import { Order, OperationalSignal, ResolverAdapters, ResourceBaseline } from '../../adapters/contracts.js';
import {
  InMemoryAvailabilityControl,
  InMemoryOrderSource,
  InMemoryRefundGateway,
  InMemorySignalSource,
  InMemoryTicketSink
} from '../../adapters/memory.js';
import { ExampleDefinition } from '../types.js';
import { RESTAURANT_PROFILE } from './profile.js';
import { SEED_COMPLAINTS } from './seed.js';

export { RESTAURANT_PROFILE } from './profile.js';

const BRANCH_NAMES: Record<string, string> = {
  branch_cp_02: 'Central Flagship (Branch 2)',
  branch_ind_01: 'East Hub (Branch 1)',
  branch_kor_03: 'South Hub (Branch 3)'
};

const KITCHEN_PREP = { metric: 'kitchen_prep_time', label: 'Kitchen prep time', unit: 'min' };

const BRANCH_BASELINES: Record<string, ResourceBaseline> = {
  branch_cp_02: { ...KITCHEN_PREP, current: 12.4, baseline: 4.0 },
  branch_ind_01: { ...KITCHEN_PREP, current: 4.2, baseline: 4.0 },
  branch_kor_03: { ...KITCHEN_PREP, current: 4.8, baseline: 4.5 }
};
const DEFAULT_BASELINE: ResourceBaseline = { ...KITCHEN_PREP, current: 6.0, baseline: 4.0 };

// Sample orders used across test suites & seed complaints
const SEED_ORDERS: Array<{
  id: string;
  customerId: string;
  customerName: string;
  branchId: string;
  dishId: string;
  dishName: string;
  amount: number;
  prepMinutes: number;
}> = [
  { id: 'ord-1021', customerId: 'cust_amit_01', customerName: 'Amit Sharma', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 280, prepMinutes: 13.2 },
  { id: 'ord-1022', customerId: 'cust_priya_02', customerName: 'Priya Verma', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 280, prepMinutes: 12.8 },
  { id: 'ord-1023', customerId: 'cust_rahul_03', customerName: 'Rahul Mehta', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 295, prepMinutes: 14.1 },
  { id: 'ord-1024', customerId: 'cust_sneha_04', customerName: 'Sneha Patel', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 280, prepMinutes: 11.9 },
  { id: 'ord-1025', customerId: 'cust_vikram_05', customerName: 'Vikram Malhotra', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 310, prepMinutes: 13.5 },
  { id: 'ord-1040', customerId: 'cust_rohit_09', customerName: 'Rohit Nair', branchId: 'branch_ind_01', dishId: 'dish_dessert_05', dishName: 'Gulab Jamun (2 pcs)', amount: 260, prepMinutes: 4.1 },
  { id: 'ord-1041', customerId: 'cust_karan_10', customerName: 'Karan Mehra', branchId: 'branch_ind_01', dishId: 'dish_naan_04', dishName: 'Butter Garlic Naan', amount: 240, prepMinutes: 3.8 },
  { id: 'ord-1042', customerId: 'cust_divya_11', customerName: 'Divya Iyer', branchId: 'branch_kor_03', dishId: 'dish_paneer_03', dishName: 'Paneer Tikka Masala', amount: 320, prepMinutes: 4.5 },
  { id: 'ord-1043', customerId: 'cust_samir_12', customerName: 'Samir Joshi', branchId: 'branch_kor_03', dishId: 'dish_butter_chicken_02', dishName: 'Dal Makhani Combo', amount: 290, prepMinutes: 4.2 },
  { id: 'ord-1044', customerId: 'cust_tanvi_13', customerName: 'Tanvi Sen', branchId: 'branch_ind_01', dishId: 'dish_pizza_06', dishName: 'Classic Margherita Pizza', amount: 350, prepMinutes: 16.0 },
  { id: 'ord-1045', customerId: 'cust_manish_14', customerName: 'Manish Gupta', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Dum Biryani Box', amount: 320, prepMinutes: 15.0 },
  { id: 'ord-1046', customerId: 'cust_neha_15', customerName: 'Neha Rao', branchId: 'branch_cp_02', dishId: 'dish_paneer_03', dishName: 'Paneer Tikka Masala', amount: 260, prepMinutes: 5.0 },
  { id: 'ord-1047', customerId: 'cust_arjun_16', customerName: 'Arjun Das', branchId: 'branch_cp_02', dishId: 'dish_paneer_03', dishName: 'Paneer Tikka Masala', amount: 260, prepMinutes: 5.2 },
  { id: 'ord-1048', customerId: 'cust_kavita_21', customerName: 'Kavita Singh', branchId: 'branch_cp_02', dishId: 'dish_burger_07', dishName: 'Crispy Burger Box', amount: 280, prepMinutes: 4.0 }
];

function buildSeedData(): { orders: Order[]; signals: OperationalSignal[] } {
  const now = new Date();
  const orders: Order[] = [];
  const signals: OperationalSignal[] = [];

  for (const seed of SEED_ORDERS) {
    orders.push({
      id: seed.id,
      customerId: seed.customerId,
      customerName: seed.customerName,
      resourceId: seed.branchId,
      resourceName: BRANCH_NAMES[seed.branchId],
      items: [{ id: seed.dishId, name: seed.dishName, quantity: 1, unitPrice: seed.amount, totalPrice: seed.amount }],
      totalAmount: seed.amount,
      currency: 'INR',
      deliveryFee: 30,
      tax: 15,
      status: 'delivered',
      orderedAt: new Date(now.getTime() - 45 * 60 * 1000),
      deliveredAt: new Date(now.getTime() - 15 * 60 * 1000),
      paymentMethod: 'upi',
      paymentId: `pay_upi_${seed.id}`
    });

    const isBottleneck = seed.prepMinutes > 8.0;
    signals.push({
      ...KITCHEN_PREP,
      orderId: seed.id,
      resourceId: seed.branchId,
      value: seed.prepMinutes,
      baseline: 4.0,
      isAnomalous: isBottleneck,
      stage: seed.branchId === 'branch_cp_02' ? 'Expedite Station 2' : 'General Line 1',
      notes: isBottleneck ? 'Station backlog; heat-lamp saturation' : 'Standard prep',
      startedAt: new Date(now.getTime() - 40 * 60 * 1000),
      completedAt: new Date(now.getTime() - (40 - seed.prepMinutes) * 60 * 1000)
    });
  }

  // High value party order for HITL Money-Gate demo (₹1,450)
  orders.push({
    id: 'ord-1030',
    customerId: 'cust_ananya_08',
    customerName: 'Ananya Roy',
    resourceId: 'branch_cp_02',
    resourceName: BRANCH_NAMES.branch_cp_02,
    items: [
      { id: 'dish_butter_chicken_02', name: 'Butter Chicken (Family Pack)', quantity: 2, unitPrice: 550, totalPrice: 1100 },
      { id: 'dish_naan_04', name: 'Butter Garlic Naan (Pack of 5)', quantity: 1, unitPrice: 250, totalPrice: 250 },
      { id: 'dish_dessert_05', name: 'Gulab Jamun Platter', quantity: 1, unitPrice: 100, totalPrice: 100 }
    ],
    totalAmount: 1450,
    currency: 'INR',
    deliveryFee: 40,
    tax: 72,
    status: 'delivered',
    orderedAt: new Date(now.getTime() - 60 * 60 * 1000),
    deliveredAt: new Date(now.getTime() - 25 * 60 * 1000),
    paymentMethod: 'card',
    paymentId: 'pay_card_1030'
  });

  return { orders, signals };
}

export function createRestaurantAdapters(): ResolverAdapters {
  const { orders, signals } = buildSeedData();
  const dishNames = Object.fromEntries(RESTAURANT_PROFILE.items.map((item) => [item.id, item.name]));

  return {
    orderSource: new InMemoryOrderSource(orders),
    refundGateway: new InMemoryRefundGateway(RESTAURANT_PROFILE.currency.code),
    ticketSink: new InMemoryTicketSink(),
    signalSource: new InMemorySignalSource(signals, BRANCH_BASELINES, DEFAULT_BASELINE),
    availabilityControl: new InMemoryAvailabilityControl(dishNames)
  };
}

export const RESTAURANT_EXAMPLE: ExampleDefinition = {
  id: 'restaurant',
  profile: RESTAURANT_PROFILE,
  createAdapters: createRestaurantAdapters,
  seedComplaints: SEED_COMPLAINTS,
  demo: {
    defaultCustomerId: 'cust_amit_01',
    sampleOrders: [
      { id: 'ord-1021', label: 'Biryani ₹280' },
      { id: 'ord-1044', label: 'Pizza Delay ₹350' },
      { id: 'ord-1030', label: 'Party Pack ₹1,450' },
      { id: 'ord-1040', label: 'Gulab Jamun ₹260' }
    ],
    samplePrompts: [
      { label: '🥘 Cold Biryani (#ord-1021)', text: 'I ordered Hyderabadi Biryani on order #ord-1021 and it was delivered cold. Please process my refund.' },
      { label: '⏱️ Delayed Pizza (#ord-1044)', text: 'Where is my pizza? Order #ord-1044 is taking over 45 minutes!' },
      { label: '👑 Party Order ₹1450 (HITL)', text: 'I want a complete refund of ₹1450 for my party order #ord-1030. All curries leaked.', tone: 'warning' },
      { label: '👨‍💼 Supervisor Transfer', text: 'This service is ridiculous, transfer me to a human manager right now!', tone: 'danger' }
    ],
    complaintPlaceholder: "E.g. 'My Hyderabadi biryani in ord-1021 arrived ice cold from Branch 2! Need ₹280 refund.'"
  }
};
