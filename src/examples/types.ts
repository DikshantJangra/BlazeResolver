import { ResolverAdapters } from '../adapters/contracts.js';
import { DomainProfile } from '../core/domain.js';
import { CustomerInput } from '../core/types.js';

/** Sample content the dashboard and voice console show for an example business. */
export interface ExampleDemoContent {
  defaultCustomerId: string;
  sampleOrders: Array<{ id: string; label: string }>;
  samplePrompts: Array<{ label: string; text: string; tone?: 'warning' | 'danger' }>;
  complaintPlaceholder: string;
}

/** A ready-to-run business: its profile, seeded adapters and demo complaints. */
export interface ExampleDefinition {
  id: string;
  profile: DomainProfile;
  createAdapters: () => ResolverAdapters;
  seedComplaints: CustomerInput[];
  demo: ExampleDemoContent;
}
