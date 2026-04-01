import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePipelineStatus } from '../src/lib/pipelineStatus';

test('normalizePipelineStatus maps known aliases to canonical statuses', () => {
  assert.equal(normalizePipelineStatus('new_lead'), 'lead');
  assert.equal(normalizePipelineStatus('appointment_set'), 'appt_set');
  assert.equal(normalizePipelineStatus('inspection_scheduled'), 'appt_set');
  assert.equal(normalizePipelineStatus('inspection_complete'), 'inspection_completed');
  assert.equal(normalizePipelineStatus('signed_won'), 'signed');
  assert.equal(normalizePipelineStatus('paid'), 'completed');
});

test('normalizePipelineStatus preserves canonical values and handles spacing/case', () => {
  assert.equal(normalizePipelineStatus(' signed '), 'signed');
  assert.equal(normalizePipelineStatus('LEAD'), 'lead');
});

test('normalizePipelineStatus handles empty input', () => {
  assert.equal(normalizePipelineStatus(undefined), undefined);
  assert.equal(normalizePipelineStatus(null), undefined);
  assert.equal(normalizePipelineStatus(''), undefined);
});
