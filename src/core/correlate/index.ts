import { TriagedComplaint, CorrelateCluster, CorrelatedIncident } from '../types.js';
import { ResolverAdapters } from '../../adapters/contracts.js';

export class CorrelateEngine {
  private buffer: TriagedComplaint[] = [];
  private clusters: Map<string, CorrelateCluster> = new Map();
  private incidents: Map<string, CorrelatedIncident> = new Map();
  private slidingWindowHours: number;

  constructor(slidingWindowHours: number = 24) {
    this.slidingWindowHours = slidingWindowHours;
  }

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
    if (complaint.isPromptInjection || complaint.category === 'general_inquiry') {
      return { isSystemic: false };
    }

    // 1. Add to buffer
    this.buffer.push(complaint);
    this.pruneOldComplaints();

    // 2. Identify cluster key (e.g. branchId + category, or branchId + category + dishId)
    const branch = complaint.branchId || 'branch_cp_02';
    const dish = complaint.dishId || 'general';
    const clusterKey = `${branch}::${complaint.category}::${dish}`;

    // Find all complaints matching this cluster in the active window
    const matchingComplaints = this.buffer.filter(c => {
      const cBranch = c.branchId || 'branch_cp_02';
      const cDish = c.dishId || 'general';
      const sameBranch = cBranch === branch;
      const sameCategory = c.category === complaint.category;
      const sameDish = cDish === dish;

      // Match >= 2 shared dimensions (or exact cluster)
      return (sameBranch && sameCategory) || (sameBranch && sameDish) || (sameCategory && sameDish);
    });

    // 3. Cross-reference with real Operational Data (KDS Timings from OrderSource)
    let totalPrepMinutes = 0;
    let timingCount = 0;
    const ticketIds: string[] = [];

    for (const c of matchingComplaints) {
      ticketIds.push(c.id);
      if (c.orderId) {
        try {
          const timing = await adapters.orderSource.getKitchenTiming(c.orderId);
          if (timing) {
            totalPrepMinutes += timing.prepMinutes;
            timingCount++;
          }
        } catch {
          // ignore timing fetch errors for resilience
        }
      }
    }

    const branchStats = await adapters.orderSource.getBranchAveragePrepTime(branch);
    const baselinePrep = branchStats.baselineMinutes || 4.0;
    const avgKitchenPrep = timingCount > 0 ? Number((totalPrepMinutes / timingCount).toFixed(1)) : branchStats.avgMinutes || 8.5;
    const isAnomalous = matchingComplaints.length >= 3 || (avgKitchenPrep >= baselinePrep * 1.8 && matchingComplaints.length >= 2);

    const cluster: CorrelateCluster = {
      clusterKey,
      branchId: branch,
      category: complaint.category,
      dishId: complaint.dishId,
      dishName: complaint.dish,
      complaintIds: matchingComplaints.map(c => c.id),
      count: matchingComplaints.length,
      avgKitchenPrepMinutes: avgKitchenPrep,
      baselinePrepMinutes: baselinePrep,
      isAnomalous,
      firstSeen: matchingComplaints[0].timestamp,
      lastSeen: new Date()
    };

    this.clusters.set(clusterKey, cluster);

    // 4. If systemic threshold is breached (>= 3 complaints or significant delay ratio) -> Emit an Incident!
    if (isAnomalous && matchingComplaints.length >= 3) {
      cluster.rootCauseHypothesis = `KDS kitchen bottleneck detected at ${branch}. Average ticket time ${avgKitchenPrep}m vs ${baselinePrep}m standard baseline (${(avgKitchenPrep / baselinePrep).toFixed(1)}x delay).`;

      let incident = Array.from(this.incidents.values()).find(
        inc => inc.branchId === branch && inc.category === complaint.category && inc.status !== 'resolved'
      );

      const title = `🚨 Systemic ${complaint.category.replace('_', ' ').toUpperCase()} at ${branch.toUpperCase()}`;
      const summary = `${matchingComplaints.length} customer complaints clustered. KDS avg prep time is ${avgKitchenPrep} min vs ${baselinePrep} min baseline. Kitchen station delay confirmed.`;

      if (!incident) {
        // Create new incident via TicketSink adapter
        incident = await adapters.ticketSink.linkTicketsToIncident(ticketIds, summary, {
          title,
          branchId: branch,
          category: complaint.category,
          dishId: complaint.dishId,
          dishName: complaint.dish,
          complaintCount: matchingComplaints.length,
          avgTicketTimeMinutes: avgKitchenPrep,
          baselineTimeMinutes: baselinePrep,
          delayRatio: Number((avgKitchenPrep / baselinePrep).toFixed(2)),
          recommendedAction: `Inspect KDS fry/expedite station at ${branch}, dispatch shift manager, and prioritize hot thermal packaging.`
        });

        // Automatically notify branch manager
        await adapters.ticketSink.routeToManager(incident.incidentId, branch);
        incident.managerNotified = true;

        // If quality issue is severe (spoiled/bad batch), automatically 86/disable the dish
        if (complaint.category === 'quality_issue' && complaint.dishId) {
          await adapters.menuControl.disableDish(
            complaint.dishId,
            branch,
            `Automated safeguard: Clustered quality complaints (${matchingComplaints.length}) with anomalous food defect reports.`
          );
          incident.dishDisabled = true;
        }

        this.incidents.set(incident.incidentId, incident);
      } else {
        // Update existing incident count and tickets
        incident.complaintCount = matchingComplaints.length;
        incident.ticketIds = Array.from(new Set([...incident.ticketIds, ...ticketIds]));
        incident.avgTicketTimeMinutes = avgKitchenPrep;
        incident.delayRatio = Number((avgKitchenPrep / baselinePrep).toFixed(2));
        incident.updatedAt = new Date();
      }

      cluster.incidentId = incident.incidentId;

      // Mark matching complaints in buffer as incident linked
      matchingComplaints.forEach(c => {
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

  private pruneOldComplaints(): void {
    const cutoff = Date.now() - this.slidingWindowHours * 60 * 60 * 1000;
    this.buffer = this.buffer.filter(c => new Date(c.timestamp).getTime() > cutoff);
  }
}
