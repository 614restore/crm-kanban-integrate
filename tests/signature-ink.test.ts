import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addInk, hasEnoughInk, MIN_SIGNATURE_INK } from '../src/lib/signatureInk';

// Draws through the points as one stroke and returns the ink, the way the pad accumulates it.
function strokeInk(points: Array<[number, number]>, start = 0): number {
  let total = start;
  for (let i = 1; i < points.length; i++) {
    total = addInk(total, { x: points[i - 1][0], y: points[i - 1][1] }, { x: points[i][0], y: points[i][1] });
  }
  return total;
}

test('a tap draws no ink and is not a signature', () => {
  assert.equal(strokeInk([[50, 50]]), 0);
  assert.equal(hasEnoughInk(0), false);
});

test('two stray taps with a tiny wobble are not a signature', () => {
  const ink = strokeInk([[50, 50], [51, 51]], strokeInk([[80, 52], [81, 52]]));
  assert.equal(hasEnoughInk(ink), false);
});

test('a real stroke is a signature', () => {
  const ink = strokeInk([[10, 60], [40, 40], [70, 70], [100, 45], [130, 65]]);
  assert.ok(ink > MIN_SIGNATURE_INK);
  assert.equal(hasEnoughInk(ink), true);
});

test('short strokes add up across a signature', () => {
  let ink = strokeInk([[10, 10], [25, 10]]);
  assert.equal(hasEnoughInk(ink), false);
  ink = strokeInk([[30, 10], [60, 10]], ink);
  assert.equal(hasEnoughInk(ink), true);
});
