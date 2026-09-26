import { CustomerInput, PipelineResult, TriagedComplaint, ResolutionAction } from '../types.js';
import { ResolverAdapters } from '../../adapters/contracts.js';
import { TriageEngine } from '../triage/index.js';
import { CorrelateEngine } from '../correlate/index.js';
import { ResolutionEngine } from '../resolve/index.js';
import { ResponseEngine } from '../respond/index.js';

export interface BlazeResolverConfig {
  autoRefundThresholdINR?: number;
  correlationSlidingWindowHours?: number;
}

export class BlazeResolverPipeline {
  private triageEngine: TriageEngine;
  private correlateEngine: CorrelateEngine;
  private resolutionEngine: ResolutionEngine;
  private responseEngine: ResponseEngine;
  private adapters: ResolverAdapters;
  private results: PipelineResult[] = [];
  private customerComplaintCounts: Map<string, number> = new Map();

  constructor(adapters: ResolverAdapters, config: BlazeResolverConfig = {}) {
    this.adapters = adapters;
    this.triageEngine = new TriageEngine();
    this.correlateEngine = new CorrelateEngine(config.correlationSlidingWindowHours || 24);
    this.resolutionEngine = new ResolutionEngine(config.autoRefundThresholdINR || 300);
    this.responseEngine = new ResponseEngine();
  }

  public getAdapters(): ResolverAdapters {
    return this.adapters;
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

  public async processBatch(inputs: CustomerInput[]): Promise<PipelineResult[]> {
    const batchResults: PipelineResult[] = [];
    for (const input of inputs) {
      const res = await this.processComplaint(input);
      batchResults.push(res);
    }
    return batchResults;
  }
}
