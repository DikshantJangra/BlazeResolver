import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { createRestaurantAdapters, RESTAURANT_PROFILE } from '../examples/restaurant/index.js';
import { getVoiceToolDeclarations, executeVoiceTool } from '../channels/voice/tools.js';
import { generateTonePcm24k, calculatePcmRms, bufferToBase64 } from '../channels/voice/pcm-utils.js';

describe('BlazeResolver Voice Layer Suite', () => {
  const adapters = createRestaurantAdapters();
  const pipeline = new BlazeResolverPipeline(adapters, {
    profile: RESTAURANT_PROFILE,
    correlationSlidingWindowHours: 24
  });

  test('should provide valid Gemini Multimodal Live API tool declarations', () => {
    const tools = getVoiceToolDeclarations();
    assert.strictEqual(Array.isArray(tools), true);
    assert.strictEqual(tools.length >= 5, true);

    const toolNames = tools.map((t) => t.name);
    assert.strictEqual(toolNames.includes('lookup_order'), true);
    assert.strictEqual(toolNames.includes('process_refund'), true);
    assert.strictEqual(toolNames.includes('file_complaint'), true);
    assert.strictEqual(toolNames.includes('escalate_to_human'), true);
    assert.strictEqual(toolNames.includes('check_incident_status'), true);
  });

  test('lookup_order tool should return order items and operational signal', async () => {
    const result = await executeVoiceTool(
      'lookup_order',
      { orderId: 'ord-1021' },
      { pipeline, adapters, customerId: 'cust_amit_01' }
    );

    assert.strictEqual((result as any).found, true);
    assert.strictEqual((result as any).orderId, 'ord-1021');
    assert.strictEqual((result as any).totalAmount, 280);
    assert.strictEqual((result as any).currency, 'INR');
    assert.strictEqual(Array.isArray((result as any).items), true);
    assert.strictEqual((result as any).operationalSignal.isAnomalous, true);
  });

  test('process_refund tool should auto-approve amounts <= ₹300', async () => {
    const result = await executeVoiceTool(
      'process_refund',
      { orderId: 'ord-1021', amount: 280, reason: 'Cold biryani delivered' },
      { pipeline, adapters, customerId: 'cust_amit_01' }
    );

    assert.strictEqual((result as any).status, 'approved_and_processed');
    assert.strictEqual((result as any).amount, 280);
    assert.strictEqual(typeof (result as any).refundId, 'string');
  });

  test('process_refund tool should route amounts > ₹300 to MoneyGate HITL queue', async () => {
    const result = await executeVoiceTool(
      'process_refund',
      { orderId: 'ord-1030', amount: 1450, reason: 'Family party order spilled' },
      { pipeline, adapters, customerId: 'cust_ananya_08' }
    );

    assert.strictEqual((result as any).status, 'hitl_gated');
    assert.strictEqual((result as any).requiresSupervisorApproval, true);
    assert.strictEqual((result as any).amount, 1450);

    const hitlQueue = pipeline.getResolutionEngine().getHitlQueue();
    const queuedAction = hitlQueue.find((a) => a.orderId === 'ord-1030');
    assert.strictEqual(Boolean(queuedAction), true);
    assert.strictEqual(queuedAction?.amount, 1450);
  });

  test('escalate_to_human tool should create urgent supervisor ticket', async () => {
    const result = await executeVoiceTool(
      'escalate_to_human',
      { orderId: 'ord-1021', reason: 'Customer demanded manager immediately', urgency: 'urgent' },
      { pipeline, adapters, customerId: 'cust_amit_01' }
    );

    assert.strictEqual((result as any).escalated, true);
    assert.strictEqual((result as any).assignedSupervisor, 'DJ (Senior Operations Lead)');
    assert.strictEqual((result as any).priority, 'urgent');
  });

  test('PCM audio utilities should generate and calculate audio energy correctly', () => {
    const pcmBuffer = generateTonePcm24k(440, 500);
    assert.strictEqual(pcmBuffer.length, (24000 * 500 / 1000) * 2);

    const rms = calculatePcmRms(pcmBuffer);
    assert.strictEqual(rms > 0, true);

    const base64Str = bufferToBase64(pcmBuffer);
    assert.strictEqual(typeof base64Str, 'string');
    assert.strictEqual(base64Str.length > 0, true);
  });
});
