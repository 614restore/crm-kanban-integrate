import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCityState, formatCityStateZip, formatFullAddress } from '../src/lib/formatAddress';

test('an empty address formats to an empty string, not stray commas', () => {
  assert.equal(formatCityState({}), '');
  assert.equal(formatCityState({ city: '', state: '' }), '');
  assert.equal(formatCityStateZip({ city: null, state: undefined, zip: '' }), '');
  assert.equal(formatFullAddress({ address: '', city: '', state: '', zip: '' }), '');
  assert.equal(formatFullAddress({ address: '  ', city: ' ' }), '');
});

test('a complete address keeps the usual punctuation', () => {
  assert.equal(formatCityState({ city: 'Tulsa', state: 'OK' }), 'Tulsa, OK');
  assert.equal(formatCityStateZip({ city: 'Tulsa', state: 'OK', zip: '74103' }), 'Tulsa, OK 74103');
  assert.equal(
    formatFullAddress({ address: '12 Main St', city: 'Tulsa', state: 'OK', zip: '74103' }),
    '12 Main St, Tulsa, OK 74103',
  );
});

test('missing parts are skipped without leaving separators behind', () => {
  assert.equal(formatCityState({ state: 'OK' }), 'OK');
  assert.equal(formatCityState({ city: 'Tulsa' }), 'Tulsa');
  assert.equal(formatCityStateZip({ zip: '74103' }), '74103');
  assert.equal(formatFullAddress({ address: '12 Main St' }), '12 Main St');
  assert.equal(formatFullAddress({ address: '12 Main St', zip: '74103' }), '12 Main St, 74103');
  assert.equal(formatFullAddress({ city: 'Tulsa', state: 'OK' }), 'Tulsa, OK');
});
