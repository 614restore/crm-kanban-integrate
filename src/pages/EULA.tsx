import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function EULA() {
  const navigate = useNavigate();
  const effectiveDate = 'March 7, 2026';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">End-User License Agreement (EULA)</h1>
          <p className="text-sm text-gray-500 mb-1">{companyName} — Contractor CRM Software</p>
          <p className="text-gray-500 mb-8">Effective Date: {effectiveDate}</p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <p className="text-amber-800 text-sm font-medium">IMPORTANT — READ CAREFULLY</p>
            <p className="text-amber-700 text-sm mt-1">This End-User License Agreement ("EULA") is a legal agreement between you (an individual or entity) and 614 Restore LLC. By installing, accessing, or using {companyName}, you agree to be bound by this EULA. If you do not agree, do not use the software.</p>
          </div>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700">

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Grant of License</h2>
              <p>Subject to your compliance with this EULA and payment of any applicable subscription fees, 614 Restore LLC ("Licensor") grants you a limited, non-exclusive, non-transferable, revocable license to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Access and use {companyName} ("Software") via web browser or supported mobile device</li>
                <li>Use the Software solely for your internal business operations in the contracting, roofing, or restoration industries</li>
                <li>Invite team members within your organization to use the Software under your account</li>
              </ul>
              <p className="mt-3">This license does not include any rights to sublicense, resell, or redistribute the Software.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. License Restrictions</h2>
              <p>You may not:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Copy, modify, adapt, translate, or create derivative works of the Software</li>
                <li>Reverse engineer, decompile, disassemble, or attempt to derive source code from the Software</li>
                <li>Remove, alter, or obscure any proprietary notices, labels, or marks on the Software</li>
                <li>Use the Software to build a competing product or service</li>
                <li>Share your login credentials with individuals outside your organization</li>
                <li>Use automated scripts or bots to access the Software in a manner that exceeds normal usage</li>
                <li>Use the Software for any unlawful purpose or in violation of any applicable laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Ownership & Intellectual Property</h2>
              <p>The Software, including all code, design, features, documentation, and branding, is and remains the exclusive property of 614 Restore LLC. This EULA does not transfer any ownership rights to you. All rights not expressly granted herein are reserved by Licensor.</p>
              <p className="mt-3">You retain ownership of all data, content, and materials you upload or create within the Software ("User Content"). By using the Software, you grant Licensor a limited license to host, store, and process your User Content solely to provide the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Software Updates</h2>
              <p>Licensor may release updates, patches, or new versions of the Software from time to time. As a cloud-based application, updates are applied automatically. You agree that Licensor may modify features, functionality, or the interface of the Software with reasonable notice for material changes. Continued use of the Software after an update constitutes acceptance of those changes.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Software & Integrations</h2>
              <p>The Software incorporates or integrates with third-party software, libraries, and services, including:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Supabase</strong> — Database, authentication, and storage infrastructure</li>
                <li><strong>Intuit QuickBooks</strong> — Accounting integration (subject to Intuit's developer terms)</li>
                <li><strong>Resend</strong> — Transactional email delivery</li>
                <li><strong>Vercel</strong> — API hosting and serverless functions</li>
                <li><strong>React, Vite, Tailwind CSS</strong> — Open-source UI framework components</li>
              </ul>
              <p className="mt-3">Your use of integrated third-party services is subject to their respective license agreements and terms of service. Licensor is not responsible for any third-party service's availability, accuracy, or performance.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Subscription & Payment Terms</h2>
              <p>Access to the Software may require a paid subscription. By subscribing:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>You authorize Licensor to charge your payment method on a recurring basis (monthly or annual, as selected)</li>
                <li>Subscriptions automatically renew unless cancelled at least 24 hours before the renewal date</li>
                <li>Fees are non-refundable except as required by applicable law or as expressly stated in our refund policy</li>
                <li>Licensor reserves the right to change subscription pricing with 30 days' advance notice</li>
                <li>Failure to pay may result in suspension or termination of your access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Electronic Signature Features</h2>
              <p>The Software includes electronic signature functionality. You acknowledge and agree that:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Electronic signatures collected via the Software are intended to be legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN), the Uniform Electronic Transactions Act (UETA), and similar laws where applicable</li>
                <li>You are solely responsible for ensuring your use of electronic signatures complies with applicable laws in your jurisdiction and industry</li>
                <li>You are responsible for the accuracy of documents sent for signature</li>
                <li>Licensor does not provide legal advice regarding the enforceability of specific signed documents</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Data Privacy</h2>
              <p>Your use of the Software is also governed by our <a href="/crm-kanban-integrate/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Privacy Policy</a>, which is incorporated into this EULA by reference. By using the Software, you consent to the collection and use of information as described in the Privacy Policy.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimer of Warranties</h2>
              <p className="font-medium text-sm uppercase">The software is provided "as is" without warranty of any kind. To the fullest extent permitted by law, licensor disclaims all warranties, whether express, implied, statutory, or otherwise, including without limitation any implied warranty of merchantability, fitness for a particular purpose, title, or non-infringement. Licensor does not warrant that the software will be error-free, secure, uninterrupted, or that defects will be corrected.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Limitation of Liability</h2>
              <p className="font-medium text-sm uppercase">To the maximum extent permitted by applicable law, in no event shall licensor be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, including but not limited to loss of profits, loss of data, loss of business, or loss of goodwill, arising out of or in connection with this eula or your use of the software, even if licensor has been advised of the possibility of such damages. Licensor's total cumulative liability arising out of or related to this eula shall not exceed the total fees paid by you in the twelve (12) months preceding the claim.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Indemnification</h2>
              <p>You agree to indemnify, defend, and hold harmless 614 Restore LLC and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of this EULA or your use of the Software.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Term & Termination</h2>
              <p>This EULA is effective upon your first access to the Software and continues until terminated.</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Termination by You:</strong> You may terminate this EULA at any time by cancelling your account and ceasing use of the Software</li>
                <li><strong>Termination by Licensor:</strong> Licensor may terminate this EULA immediately, without notice, if you breach any provision. Licensor may also terminate with 30 days' notice for any reason</li>
                <li><strong>Effect of Termination:</strong> Upon termination, your license to use the Software ends immediately. Sections 3, 9, 10, 11, and 13 survive termination</li>
                <li><strong>Data Export:</strong> Following termination, you will have 30 days to export your data before it is permanently deleted</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Governing Law & Dispute Resolution</h2>
              <p>This EULA shall be governed by and construed in accordance with the laws of the State of Ohio, without regard to its conflict of law provisions. Any dispute arising under this EULA shall be resolved exclusively in the state or federal courts located in Franklin County, Ohio, and you consent to personal jurisdiction in those courts.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Entire Agreement</h2>
              <p>This EULA, together with the <a href="/crm-kanban-integrate/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms of Service</a> and <a href="/crm-kanban-integrate/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Privacy Policy</a>, constitutes the entire agreement between you and 614 Restore LLC regarding the Software and supersedes all prior agreements, understandings, or representations.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Contact</h2>
              <p>For questions about this EULA, contact:</p>
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
