import { TriagedComplaint, CorrelateCluster, CorrelatedIncident, SignalSummary } from '../types.js';
import { ResolverAdapters, OperationalSignal, ResourceBaseline } from '../../adapters/contracts.js';
import { DomainProfile, GENERAL_INQUIRY, categoryLabel, findCategory } from '../domain.js';

/** Complaints without a resource are grouped here instead of being guessed onto a real one. */
export const UNASSIGNED_RESOURCE = 'unassigned';

/** Clusters at least this size become a systemic incident. */
const SYSTEMIC_COMPLAINT_COUNT = 3;

/** A signal this many times above its baseline confirms an operational bottleneck. */
export const SIGNAL_ANOMALY_RATIO = 1.8;

export class CorrelateEngine {
  private buffer: TriagedComplaint[] = [];
  private clusters: Map<string, CorrelateCluster> = new Map();
  private incidents: Map<string, CorrelatedIncident> = new Map();

  constructor(
    private profile: DomainProfile,
    private slidingWindowHours: number = 24
  ) {}

  public getBuffer(): TriagedComplaint[] {
    this.pruneOldComplaints();
    return [...this.buffer];
  }

  public getClusters(): CorrelateCluster[] {
    return Array.from(this.clusters.values());
  }

  public getIncidents(): CorrelatedIncident[] {
    return Array.from(this.incidents.values());
  }

  public async processAndCorrelate(
    complaint: TriagedComplaint,
    adapters: ResolverAdapters
  ): Promise<{
    isSystemic: boolean;
    cluster?: CorrelateCluster;
    incident?: CorrelatedIncident;
  }> {
    // Exclude prompt injections or non-actionable complaints from correlation buffer
    if (complaint.isPromptInjection || complaint.category === GENERAL_INQUIRY) {
      return { isSystemic: false };
    }

    // 1. Add to buffer
    this.buffer.push(complaint);
    this.pruneOldComplaints();

    // 2. Identify cluster key (resource + category + item)
    const resource = complaint.resourceId || UNASSIGNED_RESOURCE;
    const item = complaint.itemId || 'general';
    const clusterKey = `${resource}::${complaint.category}::${item}`;

    // Find all complaints in the active window sharing at least 2 of {resource, category, item}
    const matchingComplaints = this.buffer.filter((c) => {
      const sameResource = (c.resourceId || UNASSIGNED_RESOURCE) === resource;
      const sameCategory = c.category === complaint.category;
      const sameItem = (c.itemId || 'general') === item;
      return (sameResource && sameCategory) || (sameResource && sameItem) || (sameCategory && sameItem);
    });
    const ticketIds = matchingComplaints.map((c) => c.id);

    // 3. Cross-reference with live operational data from the SignalSource adapter, if any
    const signal = await this.measureSignal(matchingComplaints, resource, adapters);
    const signalConfirmed = signal !== undefined && signal.average >= signal.baseline * SIGNAL_ANOMALY_RATIO;
    const isAnomalous =
      matchingComplaints.length >= SYSTEMIC_COMPLAINT_COUNT || (signalConfirmed && matchingComplaints.length >= 2);

    const cluster: CorrelateCluster = {
      clusterKey,
      resourceId: resource,
      category: complaint.category,
      itemId: complaint.itemId,
      itemName: complaint.itemName,
      complaintIds: ticketIds,
      count: matchingComplaints.length,
      signal,
      isAnomalous,
      firstSeen: matchingComplaints[0].timestamp,
      lastSeen: new Date()
    };

    this.clusters.set(clusterKey, cluster);

    // 4. If the systemic threshold is breached -> emit (or grow) one incident
    if (isAnomalous && matchingComplaints.length >= SYSTEMIC_COMPLAINT_COUNT) {
      const definition = findCategory(this.profile, complaint.category);
      const label = categoryLabel(this.profile, complaint.category);
      cluster.rootCauseHypothesis = this.describeRootCause(label, resource, matchingComplaints.length, signal, signalConfirmed);
      const summary = this.describeIncident(resource, matchingComplaints.length, signal, signalConfirmed);

      let incident = Array.from(this.incidents.values()).find(
        (inc) => inc.resourceId === resource && inc.category === complaint.category && inc.status !== 'resolved'
      );

      if (!incident) {
        incident = await adapters.ticketSink.linkTicketsToIncident(ticketIds, summary, {
          title: `🚨 Systemic ${label.toUpperCase()} at ${resource.toUpperCase()}`,
          resourceId: resource,
          category: complaint.category,
          itemId: complaint.itemId,
          itemName: complaint.itemName,
          complaintCount: matchingComplaints.length,
          signal,
          recommendedAction:
            definition?.incidentPlaybook?.replace(/\{resource\}/g, resource) ||
            `Investigate ${label.toLowerCase()} reports at ${resource} and notify the responsible manager.`
        });

        // Automatically notify the resource manager
        await adapters.ticketSink.routeToManager(incident.incidentId, resource);
        incident.managerNotified = true;

        // Categories marked as a safety risk pull the affected item until someone reviews it
        if (definition?.disableItemOnIncident && complaint.itemId && adapters.availabilityControl) {
          await adapters.availabilityControl.disableItem(
            complaint.itemId,
            resource,
            `Automated safeguard: ${matchingComplaints.length} clustered ${label.toLowerCase()} reports.`
          );
          incident.itemDisabled = true;
        }

        this.incidents.set(incident.incidentId, incident);
      } else {
        incident.complaintCount = matchingComplaints.length;
        incident.ticketIds = Array.from(new Set([...incident.ticketIds, ...ticketIds]));
        incident.signal = signal;
        incident.summary = summary;
        incident.updatedAt = new Date();
      }

      cluster.incidentId = incident.incidentId;
      matchingComplaints.forEach((c) => {
        c.incidentLinked = true;
      });
      complaint.incidentLinked = true;

      return {
        isSystemic: true,
        cluster,
        incident
      };
    }

    return {
      isSystemic: false,
      cluster
    };
  }

  private async measureSignal(
    complaints: TriagedComplaint[],
    resourceId: string,
    adapters: ResolverAdapters
  ): Promise<SignalSummary | undefined> {
    const source = adapters.signalSource;
    if (!source) return undefined;

    const readings: OperationalSignal[] = [];
    for (const c of complaints) {
      if (!c.orderId) continue;
      try {
        const reading = await source.getOrderSignal(c.orderId);
        if (reading) readings.push(reading);
      } catch {
        // One failed lookup must not block correlation
      }
    }

    let resourceBaseline: ResourceBaseline | null = null;
    try {
      resourceBaseline = await source.getResourceBaseline(resourceId, this.slidingWindowHours);
    } catch {
      // Fall back to per-order baselines below
    }

    const reference = readings[0] ?? resourceBaseline;
    const baseline = resourceBaseline?.baseline ?? readings[0]?.baseline;
    const average =
      readings.length > 0 ? readings.reduce((sum, r) => sum + r.value, 0) / readings.length : resourceBaseline?.current;
    if (!reference || baseline === undefined || average === undefined || baseline <= 0) {
      return undefined;
    }

    const roundedAverage = Number(average.toFixed(1));
    return {
      metric: reference.metric,
      label: reference.label,
      unit: reference.unit,
      average: roundedAverage,
      baseline,
      ratio: Number((roundedAverage / baseline).toFixed(2))
    };
  }

  private describeRootCause(
    label: string,
    resource: string,
    count: number,
    signal: SignalSummary | undefined,
    signalConfirmed: boolean
  ): string {
    if (signal && signalConfirmed) {
      return `Operational bottleneck detected at ${resource}. Average ${signal.label.toLowerCase()} ${signal.average} ${signal.unit} vs ${signal.baseline} ${signal.unit} baseline (${signal.ratio.toFixed(1)}x).`;
    }
    return `${count} similar ${label.toLowerCase()} reports at ${resource} within ${this.slidingWindowHours}h. Operational signals do not show a bottleneck; investigate the item or process.`;
  }

  private describeIncident(
    resource: string,
    count: number,
    signal: SignalSummary | undefined,
    signalConfirmed: boolean
  ): string {
    const base = `${count} customer complaints clustered at ${resource}.`;
    if (!signal) return base;
    const comparison = `Average ${signal.label.toLowerCase()} is ${signal.average} ${signal.unit} vs ${signal.baseline} ${signal.unit} baseline`;
    return signalConfirmed
      ? `${base} ${comparison} (${signal.ratio.toFixed(1)}x): operational delay confirmed.`
      : `${base} ${comparison}: no operational delay detected.`;
  }

  private pruneOldComplaints(): void {
    const cutoff = Date.now() - this.slidingWindowHours * 60 * 60 * 1000;
    this.buffer = this.buffer.filter((c) => new Date(c.timestamp).getTime() > cutoff);
  }
}
