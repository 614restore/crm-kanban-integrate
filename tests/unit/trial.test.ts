import { describe, it, expect } from 'vitest';
import { needsCardForTrial, hasCardOnTrial, CARD_REQUIRED_SINCE } from '@/lib/trial';

const after = new Date(CARD_REQUIRED_SINCE.getTime() + 60_000).toISOString();
const before = new Date(CARD_REQUIRED_SINCE.getTime() - 60_000).toISOString();
const company = (extra: Record<string, unknown> = {}) =>
  ({ id: 'c1', name: 'Co', created_at: after, subscription_status: 'trialing', ...extra }) as any;

describe('needsCardForTrial', () => {
  it('a new company on its trial with no card must add one', () => {
    expect(needsCardForTrial(company())).toBe(true);
  });

  it('companies from before cards were required are left alone', () => {
    expect(needsCardForTrial(company({ created_at: before }))).toBe(false);
  });

  it('not once a card is saved, the plan is paid, or it pays through Apple', () => {
    expect(needsCardForTrial(company({ stripe_subscription_id: 'sub_1' }))).toBe(false);
    expect(needsCardForTrial(company({ subscription_status: 'active' }))).toBe(false);
    expect(needsCardForTrial(company({ subscription_product_id: 'com.app.pro' }))).toBe(false);
    expect(needsCardForTrial(null)).toBe(false);
  });
});

describe('hasCardOnTrial', () => {
  it('only while trialing with a Stripe subscription', () => {
    expect(hasCardOnTrial(company({ stripe_subscription_id: 'sub_1' }))).toBe(true);
    expect(hasCardOnTrial(company())).toBe(false);
    expect(hasCardOnTrial(company({ subscription_status: 'active', stripe_subscription_id: 'sub_1' }))).toBe(false);
  });
});
