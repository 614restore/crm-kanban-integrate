import React from 'react';
import { Mail, Sparkles, Clock, Zap } from 'lucide-react';

interface FeatureBannerProps {
  title: string;
  description: string;
  estimatedTime?: string;
  complexity?: 'low' | 'medium' | 'high';
  emailSubject: string;
  className?: string;
}

export function FeatureBanner({
  title,
  description,
  estimatedTime,
  complexity = 'medium',
  emailSubject,
  className = '',
}: FeatureBannerProps) {
  const complexityConfig = {
    low: { color: 'bg-green-100 text-green-700', label: 'Quick Setup' },
    medium: { color: 'bg-blue-100 text-blue-700', label: 'Moderate Setup' },
    high: { color: 'bg-purple-100 text-purple-700', label: 'Custom Development' },
  };

  const config = complexityConfig[complexity];

  const handleContact = () => {
    const email = '614restorellc@gmail.com';
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(
      `Hi,\n\nI'm interested in the "${title}" feature.\n\n` +
      `My use case:\n[Describe how you'd use this feature]\n\n` +
      `Timeline:\n[When do you need this?]\n\n` +
      `Additional notes:\n[Any specific requirements?]\n\n` +
      `Thanks!`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="text-blue-600" size={24} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {estimatedTime && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={14} />
                {estimatedTime}
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm mb-4">{description}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleContact}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Mail size={16} />
              Request This Feature
            </button>
            <a
              href="mailto:614restorellc@gmail.com"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              614restorellc@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preset banners for common future features
export function PhotoChecklistBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="Photo Checklist & Upload"
      description="Add required photo checklists (before, during, after, supplement shots) with camera upload directly from work orders. Perfect for insurance documentation."
      estimatedTime="4-6 hours setup"
      complexity="medium"
      emailSubject="Photo Checklist Feature Request"
      className={className}
    />
  );
}

export function CompletionChecklistBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="Completion Checklist"
      description="Add QC checklists (magnet sweep, yard clean, materials removed, customer walk-through) to ensure nothing is missed before marking jobs complete."
      estimatedTime="2-3 hours setup"
      complexity="low"
      emailSubject="Completion Checklist Feature Request"
      className={className}
    />
  );
}

export function DualSignatureBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="Dual Signatures (Customer + Foreman)"
      description="Capture both customer and foreman signatures on work orders for complete sign-off documentation. Great for compliance and dispute prevention."
      estimatedTime="2-3 hours setup"
      complexity="low"
      emailSubject="Dual Signature Feature Request"
      className={className}
    />
  );
}

export function AutoInvoiceBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="Auto-Invoice Creation"
      description="Automatically create invoices from completed work orders with labor, materials, and AWOs pre-filled. One-click invoicing saves time and reduces errors."
      estimatedTime="3-4 hours setup"
      complexity="medium"
      emailSubject="Auto-Invoice Feature Request"
      className={className}
    />
  );
}

export function MaterialIntegrationBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="Material List Integration"
      description="Link work orders to material orders, track delivery status, and automatically roll up material costs. Streamline your material management."
      estimatedTime="4-5 hours setup"
      complexity="medium"
      emailSubject="Material List Integration Request"
      className={className}
    />
  );
}

export function SMSNotificationsBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="SMS/Email Notifications"
      description="Send work order details to crews via SMS/email, notify customers when work starts/completes, and automate daily schedules. Requires Twilio integration."
      estimatedTime="8-10 hours setup"
      complexity="high"
      emailSubject="Work Order Notifications Request"
      className={className}
    />
  );
}

export function MobileAppBanner({ className }: { className?: string }) {
  return (
    <FeatureBanner
      title="Mobile App for Field Crews"
      description="React Native mobile app for iOS/Android. Crews can view work orders, upload photos, complete checklists, track time, and capture signatures from the field."
      estimatedTime="40-60 hours"
      complexity="high"
      emailSubject="Mobile App Development Request"
      className={className}
    />
  );
}

export function SMSIntegrationBanner({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="text-green-600" size={24} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">SMS Text Messaging</h3>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Custom Setup
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Send text messages to customers and crews. Appointment reminders, work order updates, payment requests, and more. Bring your own Twilio account or we'll help you set it up.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="tel:6148088899"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Zap size={16} />
              Call (614) 808-8899
            </a>
            <a
              href="mailto:614restorellc@gmail.com?subject=SMS%20Integration%20Options"
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              614restorellc@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoiceCallsBanner({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-purple-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="text-purple-600" size={24} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Voice Calls & Voicemail</h3>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              Custom Setup
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Click-to-call from contacts, automatic call logging, voicemail transcription, and call recording. Integrate your business phone number or get a new one through Twilio.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="tel:6148088899"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Zap size={16} />
              Call (614) 808-8899
            </a>
            <a
              href="mailto:614restorellc@gmail.com?subject=Voice%20Calls%20Integration%20Options"
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              614restorellc@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}


