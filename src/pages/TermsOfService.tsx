import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();
  // Update this date on the day the revised terms are published.
  const effectiveDate = 'October 3, 2026';
  const companyName = 'TrussCTR';
  const contactEmail = 'legal@614restore.com';

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{companyName} Terms of Service</h1>
          <p className="text-gray-500 mb-8">Effective Date: {effectiveDate}</p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700">

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
              <p>By creating an account, accessing, or using {companyName} ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms constitute a legally binding agreement between you and 614 Restore LLC ("Company," "we," "us," or "our").</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
              <p>{companyName} is a cloud-based customer relationship management (CRM) and quoting platform designed for roofing, restoration, and general contracting businesses. It is available as a website and as the TrussCENTER mobile app. The Service includes tools for managing contacts, projects, inspections, estimates, quotes, change orders, invoices, receipts, documents, photos, team members, scheduling, optional AI features, and third-party integrations (including QuickBooks, EagleView, email, and text messaging).</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
              <p>To use the Service, you must create an account. You agree to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your password and accept responsibility for all activity under your account</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Be at least 18 years of age or the age of majority in your jurisdiction</li>
              </ul>
              <p className="mt-3">You are responsible for all actions taken under your account, including actions by team members you invite.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Violate any applicable law, regulation, or third-party rights</li>
                <li>Upload or transmit malicious code, viruses, or harmful content</li>
                <li>Attempt to gain unauthorized access to any system or network</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
                <li>Harvest, scrape, or collect data from other users without consent</li>
                <li>Use the Service for any fraudulent or deceptive purpose</li>
                <li>Resell or sublicense the Service without our prior written consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Ownership</h2>
              <p>You retain full ownership of all data, content, and information you submit to the Service ("Customer Data"). By using the Service, you grant us a limited, non-exclusive license to store, process, and display your Customer Data solely for the purpose of providing the Service to you. We do not claim ownership of your Customer Data and will not sell it to third parties.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Multi-Tenant Architecture & Data Isolation</h2>
              <p>The Service uses a multi-tenant architecture where each company's data is logically isolated. We implement row-level security controls to ensure your company's data is not accessible to other companies using the Service. However, you acknowledge that no system is perfectly secure and accept residual risk inherent in cloud-based software.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Third-Party Integrations</h2>
              <p>The Service integrates with third-party platforms including but not limited to QuickBooks (Intuit Inc.), EagleView, Resend (email delivery), Twilio (text messaging), Stripe (payments), Apple and RevenueCat (mobile subscriptions), AI providers (OpenAI, Anthropic, Google, and Groq), and Supabase (database infrastructure). Your use of these integrations is subject to those providers' respective terms of service and privacy policies. We are not responsible for the availability, accuracy, or conduct of third-party services.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7A. AI Features</h2>
              <p>Optional AI features may draft text, suggest estimate items, or review photos. They run on an AI provider account that your company supplies, and the content you submit is sent to that provider (see our Privacy Policy). You agree that:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>AI output may be inaccurate or incomplete. You must review it before relying on it or sending it to a customer.</li>
                <li>AI output is not legal, engineering, structural, insurance, or building-code advice, and it does not replace a licensed professional's judgment.</li>
                <li>You will not submit information you are not allowed to share with the provider.</li>
                <li>You are responsible for the provider's charges and terms on your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7B. Email and Text Messages You Send</h2>
              <p>The Service lets you send emails and, if you connect a Twilio account, text messages to your customers. You are the sender. You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Having the permission the law requires before you contact a customer, including consent under the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, and state laws</li>
                <li>Honoring requests to stop, such as a reply of STOP to a text message</li>
                <li>The content of every message, quote, report, and document you send</li>
              </ul>
              <p className="mt-3">We do not review your messages and are not responsible for whether you were permitted to send them.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7C. Your Contracts and Legal Notices</h2>
              <p>{companyName} is software. It is not a law firm and does not give legal advice. The quote, change order, receipt, and cancellation-notice wording the Service provides is a starting point. Some states give customers a right to cancel certain home-improvement and home-solicitation sales, and require specific notices, licensing information, deposit limits, or contract terms. Some of these notices are built in for certain states, and the rest use a general federal notice. You are responsible for checking that your documents, pricing, licensing, and cancellation notices meet the laws that apply where you work, and for adding anything your state requires. Consider having an attorney review your contract templates.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Electronic Signatures</h2>
              <p>The Service provides electronic signature functionality for estimates and contracts. You acknowledge that electronic signatures collected through the Service are legally binding in jurisdictions that recognize the Electronic Signatures in Global and National Commerce Act (E-SIGN) and similar laws. You are responsible for ensuring your use of electronic signatures complies with applicable laws and your agreements with your customers.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Payment and Billing</h2>
              <p>Access to premium features of the Service may require payment of subscription fees. All fees are stated in U.S. dollars. Subscriptions auto-renew unless cancelled before the renewal date. If you subscribe through the Apple App Store, Apple charges your Apple ID account, renews the subscription each period unless you cancel at least 24 hours before it ends, and handles cancellation and refunds under its own rules; you can manage or cancel it in your Apple ID subscription settings. If you subscribe on the website, you can manage or cancel from the Subscription page, or by contacting us. Refunds for purchases made directly with us are provided at our discretion. We reserve the right to modify pricing with 30 days' notice.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Intellectual Property</h2>
              <p>The Service, including its design, code, features, and branding, is owned by 614 Restore LLC and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works of the Service without our express written permission. Nothing in these Terms transfers any intellectual property rights to you.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Disclaimer of Warranties</h2>
              <p className="uppercase font-medium text-sm">The service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the service will be uninterrupted, error-free, or free of harmful components.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Limitation of Liability</h2>
              <p className="uppercase font-medium text-sm">To the maximum extent permitted by law, 614 Restore LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of or inability to use the service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Indemnification</h2>
              <p>You agree to indemnify, defend, and hold harmless 614 Restore LLC and its officers, directors, employees, and agents from any claims, damages, or expenses (including attorney's fees) arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Termination</h2>
              <p>Either party may terminate this agreement at any time. You can delete your account yourself at any time in Settings. Upon termination, your access to the Service will cease. Deleting your account removes your login right away, and the handling of company records is described in our Privacy Policy; export anything you need before you delete. We may terminate accounts that violate these Terms without notice.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Governing Law</h2>
              <p>These Terms are governed by the laws of the State of Ohio, without regard to conflict of law principles. Any dispute arising from these Terms shall be resolved in the state or federal courts located in Franklin County, Ohio.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">16. Changes to Terms</h2>
              <p>We may update these Terms from time to time. We will notify you of material changes by email or by displaying a notice in the Service at least 14 days before changes take effect. Your continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">17. Contact</h2>
              <p>For questions about these Terms, contact us at: <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a></p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
