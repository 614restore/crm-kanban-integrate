import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TRIAL_DAYS } from '@/lib/trial';

const HOURS = TRIAL_DAYS * 24;
const SUPPORT_EMAIL = 'devmgr.app@gmail.com';

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Is my card charged when I sign up?',
    a: <>No. Your card is saved, not charged. Your bank may briefly show a $0 verification, which is not a payment. The first charge happens when your {TRIAL_DAYS}-day trial ends, and only if you haven't cancelled.</>,
  },
  {
    q: 'Can I change plans during the trial?',
    a: <>Yes. Go to Settings → Subscription Plan → Manage Billing. Whichever plan you are on when the trial ends is the one that's charged.</>,
  },
  {
    q: 'What happens to my data if I cancel?',
    a: <>Nothing is deleted right away. Your account becomes read-only, so you can still sign in to view and export your contacts, quotes and documents. Your data is kept for 30 days after your account ends, as described in our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.</>,
  },
  {
    q: 'I was charged after my trial ended. Can I get a refund?',
    a: <>Refunds are handled case by case. Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">{SUPPORT_EMAIL}</a> and we'll take a look.</>,
  },
  {
    q: 'I subscribed in the TrussCENTER iPhone app. Does this apply to me?',
    a: <>Purchases made in the iPhone app are billed by Apple, not by us. Any trial and its timing are shown by Apple when you subscribe. Manage or cancel those subscriptions in your iPhone's Settings → your name → Subscriptions.</>,
  },
];

export default function FreeTrial() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 font-medium"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">The TrussCTR {TRIAL_DAYS}-day free trial</h1>
          <p className="text-gray-600 mb-8">
            What's included, how the {HOURS}-hour clock works, how to cancel, and what happens if you don't.
          </p>

          <div className="space-y-8 text-gray-700">
            <p>
              TrussCTR's free trial gives you {TRIAL_DAYS} days to run your real jobs, customers and quotes through the
              full platform before anything is charged.
            </p>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">What's included</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Every feature in the plan you pick when you sign up: contacts, pipeline boards, quotes and e-signatures, inspection reports, documents, calendar, storm data and more</li>
                <li>The plan's full team size, so you can invite your crew</li>
                <li>No charge during the {TRIAL_DAYS}-day ({HOURS}-hour) trial period</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Why a credit card is required</h2>
              <p>
                We ask for a card at sign-up so TrussCTR keeps running without interruption if you decide to stay. No
                payment is taken during the trial. Your card is saved securely by our payment processor, Stripe, not
                charged. Cancel before the {TRIAL_DAYS} days are up and you won't be billed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How long the trial lasts</h2>
              <p>
                Your trial lasts exactly {TRIAL_DAYS} days ({HOURS} hours) from the moment you create your account, not
                {' '}{TRIAL_DAYS} calendar days. Your trial's end date is shown in Settings → Subscription Plan.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How to cancel before you're charged</h2>
              <p>You can cancel at any time during the trial:</p>
              <ol className="list-decimal pl-6 space-y-2 mt-2">
                <li>In TrussCTR, open <strong>Settings → Subscription Plan</strong></li>
                <li>Click <strong>Manage Billing</strong></li>
                <li>Click <strong>Cancel subscription</strong> and confirm</li>
              </ol>
              <p className="mt-3">
                As long as you cancel before the {TRIAL_DAYS} days are up, you won't be charged.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">What happens if you don't cancel</h2>
              <p>
                When the {TRIAL_DAYS} days pass without a cancellation, your saved card is charged automatically for the
                plan you chose. After that, the plan renews every month until you cancel. You can cancel anytime in
                Settings → Subscription Plan → Manage Billing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Frequently asked questions</h2>
              <div className="space-y-2">
                {FAQS.map((f) => (
                  <details key={f.q} className="group rounded-lg border border-gray-200 px-4 py-3">
                    <summary className="cursor-pointer font-medium text-gray-900">{f.q}</summary>
                    <p className="mt-2 text-gray-700">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <p className="text-sm text-gray-500">
              See also our <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>,{' '}
              <a href="/eula" className="text-blue-600 hover:underline">End-User License Agreement</a> and{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
