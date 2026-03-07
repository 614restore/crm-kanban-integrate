import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const effectiveDate = 'March 7, 2026';
  const companyName = 'TrussCTR';
  const contactEmail = 'privacy@614restore.com';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 font-medium"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{companyName} Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Effective Date: {effectiveDate}</p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700">

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
              <p>614 Restore LLC ("Company," "we," "us," or "our") operates {companyName}, a CRM platform for contractors. This Privacy Policy explains how we collect, use, disclose, and protect information when you use our Service. By using the Service, you consent to the practices described in this policy.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2a. Information You Provide</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, company name, phone number, and password when you register</li>
                <li><strong>Business Data:</strong> Customer contacts, estimates, invoices, project details, documents, photos, and communications you enter into the Service</li>
                <li><strong>Payment Information:</strong> Billing details processed through our payment partners (we do not store full card numbers)</li>
                <li><strong>Communications:</strong> Messages you send to our support team</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2b. Information Collected Automatically</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Usage Data:</strong> Pages visited, features used, actions taken, and timestamps</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
                <li><strong>Cookies and Local Storage:</strong> Session tokens and preference data stored in your browser to keep you logged in</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2c. Information from Third Parties</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>QuickBooks Integration:</strong> When you connect QuickBooks, we receive OAuth tokens to sync financial data on your behalf</li>
                <li><strong>Email Services:</strong> Delivery status and metadata from emails sent through our Resend integration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide, operate, and improve the Service</li>
                <li>Process transactions and send related information including confirmations and invoices</li>
                <li>Send transactional emails (invitations, estimate requests, signature requests) on your behalf</li>
                <li>Sync data with third-party services you authorize (e.g., QuickBooks)</li>
                <li>Respond to your support requests and communications</li>
                <li>Monitor and analyze usage patterns to improve functionality</li>
                <li>Detect and prevent fraud, abuse, or security incidents</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p className="mt-3">We do <strong>not</strong> sell your personal information or your customers' data to any third party.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How We Share Your Information</h2>
              <p>We may share your information only in these limited circumstances:</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4a. Service Providers</h3>
              <p>We use trusted third-party services to operate the platform:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Supabase</strong> — Database hosting and authentication (supabase.com)</li>
                <li><strong>Vercel</strong> — API serverless function hosting (vercel.com)</li>
                <li><strong>Resend</strong> — Transactional email delivery (resend.com)</li>
                <li><strong>Intuit/QuickBooks</strong> — Accounting integration (intuit.com)</li>
                <li><strong>GitHub</strong> — Application hosting (github.com)</li>
              </ul>
              <p className="mt-2">Each provider is bound by their own privacy policy and data processing agreements.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4b. Legal Requirements</h3>
              <p>We may disclose your information if required by law, subpoena, court order, or to protect the rights, property, or safety of our company, users, or the public.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4c. Business Transfers</h3>
              <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a different privacy policy.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Customers' Data</h2>
              <p>When you use {companyName} to manage your customers' information (names, addresses, contact details, etc.), you act as the data controller for that information and we act as a data processor. You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Having a lawful basis to collect and process your customers' data</li>
                <li>Informing your customers about how their data is used</li>
                <li>Honoring any data deletion or access requests from your customers</li>
                <li>Obtaining consent for electronic signatures and communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
              <p>We implement industry-standard security measures to protect your data:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>All data transmitted between your browser and our servers is encrypted using TLS/HTTPS</li>
                <li>Passwords are hashed using bcrypt and never stored in plain text</li>
                <li>Database access is protected by Row-Level Security (RLS) policies ensuring each company can only access its own data</li>
                <li>API keys and credentials are stored as environment variables, never in source code</li>
                <li>File uploads are stored in private, access-controlled storage buckets</li>
              </ul>
              <p className="mt-3">Despite these measures, no system is completely secure. You acknowledge and accept residual security risk inherent in internet-based services.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
              <p>We retain your data for as long as your account is active. Upon account termination:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Your data is retained for 30 days to allow for export or account recovery</li>
                <li>After 30 days, your data is permanently deleted from our systems</li>
                <li>Anonymized, aggregated usage analytics may be retained indefinitely</li>
                <li>Data required for legal compliance may be retained longer as required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies and Tracking</h2>
              <p>We use cookies and browser local storage for:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Authentication:</strong> Keeping you logged in between sessions (stored as <code className="bg-gray-100 px-1 rounded text-sm">sb-auth-token</code>)</li>
                <li><strong>Preferences:</strong> Remembering your current view and UI settings</li>
              </ul>
              <p className="mt-3">We do not use advertising cookies or cross-site tracking. You can clear cookies through your browser settings, though this will log you out of the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Your Rights</h2>
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate personal data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
                <li><strong>Portability:</strong> Request an export of your data in a machine-readable format</li>
                <li><strong>Objection:</strong> Object to certain processing of your personal data</li>
              </ul>
              <p className="mt-3">To exercise any of these rights, contact us at <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>. We will respond within 30 days.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Children's Privacy</h2>
              <p>The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected data from a minor, please contact us immediately and we will delete it.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. International Data Transfers</h2>
              <p>Our services and infrastructure are primarily located in the United States. If you access the Service from outside the U.S., your information may be transferred to, stored, and processed in the United States. By using the Service, you consent to this transfer.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to This Policy</h2>
              <p>We may update this Privacy Policy periodically. We will notify you of material changes by email or through an in-app notice at least 14 days before the changes take effect. The "Effective Date" at the top of this page indicates when the policy was last updated.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Us</h2>
              <p>For questions, concerns, or data requests related to this Privacy Policy, contact us at:</p>
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold">614 Restore LLC</p>
                <p>Email: <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a></p>
                <p>Columbus, Ohio, United States</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
