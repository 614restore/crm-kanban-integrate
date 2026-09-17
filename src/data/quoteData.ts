// Copied from QuoteMGR src/data/quoteData.ts (read-only reference).
// QuoteMGR Types and Default Data

// ── Material Preferences (Fast Lane) ─────────────────────────────────────────
export interface TierMaterial {
  product: string;     // e.g. "GAF Timberline HDZ"
  warranty?: string;   // e.g. "Lifetime"
  notes?: string;
  per_sq?: number;     // company's all-in price per square for this material (material + labor)
  // Roofing supporting materials — kept per-tier so each tier's accessories can
  // correlate to whichever brand/product that tier actually uses (e.g. Good
  // using an Atlas shingle keeps Atlas underlayment/ice&water/etc., even if
  // Better uses a different manufacturer entirely).
  underlayment?: string; // e.g. "GAF FeltBuster Synthetic"
  ice_water?:    string; // e.g. "GAF WeatherWatch"
  starter?:      string; // e.g. "GAF ProStart"
  ridge_cap?:    string; // e.g. "GAF TimberTex"
  drip_edge?:    string; // e.g. "Aluminum drip edge"
}

export interface MaterialPreferences {
  roofing?: {
    good?:        TierMaterial;
    better?:      TierMaterial;
    best?:        TierMaterial;
    // Deprecated flat fallbacks — pre-per-tier data may still have these set.
    // New saves no longer rely on them (each tier carries its own values above),
    // but they're kept here so old company records still read back correctly.
    underlayment?: string;   // e.g. "Synthetic underlayment"
    ice_water?:    string;   // e.g. "GAF WeatherWatch"
    starter?:      string;   // e.g. "GAF ProStart"
    ridge_cap?:    string;   // e.g. "GAF TimberTex"
    drip_edge?:    string;   // e.g. "Aluminum drip edge"
  };
  siding?: {
    good?:        TierMaterial;
    better?:      TierMaterial;
    best?:        TierMaterial;
    house_wrap?:  string;    // e.g. "Tyvek HomeWrap"
  };
  gutters?: {
    material?: string;       // e.g. "Aluminum"
    style?:    string;       // e.g. "K-style"
    size?:     string;       // e.g. '5"'
    color?:    string;       // e.g. "White"
  };
}

export interface Company {
  id: string;
  name: string;
  email: string;
  quote_sender_name?: string | null;
  quote_sender_email?: string | null;
  quote_reply_to_email?: string | null;
  email_send_mode?: 'shared' | 'smtp' | null;
  connected_mail_provider?: 'gmail' | 'outlook' | 'custom' | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_secure?: boolean | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  logo_url: string;
  logo_zoom: number;
  about_text: string;
  warranty_text: string;
  license_number: string;
  website: string;
  sales_can_edit_pricing: boolean;
  quote_primary_color?: string;
  quote_secondary_color?: string;
  quote_accent_color?: string;
  tier_good_color?: string | null;
  tier_better_color?: string | null;
  tier_best_color?: string | null;
  quote_customer_layout?: 'modern' | 'classic';
  invite_code?: string;
  preferred_shingle_brand?: string | null;
  preferred_siding_brand?: string | null;
  material_preferences?: MaterialPreferences | null;
  // About Us page
  about_tagline?: string | null;
  about_mission?: string | null;
  about_highlights?: Array<{ title: string; description: string; photoUrl?: string }> | null;
  about_process_steps?: Array<{ title: string; description: string }> | null;
  about_showcase_photos?: Array<{ url: string; caption?: string }> | null;
  about_page_template?: 'about_us' | 'value_pillars' | null;
  about_bg_image_url?: string | null;
  about_bg_opacity?: number | null;
  about_bg_zoom?: number | null;
  // Insurance supplement rates (owner/admin configurable in Price Library settings)
  supplement_rates?: {
    mod_steep?:             { good: number; better: number; best: number };
    steep?:                 { good: number; better: number; best: number };
    very_steep?:            { good: number; better: number; best: number };
    two_story?:             { good: number; better: number; best: number };
    three_plus_story?:      { good: number; better: number; best: number };
    /** When true, the company's price list already contains sell prices (markup baked in). */
    prices_include_markup?: boolean;
  } | null;
  // Pricing defaults
  default_margin_percent?: number | null;  // 0–100; default 50 (applied automatically on measurement import)
  margin_locked?: boolean | null;          // when true, team members cannot adjust the margin in QuoteBuilder
  default_deposit_percent?: number | null; // 0–100; default 50 (shown in quote acceptance payment schedule)
  payment_terms_text?: string | null;      // custom payment terms verbiage; overrides auto-generated schedule when set
  // Quote watermark (user-uploaded image shown diagonally across each PDF page)
  quote_watermark_url?: string | null;
  quote_watermark_opacity?: number | null; // 0.0–1.0, default 0.08
  quote_watermark_rotation?: 'diagonal' | 'straight' | null; // default 'diagonal'
  quote_watermark_size?: number | null; // 0.20–1.40 multiplier; 0.55 = subtle, 1.40 = full page
  // Customer-facing service request form on the quote portal (default on)
  enable_service_requests?: boolean | null;
  // Hide the "Designed with QuoteMGR" footer line on customer documents
  hide_quotemgr_branding?: boolean | null;
  // Setup guide progress
  setup_guide_progress?: Record<string, 'done' | 'skipped'> | null;
  // Final Offer feature
  final_offer_enabled?: boolean | null;
  final_offer_discount_pct?: number | null;
  final_offer_days_threshold?: number | null;
  final_offer_validity_days?: number | null;
  sales_can_send_final_offer?: boolean | null;
  permissions_config?: Record<string, any> | null;
  // Needs-attention follow-up
  follow_up_message?: string | null;
  // Company standard price list (set by owner/admin; any team member can restore to it)
  standard_price_list_name?: string | null;
  // Post-signing deposit follow-up email
  signing_followup_enabled?: boolean | null;
  signing_followup_deposit_pct?: number | null;
  signing_followup_payment_methods?: string[] | null;
  // Post-approval cost-recovery clause in 3-Day Cancel section
  cost_recovery_clause_enabled?: boolean | null;
  // Subscription / billing
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | null;
  subscription_plan?: 'starter' | 'professional' | 'business' | 'enterprise' | null;
  subscription_period_end?: string | null;
  trial_ends_at?: string | null;
}


export interface TeamMember {
  id: string;
  company_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'salesperson' | 'sales' | 'canvasser';
  phone: string;
  is_active: boolean;
  created_at: string;
  last_login: string;
  avatar_url?: string | null;
  can_export?: boolean;
}

export interface Contact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface CustomPageAttachment {
  id: string;
  url: string;
  name: string;
  type: string;
}

export interface CustomQuotePage {
  id: string;
  title: string;
  body: string;
  attachments: CustomPageAttachment[];
  created_at?: string;
  updated_at?: string;
}

export interface Estimate {
  id: string;
  company_id: string;
  created_by: string;
  contact_id: string;
  estimate_number: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'declined';
  job_type: 'exterior' | 'interior' | 'both';
  job_description: string;
  good_total: number;
  better_total: number;
  best_total: number;
  selected_tier: 'good' | 'better' | 'best' | 'all' | null;
  notes: string;
  cover_page_title: string;
  include_about_page: boolean;
  include_warranty_page: boolean;
  include_cancel_notice: boolean;
  include_custom_page?: boolean;
  custom_page_title?: string | null;
  custom_page_body?: string | null;
  custom_page_file_url?: string | null;
  custom_page_file_name?: string | null;
  custom_page_file_type?: string | null;
  selected_custom_pages?: CustomQuotePage[] | null;
  include_better: boolean;
  include_best: boolean;
  measurement_provider?: string | null;
  measurement_source_name?: string | null;
  measurement_data?: Record<string, unknown> | null;
  tier_photo_good: string | null;
  tier_photo_better: string | null;
  tier_photo_best: string | null;
  cover_photo_url?: string | null;
  cover_photo_zoom?: number | null;
  cover_photo_offset_x?: number | null;
  cover_photo_offset_y?: number | null;
  sales_rep_photo_url?: string | null;
  sales_rep_photo_zoom?: number | null;
  sales_rep_photo_offset_x?: number | null;
  sales_rep_photo_offset_y?: number | null;
  show_good_tier: boolean;
  show_better_tier: boolean;
  show_best_tier: boolean;
  good_tier_name: string;
  better_tier_name: string;
  best_tier_name: string;
  show_line_item_prices: boolean;
  show_section_totals: boolean;
  use_manual_totals?: boolean;
  manual_good_total?: number | null;
  manual_better_total?: number | null;
  manual_best_total?: number | null;
  page_order: string[] | null;
  valid_until: string;
  measurement_report_url?: string | null;
  include_measurement_report?: boolean | null;
  signed_at: string | null;
  signed_by: string | null;
  signature_data: string | null;
  contractor_signature_data?: string | null;
  contractor_signed_by?: string | null;
  contractor_signed_at?: string | null;
  completion_certificate_sent_at?: string | null;
  completion_certificate_viewed_at?: string | null;
  certificate_customer_signature_data?: string | null;
  certificate_cancel_signature_data?: string | null;
  certificate_customer_signed_at?: string | null;
  contingency_enabled?: boolean | null;
  contingency_signed_at?: string | null;
  contingency_signed_by?: string | null;
  inspection_report_sent_at?: string | null;
  inspection_report_viewed_at?: string | null;
  share_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  final_offer_sent_at?: string | null;
  final_offer_discount_pct?: number | null;
  final_offer_pending_at?: string | null;
  final_offer_pending_discount_pct?: number | null;
  final_offer_pending_validity_days?: number | null;
  final_offer_submitted_by?: string | null;
  quote_structure_type?: QuoteStructureType | null;
  selected_option_id?: string | null;
  include_signing_followup?: boolean | null;
  countersigned_copy_sent_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact?: Contact;
  creator?: TeamMember;
  line_items?: LineItem[];
  photos?: EstimatePhoto[];
  options?: QuoteOption[];
}


export type QuoteStructureType = 'tiered' | 'multi_scope' | 'inspection_report' | 'insurance_invoice' | 'insurance_supplement';

export interface QuoteOption {
  id: string;
  quote_id: string;
  name: string;
  sort_order: number;
  subtotal: number;
  color?: string | null;
  created_at?: string;
}

export interface LineItem {
  id: string;
  quote_id: string;
  estimate_id?: string; // backwards compat alias
  category: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  good_price: number;
  better_price: number;
  best_price: number;
  sort_order: number;
  fixed_price?: boolean;
  // Per-tier product/material grade (e.g. "Atlas ProLam" / "Atlas Pinnacle Pristine" / "Atlas StormMaster")
  good_product?: string;
  better_product?: string;
  best_product?: string;
  // Which tiers this item applies to — empty/null means all tiers (shared item).
  // e.g. ['good'] means this item only shows in the Good tier column.
  tiers_applicable?: string[];
  // New option-based fields — set when quote uses quote_options architecture
  quote_option_id?: string | null;
  price?: number | null;
  product_name?: string | null;
  // Highlight flag — draws customer attention to this line item in the quote preview
  highlighted?: boolean;
  // Internal-only line (labor, cost basis). Excluded from every customer-facing
  // render, but its dollars stay inside the tier totals the customer sees.
  hidden_from_customer?: boolean;
  /** Estimator-only note. Never rendered on customer-facing documents. */
  internal_note?: string | null;
}


export interface CompanyPricing {
  id: string;
  company_id: string;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  good_price: number;
  better_price: number;
  best_price: number;
  fixed_price?: boolean;
  /** Internal-only item (labor). Arrives pre-hidden when added to a quote. */
  hidden_from_customer?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EstimatePhoto {
  id: string;
  estimate_id?: string;
  quote_id?: string;
  photo_url: string;
  caption: string;
  damage_type: string;
  location: string;
  notes: string;
  sort_order: number;
}

export const photoLocations = [
  'Front',
  'Back',
  'Left Side',
  'Right Side',
  'Roof',
  'Siding',
  'Gutters',
  'Windows',
  'First Story',
  'Second Story',
  'Interior',
  'Garage',
  'Other',
];


export interface EstimateSignature {
  id: string;
  estimate_id: string;
  signer_name: string;
  signer_email: string;
  signature_data: string;
  signed_at: string;
  cancel_deadline: string;
}

export interface LineItemTemplate {
  item_name: string;
  description: string;
  unit: string;
  good_price: number;
  better_price: number;
  best_price: number;
  quantity?: number;
  fixed_price?: boolean;
  /** When true, FastLane/Strike mode starts this item at qty 0 so it doesn't
   *  auto-include in the total. The user can enable it manually by setting a qty. */
  optional?: boolean;
}

export interface QuoteProjectTemplate {
  id: string;
  name: string;
  description: string;
  projectType: 'exterior' | 'interior' | 'both';
  coverPageTitle: string;
  projectDescription: string;
  lineItems: Array<LineItemTemplate & { category: string }>;
}

export interface EstimatePackage {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimatePackageItem {
  id: string;
  package_id: string;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  good_price: number;
  better_price: number;
  best_price: number;
  sort_order: number;
  fixed_price?: boolean;
}

export interface EstimateNotification {
  id: string;
  company_id: string;
  estimate_id: string;
  event_type: 'viewed' | 'signed' | 'email_opened' | 'email_clicked';
  message: string;
  actor_name?: string | null;
  actor_email?: string | null;
  created_at: string;
  read_at?: string | null;
}


export const lineItemCategories = [
  'Roofing',
  'Gutters',
  'Siding',
  'Windows',
  'Doors',
  'Paint - Exterior',
  'Paint - Interior',
  'Drywall',
  'Flooring',
  'Insulation',
  'Fencing',
  'Decking',
  'Solar',
  'Framing & Structural',
  'Finish Carpentry',
  'Trim & Millwork',
  'Trim & Finish',
  'General Labor',
  'Permits & Fees',
  'Other'
];

// Default line items by category
export const defaultLineItems: Record<string, LineItemTemplate[]> = {
  'Roofing': [
    { item_name: 'Tear Off Existing Roof', description: 'Remove and dispose of existing shingles and underlayment — single-layer tear-off labor is included in the Install Labor line', unit: 'sq', good_price: 45, better_price: 45, best_price: 45, fixed_price: true },
    { item_name: 'Shingle Install Labor', description: 'Shingle installation labor — per roofing square. Tear-off is a separate line item. 2nd/3rd layer surcharges are additional.', unit: 'sq', good_price: 85, better_price: 85, best_price: 85 },
    { item_name: 'Architectural Shingles', description: 'Dimensional architectural shingles — material only (contractor cost), per roofing square. Good: standard arch ~3 bdl/sq (e.g. GAF HDZ $36/bdl), Better: mid-grade (e.g. Atlas Pinnacle Pristine $36/bdl), Best: premium SBS (e.g. Atlas StormMaster $58.50/bdl)', unit: 'sq', good_price: 108, better_price: 126, best_price: 176 },
    { item_name: 'Synthetic Underlayment', description: 'Synthetic underlayment — 1 roll covers 1,000 sq ft (10 sq)', unit: 'roll', good_price: 55, better_price: 80, best_price: 105 },
    { item_name: 'Ice & Water Shield', description: 'Peel-and-stick ice & water protection at eaves and valleys — 1 roll = 200 sq ft', unit: 'roll', good_price: 60, better_price: 85, best_price: 120 },
    { item_name: 'Ridge Vent & Attic Ventilation Balance', description: 'Ridge exhaust vent — 1 box covers ~16–20 lf of ridgeline (Cor-A-Vent, VentSure, or equivalent)', unit: 'box', good_price: 25, better_price: 25, best_price: 25, fixed_price: true },
    { item_name: 'TruRidge Continuous Ridge Vent', description: 'Air Vent TruRidge continuous ridge vent — nailed along ridge cut for balanced attic ventilation — material per linear foot of ridge', unit: 'lf', good_price: 1.75, better_price: 2.25, best_price: 3.00 },
    { item_name: 'TruRidge EZ Ridge Vent', description: 'Air Vent TruRidge EZ tool-free continuous ridge vent — snap-lock installation over the ridge cut — material per linear foot of ridge', unit: 'lf', good_price: 2.00, better_price: 2.75, best_price: 3.50 },
    { item_name: 'T Style Drip Edge', description: "T-style aluminum drip edge flashing — 10' stick (material per piece)", unit: 'pc', good_price: 6, better_price: 8, best_price: 12 },
    { item_name: 'Pipe Boots / Split Boots / Seals', description: 'Rubber vent boots and split-boot seals for plumbing penetrations — material per boot', unit: 'each', good_price: 15, better_price: 25, best_price: 40 },
    { item_name: 'Starter Strip', description: 'Starter strip shingles at eaves and rakes — 1 bundle ≈ 105 lf', unit: 'bdl', good_price: 55, better_price: 55, best_price: 55, fixed_price: true },
    { item_name: 'Hip & Ridge Cap Shingles', description: 'Hip and ridge cap shingles — 1 bundle = 25 lf', unit: 'bdl', good_price: 50, better_price: 65, best_price: 85 },
    { item_name: 'Valley Metal', description: 'Pre-formed or rolled valley metal flashing — material per LF', unit: 'lf', good_price: 1.50, better_price: 2.25, best_price: 3.50 },
    { item_name: 'Step Flashing', description: 'Aluminum step flashing at wall-to-roof intersections — material per LF', unit: 'lf', good_price: 0.75, better_price: 1.25, best_price: 2.00 },
    { item_name: 'Flashing (Misc / Apron)', description: 'Miscellaneous wall/apron flashing, kickout flashing — material per LF', unit: 'lf', good_price: 0.75, better_price: 1.25, best_price: 2.00 },
    { item_name: 'Flashing Package (Valley/Step/Chimney)', description: 'Valley, step, chimney, and vent flashing materials — aluminum / galvalume / copper (lot allowance)', unit: 'lot', good_price: 100, better_price: 175, best_price: 300 },
    { item_name: 'Nails & Fasteners', description: 'Galvanized roofing nails — 1-1/4" coil nails (1 box ≈ 7,200 nails, covers approx. 20 sq)', unit: 'box', good_price: 28, better_price: 28, best_price: 45, fixed_price: true },
    { item_name: 'Caulk / Sealant', description: 'Roof-grade sealant at flashings, penetrations, and terminations — material per tube', unit: 'each', good_price: 10, better_price: 14, best_price: 20 },
    { item_name: 'Spray Paint & Finish Detailing', description: 'Touch-up spray paint for exposed metals and blended finish points — material per can', unit: 'each', good_price: 10, better_price: 14, best_price: 20 },
    { item_name: 'Steep Slope Labor', description: 'Additional labor for steep pitch roofing (≥7/12) — per square surcharge', unit: 'sq', good_price: 65, better_price: 85, best_price: 115 },
    { item_name: 'High Complexity Labor', description: 'Additional labor for high-complexity roof geometry (≥21 facets) — per square surcharge', unit: 'sq', good_price: 75, better_price: 75, best_price: 75 },
    // ── Flat roof materials ───────────────────────────────────────────────────
    { item_name: 'Asphalt Primer / Substrate Coat', description: 'Henry 177 or equivalent asphalt-based primer applied to deck/substrate before membrane — sold per gallon, ~100 sq ft/gal coverage', unit: 'gal', good_price: 35, better_price: 42, best_price: 50 },
    { item_name: 'ISO Insulation Board (2")', description: '2" polyisocyanurate insulation board — ~3 sheets per roofing sq (4×8 sheet = 32 sq ft), price is per roofing square (100 sq ft) installed', unit: 'sq', good_price: 100, better_price: 130, best_price: 175 },
    { item_name: 'Cover Board (1/2" Densdeck / HD ISO)', description: 'High-density cover board over ISO insulation for puncture resistance — ~3 sheets (4×8) per roofing square, price per roofing square material', unit: 'sq', good_price: 65, better_price: 90, best_price: 120 },
    // ── Chimney cap & masonry ─────────────────────────────────────────────────
    { item_name: 'Chimney Cap Removal & Disposal', description: 'Remove deteriorated chimney cap, crown material, or damaged mortar wash and dispose of debris', unit: 'each', good_price: 75, better_price: 75, best_price: 75, fixed_price: true },
    { item_name: 'Chimney Crown Wash Repair', description: 'Inspect crown for cracks and spalling — patch with hydraulic cement or rebuild mortar wash as needed', unit: 'each', good_price: 120, better_price: 185, best_price: 275 },
    { item_name: 'Chimney Cap (Galvanized / Stainless / Copper)', description: 'New fitted chimney cap — galvanized steel / 304 stainless multi-flue / copper heritage cap', unit: 'each', good_price: 85, better_price: 165, best_price: 340 },
    { item_name: 'Chimney Flashing Resealing', description: 'Inspect step, counter, and apron flashings — reseal all joints with elastomeric sealant', unit: 'each', good_price: 95, better_price: 145, best_price: 210 },
    { item_name: 'Chimney Repointing / Tuckpointing', description: 'Remove deteriorated mortar joints and repoint with Type S mortar — per course or full chimney', unit: 'lot', good_price: 175, better_price: 275, best_price: 425 },
    { item_name: 'Chimney Waterproof Sealant', description: 'Penetrating siloxane-based waterproof sealant applied to all exposed masonry surfaces', unit: 'each', good_price: 85, better_price: 125, best_price: 185 },
  ],
  'Gutters': [
    // ── Material cost per LF (aluminum coil stock / seamless machine roll) ────
    // Standard aluminum coil: $2.50-5/lf material; copper 3-4× premium
    { item_name: '5" K-Style Gutters', description: 'Seamless 5" K-style aluminum gutters — standard / heavy-gauge / copper — material cost per LF', unit: 'lf', good_price: 3.00, better_price: 5.00, best_price: 8.00 },
    { item_name: '6" K-Style Gutters', description: 'Seamless 6" K-style aluminum gutters for high-volume roof areas — material cost per LF', unit: 'lf', good_price: 4.00, better_price: 6.50, best_price: 10.00 },
    { item_name: 'Half-Round Gutters', description: '5" or 6" half-round aluminum/copper gutters for historic or architectural profiles — material cost per LF', unit: 'lf', good_price: 5.00, better_price: 9.00, best_price: 18.00 },
    { item_name: 'Downspouts', description: '2×3 or 3×4 aluminum downspouts — standard / oversized / corrugated — material cost per LF', unit: 'lf', good_price: 2.00, better_price: 3.00, best_price: 5.00 },
    // ── Gutter Guards — generic type (material cost) ───────────────────────────
    { item_name: 'Gutter Guards - Mesh Screen', description: 'Basic aluminum or plastic mesh screen — material cost per LF', unit: 'lf', good_price: 1.50, better_price: 1.50, best_price: 1.50, fixed_price: true },
    { item_name: 'Gutter Guards - Micro-Mesh (generic)', description: 'Fine stainless steel micro-mesh over aluminum frame — material cost per LF', unit: 'lf', good_price: 4.00, better_price: 8.00, best_price: 15.00 },
    { item_name: 'Gutter Guards - Solid Cover / Reverse Curve (generic)', description: 'Solid aluminum reverse-curve cover — material cost per LF', unit: 'lf', good_price: 6.00, better_price: 12.00, best_price: 20.00 },
    { item_name: 'Gutter Guards - Foam Insert', description: 'Porous polyurethane foam insert — material cost per LF', unit: 'lf', good_price: 1.50, better_price: 2.50, best_price: 3.00 },
    { item_name: 'Gutter Guards - Brush Insert', description: 'Cylindrical bristle brush — material cost per LF', unit: 'lf', good_price: 1.50, better_price: 2.00, best_price: 2.50 },
    // ── LeafFilter ────────────────────────────────────────────────────────────
    { item_name: 'LeafFilter Gutter Protection (5" gutter)', description: 'LeafFilter micro-mesh system for standard 5" K-style — surgical-grade stainless mesh, uPVC frame, lifetime transferable warranty. Installed price.', unit: 'lf', good_price: 17, better_price: 22, best_price: 28 },
    { item_name: 'LeafFilter Gutter Protection (6" gutter)', description: 'LeafFilter micro-mesh system for 6" K-style or oversized gutters — same surgical-grade mesh, wider frame. Installed price.', unit: 'lf', good_price: 20, better_price: 26, best_price: 32 },
    { item_name: 'LeafFilter Gutter Protection (4" gutter)', description: 'LeafFilter micro-mesh system for older 4" gutters — fits narrow profile. Installed price.', unit: 'lf', good_price: 15, better_price: 19, best_price: 24 },
    // ── GutterHelmet ──────────────────────────────────────────────────────────
    { item_name: 'GutterHelmet (Standard)', description: 'GutterHelmet original reverse-curve ribbed aluminum cover — patented nose-forward design, lifetime no-clog warranty. Installed price.', unit: 'lf', good_price: 20, better_price: 25, best_price: 32 },
    { item_name: 'GutterHelmet Diamond Series', description: 'GutterHelmet Diamond Series — textured diamond surface with enhanced debris-shedding geometry, premium finish options. Installed price.', unit: 'lf', good_price: 26, better_price: 32, best_price: 42 },
    // ── Other named brands ────────────────────────────────────────────────────
    { item_name: 'LeafGuard (Seamless One-Piece System)', description: 'LeafGuard seamless aluminum gutter + integrated hood — one-piece system replaces existing gutters entirely, lifetime clog-free guarantee. Installed price.', unit: 'lf', good_price: 25, better_price: 32, best_price: 42 },
    { item_name: 'HomeCraft Gutter Protection', description: 'HomeCraft micro-mesh gutter guard with stainless steel mesh and powder-coated aluminum body — lifetime transferable warranty. Installed price.', unit: 'lf', good_price: 14, better_price: 18, best_price: 24 },
    { item_name: 'Valor Gutter Guard', description: 'Valor stainless micro-mesh with raised v-groove pattern for self-cleaning — contractor/dealer installed. Installed price.', unit: 'lf', good_price: 12, better_price: 16, best_price: 22 },
    { item_name: 'K-Guard Leaf Free Gutter System', description: 'K-Guard complete seamless hooded gutter system — large 5" capacity, one-piece hood eliminates exposed seams. Installed price.', unit: 'lf', good_price: 22, better_price: 28, best_price: 38 },
    { item_name: 'MasterShield Gutter Guard', description: 'MasterShield micro-mesh installed at roof pitch angle — self-shedding slope prevents debris buildup, HydroVortex technology. Installed price.', unit: 'lf', good_price: 18, better_price: 24, best_price: 34 },
    { item_name: 'Raptor Gutter Guard (Micro-Mesh)', description: 'Raptor contractor-grade stainless micro-mesh with aluminum frame — professional installation version. Installed price.', unit: 'lf', good_price: 10, better_price: 14, best_price: 18 },
    { item_name: 'Gutter Removal', description: 'Remove and dispose of existing gutters and downspouts', unit: 'lf', good_price: 2, better_price: 2, best_price: 2, fixed_price: true },
    // ── Per-unit components (insurance supplements / itemized scopes) ─────────
    { item_name: 'Downspout Elbow / Miter (90° or 45°)', description: 'Aluminum downspout elbow for offset and directional turns', unit: 'each', good_price: 8, better_price: 10, best_price: 14 },
    { item_name: 'Gutter End Cap', description: 'Right or left aluminum end cap to close gutter run', unit: 'each', good_price: 6, better_price: 8, best_price: 12 },
    { item_name: 'Gutter Outlet Tube', description: 'Drop outlet connecting gutter to downspout', unit: 'each', good_price: 8, better_price: 10, best_price: 14 },
    { item_name: 'Gutter Hanger / Bracket', description: 'Hidden hanger or spike-and-ferrule bracket — material per each', unit: 'each', good_price: 1.50, better_price: 2.00, best_price: 3.00 },
    { item_name: 'Gutter Apron Flashing', description: 'Aluminum gutter apron/drip edge extension behind existing fascia to redirect water into gutter — material per LF', unit: 'lf', good_price: 0.80, better_price: 1.25, best_price: 2.00 },
    { item_name: 'Downspout Extension / Splash Block', description: 'Flexible extension or concrete splash block to direct runoff away from foundation', unit: 'each', good_price: 15, better_price: 22, best_price: 35 },
    { item_name: 'Gutter Sealant (tube)', description: 'Gutter-grade silicone or polyurethane sealant for seams, joints, and end caps', unit: 'tube', good_price: 7, better_price: 9, best_price: 12 },
  ],
  'Siding': [
    // ── Tear-off ─────────────────────────────────────────────────────────────
    { item_name: 'Siding Removal', description: 'Remove and haul all existing siding — qty: total wall area in squares (1 sq = 100 sq ft)', unit: 'sq', good_price: 75, better_price: 75, best_price: 75, fixed_price: true },
    // ── Substrate & moisture management ──────────────────────────────────────
    { item_name: 'Sheathing / OSB Repair', description: 'Inspect and replace damaged 7/16" OSB sheathing sections — qty: affected area in squares', unit: 'sq', good_price: 110, better_price: 110, best_price: 110, fixed_price: true },
    { item_name: 'House Wrap / WRB', description: 'Tyvek or equivalent weather barrier, fully lapped and taped — qty: total wall area in squares', unit: 'sq', good_price: 30, better_price: 38, best_price: 50 },
    { item_name: 'Foam Insulation Backer Board', description: 'Rigid foam backer board (R-3 / R-5 / R-7) for added thermal performance — qty: total wall area in squares', unit: 'sq', good_price: 45, better_price: 75, best_price: 115 },
    // ── Main cladding (single tiered item, good/better/best = product grade) ──
    { item_name: 'Siding Panels', description: 'Lap siding panels — Good: standard vinyl (0.040"), Better: premium insulated vinyl, Best: fiber cement (HardiePlank-class) — qty: total wall area in squares', unit: 'sq', good_price: 240, better_price: 350, best_price: 760 },
    // ── Trim system (lf items — quantity driven by wall perimeter) ────────────
    { item_name: 'Starter Strip', description: 'Aluminum/vinyl strip at wall base, aligns the first siding course — qty: total LF of wall base perimeter', unit: 'lf', good_price: 0.85, better_price: 1.15, best_price: 1.50 },
    { item_name: 'J-Channel', description: 'J-channel at window/door openings and eave/soffit terminations — 12 ft stick, material cost per stick', unit: 'stick', good_price: 6.00, better_price: 9.00, best_price: 13.00 },
    { item_name: 'Outside Corners', description: 'Outside corner posts (12.5 ft sticks) — qty: total LF across all exterior corners (count × height)', unit: 'lf', good_price: 2.00, better_price: 3.25, best_price: 5.00 },
    { item_name: 'Inside Corners', description: 'Inside corner posts (12.5 ft sticks) — qty: total LF across all interior wall angles (count × height)', unit: 'lf', good_price: 3.25, better_price: 3.75, best_price: 7.00 },
    { item_name: 'Window & Door Trim', description: 'Window and door casing / brick molding / flat trim — qty: total LF of all window and door perimeters (material per lf)', unit: 'lf', good_price: 1.50, better_price: 2.50, best_price: 4.00 },
    { item_name: 'Drip Cap / Head Flashing', description: 'Metal flashing above windows, doors, and horizontal transitions — qty: total LF of horizontal opening heads (material per lf)', unit: 'lf', good_price: 0.85, better_price: 1.50, best_price: 2.50 },
    { item_name: 'Under-Sill Trim', description: 'Vinyl utility/under-sill trim channel at window sill and horizontal cuts — holds and seals top edge of cut siding panel — material per lf', unit: 'lf', good_price: 0.30, better_price: 0.50, best_price: 0.75 },
    { item_name: 'Mounting Blocks', description: 'Siding mounting blocks for light fixtures, electrical outlets, hose bibs, cable penetrations — qty: total count per job', unit: 'each', good_price: 8, better_price: 12, best_price: 18 },
    { item_name: 'Soffit', description: 'Vinyl or aluminum soffit panels — material per linear foot', unit: 'lf', good_price: 2.00, better_price: 3.50, best_price: 5.50 },
    { item_name: 'Fascia', description: 'Aluminum wrap coil or composite fascia — material per linear foot', unit: 'lf', good_price: 1.75, better_price: 3.00, best_price: 5.00 },
    // ── Lot allowances ────────────────────────────────────────────────────────
    { item_name: 'Trim Package', description: 'All trim bundled: inside/outside corners, window/door casing, frieze boards, and termination trims — qty: 1 per job', unit: 'lot', good_price: 550, better_price: 850, best_price: 1250 },
    { item_name: 'Flashing Package', description: 'Kickout, step, Z-, and cap flashing at all wall/roof intersections and penetrations — qty: 1 per job', unit: 'lot', good_price: 225, better_price: 350, best_price: 525 },
    { item_name: 'Sheathing Tape / WRB Tape', description: 'Self-adhesive seam tape for house wrap / WRB lap joints, window rough openings, and transitions — Tyvek tape or equivalent — material per roll (~75 lf)', unit: 'roll', good_price: 12, better_price: 18, best_price: 28 },
    { item_name: 'Furring Strips', description: '1×3 or 1×4 pressure-treated furring strips for rainscreen drainage plane or plumb-correction over irregular sheathing — material per lf', unit: 'lf', good_price: 0.45, better_price: 0.65, best_price: 0.95 },
    { item_name: 'Siding Vents', description: 'Through-wall vent covers — dryer exhaust, bath fan, kitchen exhaust, or HRV termination — qty: total vent count on elevations being sided', unit: 'each', good_price: 12, better_price: 20, best_price: 35 },
    { item_name: 'Exterior Paint / Stain', description: 'Exterior paint or solid stain for fiber cement, engineered wood, or bare wood siding — premium 100% acrylic latex — material per gallon (1 gal ≈ 300–400 sq ft / coat)', unit: 'gal', good_price: 35, better_price: 55, best_price: 85 },
    { item_name: 'Siding Nails & Fasteners', description: 'Corrosion-resistant nails, screws, or hidden clips for siding type', unit: 'lot', good_price: 135, better_price: 210, best_price: 310 },
    { item_name: 'Siding Caulk / Sealant', description: 'Exterior-grade silicone caulk at penetrations, corners, and approved joints', unit: 'lot', good_price: 180, better_price: 275, best_price: 400 },
    { item_name: 'Site Protection & Cleanup', description: 'Protect landscaping and property; remove and haul debris after installation', unit: 'lot', good_price: 350, better_price: 350, best_price: 350, fixed_price: true },
    { item_name: 'Permit & Disposal Fees', description: 'Permit processing and dumpster/disposal fees', unit: 'lot', good_price: 425, better_price: 425, best_price: 425, fixed_price: true },
    // ── Royal Building Products — vinyl siding panels ─────────────────────────
    { item_name: 'Royal Estate Vinyl Siding', description: 'Royal Estate vinyl siding — qty: wall area in squares; verify current dealer pricing and color upcharges', unit: 'sq', good_price: 154, better_price: 154, best_price: 154 },
    { item_name: 'Royal Woodland 16', description: 'Royal vinyl siding — verify pricing with local distributor', unit: 'sq', good_price: 160, better_price: 160, best_price: 160 },
    { item_name: 'Royal DuraPlank', description: 'Royal DuraPlank vinyl siding — verify pricing with local distributor', unit: 'sq', good_price: 210, better_price: 210, best_price: 210 },
    // ── ProVia — vinyl siding panels ─────────────────────────────────────────
    { item_name: 'ProVia Ultra Lifestyle', description: 'ProVia non-insulated vinyl siding — 2025 price sheet', unit: 'sq', good_price: 86.02, better_price: 86.02, best_price: 86.02 },
    { item_name: 'ProVia Willowbrook Lifestyle', description: 'ProVia non-insulated vinyl siding — 2025 price sheet', unit: 'sq', good_price: 99.02, better_price: 99.02, best_price: 99.02 },
    { item_name: 'ProVia Willowbrook Signature', description: 'ProVia premium non-insulated vinyl siding — 2025 price sheet', unit: 'sq', good_price: 112.07, better_price: 112.07, best_price: 112.07 },
    { item_name: 'ProVia Hearttech Lifestyle', description: 'ProVia vinyl siding — 2025 price sheet', unit: 'sq', good_price: 106.46, better_price: 106.46, best_price: 106.46 },
    { item_name: 'ProVia Hearttech Signature', description: 'ProVia premium vinyl siding — 2025 price sheet', unit: 'sq', good_price: 117.92, better_price: 117.92, best_price: 117.92 },
    { item_name: 'ProVia Cedarpeaks Lifestyle', description: 'ProVia vinyl siding — 2025 price sheet', unit: 'sq', good_price: 120.91, better_price: 120.91, best_price: 120.91 },
    { item_name: 'ProVia Cedarpeaks Signature', description: 'ProVia premium vinyl siding — 2025 price sheet', unit: 'sq', good_price: 135.81, better_price: 135.81, best_price: 135.81 },
    { item_name: 'ProVia CedarMax D6 Lifestyle', description: 'ProVia insulated siding — verify stock and freight', unit: 'sq', good_price: 278.56, better_price: 278.56, best_price: 278.56 },
    { item_name: 'ProVia CedarMax D6 Signature', description: 'ProVia insulated premium siding — verify stock and freight', unit: 'sq', good_price: 305.29, better_price: 305.29, best_price: 305.29 },
    { item_name: 'ProVia CedarMax S7 Lifestyle', description: 'ProVia insulated siding — verify stock and freight', unit: 'sq', good_price: 323.20, better_price: 323.20, best_price: 323.20 },
    { item_name: 'ProVia CedarMax S7 Signature', description: 'ProVia insulated premium siding — verify stock and freight', unit: 'sq', good_price: 356.91, better_price: 356.91, best_price: 356.91 },
    // ── ProVia — accessories (per carton / each) ──────────────────────────────
    { item_name: 'ProVia J-Channel Lifestyle', description: '1-1/8 in. J-channel — per carton; use linear footage conversion from carton coverage', unit: 'ctn', good_price: 205.48, better_price: 205.48, best_price: 205.48 },
    { item_name: 'ProVia J-Channel Signature', description: '1-1/8 in. J-channel — per carton; use linear footage conversion from carton coverage', unit: 'ctn', good_price: 298.23, better_price: 298.23, best_price: 298.23 },
    { item_name: 'ProVia Inside Corner Post Lifestyle', description: '1-1/8 in. inside corner post — per carton', unit: 'ctn', good_price: 177.14, better_price: 177.14, best_price: 177.14 },
    { item_name: 'ProVia Inside Corner Post Signature', description: '1-1/8 in. inside corner post — per carton', unit: 'ctn', good_price: 251.25, better_price: 251.25, best_price: 251.25 },
    { item_name: 'ProVia Outside Corner Post Lifestyle', description: '1-1/8 in. outside corner post — per carton', unit: 'ctn', good_price: 241.42, better_price: 241.42, best_price: 241.42 },
    { item_name: 'ProVia Outside Corner Post Signature', description: '1-1/8 in. outside corner post — per carton', unit: 'ctn', good_price: 336.97, better_price: 336.97, best_price: 336.97 },
    { item_name: 'ProVia Transition Trim Lifestyle', description: '1-1/8 in. transition trim — per carton', unit: 'ctn', good_price: 399.47, better_price: 399.47, best_price: 399.47 },
    { item_name: 'ProVia Transition Trim Signature', description: '1-1/8 in. transition trim — per carton', unit: 'ctn', good_price: 480.59, better_price: 480.59, best_price: 480.59 },
    { item_name: 'ProVia Window & Door Surround', description: "3/4 in. surround, 12'6\" — per carton", unit: 'ctn', good_price: 351.31, better_price: 351.31, best_price: 351.31 },
    { item_name: 'ProVia Mount Block STD Square', description: 'Standard square mount block for fixtures and penetrations', unit: 'ea', good_price: 11.41, better_price: 11.41, best_price: 11.41 },
    { item_name: 'ProVia Mount Block STD Jumbo', description: 'Standard jumbo mount block for fixtures and penetrations', unit: 'ea', good_price: 17.98, better_price: 17.98, best_price: 17.98 },
    { item_name: 'ProVia Split Block Mini', description: 'Mini split block for fixtures and penetrations', unit: 'ea', good_price: 11.40, better_price: 11.40, best_price: 11.40 },
    { item_name: 'ProVia Master Exhaust', description: 'Exhaust accessory for vent termination', unit: 'ea', good_price: 32.78, better_price: 32.78, best_price: 32.78 },
    { item_name: 'ProVia Trim Coil Stock', description: '50 ft color-match trim coil — stock color', unit: 'roll', good_price: 109.59, better_price: 109.59, best_price: 109.59 },
    { item_name: 'ProVia Trim Coil Non-Stock', description: '50 ft color-match trim coil — non-stock color', unit: 'roll', good_price: 170.64, better_price: 170.64, best_price: 170.64 },
  ],
  'Windows': [
    // ── Window units (supply + install) ──────────────────────────────────────
    // Ohio contractor pricing 2026; labor $200-400/window Columbus (separate)
    { item_name: 'Double Hung Window', description: 'Vinyl double-hung replacement window — standard / Energy Star / triple-pane (3×4 ft avg)', unit: 'each', good_price: 450, better_price: 650, best_price: 900 },
    { item_name: 'Casement Window', description: 'Vinyl casement window (crank-out) — standard / Energy Star / fiberglass', unit: 'each', good_price: 500, better_price: 750, best_price: 1050 },
    { item_name: 'Picture Window', description: 'Fixed picture window — standard / Energy Star / triple-pane', unit: 'each', good_price: 450, better_price: 700, best_price: 1050 },
    { item_name: 'Sliding Window', description: 'Horizontal sliding window — standard / Energy Star / triple-pane', unit: 'each', good_price: 350, better_price: 550, best_price: 800 },
    { item_name: 'Egress Window', description: 'Code-compliant egress window unit for basement/bedroom — includes enlarging opening if needed', unit: 'each', good_price: 800, better_price: 1200, best_price: 1800 },
    { item_name: 'Window Trim', description: 'Interior/exterior window trim and casing — per window', unit: 'each', good_price: 45, better_price: 75, best_price: 120 },
    // ── Per-unit installation materials (insurance supplements) ───────────────
    { item_name: 'Window Flashing Tape & Foam Kit', description: 'Self-adhering flashing tape for rough opening + low-expansion foam sealant — per window', unit: 'each', good_price: 28, better_price: 38, best_price: 50 },
    { item_name: 'Exterior Window Caulk (tube)', description: 'Exterior-grade silicone or polyurethane caulk for window perimeter seal', unit: 'tube', good_price: 8, better_price: 10, best_price: 14 },
    { item_name: 'Window Jamb Extension', description: 'PVC or wood jamb extension set for walls thicker than standard — per window', unit: 'each', good_price: 55, better_price: 80, best_price: 120 },
    { item_name: 'Window Screen Replacement', description: 'Standard fiberglass mesh screen in aluminum frame — per screen', unit: 'each', good_price: 30, better_price: 45, best_price: 65 },
  ],
  'Paint - Exterior': [
    { item_name: 'Exterior Paint - Walls', description: 'Prep, prime, and paint exterior walls', unit: 'sq ft', good_price: 2.50, better_price: 3.50, best_price: 5 },
    { item_name: 'Exterior Paint - Trim', description: 'Prep, prime, and paint exterior trim', unit: 'lf', good_price: 3, better_price: 5, best_price: 8 },
    { item_name: 'Power Washing', description: 'Power wash exterior surfaces', unit: 'sq ft', good_price: 0.25, better_price: 0.35, best_price: 0.50 },
  ],
  'Paint - Interior': [
    // ── Labor-inclusive (customer-facing per sq ft / lf) ──────────────────────
    { item_name: 'Interior Paint - Walls', description: 'Prep, prime, and paint interior walls — labor + material', unit: 'sq ft', good_price: 2, better_price: 3, best_price: 4.50 },
    { item_name: 'Interior Paint - Ceiling', description: 'Prep, prime, and paint ceiling — labor + material', unit: 'sq ft', good_price: 2.50, better_price: 3.50, best_price: 5 },
    { item_name: 'Interior Paint - Trim & Baseboards', description: 'Prep and paint interior trim, baseboards, and casings — labor + material', unit: 'lf', good_price: 2.50, better_price: 4, best_price: 6 },
    // ── Per-unit materials (for insurance supplements / itemized scopes) ───────
    // Ohio contractor pricing 2026 (Sherwin-Williams, Home Depot Pro, Menards)
    { item_name: 'Primer - Interior (1 gal)', description: 'Interior drywall primer — standard PVA / stain-blocking / premium high-hide', unit: 'gal', good_price: 28, better_price: 35, best_price: 45 },
    { item_name: 'Interior Paint (1 gal)', description: 'Latex interior paint — flat / satin / eggshell (1 gal covers ~400 sq ft)', unit: 'gal', good_price: 32, better_price: 42, best_price: 52 },
    { item_name: "Painter's Tape (roll)", description: '1.5" masking/painter tape — standard blue / low-tack / delicate surface', unit: 'roll', good_price: 5, better_price: 7, best_price: 9 },
    { item_name: 'Drop Cloth (9×12)', description: 'Floor/surface protection drop cloth — poly sheeting / canvas / heavyweight canvas duck', unit: 'each', good_price: 10, better_price: 14, best_price: 22 },
    { item_name: 'Roller Kit (Frame + Covers)', description: '9" roller frame with 2 covers — standard 3/8" nap / microfiber / professional set', unit: 'kit', good_price: 25, better_price: 32, best_price: 45 },
    { item_name: 'Ceiling Texture (Knockdown Kit)', description: 'Spray-on knockdown texture kit for ceiling patches and re-texture — 1 kit ≈ 150 sq ft', unit: 'kit', good_price: 32, better_price: 42, best_price: 55 },
  ],
  'Drywall': [
    // ── Labor-inclusive (customer-facing per sq ft / per job) ─────────────────
    { item_name: 'Drywall Installation', description: 'Hang, tape, mud, and finish new drywall — labor + material', unit: 'sq ft', good_price: 2, better_price: 2.50, best_price: 3.50 },
    { item_name: 'Drywall Repair (Small Patch)', description: 'Patch and finish holes up to 6" — labor + material', unit: 'each', good_price: 75, better_price: 125, best_price: 200 },
    { item_name: 'Drywall Repair (Large Section)', description: 'Cut-in and replace full damaged section, tape, mud, and blend — labor + material', unit: 'sq ft', good_price: 3.50, better_price: 5, best_price: 7 },
    { item_name: 'Texture Matching', description: 'Match existing wall/ceiling texture (knockdown, orange peel, smooth) — labor + material', unit: 'sq ft', good_price: 1.50, better_price: 2.50, best_price: 4 },
    // ── Per-unit materials (for insurance supplements / itemized scopes) ───────
    // Ohio contractor pricing 2026 (Home Depot Pro / Menards / Carter Lumber)
    { item_name: 'Drywall Sheet (4×8, 1/2")', description: 'Standard 1/2" gypsum drywall panel — standard / fire-rated (Type X) / moisture-resistant', unit: 'sheet', good_price: 13, better_price: 16, best_price: 20 },
    { item_name: 'Drywall Sheet (4×8, 5/8")', description: '5/8" gypsum panel — standard / Type X fire-rated / ceilings & heavy use', unit: 'sheet', good_price: 15, better_price: 18, best_price: 22 },
    { item_name: 'Joint Compound (5 gal)', description: 'Pre-mixed all-purpose joint compound — 1 bucket covers ~100 sq ft of taping', unit: 'bucket', good_price: 22, better_price: 25, best_price: 30 },
    { item_name: 'Drywall Tape (Mesh/Paper Roll)', description: 'Fiberglass mesh or paper drywall tape — 500 ft roll', unit: 'roll', good_price: 12, better_price: 15, best_price: 18 },
    { item_name: 'Drywall Screws (1 lb box)', description: '1-1/4" coarse-thread drywall screws — per pound box (~200 screws)', unit: 'box', good_price: 10, better_price: 10, best_price: 10, fixed_price: true },
    { item_name: 'Corner Bead (8 ft)', description: 'Metal or vinyl corner bead for outside corners — 8 ft length', unit: 'pc', good_price: 3, better_price: 4, best_price: 5 },
    { item_name: 'Self-Adhesive Drywall Patch', description: 'Pre-cut self-adhesive mesh patch panel — 4" / 8" / 12" sizes for small repairs', unit: 'each', good_price: 8, better_price: 12, best_price: 18 },
    { item_name: 'Furring Strip / Wood Backing', description: '2×2 or 2×4 backing for patching or bridging framing gaps (8 ft length)', unit: 'pc', good_price: 5, better_price: 7, best_price: 10 },
  ],
  'Flooring': [
    // ── Labor-inclusive (customer-facing per sq ft) ───────────────────────────
    // Ohio labor $2.50-6/sq ft; contractor material LVP $2-4/sq ft (2026)
    { item_name: 'Luxury Vinyl Plank (LVP)', description: 'Click-lock LVP flooring — standard 5mm / premium 7mm / waterproof SPC core — labor + material', unit: 'sq ft', good_price: 5, better_price: 7.50, best_price: 11 },
    { item_name: 'Laminate Flooring', description: 'Standard / Premium / Luxury laminate — labor + material', unit: 'sq ft', good_price: 4, better_price: 7, best_price: 11 },
    { item_name: 'Hardwood Flooring', description: 'Engineered / Solid hardwood — labor + material', unit: 'sq ft', good_price: 8, better_price: 12, best_price: 18 },
    { item_name: 'Tile Flooring', description: 'Ceramic / Porcelain tile — labor + material', unit: 'sq ft', good_price: 6, better_price: 10, best_price: 16 },
    { item_name: 'Carpet', description: 'Standard / Premium carpet with pad — labor + material', unit: 'sq ft', good_price: 3, better_price: 5, best_price: 8 },
    // ── Per-unit materials ─────────────────────────────────────────────────────
    { item_name: 'Flooring Underlayment', description: 'Foam / cork / combo underlayment pad for LVP or laminate — per sq ft', unit: 'sq ft', good_price: 0.20, better_price: 0.35, best_price: 0.55 },
    { item_name: 'Flooring Adhesive / Glue', description: 'Full-spread or perimeter adhesive for glue-down LVP in wet areas — per sq ft', unit: 'sq ft', good_price: 0.30, better_price: 0.45, best_price: 0.65 },
    { item_name: 'Transition Strip (T-Mold / Reducer)', description: 'Matching color T-mold or reducer strip at doorways and flooring transitions — 4 ft length', unit: 'each', good_price: 18, better_price: 28, best_price: 40 },
    { item_name: 'Quarter Round / Shoe Molding', description: 'Matching quarter round or shoe molding at wall-to-floor joint — per LF', unit: 'lf', good_price: 1.50, better_price: 2.25, best_price: 3.50 },
    { item_name: 'Self-Leveling Compound (Subfloor Leveler)', description: '50 lb bag self-leveling underlayment for subfloor prep — 1 bag ≈ 40 sq ft at 1/8"', unit: 'bag', good_price: 28, better_price: 35, best_price: 45 },
    { item_name: 'Tile / Backsplash (material)', description: 'Ceramic / porcelain / glass mosaic tile — material cost per sq ft (labor separate)', unit: 'sq ft', good_price: 3, better_price: 7, best_price: 14 },
    { item_name: 'Tile Grout & Thinset', description: 'Unsanded/sanded grout and polymer-modified thinset mortar — per lot (50 sq ft coverage)', unit: 'lot', good_price: 35, better_price: 45, best_price: 60 },
  ],
  'Trim & Finish': [
    { item_name: 'Baseboard / Trim (PVC or MDF)', description: 'Primed PVC or MDF baseboard and casing — standard / stepped / craftsman profile', unit: 'lf', good_price: 2, better_price: 3, best_price: 4.50 },
    { item_name: 'Trim Installation Labor', description: 'Cut, fit, nail, and caulk baseboard, door casing, and window trim', unit: 'lf', good_price: 3, better_price: 4.50, best_price: 6.50 },
    { item_name: 'Caulk / Sealant (tube)', description: 'Paintable latex or silicone caulk — standard / paintable siliconized / premium', unit: 'tube', good_price: 4, better_price: 6, best_price: 8 },
    { item_name: 'Door Pre-Hung (Interior)', description: 'Pre-hung interior door unit, install in existing rough opening — standard / solid core / solid wood', unit: 'each', good_price: 250, better_price: 400, best_price: 650 },
    { item_name: 'Door Hardware (Knob/Lever Set)', description: 'Interior door knob or lever passage set — standard / keyed / premium', unit: 'each', good_price: 35, better_price: 65, best_price: 120 },
    { item_name: 'Lighting Fixture (Interior)', description: 'Basic recessed LED / flush mount / semi-flush fixture — materials only', unit: 'each', good_price: 45, better_price: 90, best_price: 175 },
  ],
  'Doors': [
    // ── Exterior doors — supply + install ─────────────────────────────────────
    // Ohio contractor cost $500-900; labor $300-600/door Columbus (2026)
    { item_name: 'Exterior Door - Fiberglass (Pre-Hung)', description: 'Pre-hung fiberglass entry door 36×80" — standard / insulated glass lite / premium smooth/wood-grain finish', unit: 'each', good_price: 900, better_price: 1400, best_price: 2100 },
    { item_name: 'Exterior Door - Steel (Pre-Hung)', description: 'Pre-hung steel entry door 36×80" — standard / insulated glass / heavy-duty with security reinforcement', unit: 'each', good_price: 750, better_price: 1100, best_price: 1700 },
    { item_name: 'Exterior Door - Wood (Pre-Hung)', description: 'Solid wood or wood-core pre-hung entry door — paint-grade / stain-grade / mahogany or knotty alder', unit: 'each', good_price: 1200, better_price: 1800, best_price: 2800 },
    { item_name: 'Patio Door - Sliding (Vinyl)', description: '6 ft or 8 ft vinyl sliding patio door, double-pane — standard / Energy Star / triple-pane', unit: 'each', good_price: 1100, better_price: 1700, best_price: 2600 },
    { item_name: 'Patio Door - French (Hinged)', description: 'French hinged patio door set, inswing or outswing — standard / Energy Star / fiberglass', unit: 'each', good_price: 1400, better_price: 2200, best_price: 3400 },
    { item_name: 'Storm Door', description: 'Full-view aluminum storm door — standard / retractable screen / triple-track', unit: 'each', good_price: 350, better_price: 550, best_price: 850 },
    { item_name: 'Interior Door (Pre-Hung)', description: 'Pre-hung interior door in existing rough opening — hollow-core / solid-core / solid wood', unit: 'each', good_price: 250, better_price: 400, best_price: 650 },
    { item_name: 'Garage Door (Single, 9×7)', description: 'Single 9×7 garage door — steel non-insulated / insulated / carriage-style insulated', unit: 'each', good_price: 700, better_price: 1100, best_price: 1800 },
    { item_name: 'Garage Door (Double, 16×7)', description: 'Double 16×7 garage door — steel non-insulated / insulated / carriage-style insulated', unit: 'each', good_price: 1100, better_price: 1800, best_price: 2800 },
    // ── Per-unit installation materials ───────────────────────────────────────
    { item_name: 'Door Threshold & Door Sweep', description: 'Adjustable aluminum threshold and door sweep set for exterior door bottom seal', unit: 'each', good_price: 45, better_price: 65, best_price: 95 },
    { item_name: 'Weatherstripping (Door)', description: 'Foam, rubber, or pile weatherstrip for door perimeter — per door set', unit: 'each', good_price: 18, better_price: 28, best_price: 45 },
    { item_name: 'Door Hinges (set of 3)', description: 'Heavy-duty ball-bearing hinges — standard brass/satin / commercial grade / security', unit: 'set', good_price: 22, better_price: 35, best_price: 55 },
    { item_name: 'Deadbolt / Lockset (Exterior)', description: 'Single-cylinder deadbolt or keyed entry lockset — ANSI Grade 2 / Grade 1 / smart lock', unit: 'each', good_price: 55, better_price: 95, best_price: 180 },
    { item_name: 'Door Flashing Tape & Sill Pan', description: 'Self-adhering flexible flashing tape for rough opening and sloped sill pan — per door kit', unit: 'each', good_price: 35, better_price: 50, best_price: 70 },
    { item_name: 'Jamb Extension', description: 'PVC or wood jamb extension kit for walls thicker than standard 4-9/16" — per door', unit: 'each', good_price: 65, better_price: 95, best_price: 145 },
  ],
  'Insulation': [
    // ── Labor-inclusive (customer-facing per sq ft) ───────────────────────────
    // Ohio install $1.20-2/sq ft blown; contractor material $0.80-1.20/sq ft (2026)
    { item_name: 'Blown-In Cellulose Insulation (Attic)', description: 'Blown cellulose for attic floor — R-38 (10.5") standard / R-49 / R-60 high-performance — labor + material', unit: 'sq ft', good_price: 1.80, better_price: 2.50, best_price: 3.50 },
    { item_name: 'Blown-In Fiberglass Insulation (Attic)', description: 'Blown fiberglass for attic floor — R-38 standard / R-49 / R-60 — labor + material', unit: 'sq ft', good_price: 2.00, better_price: 2.75, best_price: 3.75 },
    { item_name: 'Fiberglass Batt - R-13 (Wall)', description: 'R-13 kraft-faced or unfaced fiberglass batt for 2×4 wall cavities — labor + material', unit: 'sq ft', good_price: 1.20, better_price: 1.60, best_price: 2.20 },
    { item_name: 'Fiberglass Batt - R-19/R-21 (Wall/Floor)', description: 'R-19 or R-21 batt for 2×6 walls or floor/crawlspace — labor + material', unit: 'sq ft', good_price: 1.50, better_price: 2.00, best_price: 2.75 },
    { item_name: 'Spray Foam Insulation - Closed-Cell', description: 'Closed-cell spray foam (2 lb density) — R-6.5/inch; air barrier + vapor retarder + structural — labor + material', unit: 'sq ft', good_price: 2.50, better_price: 3.50, best_price: 5.00 },
    { item_name: 'Spray Foam Insulation - Open-Cell', description: 'Open-cell spray foam (0.5 lb density) — R-3.7/inch; sound control, rim joists, tight spaces — labor + material', unit: 'sq ft', good_price: 1.50, better_price: 2.00, best_price: 2.75 },
    { item_name: 'Rigid Foam Board (Exterior / Continuous)', description: 'EPS, XPS, or polyiso rigid foam board — exterior wall continuous insulation or basement walls', unit: 'sq ft', good_price: 0.80, better_price: 1.20, best_price: 1.80 },
    // ── Per-unit materials ─────────────────────────────────────────────────────
    { item_name: 'Blown-In Insulation Bag (Cellulose)', description: '30 lb bag blown cellulose — covers ~40 sq ft at R-38 (machine rental typically free with bag purchase)', unit: 'bag', good_price: 18, better_price: 18, best_price: 18, fixed_price: true },
    { item_name: 'Blown-In Insulation Bag (Fiberglass)', description: '40 lb bag blown fiberglass — covers ~40 sq ft at R-38', unit: 'bag', good_price: 22, better_price: 22, best_price: 22, fixed_price: true },
    { item_name: 'Vapor Barrier (6-mil Poly)', description: '6-mil polyethylene vapor barrier for crawlspace or attic — 10×25 roll (250 sq ft)', unit: 'roll', good_price: 45, better_price: 60, best_price: 80 },
    { item_name: 'Low-Expansion Foam Sealant (can)', description: 'Low-expansion polyurethane foam for air sealing around windows, doors, pipes, and penetrations', unit: 'can', good_price: 8, better_price: 10, best_price: 14 },
    { item_name: 'Insulation Dam / Baffle (Rafter Vent)', description: 'Polystyrene or cardboard rafter baffles to maintain attic eave ventilation pathway under insulation — per each', unit: 'each', good_price: 2, better_price: 3, best_price: 4 },
  ],
  'Fencing': [
    // ── Labor-inclusive (customer-facing per LF) ──────────────────────────────
    // Ohio labor $10-20/LF; contractor material wood $15-25/LF, vinyl +30% (2026)
    { item_name: 'Wood Privacy Fence', description: '6 ft wood privacy fence — pressure-treated pine / cedar / cedar with cap and trim — labor + material', unit: 'lf', good_price: 28, better_price: 40, best_price: 58 },
    { item_name: 'Wood Picket Fence', description: '4 ft wood picket fence — painted pine / cedar / decorative top — labor + material', unit: 'lf', good_price: 18, better_price: 28, best_price: 42 },
    { item_name: 'Vinyl Privacy Fence', description: '6 ft vinyl privacy fence — standard white / tan / gray / woodgrain — labor + material', unit: 'lf', good_price: 38, better_price: 52, best_price: 72 },
    { item_name: 'Vinyl Picket Fence', description: '4 ft vinyl picket fence — standard / decorative — labor + material', unit: 'lf', good_price: 28, better_price: 38, best_price: 55 },
    { item_name: 'Aluminum / Ornamental Fence', description: '4-5 ft aluminum ornamental fence — flat top / spear top / arched — labor + material', unit: 'lf', good_price: 32, better_price: 48, best_price: 68 },
    { item_name: 'Chain Link Fence', description: '4-6 ft galvanized chain link fence with posts — standard / vinyl-coated black or green — labor + material', unit: 'lf', good_price: 18, better_price: 26, best_price: 38 },
    { item_name: 'Fence Removal', description: 'Remove and dispose of existing fence', unit: 'lf', good_price: 4, better_price: 4, best_price: 4, fixed_price: true },
    // ── Per-unit materials ─────────────────────────────────────────────────────
    { item_name: 'Fence Post (4×4 Treated Pine, 8 ft)', description: '4×4×8 pressure-treated pine fence post — standard / premium ground-contact rated (UC4B)', unit: 'each', good_price: 14, better_price: 18, best_price: 24 },
    { item_name: 'Fence Rail (2×4 Treated, 8 ft)', description: '2×4×8 pressure-treated horizontal rail for fence framing', unit: 'each', good_price: 7, better_price: 9, best_price: 12 },
    { item_name: 'Cedar Picket (1×6×6)', description: '1×6×6 cedar fence picket — dog-ear / flat-top', unit: 'each', good_price: 4, better_price: 5.50, best_price: 7 },
    { item_name: 'Concrete (60 lb bag, post footing)', description: '60 lb fast-set or standard concrete bag for fence post footings — 1 bag per post typically', unit: 'bag', good_price: 7, better_price: 7, best_price: 7, fixed_price: true },
    { item_name: 'Fence Gate (Single, 4 ft)', description: 'Single 4 ft walk-through gate panel — wood / vinyl / aluminum to match fence style', unit: 'each', good_price: 180, better_price: 280, best_price: 420 },
    { item_name: 'Fence Gate (Double, 8-10 ft)', description: 'Double drive gate 8-10 ft — wood / vinyl / aluminum with drop rod and latch', unit: 'each', good_price: 350, better_price: 550, best_price: 850 },
    { item_name: 'Post Cap / Finial', description: 'Decorative post cap or finial — flat aluminum / pyramid cedar / solar light cap', unit: 'each', good_price: 6, better_price: 12, best_price: 22 },
  ],
  'Decking': [
    // ── Labor-inclusive (customer-facing per sq ft) ───────────────────────────
    // Ohio labor $10-25/sq ft; contractor material composite $5-10/sq ft (2026)
    { item_name: 'Composite Decking (Trex / Fiberon)', description: 'Composite deck boards — standard grooved / mid-grade / premium capped composite (Trex, Fiberon, TimberTech) — labor + material', unit: 'sq ft', good_price: 18, better_price: 28, best_price: 42 },
    { item_name: 'Pressure-Treated Wood Decking', description: 'Pressure-treated 5/4×6 deck boards — standard PT / premium kiln-dried / Ipe hardwood — labor + material', unit: 'sq ft', good_price: 12, better_price: 18, best_price: 28 },
    { item_name: 'Deck Removal', description: 'Demolish and haul away existing deck — per sq ft', unit: 'sq ft', good_price: 3, better_price: 3, best_price: 3, fixed_price: true },
    // ── Per-unit materials ─────────────────────────────────────────────────────
    { item_name: 'Deck Framing / Joist (2×8 Treated, 12 ft)', description: '2×8×12 pressure-treated lumber for deck joists and framing — ground-contact rated', unit: 'each', good_price: 18, better_price: 22, best_price: 28 },
    { item_name: 'Ledger Board & Flashing (10 ft)', description: '2×10 or 2×12 treated ledger board with self-adhering ledger flashing tape — per 10 ft section', unit: 'section', good_price: 55, better_price: 70, best_price: 90 },
    { item_name: 'Deck Post (4×4 or 6×6 Treated)', description: 'Pressure-treated structural post — 4×4 standard height / 6×6 for elevated or heavy loads', unit: 'each', good_price: 22, better_price: 35, best_price: 50 },
    { item_name: 'Post Anchor / Footing Hardware', description: 'Adjustable post base anchor (ABA44/ABA66) for concrete pier or surface mount', unit: 'each', good_price: 18, better_price: 28, best_price: 40 },
    { item_name: 'Concrete Pier / Footing (Tube Form)', description: '10" or 12" tube form concrete footing — poured per post location (materials only, per footing)', unit: 'each', good_price: 45, better_price: 65, best_price: 90 },
    { item_name: 'Hidden Deck Fasteners (Ipe Clip / Camo)', description: 'Hidden fastener clips or CAMO screws for grooved composite or hardwood boards — per 50 sq ft bag', unit: 'bag', good_price: 28, better_price: 38, best_price: 52 },
    { item_name: 'Deck Screws / Structural Fasteners', description: 'Composite or coated deck screws — #10 × 3" / structural LedgerLOK / hidden drive (per lb)', unit: 'lb', good_price: 12, better_price: 16, best_price: 22 },
    { item_name: 'Deck Railing - Composite (per LF)', description: 'Composite top/bottom rail with aluminum balusters — standard / premium / glass panel — labor + material', unit: 'lf', good_price: 35, better_price: 55, best_price: 85 },
    { item_name: 'Deck Railing - Aluminum (per LF)', description: 'Powder-coated aluminum rail with matching balusters — standard / decorative — labor + material', unit: 'lf', good_price: 30, better_price: 48, best_price: 70 },
    { item_name: 'Deck Stairs (per Step)', description: 'Deck stair stringers, treads, and risers — PT wood / composite treads / cable railing option', unit: 'step', good_price: 95, better_price: 145, best_price: 220 },
    { item_name: 'Joist Hanger & Structural Hardware (lot)', description: 'Joist hangers, post caps, hurricane ties, and structural connector hardware for full deck framing — lot allowance', unit: 'lot', good_price: 180, better_price: 250, best_price: 350 },
  ],
  'Permits & Fees': [
    { item_name: 'Building Permit', description: 'Building permit fee', unit: 'each', good_price: 200, better_price: 200, best_price: 200, fixed_price: true },
    { item_name: 'Dumpster Rental', description: 'Roll-off dumpster rental and disposal', unit: 'each', good_price: 350, better_price: 450, best_price: 550 },
    { item_name: 'Code Inspection', description: 'Municipal code inspection fee', unit: 'each', good_price: 100, better_price: 100, best_price: 100, fixed_price: true },
  ],
  'Solar': [
    // ── Detach & Reset (for roofing jobs with existing solar) ──────────────────
    // ~$400/panel total customer-facing; split across detach + reset line items
    { item_name: 'Solar Panel Detach', description: 'Carefully remove and label all solar panels and racking hardware for safe storage during roof replacement', unit: 'panel', good_price: 200, better_price: 200, best_price: 200, fixed_price: true },
    { item_name: 'Solar Panel Reset & Reinstall', description: 'Reinstall panels and racking on new roof surface, reconnect wiring, and verify system operation', unit: 'panel', good_price: 200, better_price: 225, best_price: 250 },
    { item_name: 'Roof Penetration Resealing', description: 'Reseal all roof penetrations and mounting points at each solar mount during reinstall', unit: 'lot', good_price: 150, better_price: 200, best_price: 275 },
    { item_name: 'Electrical Reconnection & System Test', description: 'Licensed electrician reconnection of inverter and grid-tie, full system output verification post-reinstall', unit: 'lot', good_price: 350, better_price: 450, best_price: 600 },
    { item_name: 'Coordination & Scheduling', description: 'Coordination with solar installer/utility for safe disconnect and scheduling around roofing crew', unit: 'lot', good_price: 150, better_price: 150, best_price: 150, fixed_price: true },
    // ── New Installation ───────────────────────────────────────────────────────
    // Pricing based on 2026 US residential market (per-panel ~$200-340 customer retail;
    // inverter $10k-15k retail for 10kW; racking $80-160/panel; labor $10k-15k/10kW system)
    { item_name: 'Site Assessment & Structural Analysis', description: 'Roof load analysis, shading report, system design, and proposal for optimal panel count/layout', unit: 'lot', good_price: 450, better_price: 550, best_price: 650 },
    { item_name: 'Solar Panels (Monocrystalline)', description: 'Standard / high-efficiency / premium bifacial monocrystalline panels — per panel (400W typical)', unit: 'each', good_price: 200, better_price: 265, best_price: 340 },
    { item_name: 'Racking & Mounting System', description: 'Roof-mount rail system per panel — standard aluminum / low-profile / flush composite flashed mounts', unit: 'panel', good_price: 80, better_price: 120, best_price: 160 },
    { item_name: 'String Inverter / Microinverters', description: 'Grid-tied string inverter (Sol-Ark/SMA) / SolarEdge optimizers / Enphase IQ microinverters — per system lot', unit: 'lot', good_price: 5000, better_price: 9000, best_price: 14500 },
    { item_name: 'DC Wiring & Conduit (Roof to Inverter)', description: 'PV-rated DC wire runs, MC4 connectors, and weatherproof conduit routing from array to inverter', unit: 'lot', good_price: 1200, better_price: 1800, best_price: 2500 },
    { item_name: 'AC Wiring & Conduit (Inverter to Panel)', description: 'AC wiring from inverter to main electrical panel with junction, disconnect, and labeling', unit: 'lot', good_price: 800, better_price: 1200, best_price: 1800 },
    { item_name: 'Main Panel Upgrade / Electrical Work', description: 'Service panel inspection, 20/30A breaker addition, or full 200A panel upgrade as required', unit: 'lot', good_price: 1500, better_price: 3500, best_price: 6500 },
    { item_name: 'Solar Installation Labor', description: 'Full installation labor — panel mounting, wiring, commissioning, and utility walkthrough (per system lot)', unit: 'lot', good_price: 5000, better_price: 7500, best_price: 10000 },
    { item_name: 'Roof Penetration Flashing & Sealant', description: 'Flashed and sealed roof penetrations at each mounting foot with roofing-grade sealant', unit: 'each', good_price: 22, better_price: 35, best_price: 50 },
    { item_name: 'Monitoring System', description: 'System-level monitoring app / module-level monitoring platform (Enphase Enlighten, SolarEdge portal)', unit: 'lot', good_price: 0, better_price: 450, best_price: 850 },
    { item_name: 'Battery Storage (Optional Add-On)', description: 'Home battery backup — basic LFP / mid-tier / premium (e.g. Powerwall 3 or equivalent)', unit: 'each', good_price: 0, better_price: 9500, best_price: 14500 },
  ],
};

export const quoteProjectTemplates: QuoteProjectTemplate[] = [
  {
    id: 'roof-replacement',
    name: 'Asphalt Shingle Roof',
    description: 'Complete tear-off and asphalt shingle re-roof with decking, ventilation, flashing, and finish materials.',
    projectType: 'exterior',
    coverPageTitle: 'Asphalt Shingle Roof Proposal',
    projectDescription:
      'Complete asphalt shingle roof replacement including tear-off, decking repairs, leak barriers, architectural shingle system, ventilation components, flashings, and finish detailing.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roof', description: 'Remove and dispose of existing shingles and underlayment', unit: 'sq', quantity: 1, good_price: 85, better_price: 85, best_price: 85 },
      { category: 'Roofing', item_name: 'Roof Decking (5/8" CDX/OSB) Repair', description: 'Repair/replace rotted plywood or OSB sheathing as needed', unit: 'sq', quantity: 0, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'Underlayment / Leak Barrier', description: 'Synthetic underlayment across roof deck (1 roll = 10 sq / 1,000 sq ft)', unit: 'roll', quantity: 1, good_price: 84, better_price: 84, best_price: 84 },
      { category: 'Roofing', item_name: 'Ice & Water Shield', description: 'Self-adhered membrane at eaves, valleys, and penetrations — 1 roll = 200 sq ft', unit: 'roll', quantity: 1, good_price: 60, better_price: 60, best_price: 60 },
      { category: 'Roofing', item_name: 'Architectural Shingles', description: 'Architectural / dimensional shingles (3 bundles per square) — material only, marked up with the rest of the scope', unit: 'sq', quantity: 1, good_price: 96, better_price: 96, best_price: 96 },
      { category: 'Roofing', item_name: 'Starter Strip', description: 'Starter strip shingles at eaves and rakes (1 bundle ≈ 105 lf)', unit: 'bdl', quantity: 1, good_price: 25.5, better_price: 25.5, best_price: 25.5, fixed_price: true },
      { category: 'Roofing', item_name: 'Drip Edge', description: "Metal drip edge flashing (aluminum/galvalume) at eaves and rakes — 10 ft stick", unit: 'pc', quantity: 1, good_price: 5, better_price: 5, best_price: 5, fixed_price: true },
      { category: 'Roofing', item_name: 'Valley Metal', description: 'Pre-formed or rolled valley metal flashing — installed LF', unit: 'lf', quantity: 1, good_price: 8, better_price: 8, best_price: 8 },
      { category: 'Roofing', item_name: 'Step Flashing', description: 'Aluminum step flashing at wall-to-roof intersections — installed LF', unit: 'lf', quantity: 1, good_price: 5, better_price: 5, best_price: 5 },
      { category: 'Roofing', item_name: 'Flashing (Misc / Apron)', description: 'Miscellaneous wall/apron flashing, kickout flashing — installed LF', unit: 'lf', quantity: 1, good_price: 5, better_price: 5, best_price: 5 },
      { category: 'Roofing', item_name: 'Flashing Package (Valley/Step/Chimney)', description: 'Install/replace valley, step, chimney, and vent flashings with sealed joints (lot allowance)', unit: 'lot', quantity: 1, good_price: 280, better_price: 280, best_price: 280 },
      { category: 'Roofing', item_name: 'Steep Slope Labor', description: 'Additional labor for steep pitch roofing (≥7/12) — per square surcharge', unit: 'sq', quantity: 1, good_price: 65, better_price: 65, best_price: 65 },
      { category: 'Roofing', item_name: 'High Complexity Labor', description: 'Additional labor for high-complexity roof geometry (≥21 facets) — per square surcharge', unit: 'sq', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'Hip & Ridge Cap Shingles', description: 'Hip/ridge cap shingles with high-wind fastening pattern (1 bundle ≈ 25 lf)', unit: 'bdl', quantity: 1, good_price: 34.5, better_price: 34.5, best_price: 34.5 },
      { category: 'Roofing', item_name: 'Box Vents', description: 'Static box vents for roof exhaust (as required by layout)', unit: 'each', quantity: 0, good_price: 55, better_price: 55, best_price: 55 },
      { category: 'Roofing', item_name: 'Braun/Broan Stove Vent Flashing', description: 'Kitchen/stove vent cap flashing and weatherproof seal integration', unit: 'each', quantity: 0, good_price: 65, better_price: 65, best_price: 65 },
      { category: 'Roofing', item_name: 'Pipe Boots / Split Boots / Seals', description: 'Rubber vent boots and split-boot seals for plumbing penetrations', unit: 'each', quantity: 0, good_price: 35, better_price: 35, best_price: 35 },
      { category: 'Roofing', item_name: 'Ridge Vent & Attic Ventilation Balance', description: 'Ridge exhaust and soffit intake configuration targeting 1/150 ventilation ratio (1 box = 16 lf)', unit: 'box', quantity: 1, good_price: 65, better_price: 65, best_price: 65 },
      { category: 'Roofing', item_name: 'Nails & Fasteners', description: '1-1/4" galvanized roofing nails, proper pattern (4-6 per shingle)', unit: 'lot', quantity: 1, good_price: 85, better_price: 85, best_price: 85, fixed_price: true },
      { category: 'Roofing', item_name: 'Caulk / Sealant', description: 'Roof-grade sealants at flashing edges, penetrations, and terminations', unit: 'lot', quantity: 1, good_price: 65, better_price: 65, best_price: 65 },
      { category: 'Roofing', item_name: 'Spray Paint & Finish Detailing', description: 'Touch-up spray paint for exposed metals and blended finish points', unit: 'lot', quantity: 0, good_price: 35, better_price: 35, best_price: 35 },
      { category: 'Roofing', item_name: 'Aluminum Coil Stock', description: 'Aluminum coil for trim wrapping, fascia transitions, and custom bends', unit: 'lf', quantity: 0, good_price: 7, better_price: 7, best_price: 7 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect landscaping, magnet sweep, and final debris cleanup', unit: 'lot', quantity: 1, good_price: 350, better_price: 350, best_price: 350 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and disposal/dumpster fees', unit: 'lot', quantity: 1, good_price: 450, better_price: 450, best_price: 450 },
    ],
  },
  {
    id: 'standing-seam-metal-roof',
    name: 'Standing Seam Metal Roof',
    description: 'Premium standing seam metal roofing system with ventilation and flashing upgrades.',
    projectType: 'exterior',
    coverPageTitle: 'Standing Seam Metal Roof Proposal',
    projectDescription:
      'Standing seam metal roof installation including tear-off, decking corrections, leak barriers, high-performance panel system, and full flashing package.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roof', description: 'Remove and dispose of existing roof materials', unit: 'sq', quantity: 1, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'Roofing', item_name: 'Decking Repair (5/8" CDX/OSB)', description: 'Repair or replace rotted roof decking as needed', unit: 'sheet', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'Synthetic Underlayment', description: 'High-temp synthetic underlayment for metal roofing — material per roofing square', unit: 'sq', quantity: 1, good_price: 8, better_price: 8, best_price: 8 },
      { category: 'Roofing', item_name: 'Ice & Water Shield', description: 'Self-adhered leak barrier at eaves, valleys, and all penetrations — material per roofing square', unit: 'sq', quantity: 1, good_price: 28, better_price: 28, best_price: 28 },
      { category: 'Roofing', item_name: 'Standing Seam Metal Panels', description: '24ga / 26ga standing seam panel system with concealed fasteners — material per sq', unit: 'sq', quantity: 1, good_price: 220, better_price: 320, best_price: 450 },
      { category: 'Roofing', item_name: 'Drip Edge & Eave Trim', description: 'Custom formed eave/rake trims and drip edge in matching color — material per lf', unit: 'lf', quantity: 1, good_price: 3.00, better_price: 3.00, best_price: 3.00 },
      { category: 'Roofing', item_name: 'Flashing Package', description: 'Valley, step, chimney, vent, and wall transition flashing materials — lot allowance', unit: 'lot', quantity: 1, good_price: 150, better_price: 150, best_price: 150 },
      { category: 'Roofing', item_name: 'Pipe Boots / Penetration Seals', description: 'EPDM boots and split seals for all roof penetrations — material per each', unit: 'each', quantity: 2, good_price: 20, better_price: 20, best_price: 20 },
      { category: 'Roofing', item_name: 'Ventilation System', description: 'Ridge vent box(es) and soffit intake material — lot allowance', unit: 'lot', quantity: 1, good_price: 80, better_price: 80, best_price: 80 },
      { category: 'Roofing', item_name: 'Concealed Fastener Clips & Closures', description: 'Concealed standing seam panel clips, butyl tape, foam closure strips, and manufacturer-approved sealant — material lot', unit: 'lot', quantity: 1, good_price: 90, better_price: 90, best_price: 90 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protection, magnet sweep, and complete jobsite cleanup', unit: 'lot', quantity: 1, good_price: 400, better_price: 400, best_price: 400 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and disposal logistics', unit: 'lot', quantity: 1, good_price: 350, better_price: 350, best_price: 350 },
    ],
  },
  {
    id: 'corrugated-metal-roof',
    name: 'Corrugated Metal Roof',
    description: 'Durable corrugated metal roofing package with full weatherproofing and trim set.',
    projectType: 'exterior',
    coverPageTitle: 'Corrugated Metal Roof Proposal',
    projectDescription:
      'Corrugated metal roof installation including tear-off, underlayment, panel system, flashing components, and ventilation balancing.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roof', description: 'Remove existing shingles/roofing materials and dispose', unit: 'sq', quantity: 1, good_price: 90, better_price: 90, best_price: 90 },
      { category: 'Roofing', item_name: 'Decking Repair (5/8" CDX/OSB)', description: 'Repair and replace damaged roof sheathing areas', unit: 'sheet', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'Underlayment + Ice & Water Shield', description: 'Synthetic underlayment base with ice/water barrier at critical zones — material per sq', unit: 'sq', quantity: 1, good_price: 15, better_price: 15, best_price: 15 },
      { category: 'Roofing', item_name: 'Corrugated Metal Panels', description: '28ga / 26ga corrugated metal panel roofing — material per sq', unit: 'sq', quantity: 1, good_price: 150, better_price: 210, best_price: 290 },
      { category: 'Roofing', item_name: 'Ridge Cap & Closure Strips', description: 'Ridge cap assemblies with foam closures and weather seals — material per lf', unit: 'lf', quantity: 1, good_price: 3.00, better_price: 3.00, best_price: 3.00 },
      { category: 'Roofing', item_name: 'Drip Edge & Trim Metals', description: 'Rake/eave trims and transition pieces in matching coil stock — material per lf', unit: 'lf', quantity: 1, good_price: 2.00, better_price: 2.00, best_price: 2.00 },
      { category: 'Roofing', item_name: 'Flashing Package', description: 'Valley, chimney, step, and penetration flashing materials — lot allowance', unit: 'lot', quantity: 1, good_price: 100, better_price: 100, best_price: 100 },
      { category: 'Roofing', item_name: 'Pipe Boots / Vent Seals', description: 'Rubber boots and gasketed seals for roof penetrations — material per each', unit: 'each', quantity: 2, good_price: 15, better_price: 15, best_price: 15 },
      { category: 'Roofing', item_name: 'Metal Roofing Screws & Sealant', description: 'Hex-head gasketed corrugated metal roofing screws, butyl sealant, foam closure strips, and touch-up coating kit — material lot', unit: 'lot', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'Ventilation Upgrades', description: 'Ridge vent, box vent, and soffit intake materials as required — lot allowance', unit: 'lot', quantity: 1, good_price: 60, better_price: 60, best_price: 60 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Property protection and final debris removal', unit: 'lot', quantity: 1, good_price: 375, better_price: 375, best_price: 375 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit handling and disposal/dumpster costs', unit: 'lot', quantity: 1, good_price: 325, better_price: 325, best_price: 325 },
    ],
  },
  {
    id: 'siding-replacement',
    name: 'Siding Replacement',
    description: 'Full siding replacement — tear-off, WRB, primary cladding, complete trim system, flashing package, and site cleanup.',
    projectType: 'exterior',
    coverPageTitle: 'Siding Replacement Proposal',
    projectDescription:
      'Complete exterior siding replacement including full tear-off of existing cladding, wall sheathing inspection, weather-resistant barrier installation, primary siding panel installation, full trim system, flashing at all transitions, fasteners, caulk, and site cleanup.',
    lineItems: [
      // ── Tear-off ──────────────────────────────────────────────────────────
      { category: 'Siding', item_name: 'Siding Removal', description: 'Remove and haul all existing siding — qty: total wall area in squares (1 sq = 100 sq ft)', unit: 'sq', quantity: 1, good_price: 75, better_price: 75, best_price: 75, fixed_price: true },
      // ── Substrate & moisture ──────────────────────────────────────────────
      { category: 'Siding', item_name: 'Sheathing / OSB Repair', description: 'Inspect and replace damaged 7/16" OSB sheathing sections — qty: affected area in squares (set qty to 0 if no sheathing damage found)', unit: 'sq', quantity: 1, good_price: 110, better_price: 110, best_price: 110, fixed_price: true, optional: true },
      { category: 'Siding', item_name: 'House Wrap / WRB', description: 'Tyvek or equivalent weather barrier, fully lapped and taped — qty: total wall area in squares (material per sq)', unit: 'sq', quantity: 1, good_price: 30, better_price: 30, best_price: 30 },
      { category: 'Siding', item_name: 'Sheathing Tape / WRB Tape', description: 'Self-adhesive seam tape for WRB lap joints, window rough openings, and transitions — Tyvek tape or equivalent — qty: 1 lot per job', unit: 'lot', quantity: 1, good_price: 45, better_price: 45, best_price: 45, optional: true },
      { category: 'Siding', item_name: 'Foam Insulation Backer Board', description: 'Rigid foam backer board (R-3 / R-5 / R-7) for added thermal performance — qty: total wall area in squares (material per sq)', unit: 'sq', quantity: 1, good_price: 35, better_price: 60, best_price: 95, optional: true },
      // ── Primary cladding (one tiered item matching material preferences) ───
      { category: 'Siding', item_name: 'Siding Panels', description: 'Lap siding panels — Good: standard vinyl (0.040"), Better: premium insulated vinyl, Best: fiber cement (HardiePlank-class) — qty: total wall area in squares', unit: 'sq', quantity: 1, good_price: 240, better_price: 350, best_price: 760 },
      // ── Trim system ───────────────────────────────────────────────────────
      { category: 'Siding', item_name: 'Starter Strip', description: 'Aluminum/vinyl strip at wall base, aligns the first siding course — qty: total LF of wall base perimeter', unit: 'lf', quantity: 1, good_price: 0.85, better_price: 0.85, best_price: 0.85 },
      { category: 'Siding', item_name: 'J-Channel', description: 'J-channel at window/door openings and eave/soffit terminations — 12 ft stick, material per stick', unit: 'stick', quantity: 1, good_price: 6.00, better_price: 6.00, best_price: 6.00 },
      { category: 'Siding', item_name: 'Outside Corners', description: 'Outside corner posts (12.5 ft sticks) — qty: total LF across all exterior corners (count × height)', unit: 'lf', quantity: 1, good_price: 2.00, better_price: 2.00, best_price: 2.00 },
      { category: 'Siding', item_name: 'Inside Corners', description: 'Inside corner posts (12.5 ft sticks) — qty: total LF across all interior wall angles (count × height)', unit: 'lf', quantity: 1, good_price: 3.25, better_price: 3.25, best_price: 3.25 },
      { category: 'Siding', item_name: 'Window & Door Trim', description: 'Window and door casing / flat trim / brick molding — qty: total LF of all window and door perimeters (material per lf)', unit: 'lf', quantity: 1, good_price: 1.50, better_price: 1.50, best_price: 1.50 },
      { category: 'Siding', item_name: 'Drip Cap / Head Flashing', description: 'Metal flashing above windows, doors, and horizontal transitions — qty: total LF of horizontal opening heads (material per lf)', unit: 'lf', quantity: 1, good_price: 0.85, better_price: 0.85, best_price: 0.85 },
      { category: 'Siding', item_name: 'Under-Sill Trim', description: 'Vinyl utility/under-sill trim channel at window sills and horizontal panel cuts — holds and seals top edge of cut siding course — qty: total LF of window widths', unit: 'lf', quantity: 1, good_price: 0.30, better_price: 0.30, best_price: 0.30, optional: true },
      { category: 'Siding', item_name: 'Mounting Blocks', description: 'Siding mounting blocks for light fixtures, electrical outlets, hose bibs, and cable penetrations — qty: count of penetrations per job', unit: 'each', quantity: 4, good_price: 8, better_price: 8, best_price: 8, optional: true },
      // ── Flashing & moisture accessories ──────────────────────────────────
      { category: 'Siding', item_name: 'Flashing Package', description: 'Kickout, step, Z-, and cap flashing materials at all wall/roof intersections and penetrations — qty: 1 per job', unit: 'lot', quantity: 1, good_price: 100, better_price: 100, best_price: 100 },
      // ── Fasteners, sealants, and finishing ───────────────────────────────
      { category: 'Siding', item_name: 'Siding Nails & Fasteners', description: 'Corrosion-resistant nails, screws, or hidden clips for siding type — galvanized ring-shank or stainless steel', unit: 'lot', quantity: 1, good_price: 135, better_price: 135, best_price: 135 },
      { category: 'General Labor', item_name: 'Siding Caulk / Sealant', description: 'Exterior-grade silicone or paintable acrylic latex caulk at penetrations, corners, and approved joints (OSI Quad Max / GE Silicone / acrylic latex)', unit: 'lot', quantity: 1, good_price: 180, better_price: 180, best_price: 180 },
      { category: 'Siding', item_name: 'Furring Strips', description: '1×3 or 1×4 pressure-treated furring strips for rainscreen drainage plane or plumb-correction — conditional item, set qty to 0 if not required', unit: 'lot', quantity: 1, good_price: 125, better_price: 125, best_price: 125, optional: true },
      { category: 'Siding', item_name: 'Siding Vents', description: 'Through-wall vent covers for dryer exhaust, bath fan, kitchen range hood, or HRV termination — qty: count of vents on siding elevations', unit: 'each', quantity: 2, good_price: 12, better_price: 12, best_price: 12, optional: true },
      { category: 'Siding', item_name: 'Exterior Paint / Stain', description: 'Premium 100% acrylic latex exterior paint or solid stain — required for fiber cement, engineered wood, or bare wood siding (not needed for vinyl) — conditional item', unit: 'lot', quantity: 1, good_price: 175, better_price: 175, best_price: 175, optional: true },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect landscaping and property; remove and haul all debris', unit: 'lot', quantity: 1, good_price: 350, better_price: 350, best_price: 350, fixed_price: true },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and dumpster/disposal fees', unit: 'lot', quantity: 1, good_price: 425, better_price: 425, best_price: 425, fixed_price: true },
    ],
  },
  {
    id: 'gutter-replacement',
    name: 'Gutter Replacement',
    description: 'Complete seamless gutter system teardown and replacement with full accessories.',
    projectType: 'exterior',
    coverPageTitle: 'Gutter Replacement Proposal',
    projectDescription:
      'Complete gutter replacement including full teardown, seamless trough installation, corners, downspouts, brackets, flashing, guards, and drainage accessories.',
    lineItems: [
      { category: 'Gutters', item_name: 'Full Gutter System Tear-Off', description: 'Remove and dispose of existing troughs, downspouts, and hardware', unit: 'lf', quantity: 1, good_price: 2, better_price: 2, best_price: 2, fixed_price: true },
      { category: 'Gutters', item_name: 'Seamless Gutter Trough Sections (5"/6" K-Style)', description: 'Seamless aluminum gutter coil stock — material per lf (5" standard / 6" heavy-volume)', unit: 'lf', quantity: 1, good_price: 3.00, better_price: 5.00, best_price: 8.00 },
      { category: 'Gutters', item_name: 'End Caps', description: 'Aluminum end caps to close gutter runs — material per each', unit: 'each', quantity: 4, good_price: 4, better_price: 4, best_price: 4 },
      { category: 'Gutters', item_name: 'Miters & Corners', description: 'Inside/outside corner miters and transition joints — material per each', unit: 'each', quantity: 4, good_price: 8, better_price: 8, best_price: 8 },
      { category: 'Gutters', item_name: 'Outlet Drops & Elbows', description: 'Drop outlet and elbow fittings for downspout connections — material per each', unit: 'each', quantity: 4, good_price: 5, better_price: 5, best_price: 5 },
      { category: 'Gutters', item_name: 'Downspouts (2x3 / 3x4)', description: 'Rectangular aluminum downspout sections — material per lf', unit: 'lf', quantity: 1, good_price: 2.00, better_price: 2.00, best_price: 2.00 },
      { category: 'Gutters', item_name: 'Hangers / Brackets', description: 'Hidden hanger or spike-and-ferrule brackets — material lot allowance for full run', unit: 'lot', quantity: 1, good_price: 55, better_price: 55, best_price: 55 },
      { category: 'Gutters', item_name: 'Fascia Brackets', description: 'Fascia-mounted support brackets and anchoring hardware — material lot', unit: 'lot', quantity: 1, good_price: 35, better_price: 35, best_price: 35 },
      { category: 'Gutters', item_name: 'Gutter Apron / Flashing', description: 'Aluminum apron/drip-edge flashing under shingle edge — material per lf', unit: 'lf', quantity: 1, good_price: 0.80, better_price: 0.80, best_price: 0.80 },
      { category: 'Gutters', item_name: 'Gutter Guards / Screens', description: 'Leaf protection material — mesh / micro-mesh / solid cover — material per lf', unit: 'lf', quantity: 1, good_price: 2.00, better_price: 5.00, best_price: 10.00 },
      { category: 'Gutters', item_name: 'Splash Blocks / Extensions', description: 'Ground diverters and flexible discharge extensions — material per each', unit: 'each', quantity: 4, good_price: 8, better_price: 8, best_price: 8 },
      { category: 'General Labor', item_name: 'System Alignment & Water Test', description: 'Pitch calibration, leak check, and functional water test', unit: 'lot', quantity: 1, good_price: 120, better_price: 120, best_price: 120 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect property and remove debris/materials', unit: 'lot', quantity: 1, good_price: 225, better_price: 225, best_price: 225 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and disposal/dumpster fees', unit: 'lot', quantity: 1, good_price: 150, better_price: 150, best_price: 150 },
    ],
  },
  {
    id: 'epdm-flat-roof',
    name: 'EPDM Flat Roof',
    description: 'Full EPDM rubber membrane flat roof system with insulation, flashing, and drainage.',
    projectType: 'exterior',
    coverPageTitle: 'EPDM Flat Roof Proposal',
    projectDescription:
      'Complete EPDM flat roof installation including tear-off, deck preparation, ISO insulation, 60-mil rubber membrane, fully adhered seams, termination bar flashing, and drainage upgrades.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roof / Membrane', description: 'Remove and dispose of existing flat roof system, gravel, or membrane', unit: 'sq', quantity: 1, good_price: 80, better_price: 80, best_price: 80 },
      { category: 'Roofing', item_name: 'Roof Deck Repair (1/2" CDX / Densdeck)', description: 'Repair or replace rotted/damaged decking and substrate sections', unit: 'sheet', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'ISO Insulation Board (2")', description: '2" polyisocyanurate insulation board for thermal performance (R-13) — ~3 sheets per sq (4×8 = 32 sq ft/sheet), price is per roofing square installed', unit: 'sq', quantity: 1, good_price: 100, better_price: 100, best_price: 100 },
      { category: 'Roofing', item_name: 'Cover Board (1/2" Densdeck / HD ISO)', description: 'High-density cover board for membrane protection — ~3 sheets (4×8) per roofing square — material per sq', unit: 'sq', quantity: 1, good_price: 150, better_price: 150, best_price: 150 },
      { category: 'Roofing', item_name: 'Asphalt Primer / Substrate Coat', description: 'Henry 177 or equivalent asphalt-based primer — coverage ~100 sq ft/gal — material per gallon', unit: 'gal', quantity: 1, good_price: 25, better_price: 25, best_price: 25 },
      { category: 'Roofing', item_name: 'EPDM Membrane (45-mil / 60-mil / 90-mil)', description: 'EPDM rubber membrane — standard / mid-grade / commercial heavy-duty — material per sq', unit: 'sq', quantity: 1, good_price: 260, better_price: 380, best_price: 500 },
      { category: 'Roofing', item_name: 'Membrane Adhesive (Bonding / Water-Based)', description: 'Contact cement or low-VOC bonding adhesive for fully adhered installation — material per sq', unit: 'sq', quantity: 1, good_price: 18, better_price: 18, best_price: 18 },
      { category: 'Roofing', item_name: 'Seam Tape & Lap Sealant', description: 'Factory-grade seam tape and EPDM lap caulk at all seam overlaps — material lot', unit: 'lot', quantity: 1, good_price: 55, better_price: 55, best_price: 55 },
      { category: 'Roofing', item_name: 'Termination Bar & Edge Metal', description: 'Aluminum termination bar at perimeter and wall terminations — material per lf', unit: 'lf', quantity: 1, good_price: 2.00, better_price: 2.00, best_price: 2.00 },
      { category: 'Roofing', item_name: 'Pipe Boots / Penetration Flashings', description: 'EPDM pipe boots and fabricated flashings — material per each', unit: 'each', quantity: 3, good_price: 25, better_price: 25, best_price: 25 },
      { category: 'Roofing', item_name: 'Drain Assembly / Scupper Upgrade', description: 'Cast-iron or PVC roof drain with clamping ring and strainer, or scupper box with extension', unit: 'each', quantity: 2, good_price: 145, better_price: 145, best_price: 145 },
      { category: 'Roofing', item_name: 'Walkway Pads', description: 'Protection pads at access points, AC units, and high-traffic roof areas', unit: 'each', quantity: 2, good_price: 65, better_price: 65, best_price: 65 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect property, contain debris, and perform final magnet sweep', unit: 'lot', quantity: 1, good_price: 325, better_price: 325, best_price: 325 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and roof debris disposal/dumpster fees', unit: 'lot', quantity: 1, good_price: 325, better_price: 325, best_price: 325 },
    ],
  },
  {
    id: 'tpo-flat-roof',
    name: 'TPO Flat Roof',
    description: 'Commercial-grade TPO single-ply membrane flat roof with hot-air welded seams and full insulation.',
    projectType: 'exterior',
    coverPageTitle: 'TPO Flat Roof Proposal',
    projectDescription:
      'Complete TPO flat roof installation including tear-off, deck preparation, polyiso insulation, 60-mil or 80-mil TPO membrane with hot-air welded seams, mechanically fastened or fully adhered, plus all flashings and drainage upgrades.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roof / Membrane', description: 'Remove and dispose of existing flat roof membrane, gravel, or built-up system', unit: 'sq', quantity: 1, good_price: 80, better_price: 80, best_price: 80 },
      { category: 'Roofing', item_name: 'Roof Deck Repair (1/2" CDX / Densdeck)', description: 'Repair or replace damaged substrate and decking sections as needed', unit: 'sheet', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'ISO Insulation Board (2")', description: '2" polyisocyanurate tapered or flat insulation for thermal performance — ~3 sheets per sq (4×8 = 32 sq ft/sheet), price is per roofing square installed', unit: 'sq', quantity: 1, good_price: 100, better_price: 100, best_price: 100 },
      { category: 'Roofing', item_name: 'Cover Board (1/2" Densdeck / HD ISO)', description: 'High-density cover board — ~3 sheets (4×8) per roofing square — material per sq', unit: 'sq', quantity: 1, good_price: 150, better_price: 150, best_price: 150 },
      { category: 'Roofing', item_name: 'Asphalt Primer / Substrate Coat', description: 'Henry 177 or equivalent asphalt-based primer — coverage ~100 sq ft/gal — material per gallon', unit: 'gal', quantity: 1, good_price: 25, better_price: 25, best_price: 25 },
      { category: 'Roofing', item_name: 'TPO Membrane (45-mil / 60-mil / 80-mil)', description: 'Single-ply TPO membrane — mechanically fastened / adhered / induction welded — material per sq', unit: 'sq', quantity: 1, good_price: 90, better_price: 130, best_price: 190 },
      { category: 'Roofing', item_name: 'Hot-Air Welded Seams', description: 'Seam tape, butyl, and consumables for hot-air welded lap seams — material per sq', unit: 'sq', quantity: 1, good_price: 8, better_price: 8, best_price: 8 },
      { category: 'Roofing', item_name: 'TPO Perimeter Edge Metal & Coping', description: 'TPO-coated drip edge and coping cap at parapet/perimeter — material per lf', unit: 'lf', quantity: 1, good_price: 3.00, better_price: 3.00, best_price: 3.00 },
      { category: 'Roofing', item_name: 'Pipe Boots / Penetration Flashings', description: 'Pre-molded TPO pipe boots and fabricated flashings — material per each', unit: 'each', quantity: 3, good_price: 30, better_price: 30, best_price: 30 },
      { category: 'Roofing', item_name: 'Drain Assembly / Scupper Upgrade', description: 'Cast-iron or PVC drain with clamping ring/strainer, or scupper with welded TPO collar', unit: 'each', quantity: 2, good_price: 155, better_price: 155, best_price: 155 },
      { category: 'Roofing', item_name: 'Curb Flashings (HVAC / Skylights)', description: 'Pre-fabricated TPO curb flashings welded to membrane at equipment curbs', unit: 'each', quantity: 1, good_price: 180, better_price: 180, best_price: 180 },
      { category: 'Roofing', item_name: 'Walkway Pads', description: 'TPO walkway protection pads at access and HVAC service areas', unit: 'each', quantity: 2, good_price: 70, better_price: 70, best_price: 70 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect rooftop equipment, contain debris, and complete final cleanup', unit: 'lot', quantity: 1, good_price: 325, better_price: 325, best_price: 325 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and membrane/debris disposal fees', unit: 'lot', quantity: 1, good_price: 325, better_price: 325, best_price: 325 },
    ],
  },
  {
    id: 'rolled-roofing',
    name: 'Rolled Roofing',
    description: 'Budget-friendly mineral-surfaced roll roofing for low-slope roofs, sheds, garages, and utility buildings.',
    projectType: 'exterior',
    coverPageTitle: 'Rolled Roofing Proposal',
    projectDescription:
      'Complete rolled roofing installation including tear-off, deck inspection, felt underlayment, mineral-surfaced roll material, drip edge, and all penetration flashings and sealants.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roofing', description: 'Remove and dispose of existing rolled roofing, shingles, or felt layers', unit: 'sq', quantity: 1, good_price: 50, better_price: 50, best_price: 50 },
      { category: 'Roofing', item_name: 'Roof Deck Inspection & Repair', description: 'Inspect and replace damaged sheathing or board decking sections', unit: 'sheet', quantity: 1, good_price: 65, better_price: 65, best_price: 65 },
      { category: 'Roofing', item_name: 'Roofing Felt / Underlayment (15-lb / 30-lb / Ice & Water Shield)', description: 'Base layer protection — standard 15-lb felt / heavy 30-lb felt / peel-and-stick ice & water shield', unit: 'sq', quantity: 1, good_price: 18, better_price: 25, best_price: 38 },
      { category: 'Roofing', item_name: 'Rolled Roofing (90-lb Standard / 90-lb Premium / Double-Layer Cap Roll)', description: 'Mineral-surfaced asphalt roll — standard 90-lb / premium granulated 90-lb / double-layer cap roll system', unit: 'sq', quantity: 1, good_price: 42, better_price: 62, best_price: 88 },
      { category: 'Roofing', item_name: 'Drip Edge & Edge Metal', description: 'Galvanized or aluminum drip edge at eaves and rakes', unit: 'lf', quantity: 1, good_price: 4, better_price: 4, best_price: 4 },
      { category: 'Roofing', item_name: 'Pipe Boots / Penetration Flashings', description: 'Rubber pipe boots and sheet-metal flashings sealed at all roof penetrations', unit: 'each', quantity: 2, good_price: 35, better_price: 35, best_price: 35 },
      { category: 'Roofing', item_name: 'Roofing Cement & Lap Sealant', description: 'Asphalt roofing cement and lap sealant at all seams, edges, and flashings', unit: 'lot', quantity: 1, good_price: 55, better_price: 55, best_price: 55 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect property, contain debris, and perform final cleanup', unit: 'lot', quantity: 1, good_price: 250, better_price: 250, best_price: 250 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and roofing debris disposal fees', unit: 'lot', quantity: 1, good_price: 225, better_price: 225, best_price: 225 },
    ],
  },
  {
    id: 'mod-bit-flat-roof',
    name: 'Modified Bitumen (Mod Bit) Flat Roof',
    description: 'Two-ply modified bitumen flat roof system with base sheet, granulated cap sheet, and full flashing.',
    projectType: 'exterior',
    coverPageTitle: 'Modified Bitumen Flat Roof Proposal',
    projectDescription:
      'Complete modified bitumen flat roof installation including tear-off, deck preparation, polyiso insulation, cover board, SBS or APP mod-bit base sheet, granulated cap sheet, perimeter edge metal, and all flashings and drainage upgrades.',
    lineItems: [
      { category: 'Roofing', item_name: 'Tear Off Existing Roof / Membrane', description: 'Remove and dispose of existing flat roof system, gravel, BUR, or membrane', unit: 'sq', quantity: 1, good_price: 80, better_price: 80, best_price: 80 },
      { category: 'Roofing', item_name: 'Roof Deck Repair (1/2" CDX / Densdeck)', description: 'Repair or replace rotted/damaged decking and substrate sections as needed', unit: 'sheet', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'ISO Insulation Board (2")', description: '2" polyisocyanurate insulation board for thermal performance (R-13) — ~3 sheets per sq (4×8 = 32 sq ft/sheet), price is per roofing square installed', unit: 'sq', quantity: 1, good_price: 100, better_price: 100, best_price: 100 },
      { category: 'Roofing', item_name: 'Cover Board (1/2" Densdeck / HD ISO)', description: 'High-density cover board over insulation — ~3 sheets (4×8) per roofing square — material per sq', unit: 'sq', quantity: 1, good_price: 150, better_price: 150, best_price: 150 },
      { category: 'Roofing', item_name: 'Asphalt Primer / Substrate Coat', description: 'Henry 177 or equivalent asphalt-based primer — coverage ~100 sq ft/gal — material per gallon', unit: 'gal', quantity: 1, good_price: 25, better_price: 25, best_price: 25 },
      { category: 'Roofing', item_name: 'Mod Bit Base Sheet (SBS Self-Adhered / SBS Torch / APP Torch)', description: 'Modified bitumen base ply — SBS cold self-adhered / SBS torch / APP torch commercial grade — material per sq', unit: 'sq', quantity: 1, good_price: 135, better_price: 145, best_price: 195 },
      { category: 'Roofing', item_name: 'Mod Bit Cap Sheet (Granulated SBS / SBS Torch / APP Torch)', description: 'Granulated mineral-surfaced cap sheet — SBS cold / SBS torch / APP torch premium — material per sq', unit: 'sq', quantity: 1, good_price: 50, better_price: 80, best_price: 115 },
      { category: 'Roofing', item_name: 'Perimeter Edge Metal & Coping', description: 'Metal drip edge and coping cap at parapet walls and roof perimeter — material per lf', unit: 'lf', quantity: 1, good_price: 2.50, better_price: 2.50, best_price: 2.50 },
      { category: 'Roofing', item_name: 'Pipe Boots / Penetration Flashings', description: 'Mod-bit pipe boots and fabricated flashings — material per each', unit: 'each', quantity: 3, good_price: 25, better_price: 25, best_price: 25 },
      { category: 'Roofing', item_name: 'Drain Assembly / Scupper Upgrade', description: 'Cast-iron or PVC roof drain with clamping ring and strainer, or scupper box with mod-bit collar', unit: 'each', quantity: 2, good_price: 145, better_price: 145, best_price: 145 },
      { category: 'Roofing', item_name: 'Roofing Mastic & Lap Cement', description: 'Bituminous mastic and lap cement at all seams, flashings, and terminations', unit: 'lot', quantity: 1, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Protect property, contain debris, and perform final cleanup', unit: 'lot', quantity: 1, good_price: 300, better_price: 300, best_price: 300 },
      { category: 'Permits & Fees', item_name: 'Permit & Disposal Fees', description: 'Permit processing and roof debris disposal/dumpster fees', unit: 'lot', quantity: 1, good_price: 325, better_price: 325, best_price: 325 },
    ],
  },
  {
    id: 'solar-installation',
    name: 'Solar Installation',
    description: 'Residential solar PV system including panels, inverter, racking, wiring, and utility interconnect.',
    projectType: 'exterior',
    coverPageTitle: 'Solar Installation Proposal',
    projectDescription:
      'Complete residential solar photovoltaic system installation including structural assessment, panel mounting, inverter system, electrical panel work, conduit/wiring, monitoring, utility interconnection, and permit processing.',
    lineItems: [
      // ── 20-panel / ~8kW system default (scale quantity to match actual design) ──
      { category: 'Solar', item_name: 'Site Assessment & Structural Analysis', description: 'Roof load analysis, shading report, system design, and proposal for optimal panel count/layout', unit: 'lot', quantity: 1, good_price: 450, better_price: 450, best_price: 450 },
      { category: 'Solar', item_name: 'Solar Panels (Monocrystalline)', description: 'Standard / high-efficiency / premium bifacial monocrystalline panels — 400W typical (update qty to match design)', unit: 'each', quantity: 20, good_price: 200, better_price: 265, best_price: 340 },
      { category: 'Solar', item_name: 'Racking & Mounting System', description: 'Roof-mount rail system per panel — standard aluminum / low-profile / flush composite flashed mounts', unit: 'panel', quantity: 20, good_price: 80, better_price: 120, best_price: 160 },
      { category: 'Solar', item_name: 'String Inverter / Microinverters', description: 'Grid-tied string inverter (Sol-Ark/SMA) / SolarEdge optimizers / Enphase IQ microinverters — per system', unit: 'lot', quantity: 1, good_price: 5000, better_price: 9000, best_price: 14500 },
      { category: 'Solar', item_name: 'DC Wiring & Conduit (Roof to Inverter)', description: 'PV-rated DC wire runs, MC4 connectors, and weatherproof conduit routing from array to inverter', unit: 'lot', quantity: 1, good_price: 1200, better_price: 1200, best_price: 1200 },
      { category: 'Solar', item_name: 'AC Wiring & Conduit (Inverter to Panel)', description: 'AC wiring from inverter to main electrical panel with junction, disconnect, and labeling', unit: 'lot', quantity: 1, good_price: 800, better_price: 800, best_price: 800 },
      { category: 'Solar', item_name: 'Main Panel Upgrade / Electrical Work', description: 'Service panel inspection, breaker addition, or full 200A panel upgrade as required', unit: 'lot', quantity: 1, good_price: 1500, better_price: 3500, best_price: 6500 },
      { category: 'Solar', item_name: 'Solar Installation Labor', description: 'Full installation labor — panel mounting, wiring, commissioning, and utility walkthrough', unit: 'lot', quantity: 1, good_price: 5000, better_price: 7500, best_price: 10000 },
      { category: 'Solar', item_name: 'Roof Penetration Flashing & Sealant', description: 'Flashed and sealed roof penetrations at each mounting foot with roofing-grade sealant', unit: 'each', quantity: 20, good_price: 22, better_price: 22, best_price: 22 },
      { category: 'Solar', item_name: 'Monitoring System', description: 'System-level monitoring app / module-level monitoring platform (Enphase Enlighten, SolarEdge portal)', unit: 'lot', quantity: 1, good_price: 0, better_price: 450, best_price: 850 },
      { category: 'Solar', item_name: 'Battery Storage (Optional Add-On)', description: 'Home battery backup — basic LFP / mid-tier / premium (e.g. Powerwall 3 or equivalent)', unit: 'each', quantity: 1, good_price: 0, better_price: 9500, best_price: 14500 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Property protection during install and final cleanup including packaging disposal', unit: 'lot', quantity: 1, good_price: 350, better_price: 350, best_price: 350 },
      { category: 'Permits & Fees', item_name: 'Building & Electrical Permit', description: 'Residential solar building and electrical permit processing fees', unit: 'lot', quantity: 1, good_price: 450, better_price: 450, best_price: 450 },
      { category: 'Permits & Fees', item_name: 'Utility Interconnect / Net Metering Application', description: 'Utility application, interconnect agreement, and net metering enrollment', unit: 'lot', quantity: 1, good_price: 250, better_price: 250, best_price: 250 },
    ],
  },
  {
    id: 'repair-template',
    name: 'Repair Template',
    description: 'General restoration repair scope for mixed damage conditions.',
    projectType: 'both',
    coverPageTitle: 'Restoration Repair Proposal',
    projectDescription:
      'General repair scope for mixed interior/exterior damage including stabilization, selective replacement, and finish restoration.',
    lineItems: [
      { category: 'General Labor', item_name: 'Damage Assessment & Scope Verification', description: 'Detailed assessment, measurements, and scope confirmation', unit: 'hr', quantity: 4, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'Roofing', item_name: 'Emergency Tarp / Temporary Protection', description: 'Temporary weatherproofing to prevent further damage', unit: 'lot', quantity: 1, good_price: 250, better_price: 250, best_price: 250 },
      { category: 'Roofing', item_name: 'Roofing Spot Repair', description: 'Localized shingle and flashing repairs at damaged areas', unit: 'sq', quantity: 1, good_price: 180, better_price: 180, best_price: 180 },
      { category: 'Roofing', item_name: 'Chimney Cap Removal & Disposal', description: 'Remove deteriorated chimney cap, crown material, or damaged mortar wash and dispose of debris', unit: 'each', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Roofing', item_name: 'Chimney Crown Wash Repair', description: 'Inspect crown for cracks and spalling — patch with hydraulic cement or rebuild mortar wash as needed', unit: 'each', quantity: 1, good_price: 120, better_price: 120, best_price: 120 },
      { category: 'Roofing', item_name: 'Chimney Cap (Galvanized / Stainless / Copper)', description: 'New fitted chimney cap — galvanized steel / 304 stainless multi-flue / copper heritage cap', unit: 'each', quantity: 1, good_price: 85, better_price: 165, best_price: 340 },
      { category: 'Roofing', item_name: 'Chimney Flashing Resealing', description: 'Inspect step, counter, and apron flashings — reseal all joints with elastomeric sealant', unit: 'each', quantity: 1, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'Roofing', item_name: 'Chimney Repointing / Tuckpointing', description: 'Remove deteriorated mortar joints and repoint with Type S mortar — per course or full chimney', unit: 'lot', quantity: 1, good_price: 175, better_price: 175, best_price: 175 },
      { category: 'Roofing', item_name: 'Chimney Waterproof Sealant', description: 'Penetrating siloxane-based waterproof sealant applied to all exposed masonry surfaces', unit: 'each', quantity: 1, good_price: 85, better_price: 85, best_price: 85 },
      { category: 'Siding', item_name: 'Siding Section Repair', description: 'Selective siding panel replacement and patch integration', unit: 'sq', quantity: 1, good_price: 160, better_price: 160, best_price: 160 },
      { category: 'Gutters', item_name: 'Gutter/Downspout Repair', description: 'Repair sagging sections, seams, and downspout connections', unit: 'lf', quantity: 1, good_price: 10, better_price: 10, best_price: 10 },
      { category: 'Drywall', item_name: 'Drywall Repair', description: 'Patch and repair damaged drywall', unit: 'each', quantity: 1, good_price: 75, better_price: 75, best_price: 75 },
      { category: 'Drywall', item_name: 'Texture Matching', description: 'Match existing wall texture', unit: 'sq ft', quantity: 1, good_price: 1.5, better_price: 1.5, best_price: 1.5 },
      { category: 'Paint - Interior', item_name: 'Interior Paint Touch-Up', description: 'Prime and touch-up affected interior wall/ceiling areas', unit: 'sq ft', quantity: 1, good_price: 2, better_price: 2, best_price: 2 },
      { category: 'General Labor', item_name: 'Final Cleanup & Debris Removal', description: 'Final cleanup, haul away, and project closeout', unit: 'lot', quantity: 1, good_price: 175, better_price: 175, best_price: 175 },
    ],
  },
  {
    id: 'general-contractor-carpentry',
    name: 'General Contractor / Carpentry',
    description: 'Custom carpentry and general contracting scope covering framing, finish work, trim, decking, and structural repairs.',
    projectType: 'both',
    coverPageTitle: 'Carpentry & General Contracting Proposal',
    projectDescription:
      'Custom carpentry and general contracting scope including framing, structural repairs, finish carpentry, trim and millwork, decking, and site cleanup. All pricing is per the Good / Better / Best options selected.',
    lineItems: [
      { category: 'Framing & Structural', item_name: 'Structural Assessment & Layout', description: 'Evaluate existing structure, take measurements, and lay out scope of work', unit: 'hr', quantity: 4, good_price: 85, better_price: 85, best_price: 85 },
      { category: 'Framing & Structural', item_name: 'Stud Wall Framing (New Partition)', description: 'Frame new interior partition walls — 2x4 / 2x6 lumber, plates, and blocking', unit: 'lf', quantity: 1, good_price: 18, better_price: 18, best_price: 18 },
      { category: 'Framing & Structural', item_name: 'Header / Beam Installation', description: 'Install load-bearing header or engineered beam at door/window opening', unit: 'each', quantity: 1, good_price: 350, better_price: 350, best_price: 350 },
      { category: 'Framing & Structural', item_name: 'Subfloor Repair / Replacement (3/4" T&G)', description: 'Remove and replace damaged or rotted subfloor sheathing — per sheet', unit: 'sheet', quantity: 1, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'Framing & Structural', item_name: 'Blocking & Backing', description: 'Install blocking and backing in walls/ceilings for hardware, cabinets, or fixtures', unit: 'hr', quantity: 2, good_price: 85, better_price: 85, best_price: 85 },
      { category: 'Framing & Structural', item_name: 'Joist Sister / Floor Joist Repair', description: 'Sister or replace damaged floor/ceiling joists — per joist', unit: 'each', quantity: 1, good_price: 180, better_price: 180, best_price: 180 },
      { category: 'Finish Carpentry', item_name: 'Door Installation (Pre-Hung Interior)', description: 'Install pre-hung interior door including casing, hinges, and hardware', unit: 'each', quantity: 1, good_price: 285, better_price: 395, best_price: 550 },
      { category: 'Finish Carpentry', item_name: 'Door Installation (Exterior / Entry)', description: 'Install exterior or entry door including weather-stripping, threshold, and casing', unit: 'each', quantity: 1, good_price: 420, better_price: 620, best_price: 890 },
      { category: 'Finish Carpentry', item_name: 'Window Installation', description: 'Set and seal replacement window unit, flash, and trim to finish', unit: 'each', quantity: 1, good_price: 380, better_price: 560, best_price: 820 },
      { category: 'Finish Carpentry', item_name: 'Built-In Shelving / Bookcase', description: 'Build and install custom shelving or bookcase unit — per linear foot', unit: 'lf', quantity: 1, good_price: 110, better_price: 175, best_price: 260 },
      { category: 'Finish Carpentry', item_name: 'Cabinet Installation', description: 'Install customer-supplied cabinets — per cabinet box', unit: 'each', quantity: 1, good_price: 85, better_price: 125, best_price: 185 },
      { category: 'Finish Carpentry', item_name: 'Stair Railing & Baluster Installation', description: 'Install stair handrail system with balusters — per flight', unit: 'flight', quantity: 1, good_price: 650, better_price: 980, best_price: 1450 },
      { category: 'Trim & Millwork', item_name: 'Baseboard Installation', description: 'Install painted or stained baseboard trim — per linear foot installed', unit: 'lf', quantity: 1, good_price: 4.5, better_price: 4.5, best_price: 4.5 },
      { category: 'Trim & Millwork', item_name: 'Door & Window Casing', description: 'Install door or window casing — per opening (both sides)', unit: 'each', quantity: 1, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'Trim & Millwork', item_name: 'Crown Molding Installation', description: 'Install crown molding at ceiling-wall junction — per linear foot', unit: 'lf', quantity: 1, good_price: 8, better_price: 8, best_price: 8 },
      { category: 'Trim & Millwork', item_name: 'Chair Rail / Wainscoting Cap', description: 'Install chair rail or wainscoting cap trim — per linear foot', unit: 'lf', quantity: 1, good_price: 6, better_price: 6, best_price: 6 },
      { category: 'Trim & Millwork', item_name: 'Coffered Ceiling / Beam Detail', description: 'Install decorative coffered ceiling grid or beam detail — per bay', unit: 'each', quantity: 1, good_price: 420, better_price: 640, best_price: 960 },
      { category: 'Decking', item_name: 'Deck Frame & Ledger (Pressure Treated)', description: 'Build pressure-treated deck frame, ledger, posts, and footings — per sq ft', unit: 'sq ft', quantity: 1, good_price: 18, better_price: 18, best_price: 18 },
      { category: 'Decking', item_name: 'Deck Boards (Pressure Treated / Composite)', description: 'Install deck surface boards — PT lumber / composite / hardwood', unit: 'sq ft', quantity: 1, good_price: 12, better_price: 22, best_price: 38 },
      { category: 'Decking', item_name: 'Deck Railing System', description: 'Install code-compliant deck railing — wood, composite, or aluminum — per linear foot', unit: 'lf', quantity: 1, good_price: 45, better_price: 75, best_price: 115 },
      { category: 'Decking', item_name: 'Stair Stringers & Treads (Deck)', description: 'Build and install deck stairs — per step', unit: 'each', quantity: 1, good_price: 95, better_price: 95, best_price: 95 },
      { category: 'General Labor', item_name: 'General Carpentry Labor', description: 'Skilled carpentry labor for custom scopes not itemized above', unit: 'hr', quantity: 8, good_price: 85, better_price: 85, best_price: 85 },
      { category: 'General Labor', item_name: 'Materials — Lumber & Fasteners', description: 'Allowance for dimensional lumber, hardware, fasteners, and adhesives', unit: 'lot', quantity: 1, good_price: 350, better_price: 350, best_price: 350 },
      { category: 'General Labor', item_name: 'Site Protection & Cleanup', description: 'Floor/furniture protection during work and final debris removal', unit: 'lot', quantity: 1, good_price: 275, better_price: 275, best_price: 275 },
      { category: 'Permits & Fees', item_name: 'Building Permit & Inspection Fees', description: 'Permit application, plan review, and required inspection fees', unit: 'lot', quantity: 1, good_price: 350, better_price: 350, best_price: 350 },
    ],
  },
];

// Damage types for photo documentation
export const damageTypes = [
  'Hail Damage',
  'Wind Damage',
  'Water Damage',
  'Storm Damage',
  'Wear & Tear',
  'Rot/Decay',
  'Mold/Mildew',
  'Cracking',
  'Missing Material',
  'Structural Damage',
  'Impact Damage',
  'UV Damage',
  'Other'
];

// Status colors and labels
export const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100' },
  sent: { label: 'Sent', color: 'text-blue-700', bg: 'bg-blue-100' },
  viewed: { label: 'Viewed', color: 'text-purple-700', bg: 'bg-purple-100' },
  signed: { label: 'Signed', color: 'text-green-700', bg: 'bg-green-100' },
  expired: { label: 'Expired', color: 'text-orange-700', bg: 'bg-orange-100' },
  declined: { label: 'Declined', color: 'text-red-700', bg: 'bg-red-100' },
};

export const tierLabels = {
  good: { label: 'Good', subtitle: 'Essential Coverage', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', solidBg: 'bg-emerald-600', icon: 'shield' },
  better: { label: 'Better', subtitle: 'Enhanced Protection', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', solidBg: 'bg-blue-600', icon: 'shield-check' },
  best: { label: 'Best', subtitle: 'Premium Solution', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', solidBg: 'bg-amber-600', icon: 'crown' },
};

export interface QuoteUpgrade {
  id: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  price: number;
  is_suggested?: boolean;
  is_selected?: boolean;
  photo_url?: string | null;
}

// Type aliases for components that use older naming conventions
export type Quote = Estimate;
export type Customer = Contact;
export type QuotePhoto = EstimatePhoto;
