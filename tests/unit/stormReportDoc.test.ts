import { describe, it, expect } from 'vitest';
import { describeStormEntry, hasStormReport, toStormReportEntry } from '@/lib/stormReportDoc';

describe('storm report helpers', () => {
  it('describes hail, wind and tornadoes in plain words', () => {
    expect(describeStormEntry({ category: 'hail', typeText: 'HAIL', magnitude: 1.75, unit: 'Inch' })).toBe('1.75 inch hail');
    expect(describeStormEntry({ category: 'wind', typeText: 'TSTM WND GST', magnitude: 62, unit: 'MPH' })).toBe('62 mph wind');
    expect(describeStormEntry({ category: 'tornado', typeText: 'TORNADO', magnitude: null, unit: null })).toBe('Tornado');
    expect(describeStormEntry({ category: 'damage', typeText: 'TSTM WND DMG', magnitude: null, unit: null })).toBe('TSTM WND DMG');
  });

  it('keeps what the page needs from a storm history report', () => {
    const e = toStormReportEntry({
      id: 'r1', source: 'ground', category: 'hail', typeText: 'HAIL', title: '', magnitude: 1, unit: 'Inch',
      lat: 40, lon: -83, distanceMiles: 2.345, direction: 'NW', validUtc: '2026-06-14T21:40:00Z', severity: 'severe',
      place: 'Westerville', state: 'OH',
    });
    expect(e).toMatchObject({ date: '2026-06-14T21:40:00Z', distanceMiles: 2.3, place: 'Westerville, OH', source: 'ground' });
  });

  it('only counts a saved report with storms in it', () => {
    expect(hasStormReport(null)).toBe(false);
    expect(hasStormReport({ entries: [] })).toBe(false);
    expect(hasStormReport({ address: 'x', radiusMiles: 10, months: 12, generatedAt: '', entries: [{}] })).toBe(true);
  });
});
