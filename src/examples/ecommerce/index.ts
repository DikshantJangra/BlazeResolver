import { Order, OperationalSignal, ResolverAdapters, ResourceBaseline } from '../../adapters/contracts.js';
import {
  InMemoryAvailabilityControl,
  InMemoryOrderSource,
  InMemoryRefundGateway,
  InMemorySignalSource,
  InMemoryTicketSink
} from '../../adapters/memory.js';
import { ExampleDefinition } from '../types.js';
import { ECOMMERCE_PROFILE } from './profile.js';
import { ECOMMERCE_SEED_COMPLAINTS } from './seed.js';

export { ECOMMERCE_PROFILE } from './profile.js';

const WAREHOUSE_NAMES: Record<string, string> = {
  wh_east_01: 'East Coast Warehouse',
  wh_west_02: 'West Coast Warehouse'
};

const DISPATCH_TIME = { metric: 'warehouse_dispatch_time', label: 'Warehouse dispatch time', unit: 'h' };

const WAREHOUSE_BASELINES: Record<string, ResourceBaseline> = {
  wh_east_01: { ...DISPATCH_TIME, current: 8.3, baseline: 8 },
  wh_west_02: { ...DISPATCH_TIME, current: 31, baseline: 8 }
};

const SEED_ORDERS: Array<{
  id: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  sku: string;
  price: number;
  dispatchHours: number;
  status: Order['status'];
}> = [
  { id: 'ORD-5001', customerId: 'cust_ava_01', customerName: 'Ava Thompson', warehouseId: 'wh_east_01', sku: 'sku_earbuds_01', price: 79, dispatchHours: 8.2, status: 'delivered' },
  { id: 'ORD-5002', customerId: 'cust_ben_02', customerName: 'Ben Carter', warehouseId: 'wh_east_01', sku: 'sku_earbuds_01', price: 79, dispatchHours: 7.9, status: 'delivered' },
  { id: 'ORD-5003', customerId: 'cust_cara_03', customerName: 'Cara Lopez', warehouseId: 'wh_east_01', sku: 'sku_earbuds_01', price: 79, dispatchHours: 8.4, status: 'delivered' },
  { id: 'ORD-5004', customerId: 'cust_dev_04', customerName: 'Dev Patel', warehouseId: 'wh_east_01', sku: 'sku_earbuds_01', price: 79, dispatchHours: 8.1, status: 'delivered' },
  { id: 'ORD-5010', customerId: 'cust_eli_05', customerName: 'Eli Brooks', warehouseId: 'wh_west_02', sku: 'sku_speaker_04', price: 59, dispatchHours: 31, status: 'processing' },
  { id: 'ORD-5011', customerId: 'cust_fay_06', customerName: 'Fay Nguyen', warehouseId: 'wh_west_02', sku: 'sku_charger_02', price: 39, dispatchHours: 29, status: 'processing' },
  { id: 'ORD-5012', customerId: 'cust_gus_07', customerName: 'Gus Miller', warehouseId: 'wh_west_02', sku: 'sku_speaker_04', price: 59, dispatchHours: 34, status: 'processing' },
  { id: 'ORD-5020', customerId: 'cust_hal_08', customerName: 'Hal Jensen', warehouseId: 'wh_east_01', sku: 'sku_watch_03', price: 249, dispatchHours: 8.0, status: 'delivered' },
  { id: 'ORD-5021', customerId: 'cust_ivy_09', customerName: 'Ivy Chen', warehouseId: 'wh_west_02', sku: 'sku_watch_03', price: 249, dispatchHours: 9.5, status: 'delivered' },
  { id: 'ORD-5030', customerId: 'cust_jon_10', customerName: 'Jon Reyes', warehouseId: 'wh_east_01', sku: 'sku_charger_02', price: 39, dispatchHours: 7.5, status: 'delivered' },
  { id: 'ORD-5031', customerId: 'cust_kim_11', customerName: 'Kim Park', warehouseId: 'wh_west_02', sku: 'sku_speaker_04', price: 59, dispatchHours: 9.0, status: 'delivered' },
  { id: 'ORD-5040', customerId: 'cust_lea_12', customerName: 'Lea Fischer', warehouseId: 'wh_east_01', sku: 'sku_stand_05', price: 45, dispatchHours: 8.6, status: 'delivered' }
];

function buildSeedData(): { orders: Order[]; signals: OperationalSignal[] } {
  const now = Date.now();
  const skuNames = Object.fromEntries(ECOMMERCE_PROFILE.items.map((item) => [item.id, item.name]));
  const orders: Order[] = [];
  const signals: OperationalSignal[] = [];

  for (const seed of SEED_ORDERS) {
    orders.push({
      id: seed.id,
      customerId: seed.customerId,
      customerName: seed.customerName,
      resourceId: seed.warehouseId,
      resourceName: WAREHOUSE_NAMES[seed.warehouseId],
      items: [{ id: seed.sku, name: skuNames[seed.sku], quantity: 1, unitPrice: seed.price, totalPrice: seed.price }],
      totalAmount: seed.price,
      currency: 'USD',
      status: seed.status,
      orderedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
      deliveredAt: seed.status === 'delivered' ? new Date(now - 24 * 60 * 60 * 1000) : undefined,
      paymentMethod: 'card',
      paymentId: `pay_card_${seed.id}`
    });

    signals.push({
      ...DISPATCH_TIME,
      orderId: seed.id,
      resourceId: seed.warehouseId,
      value: seed.dispatchHours,
      baseline: 8,
      isAnomalous: seed.dispatchHours > 16,
      stage: 'Pick & pack',
      notes: seed.dispatchHours > 16 ? 'Packing backlog after carrier cutoff change' : 'Dispatched on schedule'
    });
  }

  return { orders, signals };
}

export function createEcommerceAdapters(): ResolverAdapters {
  const { orders, signals } = buildSeedData();
  const skuNames = Object.fromEntries(ECOMMERCE_PROFILE.items.map((item) => [item.id, item.name]));

  return {
    orderSource: new InMemoryOrderSource(orders),
    refundGateway: new InMemoryRefundGateway(ECOMMERCE_PROFILE.currency.code),
    ticketSink: new InMemoryTicketSink(),
    signalSource: new InMemorySignalSource(signals, WAREHOUSE_BASELINES),
    availabilityControl: new InMemoryAvailabilityControl(skuNames)
  };
}

export const ECOMMERCE_EXAMPLE: ExampleDefinition = {
  id: 'ecommerce',
  profile: ECOMMERCE_PROFILE,
  createAdapters: createEcommerceAdapters,
  seedComplaints: ECOMMERCE_SEED_COMPLAINTS,
  demo: {
    defaultCustomerId: 'cust_ava_01',
    sampleOrders: [
      { id: 'ORD-5001', label: 'Earbuds $79' },
      { id: 'ORD-5010', label: 'Speaker, delayed $59' },
      { id: 'ORD-5021', label: 'Smartwatch $249' },
      { id: 'ORD-5030', label: 'Charger $39' }
    ],
    samplePrompts: [
      { label: '🎧 Dead earbuds (#ORD-5001)', text: 'My earbuds from order ORD-5001 are not working at all. Please refund me.' },
      { label: '📦 Late parcel (#ORD-5010)', text: 'Where is my order ORD-5010? It is running late and tracking has not updated.' },
      { label: '⌚ Smartwatch $249 (HITL)', text: 'My smartwatch from order ORD-5021 arrived with a cracked screen. I want a full refund of $249.', tone: 'warning' },
      { label: '👨‍💼 Supervisor Transfer', text: 'This is ridiculous, transfer me to a human manager right now!', tone: 'danger' }
    ],
    complaintPlaceholder: "E.g. 'My earbuds from order ORD-5001 stopped working after a day. Please refund $79.'"
  }
};
