import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { GENERIC_PROFILE } from '../core/domain.js';
import { InMemoryOrderSource, InMemoryRefundGateway, InMemoryTicketSink } from '../adapters/memory.js';
import { createEcommerceAdapters, ECOMMERCE_PROFILE } from '../examples/ecommerce/index.js';
import { ECOMMERCE_SEED_COMPLAINTS } from '../examples/ecommerce/seed.js';
import { CustomerInput } from '../core/types.js';

function createEcommercePipeline() {
  const adapters = createEcommerceAdapters();
  const pipeline = new BlazeResolverPipeline(adapters, { profile: ECOMMERCE_PROFILE });
  return { adapters, pipeline };
}

function seed(id: string): CustomerInput {
  const input = ECOMMERCE_SEED_COMPLAINTS.find((c) => c.id === id);
  if (!input) throw new Error(`Missing seed ${id}`);
  return { ...input, timestamp: new Date() };
}

describe('E-commerce Example (non-restaurant business) Suite', () => {
  it('should classify product complaints with the generic categories', async () => {
    const { pipeline } = createEcommercePipeline();
    const expected: Record<string, string> = {
      shop_01: 'damaged_item',
      shop_05: 'delivery_delay',
      shop_09: 'wrong_item',
      shop_10: 'missing_item',
      shop_11: 'quality_issue',
      shop_12: 'billing_issue',
      shop_13: 'account_access',
      shop_15: 'general_inquiry'
    };

    for (const [id, category] of Object.entries(expected)) {
      const result = await pipeline.processComplaint(seed(id));
      assert.strictEqual(result.triage.category, category, `${id} should be ${category}`);
    }
  });

  it('should extract the product, warehouse and USD amount from free text', async () => {
    const { pipeline } = createEcommercePipeline();
    const result = await pipeline.processComplaint({
      id: 'free_text',
      channel: 'text',
      rawText: 'My earbuds from the east warehouse stopped working, order ORD-5002. Please refund $79.',
      customerId: 'cust_ben_02',
      timestamp: new Date()
    });

    assert.strictEqual(result.triage.itemId, 'sku_earbuds_01');
    assert.strictEqual(result.triage.resourceId, 'wh_east_01');
    assert.strictEqual(result.triage.orderId, 'ORD-5002');
    assert.strictEqual(result.triage.claimedAmount, 79);
    assert.strictEqual(result.resolution.actions[0].currency, 'USD');
    assert.ok(result.response.text.includes('$79'));
  });

  it('should turn a defective-product cluster into one incident and pause the SKU without claiming a dispatch delay', async () => {
    const { adapters, pipeline } = createEcommercePipeline();
    for (const id of ['shop_01', 'shop_02', 'shop_03', 'shop_04']) {
      await pipeline.processComplaint(seed(id));
    }

    const incidents = pipeline.getCorrelateEngine().getIncidents();
    assert.strictEqual(incidents.length, 1);
    assert.strictEqual(incidents[0].resourceId, 'wh_east_01');
    assert.strictEqual(incidents[0].complaintCount, 4);
    assert.strictEqual(incidents[0].itemDisabled, true);
    assert.strictEqual(incidents[0].signal?.metric, 'warehouse_dispatch_time');
    assert.ok(incidents[0].summary.includes('no operational delay detected'));

    const disabled = await adapters.availabilityControl!.getDisabledItems('wh_east_01');
    assert.strictEqual(disabled[0].itemId, 'sku_earbuds_01');
  });

  it('should confirm a warehouse dispatch bottleneck from the operational signal', async () => {
    const { pipeline } = createEcommercePipeline();
    let last;
    for (const id of ['shop_05', 'shop_06', 'shop_07']) {
      last = await pipeline.processComplaint(seed(id));
    }

    assert.strictEqual(last?.correlation.isSystemic, true);
    const incident = last!.correlation.incident!;
    assert.strictEqual(incident.resourceId, 'wh_west_02');
    assert.ok(incident.signal!.ratio > 3);
    assert.ok(incident.summary.includes('operational delay confirmed'));
    assert.strictEqual(last?.resolution.actions[0].actionType, 'credit');
    assert.strictEqual(last?.resolution.actions[0].amount, 5);
  });

  it('should gate refunds above the $100 store limit for human approval', async () => {
    const { pipeline } = createEcommercePipeline();
    const result = await pipeline.processComplaint(seed('shop_08'));

    assert.strictEqual(result.resolution.hitlRequired, true);
    assert.strictEqual(result.resolution.actions[0].amount, 249);
    assert.ok(result.resolution.policyDecision.rationale.includes('$100'));
    assert.ok(result.response.text.includes('$249'));
  });

  it('should run with the default generic profile and only the three required adapters', async () => {
    const adapters = {
      orderSource: new InMemoryOrderSource([
        {
          id: 'A-1001',
          customerId: 'cust_1',
          customerName: 'Sam Lee',
          resourceId: 'store_1',
          resourceName: 'Main Store',
          items: [{ id: 'sku_1', name: 'Desk Lamp', quantity: 1, unitPrice: 20, totalPrice: 20 }],
          totalAmount: 20,
          currency: 'USD',
          status: 'delivered',
          orderedAt: new Date()
        }
      ]),
      refundGateway: new InMemoryRefundGateway('USD'),
      ticketSink: new InMemoryTicketSink()
    };
    const pipeline = new BlazeResolverPipeline(adapters);
    assert.strictEqual(pipeline.getProfile().id, GENERIC_PROFILE.id);

    const result = await pipeline.processComplaint({
      id: 'generic_1',
      channel: 'text',
      rawText: 'The desk lamp from order A-1001 arrived broken.',
      customerId: 'cust_1',
      timestamp: new Date()
    });

    assert.strictEqual(result.triage.category, 'damaged_item');
    assert.strictEqual(result.triage.orderId, 'A-1001');
    assert.strictEqual(result.resolution.actions[0].approvalStatus, 'executed');
    assert.strictEqual(result.resolution.actions[0].amount, 20);
  });

  it('should keep the core engine free of restaurant-specific vocabulary', () => {
    const coreDir = join(import.meta.dirname, '..', 'core');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.ts')) files.push(path);
      }
    };
    walk(coreDir);

    for (const file of files) {
      const match = readFileSync(file, 'utf-8').match(/\b(dish|branch|kitchen|kds|menu|biryani)\w*|₹|\bINR\b/i);
      assert.strictEqual(match?.[0], undefined, `${file} contains restaurant-specific term "${match?.[0]}"`);
    }
  });
});
