// Copied from QuoteMGR src/lib/planLimits.ts (read-only reference).
/**
 * Seat allowances per subscription tier.
 *
 * Kept identical to src/lib/planLimits.ts in the iOS app and to the PLAN_LIMITS
 * block in the create-team-member edge function, so the paywall, both team
 * screens and the server all quote the same numbers.
 *
 * Canvasser seats are 5 on every tier — what the billing page has always
 * advertised, and what the previous hardcoded cap of 5 actually enforced.
 */

export type PlanTier = 'starter' | 'professional' | 'business' | 'enterprise';

/**
 * Billing writes plan names from two vocabularies. RevenueCat (Apple) writes
 * subscription_tier as starter/professional/business; Stripe (web) writes
 * subscription_plan and its price-id fallback emits 'pro', not 'professional'.
 * Without this map a Stripe Professional customer matched nothing and got no
 * seat enforcement at all.
 *
 * 'standard' is the legacy name for Starter and maps to it.
 */
const TIER_ALIASES: Record<string, PlanTier> = {
  // 'standard' is the legacy name for Starter, still present in
  // subscription_tier on older accounts.
  standard: 'starter',
  pro: 'professional',
  professional: 'professional',
  starter: 'starter',
  business: 'business',
  enterprise: 'enterprise',
};

/** Normalises whatever billing wrote into a tier this app understands. */
export const normalizeTier = (raw: string | null | undefined): PlanTier | null =>
  (raw && TIER_ALIASES[raw.trim().toLowerCase()]) || null;

/**
 * Tiers whose pricing promises white-labelling, and so may hide the
 * "Designed with QuoteMGR & TrussCTR" line on customer documents. Business advertises
 * "White-label options" and Enterprise "Full white-label"; Starter and
 * Professional do not, so the toggle is theirs to upgrade for.
 */
export const WHITE_LABEL_TIERS: readonly PlanTier[] = ['business', 'enterprise'];

export const canHideBranding = (tier: PlanTier | null | undefined): boolean =>
  !!tier && WHITE_LABEL_TIERS.includes(tier);

export interface PlanLimits {
  /** Total active members, every role included. */
  teamMembers: number;
  /** Active members with role = canvasser, counted within teamMembers. */
  canvassers: number;
}

/**
 * Partial on purpose: 'enterprise' has no entry, so limitsForTier falls through
 * to UNLIMITED for it. Enterprise advertises unlimited team members, and giving
 * it a number here would be the one way to accidentally cap it.
 */
export const PLAN_LIMITS: Partial<Record<PlanTier, PlanLimits>> = {
  starter: { teamMembers: 3, canvassers: 5 },
  professional: { teamMembers: 10, canvassers: 5 },
  business: { teamMembers: 25, canvassers: 5 },
};

/**
 * Used when the tier is not one of the three published plans — Enterprise, a
 * trial, or a value added later that this build has not heard of.
 *
 * Deliberately unlimited. Enforcement that failed closed would lock an
 * Enterprise customer, whose plan advertises unlimited team members, out at
 * three. Only tiers with a published allowance are capped.
 */
export const UNLIMITED: PlanLimits = {
  teamMembers: Number.POSITIVE_INFINITY,
  canvassers: Number.POSITIVE_INFINITY,
};

export const limitsForTier = (tier: PlanTier | null | undefined): PlanLimits =>
  (tier && PLAN_LIMITS[tier]) || UNLIMITED;

export const tierLabel = (tier: PlanTier | null | undefined): string => {
  switch (tier) {
    case 'starter':
      return 'Starter';
    case 'professional':
      return 'Professional';
    case 'business':
      return 'Business';
    case 'enterprise':
      return 'Enterprise';
    default:
      return 'No active plan';
  }
};

export interface SeatUsage {
  activeMembers: number;
  activeCanvassers: number;
  limits: PlanLimits;
  atMemberLimit: boolean;
  atCanvasserLimit: boolean;
}

/**
 * Counts only active members. A deactivated member keeps their history — that
 * is the point of deactivating rather than deleting — but must not keep
 * consuming a seat.
 */
export const seatUsage = (
  members: Array<{ role?: string | null; is_active?: boolean | null }>,
  tier: PlanTier | null | undefined,
): SeatUsage => {
  const limits = limitsForTier(tier);
  const active = members.filter((m) => m.is_active !== false);
  const activeMembers = active.length;
  const activeCanvassers = active.filter((m) => m.role === 'canvasser').length;
  return {
    activeMembers,
    activeCanvassers,
    limits,
    atMemberLimit: activeMembers >= limits.teamMembers,
    atCanvasserLimit: activeCanvassers >= limits.canvassers,
  };
};
