import React, { useState } from 'react';
import { Building2, Mail, Phone, MapPin, Globe, ChevronLeft, Save, Camera, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function CompanyProfile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.companies?.name || '',
    email: profile?.companies?.email || '',
    phone: profile?.companies?.phone || '',
    address: profile?.companies?.address || '',
    google_review_url: profile?.companies?.google_review_url || '',
    final_offer_enabled: profile?.companies?.final_offer_enabled ?? false,
    final_offer_discount_pct: profile?.companies?.final_offer_discount_pct ?? 10,
    final_offer_days_threshold: profile?.companies?.final_offer_days_threshold ?? 5,
    final_offer_validity_days: profile?.companies?.final_offer_validity_days ?? 7,
  });

  const canManageFinalOffer = ['owner', 'admin', 'manager'].includes(profile?.role || '');

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { error } = await (supabase
        .from('companies') as any)
        .update(formData)
        .eq('id', profile.company_id);

      if (error) throw error;
      await refreshProfile();
      navigate(-1);
    } catch (err) {
      console.error('Error updating company:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 active:scale-90 transition-transform">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-primary">Company Profile</h1>
          </div>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-accent text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      <div className="w-full max-w-full p-6 space-y-6 overflow-x-hidden">
        {/* Logo Section */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <div className="h-24 w-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-xl border border-slate-100 overflow-hidden">
              {profile?.companies?.logo_url ? (
                <img src={profile.companies.logo_url} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Building2 size={40} className="text-slate-200" />
              )}
            </div>
            <button className="absolute bottom-0 right-0 h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <Camera size={14} />
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Logo</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-accent/20"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email"
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-accent/20"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="tel"
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-accent/20"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Address</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-accent/20"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Google Review URL</label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="url"
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-accent/20"
                placeholder="https://g.page/r/..."
                value={formData.google_review_url}
                onChange={(e) => setFormData({ ...formData, google_review_url: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Final Offer — owner / admin / manager only */}
        {canManageFinalOffer && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Final Offer</h2>
              <p className="text-xs text-slate-400 mt-1 ml-1">
                When enabled, sales reps can send a one-time discounted offer to customers who have viewed but not signed an estimate.
              </p>
            </div>

            {/* Toggle */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Tag size={18} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-primary">Enable Final Offer</p>
                  <p className="text-xs text-slate-400">Allow reps to send a discounted final offer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, final_offer_enabled: !prev.final_offer_enabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.final_offer_enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.final_offer_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {formData.final_offer_enabled && (
              <>
                {/* Discount % */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Discount Percentage (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-accent/20"
                    placeholder="e.g. 10"
                    value={formData.final_offer_discount_pct}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, final_offer_discount_pct: Math.min(50, Math.max(1, Number(e.target.value))) }))
                    }
                  />
                  <p className="text-xs text-slate-400 ml-1">
                    This discount will be applied to the estimate total when a Final Offer is sent.
                  </p>
                </div>

                {/* Days threshold */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Days Before Final Offer Is Available
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-accent/20"
                    placeholder="e.g. 5"
                    value={formData.final_offer_days_threshold}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, final_offer_days_threshold: Math.min(90, Math.max(1, Number(e.target.value))) }))
                    }
                  />
                  <p className="text-xs text-slate-400 ml-1">
                    The "Send Final Offer" button appears only after this many days since the estimate was sent.
                  </p>
                </div>

                {/* Validity days */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Offer Valid For (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-accent/20"
                    placeholder="e.g. 7"
                    value={formData.final_offer_validity_days}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, final_offer_validity_days: Math.min(90, Math.max(1, Number(e.target.value))) }))
                    }
                  />
                  <p className="text-xs text-slate-400 ml-1">
                    How many days the discount is valid after the offer is sent. An expiration date is included in the offer email so the customer knows it's time-limited.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
