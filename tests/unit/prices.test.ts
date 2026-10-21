import { expect, it } from 'vitest';
import { price } from '../../apps/web/src/features/snapshot/format';
it('retains futures tick precision when formatting instrument prices', () => {
  expect(price('1.16505')).toBe('1.16505');
  expect(price('5643.25000000')).toBe('5,643.25');
});
