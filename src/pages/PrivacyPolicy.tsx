import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  // Update this date on the day the revised policy is published.
  const effectiveDate = 'October 3, 2026';
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
              <p>614 Restore LLC ("Company," "we," "us," or "our") operates {companyName}, a CRM and quoting platform for contractors, available as a website and as the TrussCENTER mobile app (together, the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect information when you use the Service. By using the Service, you consent to the practices described in this policy.</p>
              <p className="mt-3">The Service has two kinds of people in it: <strong>contractors and their team members</strong>, who have accounts, and <strong>the contractors' customers</strong> (for example, homeowners), who receive quotes, reports, and documents and may sign them. This policy covers both. Section 5 explains how customer information is handled.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2a. Information You Provide</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, company name, phone number, and password when you register</li>
                <li><strong>Business Data:</strong> Customer contacts (names, addresses, phone numbers, email addresses), estimates, quotes, invoices, receipts, project and insurance-claim details, documents, notes, and communications you enter into the Service</li>
                <li><strong>Photos and Files:</strong> Job-site and damage photos, measurement reports, and other files you upload or take with the camera in the Service</li>
                <li><strong>Payment Information:</strong> Billing details processed through our payment partners (we do not store full card numbers)</li>
                <li><strong>Communications:</strong> Messages you send to our support team, and bug reports you submit from the app</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2b. Information Collected Automatically</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Usage Data:</strong> Pages visited, features used, actions taken, and timestamps</li>
                <li><strong>Device Information:</strong> Browser or app version, operating system, IP address, and device identifiers</li>
                <li><strong>Push Notification Tokens:</strong> If you allow notifications in the mobile app, a token that lets us send alerts to your device</li>
                <li><strong>Cookies and Local Storage:</strong> Session tokens and preference data stored in your browser or app to keep you logged in</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2c. Information from Your Customers and Third Parties</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Signatures and Responses:</strong> When a customer views or signs a quote, report, change order, or other document, we record the signature, the typed name, the date and time, the customer's IP address, and whether and when the document was opened</li>
                <li><strong>Email Replies:</strong> When a customer replies to an email sent through the Service, the reply may be stored in that customer's notes</li>
                <li><strong>Text Messages:</strong> Inbound text messages received on a contractor's Twilio number are stored in that contractor's communications</li>
                <li><strong>QuickBooks Integration:</strong> When you connect QuickBooks, we receive OAuth tokens to sync financial data on your behalf</li>
                <li><strong>EagleView Integration:</strong> When you order or connect measurement reports, we exchange the property address and report data with EagleView</li>
                <li><strong>Email and Text Delivery:</strong> Delivery status and metadata from emails sent through Resend and messages sent through Twilio</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">2d. Mobile App Permissions</h3>
              <p>The TrussCENTER mobile app asks for access to your <strong>camera</strong> (to take job-site photos), your <strong>photo library</strong> (to attach photos to quotes and, if you choose, to save photos to your library), and <strong>notifications</strong>. You can change these at any time in your device settings. The app does not use your location and does not track you across other companies' apps or websites.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide, operate, and improve the Service</li>
                <li>Process transactions and send related information including confirmations and invoices</li>
                <li>Send transactional emails (invitations, estimate requests, signature requests, receipts) and, when you use that feature, text messages on your behalf</li>
                <li>Run the optional AI features you choose to use (see Section 4d)</li>
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
                <li><strong>Supabase</strong> — Database hosting, file storage, and authentication (supabase.com)</li>
                <li><strong>Vercel</strong> — Website and serverless function hosting (vercel.com)</li>
                <li><strong>Resend</strong> — Transactional email delivery and inbound email replies (resend.com)</li>
                <li><strong>Twilio</strong> — Text message delivery and receipt, using the contractor's own Twilio account (twilio.com)</li>
                <li><strong>Stripe</strong> — Payment processing for card payments and web subscriptions (stripe.com)</li>
                <li><strong>Apple and RevenueCat</strong> — In-app subscription purchases and subscription status in the mobile app (apple.com, revenuecat.com)</li>
                <li><strong>Intuit/QuickBooks</strong> — Accounting integration, if you connect it (intuit.com)</li>
                <li><strong>EagleView</strong> — Aerial measurement reports, if you use them (eagleview.com)</li>
                <li><strong>AI providers</strong> — OpenAI, Anthropic, Google (Gemini), and Groq, only for the AI features you use, as described in Section 4d</li>
                <li><strong>GitHub</strong> — Application source hosting (github.com)</li>
              </ul>
              <p className="mt-2">Each provider is bound by its own privacy policy and, where applicable, data processing terms. We share with each provider only what it needs to do its job.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4b. Legal Requirements</h3>
              <p>We may disclose your information if required by law, subpoena, court order, or to protect the rights, property, or safety of our company, users, or the public.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4c. Business Transfers</h3>
              <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a different privacy policy.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4d. AI Features</h3>
              <p>The Service includes optional AI features, such as drafting text and helping with estimates and photo review. These features are off unless a company turns them on and supplies its own AI provider account (an API key from OpenAI, Anthropic, Google, or Groq).</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>When someone uses an AI feature, the content needed for that request — such as the text they typed, quote or job details, and any photos they select — is sent through our server to the AI provider the company configured.</li>
                <li>The provider handles that content under the terms of the company's account with it. Because each provider's terms are different, companies should review them before enabling AI features, and should not submit information they are not permitted to share.</li>
                <li>We do not use your Customer Data to train AI models, and we do not sell it.</li>
                <li>AI output can be wrong. It is a draft for a person to review, and it is not legal, engineering, or insurance advice.</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">4e. Text Messages</h3>
              <p>If a company connects its Twilio account, it can send and receive text messages with its customers through the Service. Messages are sent by that company, from its own number, and are stored with the customer's record. We do not send marketing text messages of our own. Each company is responsible for getting any consent its customers must give before receiving texts, and for honoring requests to stop (for example, a reply of STOP). Message and data rates may apply.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Customers' Data</h2>
              <p>When you use {companyName} to manage your customers' information (names, addresses, contact details, etc.), you act as the data controller for that information and we act as a data processor. You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Having a lawful basis to collect and process your customers' data</li>
                <li>Informing your customers about how their data is used</li>
                <li>Honoring any data deletion or access requests from your customers</li>
                <li>Obtaining consent for electronic signatures, emails, and text messages</li>
              </ul>
              <p className="mt-3"><strong>If you are a customer of a contractor</strong> (for example, you received a quote or a document to sign), the contractor decides what information about you is kept and why. To see, correct, or delete your information, contact that contractor first. You can also contact us at the address in Section 13 and we will pass your request to the contractor or help directly where we can.</p>
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
              <p>We retain your data for as long as your account is active, and as needed to provide the Service.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">Deleting your account</h3>
              <p>You can delete your account yourself in the app: <strong>Settings → Delete Account</strong> on both the website and the mobile app.</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Your login and personal profile are deleted right away, and you are signed out.</li>
                <li>If you were the last member of a company workspace, deleting your account on the website also deletes that workspace and the business records in it (customers, quotes, photos, documents).</li>
                <li>If other team members remain in the workspace, the company's records stay available to them, because they belong to the company.</li>
                <li>You can also email <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a> to ask us to delete your account or a workspace. We respond within 30 days.</li>
              </ul>
              <p className="mt-3">Deleted data may remain in encrypted backups for a limited time before it is overwritten. Records we must keep for legal, tax, or fraud-prevention reasons, and signed documents that a customer or contractor is entitled to keep, may be retained as the law requires. Anonymized, aggregated usage statistics may be kept.</p>
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
              <p className="mt-3">To exercise any of these rights, contact us at <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>. We will respond within 30 days, and we may need to verify who you are first. You will not be treated differently for using these rights.</p>

              <h3 className="font-semibold text-gray-800 mt-4 mb-2">Residents of California and other U.S. states</h3>
              <p>Several states, including California, give residents rights over their personal information, such as the rights to know, access, correct, delete, and receive a copy of it, and to opt out of its sale or sharing for advertising. In short:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>We <strong>do not sell</strong> personal information and we <strong>do not share</strong> it for cross-context behavioral advertising. We do not use advertising or cross-site tracking technologies.</li>
                <li>For information a contractor stores about its customers, we act as that contractor's service provider (processor), and the contractor decides how it is used.</li>
                <li>You can use the rights above by emailing us. An authorized agent may make a request for you, and we may ask for proof of authority.</li>
              </ul>
              <p className="mt-3">If you are in the European Economic Area, the United Kingdom, or Switzerland, you may also have the right to complain to your local data protection authority.</p>
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
