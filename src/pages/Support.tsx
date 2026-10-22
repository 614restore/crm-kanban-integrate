import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { TRIAL_DAYS } from '@/lib/trial';

const SUPPORT_EMAIL = 'devmgr.app@gmail.com';

/**
 * Public help page: the App Store "Support URL" for TrussCENTER and the place
 * the website links for help, account deletion, and the legal documents.
 */
export default function Support() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">TrussCTR Support</h1>
          <p className="text-gray-600 mb-8">Help for TrussCTR on the web and the TrussCENTER iPhone app.</p>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact us</h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=TrussCTR%20Support`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 font-medium"
              >
                <Mail size={18} />
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-3">
                Tell us your company name, the email you sign in with, and what you were doing when the problem
                happened. A screenshot helps. We reply within 1–2 business days. In the iPhone app you can also use
                Settings → Report a Bug.
              </p>
              <p className="mt-2 text-sm text-gray-500">614 Restore LLC · Columbus, Ohio, United States</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Common questions</h2>
              <div className="space-y-2">
                <details className="rounded-lg border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer font-medium text-gray-900">I can't sign in</summary>
                  <p className="mt-2">Use the email your account was created with. On the sign-in screen, tap <strong>Forgot password</strong> to get a reset link by email (check your spam folder). If you were invited by your company, ask your account owner to make sure your invite was sent to the right email.</p>
                </details>
                <details className="rounded-lg border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer font-medium text-gray-900">How does the free trial work?</summary>
                  <p className="mt-2">New web accounts get a {TRIAL_DAYS}-day free trial. A card is required at sign-up but isn't charged until the trial ends, and you can cancel anytime before then. <a href="/trial" className="text-blue-600 hover:underline">Read how the free trial works</a>.</p>
                </details>
                <details className="rounded-lg border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer font-medium text-gray-900">How do I change or cancel my subscription?</summary>
                  <p className="mt-2"><strong>Billed on the web:</strong> in TrussCTR, open Settings → Subscription Plan → Manage Billing.</p>
                  <p className="mt-2"><strong>Bought in the iPhone app:</strong> subscriptions are billed by Apple. On your iPhone, open Settings → your name → Subscriptions → TrussCENTER.</p>
                </details>
                <details className="rounded-lg border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer font-medium text-gray-900">How do I restore a purchase in the iPhone app?</summary>
                  <p className="mt-2">Open the plans screen in the app and tap <strong>Restore Purchases</strong>, signed in to the App Store with the same Apple ID you subscribed with.</p>
                </details>
                <details className="rounded-lg border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer font-medium text-gray-900">How do I export my data?</summary>
                  <p className="mt-2">On the web, open Contacts and use <strong>Export</strong> to download your contacts. Quotes, signed documents and photos can be downloaded from each customer's page. Email us if you need a full export of your company's data.</p>
                </details>
              </div>
            </section>

            <section id="delete-account">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Delete your account</h2>
              <p><strong>In the TrussCENTER iPhone app:</strong> open Settings, scroll down and tap <strong>Delete Account</strong>, then confirm. This permanently deletes your login and your personal data (your profile, team membership, notifications and push notification tokens).</p>
              <p className="mt-2"><strong>Without the app:</strong> email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20TrussCTR%20account`} className="text-blue-600 hover:underline">{SUPPORT_EMAIL}</a> from the address you sign in with and ask us to delete your account. We confirm by email once it's done.</p>
              <p className="mt-2">Your company's business records (customers, quotes, invoices and documents) belong to the company, so deleting your own login leaves them for the rest of your team. To delete your whole company and all of its data, the owner can email us from the owner's sign-in address, and we will delete it as described in our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
              <p className="mt-2">Deleting your account does not cancel a subscription billed by Apple. Cancel that first in your iPhone's Settings → your name → Subscriptions. Web subscriptions can be cancelled in Settings → Subscription Plan → Manage Billing.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Legal</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a></li>
                <li><a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a></li>
                <li><a href="/eula" className="text-blue-600 hover:underline">End-User License Agreement (EULA)</a></li>
                <li><a href="/trial" className="text-blue-600 hover:underline">Free trial</a></li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
