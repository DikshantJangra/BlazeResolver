import { ExampleDefinition } from './types.js';
import { RESTAURANT_EXAMPLE } from './restaurant/index.js';
import { ECOMMERCE_EXAMPLE } from './ecommerce/index.js';

export type { ExampleDefinition, ExampleDemoContent } from './types.js';

export const EXAMPLES: Record<string, ExampleDefinition> = {
  [RESTAURANT_EXAMPLE.id]: RESTAURANT_EXAMPLE,
  [ECOMMERCE_EXAMPLE.id]: ECOMMERCE_EXAMPLE
};

export function loadExample(id: string = 'restaurant'): ExampleDefinition {
  const example = EXAMPLES[id];
  if (!example) {
    throw new Error(`Unknown example "${id}". Available examples: ${Object.keys(EXAMPLES).join(', ')}`);
  }
  return example;
}
