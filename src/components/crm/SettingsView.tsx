import React, { useState, useRef, useEffect } from 'react';
import { useCRM, canManageLeadSources } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { LeadSource, defaultLeadSources } from '@/lib/crmData';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { uploadCompanyLogo, uploadUserAvatar, validateImageFile, createPreviewUrl } from '@/lib/storage';
import {
  Settings,
  Building2,
  Users,
  Bell,
  Shield,
  CreditCard,
  Link,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Check,
  ExternalLink,
  Key,
  Database,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  User,
  Upload,
  Loader2,
} from 'lucide-react';

type SettingsTab = 'company' | 'profile' | 'integrations' | 'notifications' | 'security' | 'billing' | 'api';

interface CompanyFormData {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

export default function SettingsView() {
  const { state, dispatch } = useCRM();
  const { profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [newLeadSource, setNewLeadSource] = useState('');
  const [showAddLeadSource, setShowAddLeadSource] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  
  // Company form state
  const [companyForm, setCompanyForm] = useState<CompanyFormData>({
    name: 'StormCraft Roofing',
    phone: '(555) 123-4567',
    email: 'info@stormcraft.com',
    website: 'https://stormcraft.com',
    address: '123 Business Park Drive, Dallas, TX 75201',
  });
  
  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
  });
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(profile?.avatar_url || null);

  useEffect(() => {
    setProfileForm({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
    });
    setProfileAvatar(profile?.avatar_url || null);
  }, [profile?.first_name, profile?.last_name, profile?.avatar_url]);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  
  // Refs for file inputs
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const userRole = state.currentUser?.role || 'sales';
  const canManageSources = canManageLeadSources(userRole);

  // Combine default and custom lead sources
  const allLeadSources = [...defaultLeadSources, ...state.leadSources.filter((ls) => ls.isCustom)];

  // Load company data on mount
  useEffect(() => {
    const loadCompanyData = async () => {
      if (profile?.company_id) {
        setIsLoadingCompany(true);
        try {
          const company = await db.getCompany(profile.company_id);
          if (company) {
            setCompanyForm({
              name: company.name || 'StormCraft Roofing',
              phone: company.phone || '',
              email: company.email || '',
              website: company.website || '',
              address: company.address || '',
            });
            if (company.logo_url) {
              setCompanyLogo(company.logo_url);
            }
          }
        } catch (error) {
          console.error('Error loading company data:', error);
        } finally {
          setIsLoadingCompany(false);
        }
      }
    };

    loadCompanyData();
  }, [profile?.company_id]);

  const handleAddLeadSource = () => {
    if (newLeadSource.trim()) {
      const newSource: LeadSource = {
        id: `ls-custom-${Date.now()}`,
        name: newLeadSource.trim(),
        isCustom: true,
        createdBy: state.currentUser?.id,
      };
      dispatch({ type: 'ADD_LEAD_SOURCE', payload: newSource });
      setNewLeadSource('');
      setShowAddLeadSource(false);
      toast.success('Lead source added successfully');
    }
  };

  const handleSaveCompany = async () => {
    if (!profile?.company_id) {
      toast.error('No company associated with your account');
      return;
    }

    setIsSavingCompany(true);

    try {
      const result = await db.updateCompany(profile.company_id, {
        name: companyForm.name,
        phone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website,
        address: companyForm.address,
      });

      if (result) {
        toast.success('Company profile saved successfully!');
      } else {
        toast.error('Failed to save company profile');
      }
    } catch (error) {
      console.error('Save company error:', error);
      toast.error('Failed to save company profile');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSaveProfile = async () => {
    if (profile) {
      try {
        const { error } = await updateProfile({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
        });
        if (error) {
          throw error;
        }

        setEditingProfile(false);
        toast.success("Profile updated successfully");
      } catch (error) {
        toast.error('Failed to update profile');
        console.error('Profile update error:', error);
      }
    }
  };

  const handleCompanyLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previousLogo = companyLogo;

    // Validate file
    const validationError = validateImageFile(file, 5);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Create preview immediately
      const previewUrl = await createPreviewUrl(file);
      setCompanyLogo(previewUrl);

      // Upload to Supabase if user has company
      if (profile?.company_id) {
        const result = await uploadCompanyLogo(file, profile.company_id);
        
        if (result.error) {
          toast.error(`Upload failed: ${result.error}`);
          setCompanyLogo(previousLogo);
        } else {
          setCompanyLogo(result.url);
          
          // Update company logo URL in database and verify persistence
          const updatedCompany = await db.updateCompany(profile.company_id, { logo_url: result.url });
          if (!updatedCompany) {
            setCompanyLogo(previousLogo);
            toast.error("Logo uploaded, but failed to save to company profile");
            return;
          }

          setCompanyLogo(updatedCompany.logo_url || result.url);
          toast.success("Logo uploaded and saved successfully");
        }
      } else {
        toast.success('Logo preview loaded (connect database to persist)');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      toast.error('Failed to upload logo');
      setCompanyLogo(previousLogo);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleProfileAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validationError = validateImageFile(file, 2);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create preview immediately
      const previewUrl = await createPreviewUrl(file);
      setProfileAvatar(previewUrl);

      // Upload to Supabase if user is authenticated
      if (profile?.id) {
        const result = await uploadUserAvatar(file, profile.id);
        
        if (result.error) {
          toast.error(`Upload failed: ${result.error}`);
          setProfileAvatar(profile.avatar_url || null);
        } else {
          setProfileAvatar(result.url);
          
          // Update profile with new avatar URL
          try {
            const { error } = await updateProfile({ avatar_url: result.url });
            if (error) {
              throw error;
            }

            toast.success("Avatar uploaded and saved successfully");
          } catch (updateError) {
            console.error('Failed to update profile with new avatar:', updateError);
            toast.error('Avatar uploaded but failed to save to profile');
          }
        }
      } else {
        toast.success('Avatar preview loaded (sign in to persist)');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
      setProfileAvatar(profile?.avatar_url || null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: <Building2 size={18} /> },
    { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
    { id: 'integrations', label: 'Integrations', icon: <Link size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
    { id: 'api', label: 'API Access', icon: <Key size={18} /> },
  ];

  const integrations = [
    {
      name: 'QuickBooks',
      description: 'Sync invoices, payments, and financial data',
      icon: '💰',
      connected: false,
      category: 'Accounting',
    },
    {
      name: 'Twilio',
      description: 'Send and receive SMS messages',
      icon: '📱',
      connected: true,
      category: 'Communication',
    },
    {
      name: 'Google Calendar',
      description: 'Sync appointments and scheduling',
      icon: '📅',
      connected: true,
      category: 'Calendar',
    },
    {
      name: 'EagleView',
      description: 'Aerial roof measurements and reports',
      icon: '🦅',
      connected: false,
      category: 'Measurements',
    },
    {
      name: 'Stripe',
      description: 'Process payments and subscriptions',
      icon: '💳',
      connected: false,
      category: 'Payments',
    },
    {
      name: 'DocuSign',
      description: 'Electronic signatures for contracts',
      icon: '✍️',
      connected: false,
      category: 'Documents',
    },
    {
      name: 'ScopeMGR',
      description: 'Mobile app for photo and customer documentation',
      icon: '📸',
      connected: true,
      category: 'Field Tools',
    },
    {
      name: 'Zapier',
      description: 'Connect with 5,000+ apps',
      icon: '⚡',
      connected: false,
      category: 'Automation',
    },
  ];

  if (isLoadingCompany && activeTab === 'company') {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Hidden file inputs */}
      <input
        ref={companyLogoInputRef}
        type="file"
        accept="image/*"
        onChange={handleCompanyLogoChange}
        className="hidden"
        disabled={isUploadingLogo}
      />
      <input
        ref={profileAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleProfileAvatarChange}
        className="hidden"
        disabled={isUploadingAvatar}
      />

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 px-3">Settings</h2>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'company' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Company Profile</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    {isUploadingLogo ? (
                      <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                      </div>
                    ) : companyLogo ? (
                      <img
                        src={companyLogo}
                        alt="Company logo"
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Building2 className="text-white" size={36} />
                      </div>
                    )}
                    {!isUploadingLogo && (
                      <button
                        onClick={() => companyLogoInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        disabled={isUploadingLogo}
                      >
                        <Upload className="text-white" size={24} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{companyForm.name}</h4>
                    <p className="text-gray-500">Premium roofing and restoration services</p>
                    <button
                      onClick={() => companyLogoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Change Logo
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Max 5MB • JPG, PNG, GIF, WebP</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Phone
                    </label>
                    <input
                      type="tel"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Email
                    </label>
                    <input
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveCompany}
                  disabled={isSavingCompany}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingCompany ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lead Sources */}
            {canManageSources && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Lead Sources</h3>
                  <button
                    onClick={() => setShowAddLeadSource(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    Add Source
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {allLeadSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            source.isCustom ? 'bg-purple-500' : 'bg-blue-500'
                          }`}
                        />
                        <span className="font-medium text-gray-900">{source.name}</span>
                        {source.isCustom && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            Custom
                          </span>
                        )}
                      </div>
                      {source.isCustom && (
                        <button
                          onClick={() => {
                            dispatch({ type: 'DELETE_LEAD_SOURCE', payload: source.id });
                            toast.success('Lead source deleted');
                          }}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {showAddLeadSource && (
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="text"
                      value={newLeadSource}
                      onChange={(e) => setNewLeadSource(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLeadSource()}
                      placeholder="Enter lead source name..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleAddLeadSource}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setShowAddLeadSource(false);
                        setNewLeadSource('');
                      }}
                      className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">My Profile</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    {isUploadingAvatar ? (
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                      </div>
                    ) : profileAvatar ? (
                      <img
                        src={profileAvatar}
                        alt="Profile avatar"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {profile?.first_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                        {profile?.last_name?.[0]?.toUpperCase() || ''}
                      </div>
                    )}
                    {!isUploadingAvatar && (
                      <button
                        onClick={() => profileAvatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        <Upload className="text-white" size={24} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {profile?.first_name && profile?.last_name 
                        ? `${profile.first_name} ${profile.last_name}`
                        : profile?.email || 'User'}
                    </h4>
                    <p className="text-gray-500">{profile?.email}</p>
                    <p className="text-sm text-gray-400 capitalize mt-1">{profile?.role || 'User'}</p>
                    <button
                      onClick={() => profileAvatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Change Photo
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Max 2MB • JPG, PNG, GIF, WebP</p>
                  </div>
                </div>

                {editingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.first_name}
                          onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.last_name}
                          onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveProfile}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Save size={18} />
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingProfile(false)}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setProfileForm({
                        first_name: profile?.first_name || '',
                        last_name: profile?.last_name || '',
                      });
                      setEditingProfile(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Edit2 size={18} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-4xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Integrations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                        <span className="text-xs text-gray-400">{integration.category}</span>
                      </div>
                    </div>
                    {integration.connected && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{integration.description}</p>
                  <button
                    onClick={() => {
                      if (integration.connected) {
                        toast.info(`Managing ${integration.name} integration`);
                      } else {
                        toast.info(`Connecting to ${integration.name}...`);
                      }
                    }}
                    className={`w-full py-2 rounded-lg font-medium transition-colors ${
                      integration.connected
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {integration.connected ? 'Manage' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add other tabs here if needed - notifications, security, billing, api */}
      </div>
    </div>
  );
}
