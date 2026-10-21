import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { db, type DbCompany } from '@/lib/database';
import { PRICE_IDS, startCheckout } from '@/lib/billing';
import { TRIAL_DAYS, TRIAL_INFO_PATH, needsCardForTrial } from '@/lib/trial';
import { PLANS } from './SubscriptionView';

// Only the owner or an admin adds the company's card.
const BILLING_ROLES = ['owner', 'admin'];

/**
 * Shown instead of the app to a new company that hasn't saved a card yet.
 * Picking a plan opens Stripe Checkout, which saves the card without
 * charging it; the plan is first charged when the free trial ends.
 */
export default function StartTrialGate({ company, onReady }: { company: DbCompany; onReady: (c: DbCompany) => void }) {
  const { profile, session, signOut } = useAuth();
  const canPay = BILLING_ROLES.includes(String(profile?.role || ''));
  const plans = PLANS.filter((p) => PRICE_IDS[p.key]);
  const [selected, setSelected] = useState<string>(() => (plans.some((p) => p.key === 'pro') ? 'pro' : plans[0]?.key ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from Stripe, the card is recorded by Stripe's webhook a moment
  // later; keep checking so the app opens as soon as it lands.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const fresh = await db.getCompany(company.id, { fresh: true });
      if (fresh && !needsCardForTrial(fresh)) onReady(fresh);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [company.id, onReady]);

  const trialEnds = company.trial_ends_at ? new Date(company.trial_ends_at) : null;
  const trialEndsLabel = trialEnds?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      await startCheckout(selected, session?.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-start sm:items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <img src="/trussctr-logo-shield.png" alt="" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Start your {TRIAL_DAYS}-day free trial</h1>
            <p className="text-sm text-gray-500">{company.name}</p>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-gray-700 mb-6">
          <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />Every feature in the plan you choose, for {TRIAL_DAYS} days.</li>
          <li className="flex gap-2"><CreditCard className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />Your card is saved securely by Stripe. <strong>Nothing is charged during the trial.</strong></li>
          <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
            <span>Cancel before {trialEndsLabel ?? `the ${TRIAL_DAYS} days are up`} and you won't be charged. Otherwise your plan starts automatically on that day.</span>
          </li>
        </ul>

        {canPay ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {plans.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelected(p.key)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    selected === p.key ? 'border-blue-600 ring-2 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  aria-pressed={selected === p.key}
                >
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-600"><span className="text-lg font-bold text-gray-900">${p.price}</span>/month after trial</p>
                  <p className="text-xs text-gray-500 mt-1">{p.userLimit === Infinity ? 'Unlimited users' : `Up to ${p.userLimit} users`}</p>
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              onClick={start}
              disabled={loading || !selected}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              Add card &amp; start free trial
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Have a promo code? Enter it on the next screen. Your bank may show a temporary $0 verification.
            </p>
          </>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            Your company's owner needs to add a card to start the free trial. Once they do, sign in again to get started.
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <a href={TRIAL_INFO_PATH} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            How the free trial works
          </a>
          <div className="flex items-center gap-3 text-gray-500">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">Terms</a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">Privacy</a>
            <button onClick={() => void signOut()} className="inline-flex items-center gap-1 hover:text-gray-700">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
