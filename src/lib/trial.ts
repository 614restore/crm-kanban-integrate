import type { DbCompany } from './database';

/** Length of the TrussCTR free trial (the companies.trial_ends_at default in the database). */
export const TRIAL_DAYS = 7;

/**
 * Companies created from this moment on save a card before they start using
 * the web app. Companies created earlier keep working as they did (no card
 * asked for up front), so nobody already using TrussCTR is interrupted.
 */
export const CARD_REQUIRED_SINCE = new Date('2026-10-21T12:00:00Z');

/** The public page explaining the free trial. */
export const TRIAL_INFO_PATH = '/trial';

/**
 * Whether this company must save a card (pick a plan in Stripe Checkout)
 * before using the web app: a new company still on its trial with no Stripe
 * subscription, and not paying through the App Store.
 */
export function needsCardForTrial(company: DbCompany | null | undefined): boolean {
  if (!company) return false;
  if ((company.subscription_status ?? 'trialing') !== 'trialing') return false;
  if (company.stripe_subscription_id) return false;
  // Subscribed through Apple in the TrussCENTER app.
  if ((company as any).subscription_product_id) return false;
  if (!company.created_at || new Date(company.created_at) < CARD_REQUIRED_SINCE) return false;
  return true;
}

/** True while a trial with a saved card is running (Stripe charges when it ends). */
export function hasCardOnTrial(company: DbCompany | null | undefined): boolean {
  return !!company && company.subscription_status === 'trialing' && !!company.stripe_subscription_id;
}
