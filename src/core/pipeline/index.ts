import { CorrelatedIncident, CustomerInput, PipelineResult, TriagedComplaint } from '../types.js';
import { ResolverAdapters } from '../../adapters/contracts.js';
import { DomainProfile, GENERIC_PROFILE } from '../domain.js';
import { TriageEngine } from '../triage/index.js';
import { CorrelateEngine } from '../correlate/index.js';
import { ResolutionEngine } from '../resolve/index.js';
import { ResponseEngine } from '../respond/index.js';
import { CodeFixer, CodeFixHandoff, isSoftwareDefect, toBugIncident } from '../code-fix/index.js';

export interface BlazeResolverConfig {
  /** Business vocabulary and policy. Defaults to GENERIC_PROFILE. */
  profile?: DomainProfile;
  /** Overrides profile.moneyPolicy.autoApproveThreshold. */
  autoApproveThreshold?: number;
  /** Overrides profile.moneyPolicy.maxCreditAmount. */
  maxCreditAmount?: number;
  correlationSlidingWindowHours?: number;
  /**
   * Bug-fix loop for incidents caused by the product's own code (see CategoryDefinition.softwareDefect).
   * Each such incident is handed off once, in the background; the fix ends waiting for human review.
   */
  bugResolver?: CodeFixer;
}

export class BlazeResolverPipeline {
  private profile: DomainProfile;
  private triageEngine: TriageEngine;
  private correlateEngine: CorrelateEngine;
  private resolutionEngine: ResolutionEngine;
  private responseEngine: ResponseEngine;
  private adapters: ResolverAdapters;
  private results: PipelineResult[] = [];
  private customerComplaintCounts: Map<string, number> = new Map();
  private bugResolver?: CodeFixer;
  private codeFixes: Map<string, { handoff: CodeFixHandoff; done: Promise<CodeFixHandoff> }> = new Map();

  constructor(adapters: ResolverAdapters, config: BlazeResolverConfig = {}) {
    this.adapters = adapters;
    this.profile = config.profile ?? GENERIC_PROFILE;
    this.triageEngine = new TriageEngine(this.profile);
    this.correlateEngine = new CorrelateEngine(this.profile, config.correlationSlidingWindowHours || 24);
    this.resolutionEngine = new ResolutionEngine(this.profile, {
      autoApproveThreshold: config.autoApproveThreshold ?? this.profile.moneyPolicy.autoApproveThreshold,
      maxCreditAmount: config.maxCreditAmount ?? this.profile.moneyPolicy.maxCreditAmount
    });
    this.responseEngine = new ResponseEngine(this.profile);
    this.bugResolver = config.bugResolver;
  }

  public getProfile(): DomainProfile {
    return this.profile;
  }

  public getAdapters(): ResolverAdapters {
    return this.adapters;
  }

  public getTriageEngine(): TriageEngine {
    return this.triageEngine;
  }

  public getCorrelateEngine(): CorrelateEngine {
    return this.correlateEngine;
  }

  public getResolutionEngine(): ResolutionEngine {
    return this.resolutionEngine;
  }

  public getResults(): PipelineResult[] {
    return [...this.results];
  }

  /** Incidents handed to the bug-fix loop, with their current status. */
  public getCodeFixes(): CodeFixHandoff[] {
    return Array.from(this.codeFixes.values(), ({ handoff }) => ({ ...handoff }));
  }

  /** Resolves when the bug-fix loop finishes for the incident; undefined if it was never handed off. */
  public async waitForCodeFix(incidentId: string): Promise<CodeFixHandoff | undefined> {
    const fix = this.codeFixes.get(incidentId);
    return fix && { ...(await fix.done) };
  }

  public async processComplaint(input: CustomerInput): Promise<PipelineResult> {
    const startTime = Date.now();

    // 1. TRIAGE STAGE
    const triaged: TriagedComplaint = await this.triageEngine.triage(input);

    // Track customer velocity
    const customerKey = triaged.customerId || triaged.input.customerId || 'anon';
    const currentCount = (this.customerComplaintCounts.get(customerKey) || 0) + 1;
    this.customerComplaintCounts.set(customerKey, currentCount);

    // 2. CORRELATE STAGE (The Differentiator)
    const correlation = await this.correlateEngine.processAndCorrelate(triaged, this.adapters);
    if (correlation.incident) {
      this.startCodeFix(correlation.incident);
    }

    // 3. RESOLVE STAGE (Policy-bounded & Money-gated)
    const resolution = await this.resolutionEngine.resolve(
      triaged,
      this.adapters,
      currentCount
    );

    // 4. RESPOND STAGE (Quality Review & Tone Adaptation)
    const response = this.responseEngine.generateResponse(
      triaged,
      resolution,
      input.channel,
      correlation.isSystemic
    );

    const result: PipelineResult = {
      complaintId: triaged.id,
      input,
      triage: triaged,
      correlation,
      resolution,
      response,
      executionDurationMs: Date.now() - startTime,
      timestamp: new Date()
    };

    this.results.unshift(result);
    return result;
  }

  /** Hands a code-caused incident to the bug-fix loop once, without holding up complaint handling. */
  private startCodeFix(incident: CorrelatedIncident): void {
    if (!this.bugResolver || this.codeFixes.has(incident.incidentId) || !isSoftwareDefect(incident, this.profile)) {
      return;
    }

    const handoff: CodeFixHandoff = {
      incidentId: incident.incidentId,
      incident: toBugIncident(incident, this.correlateEngine.getBuffer(), this.profile),
      status: 'running',
      startedAt: new Date()
    };
    const bugResolver = this.bugResolver;
    // Started on a later tick so the complaint's own response never waits on the fix.
    const done = Promise.resolve().then(() => bugResolver.resolve(handoff.incident)).then(
      (result) => {
        handoff.result = result;
        handoff.status = result.status;
        handoff.finishedAt = new Date();
        return handoff;
      },
      (err) => {
        handoff.status = 'FAILED';
        handoff.finishedAt = new Date();
        handoff.result = {
          status: 'FAILED',
          incident: handoff.incident,
          attempts: [],
          failureReason: err instanceof Error ? err.message : String(err)
        };
        return handoff;
      }
    );
    this.codeFixes.set(incident.incidentId, { handoff, done });
  }

  public async processBatch(inputs: CustomerInput[]): Promise<PipelineResult[]> {
    const batchResults: PipelineResult[] = [];
    for (const input of inputs) {
      const res = await this.processComplaint(input);
      batchResults.push(res);
    }
    return batchResults;
  }
}
