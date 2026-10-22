import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages } from '../src/lib/fetchAllPages';

// A fake table of n rows served in ranges, recording each range asked for.
function table(n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { fetchPage, calls };
}

test('returns every row past the page size', async () => {
  const { fetchPage, calls } = table(2350);
  const rows = await fetchAllPages(fetchPage, 1000);
  assert.equal(rows?.length, 2350);
  assert.deepEqual(rows?.map((r) => r.id), Array.from({ length: 2350 }, (_, i) => i));
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('a table of exactly one page asks once more and stops on the empty page', async () => {
  const { fetchPage, calls } = table(1000);
  assert.equal((await fetchAllPages(fetchPage, 1000))?.length, 1000);
  assert.equal(calls.length, 2);
});

test('an empty table returns an empty list, not a failure', async () => {
  const { fetchPage } = table(0);
  assert.deepEqual(await fetchAllPages(fetchPage, 1000), []);
});

test('a failed page returns null so the caller keeps what it has', async () => {
  let n = 0;
  const rows = await fetchAllPages(async (from, to) => {
    n++;
    if (n === 2) return { data: null, error: new Error('timeout') };
    return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null };
  }, 10);
  assert.equal(rows, null);
});
