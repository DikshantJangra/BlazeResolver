import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { formatMoney } from '../core/domain.js';
import { loadExample } from '../examples/index.js';

async function runCliDemo() {
  const example = loadExample(process.argv[2] || process.env.BLAZE_EXAMPLE);
  const { profile, seedComplaints } = example;
  const money = (amount: number) => formatMoney(amount, profile.currency);

  console.log('\x1b[36m%s\x1b[0m', '\n======================================================');
  console.log('\x1b[33m%s\x1b[0m', '   🔥 BLAZERESOLVER — END-TO-END PIPELINE RUNNER 🔥   ');
  console.log('\x1b[36m%s\x1b[0m', '======================================================\n');
  console.log(`Profile: ${profile.name} (${profile.currency.code})`);
  console.log('Initializing adapters (OrderSource, RefundGateway, TicketSink, SignalSource, AvailabilityControl)...\n');

  const adapters = example.createAdapters();
  const pipeline = new BlazeResolverPipeline(adapters, {
    profile,
    correlationSlidingWindowHours: 24
  });
  const threshold = pipeline.getResolutionEngine().getAutoApproveThreshold();

  console.log(`Feeding ${seedComplaints.length} messy multi-channel complaints into the pipeline...\n`);

  for (let i = 0; i < seedComplaints.length; i++) {
    const input = seedComplaints[i];
    console.log('\x1b[90m%s\x1b[0m', `------------------------------------------------------`);
    console.log(`[#${i + 1}/${seedComplaints.length}] Channel: \x1b[35m${input.channel.toUpperCase()}\x1b[0m | ID: ${input.id}`);
    console.log(`Customer: "${input.rawText}"`);

    const res = await pipeline.processComplaint({
      ...input,
      timestamp: new Date()
    });

    // 1. TRIAGE
    console.log(`  \x1b[34m[1. TRIAGE]\x1b[0m Intent: ${res.triage.intent} | Category: \x1b[33m${res.triage.category}\x1b[0m | Severity: ${res.triage.severity}`);
    if (res.triage.isPromptInjection) {
      console.log(`  \x1b[41m\x1b[37m[SECURITY]\x1b[0m 🛑 PROMPT INJECTION BLOCKED: ${res.triage.guardrailViolationReason}`);
    }

    // 2. CORRELATE
    if (res.correlation.isSystemic && res.correlation.incident) {
      const inc = res.correlation.incident;
      console.log(`  \x1b[45m\x1b[37m[2. CORRELATE — SYSTEMIC ANOMALY DETECTED]\x1b[0m 🚨`);
      console.log(`      Incident: ${inc.title}`);
      if (inc.signal) {
        console.log(`      ${inc.signal.label}: \x1b[31m${inc.signal.average} ${inc.signal.unit}\x1b[0m vs Baseline: \x1b[32m${inc.signal.baseline} ${inc.signal.unit}\x1b[0m (${inc.signal.ratio}x)`);
      }
      console.log(`      Action: Consolidated ${inc.complaintCount} tickets -> Alerted ${profile.labels.resource} Manager @ ${inc.resourceId}${inc.itemDisabled ? ` | ${profile.labels.item} ${inc.itemId} disabled` : ''}`);
    } else {
      console.log(`  \x1b[90m[2. CORRELATE]\x1b[0m Isolated incident (Cluster count: ${res.correlation.cluster?.count || 1})`);
    }

    // 3. RESOLVE
    const action = res.resolution.actions[0];
    if (action) {
      if (action.approvalStatus === 'auto_approved' || action.approvalStatus === 'executed') {
        console.log(`  \x1b[32m[3. RESOLVE]\x1b[0m ✅ Auto-Executed: \x1b[32m${action.actionType.toUpperCase()}\x1b[0m (${money(action.amount || 0)}) | IdempotencyKey: ${action.idempotencyKey.substring(0, 22)}...`);
      } else if (action.approvalStatus === 'pending_human') {
        console.log(`  \x1b[33m[3. RESOLVE]\x1b[0m ⚠️ MONEY-GATE ACTIVATED: Claim ${money(action.amount || 0)} > ${money(threshold)} threshold -> Gated for Human Approval`);
      } else {
        console.log(`  \x1b[31m[3. RESOLVE]\x1b[0m Action: ${action.actionType} (${action.approvalStatus})`);
      }
    }

    // 4. RESPOND
    console.log(`  \x1b[36m[4. RESPOND]\x1b[0m "${res.response.text.substring(0, 100)}..."`);
    console.log(`  \x1b[90mExecution Latency: ${res.executionDurationMs}ms\x1b[0m\n`);
  }

  // Summary
  const incidents = pipeline.getCorrelateEngine().getIncidents();
  const hitlQueue = pipeline.getResolutionEngine().getHitlQueue();
  const history = pipeline.getResolutionEngine().getExecutionHistory();
  const consolidated = incidents.reduce((sum, inc) => sum + inc.complaintCount, 0);

  console.log('\x1b[36m%s\x1b[0m', '\n======================================================');
  console.log('\x1b[32m%s\x1b[0m', '                  DEMO SUMMARY RESULTS                ');
  console.log('\x1b[36m%s\x1b[0m', '======================================================');
  console.log(`Total Complaints Processed : ${seedComplaints.length}`);
  console.log(`Systemic Incidents Formed  : \x1b[35m${incidents.length}\x1b[0m (Consolidated ${consolidated} tickets into ${incidents.length} root-cause alerts)`);
  console.log(`Pending HITL Approvals     : \x1b[33m${hitlQueue.length}\x1b[0m (High-value claims held for human signoff)`);
  console.log(`Automated Safe Mutations   : \x1b[32m${history.filter(h => h.approvalStatus === 'executed' && h.actionType !== 'reject_adversarial').length}\x1b[0m`);
  console.log(`Adversarial Attacks Defended: \x1b[31m${history.filter(h => h.actionType === 'reject_adversarial').length}\x1b[0m\n`);
}

runCliDemo().catch(console.error);
