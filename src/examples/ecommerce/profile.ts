import { DomainProfile, GENERIC_PROFILE } from '../../core/domain.js';

/** The generic product profile with an electronics catalog, two warehouses and store-specific limits. */
export const ECOMMERCE_PROFILE: DomainProfile = {
  ...GENERIC_PROFILE,
  id: 'ecommerce',
  name: 'Online electronics store',
  labels: { business: 'online electronics store', item: 'Product', resource: 'Warehouse' },
  moneyPolicy: { autoApproveThreshold: 100, maxCreditAmount: 50, loyalCustomerSpend: 500 },
  items: [
    { id: 'sku_earbuds_01', name: 'Wireless Earbuds Pro', aliases: ['earbuds', 'earbud', 'earphones'] },
    { id: 'sku_charger_02', name: '65W USB-C Charger', aliases: ['charger', 'power adapter'] },
    { id: 'sku_watch_03', name: 'Fitness Smartwatch', aliases: ['smartwatch', 'smart watch', 'fitness watch'] },
    { id: 'sku_speaker_04', name: 'Bluetooth Speaker', aliases: ['speaker'] },
    { id: 'sku_stand_05', name: 'Aluminium Laptop Stand', aliases: ['laptop stand'] }
  ],
  resources: [
    { id: 'wh_east_01', name: 'East Coast Warehouse', aliases: ['east warehouse', 'east coast'] },
    { id: 'wh_west_02', name: 'West Coast Warehouse', aliases: ['west warehouse', 'west coast'] }
  ]
};
