import { describe, it, expect } from 'vitest';
import { rewriteApiUrl } from '@/lib/apiOrigin';

const LIVE = 'https://trussctr.614restore.com';
const APP = 'capacitor://localhost';

describe('rewriteApiUrl (iPhone app server calls)', () => {
  it('sends /api paths to the live site', () => {
    expect(rewriteApiUrl('/api/send', APP, LIVE)).toBe(`${LIVE}/api/send`);
    expect(rewriteApiUrl('/api/geocode?q=Columbus', APP, LIVE)).toBe(`${LIVE}/api/geocode?q=Columbus`);
  });

  it('also catches /api addresses built from the page origin', () => {
    expect(rewriteApiUrl(`${APP}/api/send`, APP, LIVE)).toBe(`${LIVE}/api/send`);
  });

  it('leaves everything else alone', () => {
    expect(rewriteApiUrl('https://xyz.supabase.co/rest/v1/quotes', APP, LIVE)).toBe('https://xyz.supabase.co/rest/v1/quotes');
    expect(rewriteApiUrl('/assets/logo.png', APP, LIVE)).toBe('/assets/logo.png');
    expect(rewriteApiUrl('/apiary', APP, LIVE)).toBe('/apiary');
  });
});
