// Settings → Company Settings: QuoteMGR's company setup page (general,
// About Us with showcase photos, warranty, price library and template prices),
// copied from QuoteMGR as-is. This loads the company row it edits.
//
// The column list is QuoteMGR's, plus the fields its page edits but QuoteMGR's
// own loader leaves out (receipt CCs, deposit %, payment terms, service
// requests, branding). Without them the page would open those fields blank
// and the next autosave would overwrite what was saved. smtp_password is never
// read into the browser; the page only writes it when a new one is typed.
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CompanySetup from '@/components/CompanySetup';
import type { Company, TeamMember } from '@/data/quoteData';

const COMPANY_COLUMNS = [
  'id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'logo_url', 'logo_zoom',
  'about_text', 'warranty_text', 'license_number', 'website', 'sales_can_edit_pricing', 'invite_code',
  'preferred_shingle_brand', 'preferred_siding_brand', 'material_preferences',
  'quote_sender_name', 'quote_sender_email', 'quote_reply_to_email', 'email_send_mode', 'connected_mail_provider',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_username',
  'quote_primary_color', 'quote_secondary_color', 'quote_accent_color', 'quote_customer_layout',
  'about_tagline', 'about_mission', 'about_highlights', 'about_showcase_photos', 'about_page_template',
  'about_bg_image_url', 'about_bg_opacity', 'about_bg_zoom', 'about_process_steps',
  'subscription_status', 'subscription_plan', 'subscription_period_end', 'trial_ends_at',
  'quote_watermark_url', 'quote_watermark_opacity', 'quote_watermark_rotation', 'quote_watermark_size',
  'setup_guide_progress', 'watermark_exempt',
  'final_offer_enabled', 'final_offer_discount_pct', 'final_offer_days_threshold', 'final_offer_validity_days',
  'sales_can_send_final_offer', 'permissions_config', 'receipt_footer_text', 'follow_up_message',
  'standard_price_list_name', 'supplement_rates',
  'signing_followup_enabled', 'signing_followup_deposit_pct', 'signing_followup_payment_methods',
  'cost_recovery_clause_enabled', 'auto_countersign_enabled', 'default_signer_id',
  // Edited on the page but missing from QuoteMGR's loader.
  'receipt_cc_emails', 'default_deposit_percent', 'payment_terms_text', 'enable_service_requests',
  'hide_quotemgr_branding',
].join(', ');

interface CompanySettingsPanelProps {
  companyId: string;
  userRole: string;
}

export default function CompanySettingsPanel({ companyId, userRole }: CompanySettingsPanelProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCompany(null);
    setError(null);
    supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError || !data) {
          setError(loadError?.message || 'Company not found.');
          return;
        }
        setCompany(data as unknown as Company);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-700">
        Could not load company settings: {error}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Loading company settings…
      </div>
    );
  }

  // CompanySetup only reads the role from the member it is given.
  const member = { role: userRole } as TeamMember;

  return <CompanySetup company={company} user={member} onUpdate={setCompany} />;
}
