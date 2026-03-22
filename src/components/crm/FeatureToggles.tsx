import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { 
  ToggleLeft, 
  ToggleRight, 
  AlertCircle, 
  CheckCircle2,
  Info,
  Zap,
  Bell,
  UserCheck,
  Calendar,
  Mail,
  MessageSquare,
  Star,
  Shield,
  Loader2
} from 'lucide-react';

export interface CompanyFeatures {
  stale_lead_detection: boolean;
  auto_contact_assignment: boolean;
  owner_nudge_notifications: boolean;
  automated_review_requests: boolean;
  mobile_photo_tagging: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  calendar_sync: boolean;
  ai_assistant: boolean;
  advanced_reporting: boolean;
  custom_workflows: boolean;
  api_access: boolean;
}

const DEFAULT_FEATURES: CompanyFeatures = {
  stale_lead_detection: true,
  auto_contact_assignment: true,
  owner_nudge_notifications: true,
  automated_review_requests: false,
  mobile_photo_tagging: false,
  email_notifications: true,
  sms_notifications: false,
  calendar_sync: true,
  ai_assistant: true,
  advanced_reporting: true,
  custom_workflows: true,
  api_access: false,
};

interface FeatureConfig {
  key: keyof CompanyFeatures;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'automation' | 'notifications' | 'integrations' | 'advanced';
  requiresPlan?: 'professional' | 'enterprise';
  comingSoon?: boolean;
}

const FEATURE_CONFIGS: FeatureConfig[] = [
  // Automation Features
  {
    key: 'stale_lead_detection',
    label: 'Stale Lead Detection',
    description: 'Automatically flag contacts with no activity after 24 hours and notify owners',
    icon: <AlertCircle className="w-5 h-5" />,
    category: 'automation',
  },
  {
    key: 'auto_contact_assignment',
    label: 'Auto Contact Assignment',
    description: 'Automatically assign new contacts to the creating user if not specified',
    icon: <UserCheck className="w-5 h-5" />,
    category: 'automation',
  },
  {
    key: 'automated_review_requests',
    label: 'Automated Review Requests',
    description: 'Send review requests to customers after job completion',
    icon: <Star className="w-5 h-5" />,
    category: 'automation',
    comingSoon: true,
  },
  {
    key: 'custom_workflows',
    label: 'Custom Workflows',
    description: 'Create automated workflows and triggers for your business processes',
    icon: <Zap className="w-5 h-5" />,
    category: 'automation',
    requiresPlan: 'professional',
  },
  
  // Notification Features
  {
    key: 'owner_nudge_notifications',
    label: 'Owner Nudge Notifications',
    description: 'Allow owners to send reminder notifications to team members about stale leads',
    icon: <Bell className="w-5 h-5" />,
    category: 'notifications',
  },
  {
    key: 'email_notifications',
    label: 'Email Notifications',
    description: 'Send email notifications for important events and reminders',
    icon: <Mail className="w-5 h-5" />,
    category: 'notifications',
  },
  {
    key: 'sms_notifications',
    label: 'SMS Notifications',
    description: 'Send text message notifications for urgent updates',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'notifications',
    requiresPlan: 'professional',
    comingSoon: true,
  },
  
  // Integration Features
  {
    key: 'calendar_sync',
    label: 'Calendar Sync',
    description: 'Sync appointments with Google Calendar, Outlook, and other calendar apps',
    icon: <Calendar className="w-5 h-5" />,
    category: 'integrations',
  },
  {
    key: 'mobile_photo_tagging',
    label: 'Mobile Photo Tagging',
    description: 'Tag and organize photos from mobile devices with contact and job information',
    icon: <Shield className="w-5 h-5" />,
    category: 'integrations',
    comingSoon: true,
  },
  
  // Advanced Features
  {
    key: 'ai_assistant',
    label: 'AI Assistant',
    description: 'AI-powered insights, recommendations, and automated responses',
    icon: <Zap className="w-5 h-5" />,
    category: 'advanced',
    requiresPlan: 'professional',
  },
  {
    key: 'advanced_reporting',
    label: 'Advanced Reporting',
    description: 'Detailed analytics, custom reports, and data exports',
    icon: <Shield className="w-5 h-5" />,
    category: 'advanced',
    requiresPlan: 'professional',
  },
  {
    key: 'api_access',
    label: 'API Access',
    description: 'Access the TrussCTR API for custom integrations and automation',
    icon: <Shield className="w-5 h-5" />,
    category: 'advanced',
    requiresPlan: 'enterprise',
  },
];

const CATEGORY_LABELS = {
  automation: 'Automation',
  notifications: 'Notifications',
  integrations: 'Integrations',
  advanced: 'Advanced Features',
};

export default function FeatureToggles() {
  const { profile } = useAuth();
  const [features, setFeatures] = useState<CompanyFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [companyPlan, setCompanyPlan] = useState<string>('trial');

  useEffect(() => {
    loadFeatures();
  }, [profile?.company_id]);

  async function loadFeatures() {
    if (!profile?.company_id) return;
    
    try {
      setLoading(true);
      const company = await db.getCompany(profile.company_id);
      
      if (company) {
        setCompanyPlan(company.subscription_plan || 'trial');
        
        // Load features from database (features JSONB column on companies table)
        const { data: companyRow } = await supabase
          .from('companies')
          .select('features')
          .eq('id', profile.company_id)
          .single();
        const dbFeatures = companyRow?.features;
        if (dbFeatures && typeof dbFeatures === 'object' && Object.keys(dbFeatures).length > 0) {
          setFeatures({ ...DEFAULT_FEATURES, ...dbFeatures });
          // Sync to localStorage as cache for offline use
          localStorage.setItem(`company_features_${profile.company_id}`, JSON.stringify(dbFeatures));
        } else {
          // Fall back to localStorage cache (pre-migration data)
          const storedFeatures = localStorage.getItem(`company_features_${profile.company_id}`);
          if (storedFeatures) {
            setFeatures({ ...DEFAULT_FEATURES, ...JSON.parse(storedFeatures) });
          } else {
            setFeatures(DEFAULT_FEATURES);
          }
        }
      }
    } catch (error) {
      console.error('Error loading features:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFeature(key: keyof CompanyFeatures) {
    if (!profile?.company_id) return;
    
    const feature = FEATURE_CONFIGS.find(f => f.key === key);
    
    // Check if feature requires a plan upgrade
    if (feature?.requiresPlan) {
      const planHierarchy = { trial: 0, starter: 1, professional: 2, enterprise: 3 };
      const currentPlanLevel = planHierarchy[companyPlan as keyof typeof planHierarchy] || 0;
      const requiredPlanLevel = planHierarchy[feature.requiresPlan];
      
      if (currentPlanLevel < requiredPlanLevel) {
        alert(`This feature requires the ${feature.requiresPlan} plan or higher. Please upgrade your subscription.`);
        return;
      }
    }
    
    // Check if feature is coming soon
    if (feature?.comingSoon) {
      alert('This feature is coming soon! Stay tuned for updates.');
      return;
    }
    
    setSaving(key);
    
    try {
      const newFeatures = { ...features, [key]: !features[key] };
      setFeatures(newFeatures);
      
      // Save to database
      await supabase
        .from('companies')
        .update({ features: newFeatures })
        .eq('id', profile.company_id);
      // Also keep localStorage in sync as a local cache
      localStorage.setItem(`company_features_${profile.company_id}`, JSON.stringify(newFeatures));
      
      // Show success message
      setTimeout(() => setSaving(null), 500);
    } catch (error) {
      console.error('Error saving feature toggle:', error);
      alert('Failed to save feature setting. Please try again.');
      // Revert the change
      setFeatures(features);
      setSaving(null);
    }
  }

  function canToggle(feature: FeatureConfig): boolean {
    if (feature.comingSoon) return false;
    if (!feature.requiresPlan) return true;
    
    const planHierarchy = { trial: 0, starter: 1, professional: 2, enterprise: 3 };
    const currentPlanLevel = planHierarchy[companyPlan as keyof typeof planHierarchy] || 0;
    const requiredPlanLevel = planHierarchy[feature.requiresPlan];
    
    return currentPlanLevel >= requiredPlanLevel;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const featuresByCategory = FEATURE_CONFIGS.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureConfig[]>);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Feature Toggles</h1>
        <p className="text-gray-600">
          Enable or disable features based on your company's needs. Some features require specific subscription plans.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Current Plan: {companyPlan.charAt(0).toUpperCase() + companyPlan.slice(1)}</p>
          <p>Some features require a Professional or Enterprise plan. Upgrade in the Billing section to unlock all features.</p>
        </div>
      </div>

      {/* Feature Categories */}
      <div className="space-y-8">
        {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              <span className="text-sm font-normal text-gray-500">({categoryFeatures.length})</span>
            </h2>
            
            <div className="space-y-3">
              {categoryFeatures.map((feature) => {
                const isEnabled = features[feature.key];
                const isToggleable = canToggle(feature);
                const isSaving = saving === feature.key;
                
                return (
                  <div
                    key={feature.key}
                    className={`bg-white border rounded-lg p-4 transition-all ${
                      isToggleable ? 'hover:shadow-md' : 'opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          {feature.icon}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{feature.label}</h3>
                            {feature.comingSoon && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                                Coming Soon
                              </span>
                            )}
                            {feature.requiresPlan && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                                {feature.requiresPlan.charAt(0).toUpperCase() + feature.requiresPlan.slice(1)}+
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleFeature(feature.key)}
                        disabled={!isToggleable || isSaving}
                        className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                          isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        >
                          {isSaving && (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600 m-0.5" />
                          )}
                        </span>
                      </button>
                    </div>
                    
                    {isEnabled && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Active</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
        <p className="text-sm text-gray-600 mb-2">
          Not sure which features to enable? Here are some recommendations:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li><strong>Stale Lead Detection</strong> - Highly recommended to prevent leads from falling through the cracks</li>
          <li><strong>Auto Contact Assignment</strong> - Ensures every lead has an owner</li>
          <li><strong>Email Notifications</strong> - Keep your team informed of important updates</li>
          <li><strong>Calendar Sync</strong> - Never miss an appointment</li>
        </ul>
      </div>
    </div>
  );
}
