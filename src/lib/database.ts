// Database service layer for CRM data persistence
import { supabase, isDemoMode } from './supabase';
import { markDeleted } from './recentlyDeleted';

// ── Company ID safety assertion ───────────────────────────────────────────────
// Defense-in-depth: throws in dev, logs in prod if any method fires without
// a company_id. RLS policies are the real enforcement layer.
function assertCompanyId(companyId: string | undefined | null, method: string): void {
  if (!companyId) {
    const msg = `[database] ${method} called without company_id — query blocked`;
    if (import.meta.env.DEV) {
      console.warn(msg); return;

    } else {
      console.error(msg);
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Types matching database schema
// The shared backend names some company fields the QuoteMGR way; the web app
// still uses its older names. Reads expose both, writes use the backend names.
function fromDbCompanyRow<T>(row: T): T {
  if (!row) return row;
  const r = row as Record<string, unknown>;
  return {
    ...r,
    tagline: r.tagline ?? r.about_tagline,
    contractor_license: r.contractor_license ?? r.license_number,
    from_email: r.from_email ?? r.quote_sender_email,
    from_name: r.from_name ?? r.quote_sender_name,
    smtp_user: r.smtp_user ?? r.smtp_username,
    smtp_pass: r.smtp_pass ?? r.smtp_password,
  } as T;
}

function toDbCompanyRow(updates: Partial<DbCompany>): Record<string, unknown> {
  const { tagline, contractor_license, from_email, from_name, smtp_user, smtp_pass, ...rest } = updates;
  return {
    ...rest,
    ...(tagline !== undefined ? { about_tagline: tagline } : {}),
    ...(contractor_license !== undefined ? { license_number: contractor_license } : {}),
    ...(from_email !== undefined ? { quote_sender_email: from_email } : {}),
    ...(from_name !== undefined ? { quote_sender_name: from_name } : {}),
    ...(smtp_user !== undefined ? { smtp_username: smtp_user } : {}),
    ...(smtp_pass !== undefined ? { smtp_password: smtp_pass } : {}),
  };
}

// work_orders.assigned_to is one team member on the shared backend (the mobile
// app and QuoteMGR read it). The web app assigns several people by user id, so
// the full list lives in assigned_user_ids and the first one fills assigned_to.
function toDbWorkOrderRow(workOrder: Partial<DbWorkOrder>): Record<string, unknown> {
  const { assigned_to, ...rest } = workOrder;
  if (assigned_to === undefined) return rest;
  const ids = (assigned_to ?? []).filter(Boolean);
  return { ...rest, assigned_user_ids: ids, assigned_to: ids[0] ?? null };
}

function fromDbWorkOrderRow(row: DbWorkOrder): DbWorkOrder {
  const ids = (row as DbWorkOrder & { assigned_user_ids?: string[] | null }).assigned_user_ids;
  return { ...row, assigned_to: Array.isArray(ids) ? ids : [] };
}

export interface DbCompany {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  logo_url?: string;
  tagline?: string;
  contractor_license?: string;
  tax_id?: string;
  from_email?: string;
  from_name?: string;
  // Custom SMTP settings (add-smtp-settings-20260322.sql)
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: boolean;
  subscription_plan?: 'starter' | 'pro' | 'business' | 'scale' | 'trial';
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing';
  trial_ends_at?: string;
  subscription_ends_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  // Limited permission seats tracking
  limited_seats_total?: number;
  limited_seats_used?: number;
  // Material pricing config (shared across all team members)
  pricing_config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbContact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone1?: string;
  phone2?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  status: string;
  status_changed_at?: string;
  lead_source?: string;
  assigned_to?: string;
  tags: string[];
  insurance_company?: string;
  policy_number?: string;
  claim_number?: string;
  adjuster_name?: string;
  adjuster_phone?: string;
  adjuster_email?: string;
  deductible?: number;
  project_type?: string;
  project_value?: number;
  deposit_amount?: number;
  deposit_paid: boolean;
  deposit_date?: string;
  final_payment_amount?: number;
  final_payment_paid: boolean;
  final_payment_date?: string;
  is_retail: boolean;
  retail_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbJob {
  id: string;
  company_id: string;
  contact_id: string;
  title: string;
  description?: string;
  status: string;
  scheduled_date?: string;
  completed_date?: string;
  estimated_value?: number;
  actual_value?: number;
  assigned_team: string[];
  materials: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbAppointment {
  id: string;
  company_id: string;
  contact_id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  duration: number;
  start_time?: string;
  end_time?: string;
  assigned_to?: string;
  location?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbInvoice {
  id: string;
  company_id: string;
  contact_id: string;
  job_id?: string;
  invoice_number?: string;
  amount: number;
  tax_amount: number;
  status: string;
  due_date?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface DbCommunication {
  id: string;
  company_id: string;
  contact_id: string;
  type: string;
  direction: string;
  subject?: string;
  content: string;
  user_id?: string;
  created_at: string;
}

// On the shared backend documents.size is a byte count and documents.uploaded_by
// references team_members.id, while the app works with a formatted size
// ("1.2 MB") and the auth user id. Convert at the database boundary.
const DOCUMENT_SIZE_UNITS: Record<string, number> = { BYTES: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

function formatDocumentSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${units[i]}`;
}

function toDbDocumentRow(document: Partial<DbDocument>): Record<string, unknown> {
  const { size, uploaded_by: _uploadedBy, ...rest } = document as Partial<DbDocument> & { size?: string | number };
  let bytes: number | null = null;
  if (typeof size === 'number') {
    bytes = size;
  } else if (typeof size === 'string') {
    const match = size.trim().match(/^([\d.]+)\s*(bytes|kb|mb|gb)?$/i);
    if (match) bytes = Math.round(parseFloat(match[1]) * DOCUMENT_SIZE_UNITS[(match[2] || 'bytes').toUpperCase()]);
  }
  return bytes === null ? rest : { ...rest, size: bytes };
}

function fromDbDocumentRow(row: DbDocument): DbDocument {
  const size = row.size as unknown;
  return typeof size === 'number' ? { ...row, size: formatDocumentSize(size) } : row;
}

export interface DbDocument {
  id: string;
  company_id: string;
  contact_id?: string;
  name: string;
  type: string;
  url: string;
  size?: string;
  uploaded_by?: string;
  created_at: string;
  category?: string; // e.g., 'measurements' for Roofr PDFs
  notes?: string;
  file_path?: string;
  file_url?: string;
  file_type?: string;
  uploaded_at?: string;
  // Signing workflow columns (added via add-document-signing-columns.sql)
  sign_token?: string;
  html_content?: string;
  status?: 'draft' | 'sent' | 'viewed' | 'signed';
  signed_by?: string;
  signature_data?: string;
  signed_at?: string;
  viewed_at?: string;
  sent_by?: string;
  contact_email?: string;
}

export interface DbKanbanBoard {
  id: string;
  company_id: string;
  name: string;
  type: string;
  visible_to: string[];
  created_by?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbKanbanColumn {
  id: string;
  board_id: string;
  title: string;
  status: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface DbLeadSource {
  id: string;
  company_id: string;
  name: string;
  is_custom: boolean;
  created_by?: string;
  created_at: string;
}

export interface DbAutomation {
  id: string;
  company_id: string;
  name: string;
  trigger_event: string;
  action_type: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  /** Custom message/body for email or SMS automations */
  message_body?: string;
  /** Hours of inactivity before a stale-lead alert fires (default 24) */
  trigger_delay_hours?: number;
  /** Persisted recipient list as JSON */
  recipients?: unknown;
}

export interface DbProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  company_id?: string;
  department?: string;
  phone?: string;
  avatar_url?: string;
  work_email?: string;
  is_active: boolean;
  commission_rate?: number;           // legacy – kept for backcompat
  commission_rate_self_gen?: number;  // % for self-generated leads
  commission_rate_company?: number;   // % for company-generated leads
  commission_rate_custom?: number;    // custom/override %
  member_type?: 'employee' | 'subcontractor';
  subcontractor_company?: string;
  ui_prefs?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbNotification {
  id: string;
  company_id: string;
  user_id?: string;
  type: string;
  title: string;
  message: string;
  related_id?: string;
  related_type?: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbNotificationPreference {
  id?: string;
  company_id: string;
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  hail_alerts_enabled: boolean;
  wind_alerts_enabled: boolean;
  appointment_alerts_enabled: boolean;
  lead_assignment_alerts_enabled: boolean;
  mention_alerts_enabled: boolean;
  min_hail_size_inches: number;
  min_wind_speed_mph: number;
  min_severity: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  max_alerts_per_day?: number;
  service_area_zip_codes: string[];
  service_area_radius_miles?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbSupplier {
  id: string;
  company_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  account_number?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMaterialOrder {
  id: string;
  company_id: string;
  supplier_id: string;
  contact_id?: string;
  job_id?: string;
  order_number?: string;
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbMaterialOrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface DbEstimateItem {
  id: string;
  estimate_id: string;
  company_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbEstimate {
  id: string;
  company_id: string;
  contact_id: string;
  job_id?: string;
  estimate_number: string;
  title: string;
  description?: string;
  status: string;
  items?: any[];
  subtotal: number;
  tax: number;
  total: number;
  validity_date?: string;
  valid_until?: string;
  notes?: string;
  terms?: string;
  terms_and_conditions?: string;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  declined_at?: string;
  signed_by?: string;
  signature_data?: string;
  sign_token?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  final_offer_sent_at?: string;
  final_offer_discount_pct?: number;
}

export interface DbEstimateItem {
  id: string;
  estimate_id: string;
  company_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbProject {
  id: string;
  company_id: string;
  project_number: string;
  name: string;
  contact_id: string;
  estimate_id?: string;
  description?: string;
  status: string;
  priority: string;
  start_date?: string;
  end_date?: string;
  completed_date?: string;
  estimated_budget: number;
  actual_cost: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  project_manager_id?: string;
  notes?: string;
  tags?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkOrder {
  id: string;
  company_id: string;
  work_order_number: string;
  project_id?: string;
  contact_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduled_date?: string;
  started_at?: string;
  completed_at?: string;
  assigned_to: string[];
  estimated_hours?: number;
  actual_hours?: number;
  labor_cost: number;
  material_cost: number;
  total_cost: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  attachments?: string[];
  checklist_items?: any[];
  signed_by?: string;
  signature_data?: string;
  sign_token?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbInvite {
  id: string;
  company_id: string;
  email: string;
  role: string;
  invited_by?: string;
  token: string;
  accepted: boolean;
  expires_at: string;
  created_at?: string;
  accepted_at?: string;
}

export interface DbExpense {
  id: string;
  company_id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  job_id?: string;
  job_name?: string;
  contact_id?: string;
  contact_name?: string;
  receipt_url?: string;
  status: string;
  submitted_by?: string;
  submitted_by_name?: string;
  submitted_at: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  notes?: string;
  mileage?: number;
  location?: string;
  vendor?: string;
  payment_method: string;
  reimbursable: boolean;
  created_at: string;
  updated_at: string;
}

// Database service class
class DatabaseService {
  private inDemoMode(): boolean {
    return isDemoMode;
  }

  private getCachedCompany(companyId: string): DbCompany | null {
    try {
      const raw = localStorage.getItem(`company_cache_${companyId}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw) as { data: DbCompany; ts: number };
      // 24 h TTL — company name/logo/settings change rarely; stale branding is
      // far less disruptive than a spinner on every page refresh. The
      // crm-company-updated event forces an immediate re-fetch when settings are saved.
      if (Date.now() - ts > 24 * 60 * 60 * 1000) return null;
      return data;
    } catch {
      return null;
    }
  }

  private setCachedCompany(companyId: string, company: DbCompany): void {
    try {
      localStorage.setItem(
        `company_cache_${companyId}`,
        JSON.stringify({ data: company, ts: Date.now() }),
      );
    } catch { /* quota exceeded — ignore */ }
  }

  private raceTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }

  // Company operations
  async getCompany(companyId: string): Promise<DbCompany | null> {
    if (this.inDemoMode()) {
      try {
        const stored = localStorage.getItem(`demo_company_${companyId}`);
        if (stored) return JSON.parse(stored) as DbCompany;
      } catch (error) {
        console.warn('[Database] Failed to retrieve company from localStorage:', error);
      }
      return null;
    }

    const cached = this.getCachedCompany(companyId);
    if (cached) return cached;

    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('companies').select('*').eq('id', companyId).single(),
        5000, 'companies direct query',
      );
      if (!error && data) { const company = fromDbCompanyRow(data); this.setCachedCompany(companyId, company); return company; }
      if (error) console.warn('[Database] Direct company query failed, trying RPC:', error.message);
    } catch {
      console.warn('[Database] Direct query timed-out, trying RPC');
    }

    try {
      const { data: rpcData, error: rpcError } = await this.raceTimeout(
        supabase.rpc('get_my_company'),
        5000, 'get_my_company RPC',
      );
      if (!rpcError && rpcData && rpcData.length > 0) {
        const company = fromDbCompanyRow(rpcData[0] as DbCompany);
        this.setCachedCompany(companyId, company);
        return company;
      }
      if (rpcError) console.warn('[Database] get_my_company RPC also failed:', rpcError.message);
    } catch {
      console.warn('[Database] RPC unavailable/timed-out');
    }

    return null;
  }

  async createCompany(company: Partial<DbCompany>): Promise<DbCompany | null> {
    if (this.inDemoMode()) {
      const newCompany = {
        id: company.id || `demo-company-${Date.now()}`,
        name: company.name || 'Demo Company',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...company,
      } as DbCompany;
      try {
        localStorage.setItem(`demo_company_${newCompany.id}`, JSON.stringify(newCompany));
      } catch (error) {
        console.warn('[Database] Failed to save company to localStorage:', error);
      }
      return newCompany;
    }
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('companies').insert(company).select().single(),
        10000, 'createCompany'
      );
      if (error) { console.error('Error creating company:', error); return null; }
      return data;
    } catch (err) { console.error('createCompany timed out or failed:', err); return null; }
  }

  async updateCompany(companyId: string, updates: Partial<DbCompany>): Promise<DbCompany | null> {
    if (this.inDemoMode()) {
      try {
        const existing = localStorage.getItem(`demo_company_${companyId}`);
        const companyData = existing ? JSON.parse(existing) : { id: companyId };
        const updated = { ...companyData, ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem(`demo_company_${companyId}`, JSON.stringify(updated));
        return updated as DbCompany;
      } catch (error) {
        console.warn('[Database] Failed to save company to localStorage:', error);
        return { id: companyId, ...updates, updated_at: new Date().toISOString() } as DbCompany;
      }
    }
    try {
      const { data: rpcData, error: rpcError } = await this.raceTimeout(
        supabase.rpc('update_my_company', {
          p_name: updates.name ?? null,
          p_phone: updates.phone ?? null,
          p_email: updates.email ?? null,
          p_website: updates.website ?? null,
          p_address: updates.address ?? null,
          p_city: updates.city ?? null,
          p_state: updates.state ?? null,
          p_zip: updates.zip ?? null,
          p_logo_url: updates.logo_url ?? null,
          p_tagline: updates.tagline ?? null,
          p_contractor_license: updates.contractor_license ?? null,
          p_tax_id: updates.tax_id ?? null,
          p_from_email: updates.from_email ?? null,
          p_from_name: updates.from_name ?? null,
        }),
        5000, 'update_my_company RPC'
      );
      if (!rpcError && rpcData) {
        const company = fromDbCompanyRow(rpcData as DbCompany);
        this.setCachedCompany(companyId, company);
        return company;
      }
      if (rpcError) console.warn('[Database] update_my_company RPC failed, falling back:', rpcError.message);
    } catch {
      console.warn('[Database] update RPC timed-out or not available, using direct query');
    }
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('companies').update({ ...toDbCompanyRow(updates), updated_at: new Date().toISOString() }).eq('id', companyId).select().single(),
        5000, 'updateCompany direct'
      );
      if (error) { console.error('Error updating company:', error); return null; }
      const company = fromDbCompanyRow(data);
      this.setCachedCompany(companyId, company);
      return company;
    } catch (err) { console.error('updateCompany timed out or failed:', err); return null; }
  }

  async updateSmtpSettings(companyId: string, settings: Pick<DbCompany, 'smtp_host' | 'smtp_port' | 'smtp_user' | 'smtp_pass' | 'smtp_secure'>): Promise<boolean> {
    assertCompanyId(companyId, 'updateSmtpSettings');
    try {
      const { error } = await this.raceTimeout(
        supabase.from('companies').update({ ...toDbCompanyRow(settings), updated_at: new Date().toISOString() }).eq('id', companyId),
        5000, 'updateSmtpSettings'
      );
      if (error) { console.error('Error updating SMTP settings:', error); return false; }
      return true;
    } catch (err) { console.error('updateSmtpSettings failed:', err); return false; }
  }

  // Contact operations
  async getContacts(companyId: string): Promise<DbContact[]> {
    assertCompanyId(companyId, 'getContacts');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('contacts').select('*').eq('company_id', companyId)
      .or('is_archived.eq.false,is_archived.is.null')
      .order('last_name', { ascending: true });
    if (error) { console.error('Error fetching contacts:', error); return []; }
    return data || [];
  }

  async getContact(contactId: string): Promise<DbContact | null> {
    const { data, error } = await supabase.from('contacts').select('*').eq('id', contactId).single();
    if (error) { console.error('Error fetching contact:', error); return null; }
    return data;
  }

  async findDuplicateContacts(
    companyId: string,
    firstName: string,
    lastName: string,
    email?: string,
    phone?: string
  ): Promise<DbContact[]> {
    assertCompanyId(companyId, 'findDuplicateContacts');
    
    try {
      // Search for potential duplicates by name, email, or phone
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .neq('is_archived', true);

      // Build OR conditions for matching
      const conditions: string[] = [];
      
      // Exact name match (case-insensitive)
      if (firstName && lastName) {
        query = query.or(
          `and(first_name.ilike.${firstName},last_name.ilike.${lastName})`
        );
      }
      
      // Email match (if provided and not empty)
      if (email && email.trim() !== '') {
        const { data: emailMatches } = await supabase
          .from('contacts')
          .select('*')
          .eq('company_id', companyId)
          .neq('is_archived', true)
          .ilike('email', email);
        
        if (emailMatches && emailMatches.length > 0) {
          return emailMatches;
        }
      }
      
      // Phone match (if provided and not empty)
      if (phone && phone.trim() !== '') {
        const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
        const { data: phoneMatches } = await supabase
          .from('contacts')
          .select('*')
          .eq('company_id', companyId)
          .neq('is_archived', true)
          .or(`phone1.ilike.%${cleanPhone}%,phone2.ilike.%${cleanPhone}%`);
        
        if (phoneMatches && phoneMatches.length > 0) {
          return phoneMatches;
        }
      }

      const { data, error } = await query.limit(10);
      
      if (error) {
        console.error('Error finding duplicate contacts:', error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error('findDuplicateContacts failed:', err);
      return [];
    }
  }

  async createContact(contact: Partial<DbContact>): Promise<DbContact | null> {
    assertCompanyId(contact.company_id, 'createContact');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('contacts').insert(contact).select().single(),
        10000, 'createContact'
      );
      if (error) { console.error('Error creating contact:', error); throw new Error(error.message || 'Failed to save contact to database'); }
      return data;
    } catch (err) {
      console.error('createContact timed out or failed:', err);
      throw err instanceof Error ? err : new Error('Failed to create contact');
    }
  }

  async updateContact(contactId: string, updates: Partial<DbContact>): Promise<DbContact | null> {
    try {
      // Extended timeout for mobile-friendly performance (30 seconds)
      const { data, error } = await this.raceTimeout(
        supabase.from('contacts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', contactId).select().single(),
        30000, 'updateContact',
      );
      if (error) { 
        console.error('Error updating contact:', error); 
        // Provide more specific error messages
        if (error.code === 'PGRST116') {
          throw new Error('Contact not found or permission denied');
        } else if (error.message.includes('timeout')) {
          throw new Error('Database timeout - please try again with a better connection');
        } else {
          throw new Error(error.message || 'Failed to update contact');
        }
      }
      return data;
    } catch (err) {
      console.error('updateContact timed out or failed:', err);
      if (err instanceof Error && err.message.includes('timed out')) {
        throw new Error('Contact save timed out - please check your connection and try again');
      }
      throw err instanceof Error ? err : new Error('Failed to update contact');
    }
  }

  async deleteContact(contactId: string): Promise<boolean> {
    try {
      // Supabase's delete() returns no error when the WHERE clause + RLS
      // match zero rows — it's a valid "deleted nothing" response, not a
      // rejected request. Without count:'exact' that reads as success and
      // the caller removes the contact from the UI even though it is still
      // in the database, so it silently reappears on the next reload. Ask
      // PostgREST for the affected row count and treat zero as a failure.
      const { error, count } = await this.raceTimeout(
        supabase.from('contacts').delete({count: 'exact'}).eq('id', contactId),
        10000, 'deleteContact'
      );
      if (error) { console.error('Error deleting contact:', error); return false; }
      if (!count) { console.error('deleteContact: 0 rows deleted for id', contactId); return false; }
      markDeleted('contact', contactId);
      return true;
    } catch (err) { console.error('deleteContact timed out or failed:', err); return false; }
  }

  // Job operations
  async getJobs(companyId: string): Promise<DbJob[]> {
    assertCompanyId(companyId, 'getJobs');
    const { data, error } = await supabase
      .from('jobs').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching jobs:', error); return []; }
    return data || [];
  }

  async getJobsByContact(contactId: string): Promise<DbJob[]> {
    const { data, error } = await supabase
      .from('jobs').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching jobs:', error); return []; }
    return data || [];
  }

  async createJob(job: Partial<DbJob>): Promise<DbJob | null> {
    assertCompanyId(job.company_id, 'createJob');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('jobs').insert(job).select().single(),
        10000, 'createJob'
      );
      if (error) { console.error('Error creating job:', error); return null; }
      return data;
    } catch (err) { console.error('createJob timed out or failed:', err); return null; }
  }

  async updateJob(jobId: string, updates: Partial<DbJob>): Promise<DbJob | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('jobs').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', jobId).select().single(),
        10000, 'updateJob'
      );
      if (error) { console.error('Error updating job:', error); return null; }
      return data;
    } catch (err) { console.error('updateJob timed out or failed:', err); return null; }
  }

  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('jobs').delete().eq('id', jobId),
        10000, 'deleteJob'
      );
      if (error) { console.error('Error deleting job:', error); return false; }
      return true;
    } catch (err) { console.error('deleteJob timed out or failed:', err); return false; }
  }

  // Appointment operations
  async getAppointments(companyId: string): Promise<DbAppointment[]> {
    assertCompanyId(companyId, 'getAppointments');
    if (this.inDemoMode()) return [];
    const tryFetch = async (orderBy: 'date' | 'start_time') =>
      supabase.from('appointments').select('*').eq('company_id', companyId).order(orderBy, { ascending: true });

    let data: any[] | null = null;
    let error: any = null;
    const startTimeResult = await tryFetch('start_time');
    if (startTimeResult.error) {
      const dateResult = await tryFetch('date');
      data = dateResult.data; error = dateResult.error;
    } else {
      data = startTimeResult.data; error = null;
    }
    if (error) { console.error('Error fetching appointments:', error); return []; }

    return (data || []).map((apt: any) => {
      if (apt.date && apt.time) return apt as DbAppointment;
      if (apt.start_time) {
        const start = new Date(apt.start_time);
        const end = apt.end_time ? new Date(apt.end_time) : null;
        const duration = end && !Number.isNaN(end.getTime())
          ? Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60))) : 60;
        const hh = String(start.getHours()).padStart(2, '0');
        const mm = String(start.getMinutes()).padStart(2, '0');
        return { ...apt, date: start.toISOString().split('T')[0], time: `${hh}:${mm}`, duration } as DbAppointment;
      }
      return { ...apt, date: new Date().toISOString().split('T')[0], time: '09:00', duration: 60 } as DbAppointment;
    });
  }

  async createAppointment(appointment: Partial<DbAppointment>): Promise<DbAppointment | null> {
    assertCompanyId(appointment.company_id, 'createAppointment');
    const date = appointment.date || new Date().toISOString().split('T')[0];
    const time = appointment.time || '09:00';
    const duration = appointment.duration || 60;
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const toStartAndEnd = () => ({
      company_id: appointment.company_id, contact_id: appointment.contact_id,
      title: appointment.title, type: appointment.type,
      start_time: start.toISOString(), end_time: end.toISOString(),
      assigned_to: appointment.assigned_to, location: appointment.location,
      notes: appointment.notes, status: appointment.status,
    });
    const toDateTime = () => ({
      company_id: appointment.company_id, contact_id: appointment.contact_id,
      title: appointment.title, type: appointment.type,
      date, time, duration,
      assigned_to: appointment.assigned_to, location: appointment.location,
      notes: appointment.notes, status: appointment.status,
    });

    try {
      const firstAttempt = await supabase.from('appointments').insert(toStartAndEnd()).select().single();
      if (!firstAttempt.error) return firstAttempt.data as DbAppointment;
      if (firstAttempt.error.code === '23505') {
        console.error('Appointment conflict (start_time unique violation):', firstAttempt.error);
        return null;
      }
      const secondAttempt = await supabase.from('appointments').insert(toDateTime()).select().single();
      if (secondAttempt.error) { console.error('Error creating appointment:', secondAttempt.error); return null; }
      return secondAttempt.data as DbAppointment;
    } catch (err) {
      console.error('createAppointment timed out or failed:', err);
      throw err instanceof Error ? err : new Error('Failed to create appointment');
    }
  }

  async updateAppointment(appointmentId: string, updates: Partial<DbAppointment>): Promise<DbAppointment | null> {
    try {
      const dbUpdates: Partial<DbAppointment> = { ...updates };
      if (updates.date && updates.time && updates.duration !== undefined) {
        const start = new Date(`${updates.date}T${updates.time}:00`);
        const end = new Date(start.getTime() + updates.duration * 60 * 1000);
        dbUpdates.start_time = start.toISOString();
        dbUpdates.end_time = end.toISOString();
        delete dbUpdates.date; delete dbUpdates.time; delete dbUpdates.duration;
      }
      const { data, error } = await this.raceTimeout(
        supabase.from('appointments').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', appointmentId).select().single(),
        10000, 'updateAppointment'
      );
      if (error) { console.error('Error updating appointment:', error); return null; }
      return data;
    } catch (err) { console.error('updateAppointment timed out or failed:', err); return null; }
  }

  async deleteAppointment(appointmentId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('appointments').delete().eq('id', appointmentId),
        10000, 'deleteAppointment'
      );
      if (error) { console.error('Error deleting appointment:', error); return false; }
      return true;
    } catch (err) { console.error('deleteAppointment timed out or failed:', err); return false; }
  }

  // Invoice operations
  async getInvoices(companyId: string): Promise<DbInvoice[]> {
    assertCompanyId(companyId, 'getInvoices');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching invoices:', error); return []; }
    return data || [];
  }

  async getInvoiceWithItems(invoiceId: string): Promise<{ invoice: DbInvoice; items: DbInvoiceItem[] } | null> {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices').select('*').eq('id', invoiceId).single();
    if (invoiceError) { console.error('Error fetching invoice:', invoiceError); return null; }
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items').select('*').eq('invoice_id', invoiceId);
    if (itemsError) { console.error('Error fetching invoice items:', itemsError); return { invoice, items: [] }; }
    return { invoice, items: items || [] };
  }

  async createInvoice(invoice: Partial<DbInvoice>, items: Partial<DbInvoiceItem>[]): Promise<DbInvoice | null> {
    assertCompanyId(invoice.company_id, 'createInvoice');
    try {
      const { data: newInvoice, error: invoiceError } = await this.raceTimeout(
        supabase.from('invoices').insert(invoice).select().single(),
        10000, 'createInvoice'
      );
      if (invoiceError) { console.error('Error creating invoice:', invoiceError); throw new Error(invoiceError.message || 'Failed to save invoice'); }
      if (items.length > 0) {
        const itemsWithInvoiceId = items.map(item => ({ ...item, invoice_id: newInvoice.id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithInvoiceId);
        if (itemsError) console.error('Error creating invoice items:', itemsError);
      }
      return newInvoice;
    } catch (err) {
      console.error('createInvoice timed out or failed:', err);
      throw err instanceof Error ? err : new Error('Failed to create invoice');
    }
  }

  async updateInvoice(invoiceId: string, updates: Partial<DbInvoice>): Promise<DbInvoice | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('invoices').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', invoiceId).select().single(),
        10000, 'updateInvoice'
      );
      if (error) { console.error('Error updating invoice:', error); return null; }
      return data;
    } catch (err) { console.error('updateInvoice timed out or failed:', err); return null; }
  }

  // Communication operations
  async getCommunications(companyId: string): Promise<DbCommunication[]> {
    assertCompanyId(companyId, 'getCommunications');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('communications').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching communications:', error); return []; }
    return data || [];
  }

  async getCommunicationsByContact(contactId: string): Promise<DbCommunication[]> {
    const { data, error } = await supabase
      .from('communications').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching communications:', error); return []; }
    return data || [];
  }

  async createCommunication(communication: Partial<DbCommunication>): Promise<DbCommunication | null> {
    assertCompanyId(communication.company_id, 'createCommunication');
    const { data, error } = await supabase.from('communications').insert(communication).select().single();
    if (error) { console.error('Error creating communication:', error); return null; }
    return data;
  }

  // Document operations
  async getDocuments(companyId: string): Promise<DbDocument[]> {
    assertCompanyId(companyId, 'getDocuments');
    const { data, error } = await supabase
      .from('documents').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching documents:', error); return []; }
    return (data || []).map(fromDbDocumentRow);
  }

  async getDocumentsByContact(contactId: string): Promise<DbDocument[]> {
    const { data, error } = await supabase
      .from('documents').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching documents:', error); return []; }
    return (data || []).map(fromDbDocumentRow);
  }

  async createDocument(document: Partial<DbDocument>): Promise<DbDocument | null> {
    assertCompanyId(document.company_id, 'createDocument');
    const { data, error } = await supabase.from('documents').insert(toDbDocumentRow(document)).select().single();
    if (error) { console.error('Error creating document:', error); return null; }
    return fromDbDocumentRow(data);
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    const { error } = await supabase.from('documents').delete().eq('id', documentId);
    if (error) { console.error('Error deleting document:', error); return false; }
    return true;
  }

  // Kanban board operations
  async getKanbanBoards(companyId: string): Promise<DbKanbanBoard[]> {
    assertCompanyId(companyId, 'getKanbanBoards');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('kanban_boards').select('*').eq('company_id', companyId).order('created_at', { ascending: true });
    if (error) { console.error('Error fetching kanban boards:', error); return []; }
    return data || [];
  }

  async getKanbanBoardWithColumns(boardId: string): Promise<{ board: DbKanbanBoard; columns: DbKanbanColumn[] } | null> {
    const { data: board, error: boardError } = await supabase
      .from('kanban_boards').select('*').eq('id', boardId).single();
    if (boardError) { console.error('Error fetching board:', boardError); return null; }
    const { data: columns, error: columnsError } = await supabase
      .from('kanban_columns').select('*').eq('board_id', boardId).order('sort_order', { ascending: true });
    if (columnsError) { console.error('Error fetching columns:', columnsError); return { board, columns: [] }; }
    // kanban_columns stores the column title as `name`.
    return { board, columns: (columns || []).map((col: DbKanbanColumn & { name?: string }) => ({ ...col, title: col.title ?? col.name ?? '' })) };
  }

  async createKanbanBoard(board: Partial<DbKanbanBoard>, columns: Partial<DbKanbanColumn>[]): Promise<DbKanbanBoard | null> {
    assertCompanyId(board.company_id, 'createKanbanBoard');
    const { data: newBoard, error: boardError } = await supabase
      .from('kanban_boards').insert(board).select().single();
    if (boardError) { console.error('Error creating board:', boardError); return null; }
    if (columns.length > 0) {
      const columnsWithBoardId = columns.map((col, index) => ({
        board_id: newBoard.id, company_id: newBoard.company_id, name: col.title || 'Untitled',
        status: col.status, color: col.color, sort_order: index,
      }));
      const { error: columnsError } = await supabase.from('kanban_columns').insert(columnsWithBoardId);
      if (columnsError) console.error('Error creating columns:', columnsError);
    }
    return newBoard;
  }

  async updateKanbanBoard(boardId: string, updates: Partial<DbKanbanBoard>): Promise<DbKanbanBoard | null> {
    const { data, error } = await supabase
      .from('kanban_boards').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', boardId).select().single();
    if (error) { console.error('Error updating board:', error); return null; }
    return data;
  }

  async replaceKanbanColumns(boardId: string, columns: Partial<DbKanbanColumn>[]): Promise<boolean> {
    const { error: deleteError } = await supabase.from('kanban_columns').delete().eq('board_id', boardId);
    if (deleteError) { console.error('Error deleting existing kanban columns:', deleteError); return false; }
    if (columns.length === 0) return true;
    const { data: board, error: boardError } = await supabase
      .from('kanban_boards').select('company_id').eq('id', boardId).single();
    if (boardError || !board) { console.error('Error loading board for kanban columns:', boardError); return false; }
    const payload = columns.map((col, index) => ({
      board_id: boardId, company_id: board.company_id, name: col.title || 'Untitled', status: col.status,
      color: col.color, sort_order: col.sort_order ?? index,
    }));
    const { error: insertError } = await supabase.from('kanban_columns').insert(payload);
    if (insertError) { console.error('Error inserting kanban columns:', insertError); return false; }
    return true;
  }

  async deleteKanbanBoard(boardId: string): Promise<boolean> {
    const { error } = await supabase.from('kanban_boards').delete().eq('id', boardId);
    if (error) { console.error('Error deleting board:', error); return false; }
    return true;
  }

  // Lead source operations
  async getLeadSources(companyId: string): Promise<DbLeadSource[]> {
    assertCompanyId(companyId, 'getLeadSources');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('lead_sources').select('*').eq('company_id', companyId).order('name', { ascending: true });
    if (error) { console.error('Error fetching lead sources:', error); return []; }
    return data || [];
  }

  async createLeadSource(leadSource: Partial<DbLeadSource>): Promise<DbLeadSource | null> {
    assertCompanyId(leadSource.company_id, 'createLeadSource');
    const { data, error } = await this.raceTimeout(
      supabase.from('lead_sources').insert(leadSource).select().single(),
      10000, 'createLeadSource'
    );
    if (error) { console.error('Error creating lead source:', error); return null; }
    return data;
  }

  async deleteLeadSource(leadSourceId: string): Promise<boolean> {
    const { error } = await supabase.from('lead_sources').delete().eq('id', leadSourceId);
    if (error) { console.error('Error deleting lead source:', error); return false; }
    return true;
  }

  // Automation operations
  async getAutomations(companyId: string): Promise<DbAutomation[]> {
    assertCompanyId(companyId, 'getAutomations');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('automations').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching automations:', error); return []; }
    return data || [];
  }

  async createAutomation(automation: Partial<DbAutomation>): Promise<DbAutomation | null> {
    assertCompanyId(automation.company_id, 'createAutomation');
    const { data, error } = await supabase.from('automations').insert(automation).select().single();
    if (error) { console.error('Error creating automation:', error); return null; }
    return data;
  }

  async updateAutomation(automationId: string, updates: Partial<DbAutomation>): Promise<DbAutomation | null> {
    const { data, error } = await supabase
      .from('automations').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', automationId).select().single();
    if (error) { console.error('Error updating automation:', error); return null; }
    return data;
  }

  async deleteAutomation(automationId: string): Promise<boolean> {
    const { error } = await supabase.from('automations').delete().eq('id', automationId);
    if (error) { console.error('Error deleting automation:', error); return false; }
    return true;
  }

  // Team member operations
  async getTeamMembers(companyId: string): Promise<DbProfile[]> {
    assertCompanyId(companyId, 'getTeamMembers');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('profiles').select('*').eq('company_id', companyId).order('first_name', { ascending: true });
    if (error) {
      console.error('[Database] Error fetching team members:', error);
      console.error('[Database] Error details:', JSON.stringify(error, null, 2));
      return [];
    }
    return data || [];
  }

  async updateProfile(profileId: string, updates: Partial<DbProfile>): Promise<DbProfile | null> {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_team_member_profile', {
        p_profile_id: profileId,
        p_first_name: updates.first_name ?? null,
        p_last_name: updates.last_name ?? null,
        p_email: updates.email ?? null,
        p_role: updates.role ?? null,
        p_department: updates.department ?? null,
        p_phone: updates.phone ?? null,
        p_is_active: updates.is_active ?? null,
      });
      if (!rpcError && rpcData) return rpcData as DbProfile;
      if (rpcError) console.warn('[Database] update_team_member_profile RPC failed, falling back:', rpcError.message);
    } catch {
      console.warn('[Database] Profile update RPC not available, using direct query');
    }
    const { data, error } = await supabase
      .from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', profileId).select().single();
    if (error) { console.error('Error updating profile:', error); return null; }
    return data;
  }

  async saveUiPrefs(profileId: string, prefs: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from('profiles').update({ ui_prefs: prefs, updated_at: new Date().toISOString() }).eq('id', profileId);
    if (error) console.error('Error saving ui_prefs:', error);
  }

  // Invite operations
  async createInvite(invite: Partial<DbInvite>): Promise<DbInvite | null> {
    assertCompanyId(invite.company_id, 'createInvite');
    const tables: Array<'invitations' | 'invites'> = ['invitations', 'invites'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).insert(invite).select().single();
      if (!error) return data as DbInvite;
      const missingTable = error.code === '42P01' || /relation .* does not exist/i.test(error.message || '');
      if (missingTable) continue;
      console.error('Error creating invite in table', table, error);
      return null;
    }
    console.error('Error creating invite: neither invitations nor invites table exists.');
    return null;
  }

  // Real-time subscriptions
  subscribeToContacts(companyId: string, callback: (payload: any) => void) {
    return supabase.channel('contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${companyId}` }, callback)
      .subscribe();
  }

  subscribeToAppointments(companyId: string, callback: (payload: any) => void) {
    return supabase.channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `company_id=eq.${companyId}` }, callback)
      .subscribe();
  }

  subscribeToInvoices(companyId: string, callback: (payload: any) => void) {
    return supabase.channel('invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` }, callback)
      .subscribe();
  }

  subscribeToCommunications(companyId: string, callback: (payload: any) => void) {
    return supabase.channel('communications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `company_id=eq.${companyId}` }, callback)
      .subscribe();
  }

  subscribeToAll(companyId: string, callbacks: {
    onContactChange?: (payload: any) => void;
    onAppointmentChange?: (payload: any) => void;
    onInvoiceChange?: (payload: any) => void;
    onCommunicationChange?: (payload: any) => void;
    onLeadSourceChange?: (payload: any) => void;
    onBoardChange?: (payload: any) => void;
    onTeamMemberChange?: (payload: any) => void;
    onEstimateChange?: (payload: any) => void;
    onProjectChange?: (payload: any) => void;
    onWorkOrderChange?: (payload: any) => void;
    onStatusChange?: (status: string, error?: Error) => void;
  }) {
    const channel = supabase.channel('all-changes');
    if (callbacks.onContactChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${companyId}` }, callbacks.onContactChange);
    if (callbacks.onAppointmentChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `company_id=eq.${companyId}` }, callbacks.onAppointmentChange);
    if (callbacks.onInvoiceChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` }, callbacks.onInvoiceChange);
    if (callbacks.onCommunicationChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `company_id=eq.${companyId}` }, callbacks.onCommunicationChange);
    if (callbacks.onLeadSourceChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'lead_sources', filter: `company_id=eq.${companyId}` }, callbacks.onLeadSourceChange);
    if (callbacks.onBoardChange) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_boards', filter: `company_id=eq.${companyId}` }, callbacks.onBoardChange);
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, callbacks.onBoardChange);
    }
    if (callbacks.onTeamMemberChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `company_id=eq.${companyId}` }, callbacks.onTeamMemberChange);
    if (callbacks.onEstimateChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'estimates', filter: `company_id=eq.${companyId}` }, callbacks.onEstimateChange);
    if (callbacks.onProjectChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `company_id=eq.${companyId}` }, callbacks.onProjectChange);
    if (callbacks.onWorkOrderChange) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders', filter: `company_id=eq.${companyId}` }, callbacks.onWorkOrderChange);
    return channel.subscribe((status, error) => { if (callbacks.onStatusChange) callbacks.onStatusChange(status, error || undefined); });
  }

  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }

  // Supplier operations
  async getSuppliers(companyId: string): Promise<DbSupplier[]> {
    assertCompanyId(companyId, 'getSuppliers');
    const { data, error } = await supabase
      .from('suppliers').select('*').eq('company_id', companyId).eq('is_active', true).order('name', { ascending: true });
    if (error) { console.error('Error fetching suppliers:', error); return []; }
    return data || [];
  }

  async createSupplier(supplier: Partial<DbSupplier>): Promise<DbSupplier | null> {
    assertCompanyId(supplier.company_id, 'createSupplier');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('suppliers').insert(supplier).select().single(),
        10000, 'createSupplier'
      );
      if (error) { console.error('Error creating supplier:', error); throw new Error(error.message || 'Failed to save supplier'); }
      return data;
    } catch (err) {
      console.error('createSupplier timed out or failed:', err);
      throw err instanceof Error ? err : new Error('Failed to create supplier');
    }
  }

  async updateSupplier(supplierId: string, updates: Partial<DbSupplier>): Promise<DbSupplier | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('suppliers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', supplierId).select().single(),
        10000, 'updateSupplier'
      );
      if (error) { console.error('Error updating supplier:', error); throw new Error(error.message || 'Failed to update supplier'); }
      return data;
    } catch (err) { console.error('updateSupplier timed out or failed:', err); throw err instanceof Error ? err : new Error('Failed to update supplier'); }
  }

  async deleteSupplier(supplierId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('suppliers').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', supplierId),
        10000, 'deleteSupplier'
      );
      if (error) { console.error('Error deleting supplier:', error); return false; }
      return true;
    } catch (err) { console.error('deleteSupplier timed out or failed:', err); return false; }
  }

  // Material Order operations
  async getMaterialOrders(companyId: string): Promise<DbMaterialOrder[]> {
    assertCompanyId(companyId, 'getMaterialOrders');
    const { data, error } = await supabase
      .from('material_orders').select('*').eq('company_id', companyId).order('order_date', { ascending: false });
    if (error) { console.error('Error fetching material orders:', error); return []; }
    return data || [];
  }

  async createMaterialOrder(order: Partial<DbMaterialOrder>): Promise<DbMaterialOrder | null> {
    assertCompanyId(order.company_id, 'createMaterialOrder');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('material_orders').insert(order).select().single(),
        10000, 'createMaterialOrder'
      );
      if (error) { console.error('Error creating material order:', error); throw new Error(error.message); }
      return data;
    } catch (err) { console.error('createMaterialOrder timed out or failed:', err); throw err; }
  }

  async updateMaterialOrder(orderId: string, updates: Partial<DbMaterialOrder>): Promise<DbMaterialOrder | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('material_orders').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', orderId).select().single(),
        10000, 'updateMaterialOrder'
      );
      if (error) { console.error('Error updating material order:', error); return null; }
      return data;
    } catch (err) { console.error('updateMaterialOrder timed out or failed:', err); return null; }
  }

  async deleteMaterialOrder(orderId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('material_orders').delete().eq('id', orderId),
        10000, 'deleteMaterialOrder'
      );
      if (error) { console.error('Error deleting material order:', error); return false; }
      return true;
    } catch (err) { console.error('deleteMaterialOrder timed out or failed:', err); return false; }
  }

  // Quote summaries: just the fields lists, pipeline values and financial stats
  // need. Quotes are created and edited in QuotesView.
  async getQuoteSummaries(companyId: string): Promise<any[]> {
    assertCompanyId(companyId, 'getQuoteSummaries');
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, cover_page_title, status, contact_id, customer_id, good_total, better_total, best_total, selected_tier, created_at')
      .eq('company_id', companyId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching quotes:', error); return []; }
    return data || [];
  }

  // Estimate operations
  async getEstimates(companyId: string): Promise<DbEstimate[]> {
    assertCompanyId(companyId, 'getEstimates');
    const { data, error } = await supabase
      .from('estimates').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching estimates:', error); return []; }
    return data || [];
  }

  async getEstimatesByContact(contactId: string): Promise<DbEstimate[]> {
    const { data, error } = await supabase
      .from('estimates').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching estimates:', error); return []; }
    return data || [];
  }

  async createEstimate(estimate: Partial<DbEstimate>): Promise<DbEstimate | null> {
    assertCompanyId(estimate.company_id, 'createEstimate');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('estimates').insert(estimate).select().single(),
        10000, 'createEstimate'
      );
      if (error) throw new Error(error.message);
      return data;
    } catch (err) { console.error('createEstimate timed out or failed:', err); throw err; }
  }

  async updateEstimate(estimateId: string, updates: Partial<DbEstimate>): Promise<DbEstimate | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('estimates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', estimateId).select().single(),
        10000, 'updateEstimate'
      );
      if (error) throw new Error(error.message);
      return data;
    } catch (err) { console.error('updateEstimate timed out or failed:', err); throw err; }
  }

  async deleteEstimate(estimateId: string): Promise<boolean> {
    const { error } = await supabase.from('estimates').delete().eq('id', estimateId);
    if (error) { console.error('Error deleting estimate:', error); return false; }
    return true;
  }

  async markEstimateSent(estimateId: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, { status: 'sent', sent_at: new Date().toISOString() });
  }

  async markEstimateViewed(estimateId: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, { status: 'viewed', viewed_at: new Date().toISOString() });
  }

  async markEstimateAccepted(estimateId: string, signedBy: string, signatureData?: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, {
      status: 'accepted', accepted_at: new Date().toISOString(),
      signed_by: signedBy, signature_data: signatureData,
    });
  }

  async requestEstimateSignature(estimateId: string, token: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, { sign_token: token });
  }

  async markEstimateDeclined(estimateId: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, { status: 'declined', declined_at: new Date().toISOString() });
  }

  async getEstimate(estimateId: string): Promise<DbEstimate | null> {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single();
    if (error) { console.error('Error fetching estimate:', error); return null; }
    return data;
  }

  // Estimate Items operations
  async getEstimateItems(estimateId: string): Promise<DbEstimateItem[]> {
    const { data, error } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('order_index');
    if (error) { console.error('Error fetching estimate items:', error); return []; }
    return data || [];
  }

  async createEstimateItem(item: Partial<DbEstimateItem>): Promise<DbEstimateItem | null> {
    assertCompanyId(item.company_id, 'createEstimateItem');
    const { data, error } = await supabase
      .from('estimate_items')
      .insert(item)
      .select()
      .single();
    if (error) { console.error('Error creating estimate item:', error); return null; }
    return data;
  }

  async updateEstimateItem(itemId: string, updates: Partial<DbEstimateItem>): Promise<DbEstimateItem | null> {
    const { data, error } = await supabase
      .from('estimate_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) { console.error('Error updating estimate item:', error); return null; }
    return data;
  }

  async deleteEstimateItem(itemId: string): Promise<boolean> {
    const { error } = await supabase.from('estimate_items').delete().eq('id', itemId);
    if (error) { console.error('Error deleting estimate item:', error); return false; }
    return true;
  }

  async getEstimateWithItems(estimateId: string): Promise<{ estimate: DbEstimate; items: DbEstimateItem[] } | null> {
    const [estimate, items] = await Promise.all([
      this.getEstimate(estimateId),
      this.getEstimateItems(estimateId)
    ]);
    
    if (!estimate) return null;
    return { estimate, items };
  }

  // Convert estimate to invoice (NEW)
  async createInvoiceFromEstimate(estimateId: string): Promise<DbInvoice | null> {
    try {
      const estimateData = await this.getEstimateWithItems(estimateId);
      if (!estimateData) {
        throw new Error('Estimate not found');
      }

      const { estimate, items } = estimateData;
      
      // Create invoice with estimate data and items
      const invoiceItems = items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        order_index: item.order_index
      }));

      const invoice = await this.createInvoice({
        company_id: estimate.company_id,
        contact_id: estimate.contact_id,
        invoice_number: `INV-${Date.now()}`, // Generate unique invoice number
        title: estimate.title,
        description: estimate.description,
        status: 'draft',
        subtotal: estimate.subtotal,
        tax: estimate.tax,
        total: estimate.total,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        notes: estimate.notes,
        terms: estimate.terms,
        created_by: estimate.created_by
      }, invoiceItems);

      if (!invoice) {
        throw new Error('Failed to create invoice');
      }

      // Mark estimate as converted
      await this.updateEstimate(estimateId, { 
        status: 'converted',
        notes: estimate.notes ? `${estimate.notes}\n\nConverted to invoice ${invoice.invoice_number}` : `Converted to invoice ${invoice.invoice_number}`
      });

      return invoice;
    } catch (error) {
      console.error('Error converting estimate to invoice:', error);
      return null;
    }
  }

  // Project operations
  async getProjects(companyId: string): Promise<DbProject[]> {
    assertCompanyId(companyId, 'getProjects');
    const { data, error } = await supabase
      .from('projects').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching projects:', error); return []; }
    return data || [];
  }

  async getProjectsByContact(contactId: string): Promise<DbProject[]> {
    const { data, error } = await supabase
      .from('projects').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching projects by contact:', error); return []; }
    return data || [];
  }

  async createProject(project: Partial<DbProject>): Promise<DbProject | null> {
    assertCompanyId(project.company_id, 'createProject');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('projects').insert([project]).select().single(),
        10000, 'createProject'
      );
      if (error) throw new Error(error.message);
      return data;
    } catch (err) { console.error('createProject timed out or failed:', err); throw err; }
  }

  async createProjectFromEstimate(estimate: DbEstimate, userId: string): Promise<DbProject | null> {
    return this.createProject({
      company_id: estimate.company_id, contact_id: estimate.contact_id,
      estimate_id: estimate.id, project_number: `PRJ-${Date.now()}`,
      name: estimate.title, description: estimate.description,
      status: 'planning', priority: 'medium',
      estimated_budget: estimate.total, actual_cost: 0,
      notes: estimate.notes, created_by: userId,
    });
  }

  async updateProject(projectId: string, updates: Partial<DbProject>): Promise<DbProject | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', projectId).select().single(),
        10000, 'updateProject'
      );
      if (error) throw new Error(error.message);
      return data;
    } catch (err) { console.error('updateProject timed out or failed:', err); throw err; }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('projects').delete().eq('id', projectId),
        10000, 'deleteProject'
      );
      if (error) { console.error('Error deleting project:', error); return false; }
      return true;
    } catch (err) { console.error('deleteProject timed out or failed:', err); return false; }
  }

  // Work Order operations
  async getWorkOrders(companyId: string): Promise<DbWorkOrder[]> {
    assertCompanyId(companyId, 'getWorkOrders');
    const { data, error } = await supabase
      .from('work_orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching work orders:', error); return []; }
    return (data || []).map(fromDbWorkOrderRow);
  }

  async getWorkOrdersByProject(projectId: string): Promise<DbWorkOrder[]> {
    const { data, error } = await supabase
      .from('work_orders').select('*').eq('project_id', projectId).order('scheduled_date', { ascending: true });
    if (error) { console.error('Error fetching work orders by project:', error); return []; }
    return (data || []).map(fromDbWorkOrderRow);
  }

  async getWorkOrdersByContact(contactId: string): Promise<DbWorkOrder[]> {
    const { data, error } = await supabase
      .from('work_orders').select('*').eq('contact_id', contactId).order('scheduled_date', { ascending: false });
    if (error) { console.error('Error fetching work orders by contact:', error); return []; }
    return (data || []).map(fromDbWorkOrderRow);
  }

  async createWorkOrder(workOrder: Partial<DbWorkOrder>): Promise<DbWorkOrder | null> {
    assertCompanyId(workOrder.company_id, 'createWorkOrder');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('work_orders').insert([toDbWorkOrderRow(workOrder)]).select().single(),
        10000, 'createWorkOrder'
      );
      if (error) throw new Error(error.message);
      return fromDbWorkOrderRow(data);
    } catch (err) { console.error('createWorkOrder timed out or failed:', err); throw err; }
  }

  async updateWorkOrder(workOrderId: string, updates: Partial<DbWorkOrder>): Promise<DbWorkOrder | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('work_orders').update({ ...toDbWorkOrderRow(updates), updated_at: new Date().toISOString() }).eq('id', workOrderId).select().single(),
        10000, 'updateWorkOrder'
      );
      if (error) { console.error('Error updating work order:', error); return null; }
      return fromDbWorkOrderRow(data);
    } catch (err) { console.error('updateWorkOrder timed out or failed:', err); return null; }
  }

  async deleteWorkOrder(workOrderId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('work_orders').delete().eq('id', workOrderId),
        10000, 'deleteWorkOrder'
      );
      if (error) { console.error('Error deleting work order:', error); return false; }
      return true;
    } catch (err) { console.error('deleteWorkOrder timed out or failed:', err); return false; }
  }

  async startWorkOrder(workOrderId: string): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, { status: 'in_progress', started_at: new Date().toISOString() });
  }

  async completeWorkOrder(workOrderId: string, actualHours?: number): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, {
      status: 'completed', completed_at: new Date().toISOString(),
      ...(actualHours !== undefined && { actual_hours: actualHours }),
    });
  }

  async markWorkOrderSigned(workOrderId: string, signedBy: string, signatureData?: string): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, {
      status: 'completed', completed_at: new Date().toISOString(),
      signed_by: signedBy, signature_data: signatureData,
    });
  }

  async requestWorkOrderSignature(workOrderId: string, token: string): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, { sign_token: token });
  }

  // Notification operations
  async getNotifications(companyId: string): Promise<DbNotification[]> {
    assertCompanyId(companyId, 'getNotifications');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('notifications').select('*').eq('company_id', companyId)
      .order('created_at', { ascending: false }).limit(100);
    if (error) { console.error('Error fetching notifications:', error); return []; }
    return (data || []) as DbNotification[];
  }

  async getUnreadNotifications(companyId: string, userId?: string): Promise<DbNotification[]> {
    assertCompanyId(companyId, 'getUnreadNotifications');
    if (this.inDemoMode()) return [];
    let query = supabase.from('notifications').select('*')
      .eq('company_id', companyId).eq('read', false).order('created_at', { ascending: false });
    if (userId) query = query.or(`user_id.eq.${userId},user_id.is.null`);
    const { data, error } = await query;
    if (error) { console.error('Error fetching unread notifications:', error); return []; }
    return (data || []) as DbNotification[];
  }

  async createNotification(notification: Partial<DbNotification>): Promise<DbNotification | null> {
    assertCompanyId(notification.company_id, 'createNotification');
    if (this.inDemoMode()) return null;
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('notifications').insert(notification).select().single(),
        10000, 'createNotification'
      );
      if (error) { console.error('Error creating notification:', error); return null; }
      return data as DbNotification;
    } catch (err) { console.error('createNotification timed out or failed:', err); return null; }
  }

  async markNotificationRead(notificationId: string): Promise<boolean> {
    if (this.inDemoMode()) return true;
    try {
      const { error } = await this.raceTimeout(
        supabase.from('notifications').update({ read: true, updated_at: new Date().toISOString() }).eq('id', notificationId),
        10000, 'markNotificationRead'
      );
      if (error) { console.error('Error marking notification read:', error); return false; }
      return true;
    } catch (err) { console.error('markNotificationRead timed out or failed:', err); return false; }
  }

  async markAllNotificationsRead(companyId: string, userId?: string): Promise<boolean> {
    assertCompanyId(companyId, 'markAllNotificationsRead');
    if (this.inDemoMode()) return true;
    let query = supabase.from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('company_id', companyId).eq('read', false);
    if (userId) query = query.or(`user_id.eq.${userId},user_id.is.null`);
    const { error } = await query;
    if (error) { console.error('Error marking all notifications read:', error); return false; }
    return true;
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    if (this.inDemoMode()) return true;
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) { console.error('Error deleting notification:', error); return false; }
    return true;
  }

  // === Notification Preferences Methods ===

  async getUserNotificationPreferences(
    companyId: string,
    userId: string
  ): Promise<DbNotificationPreference | null> {
    assertCompanyId(companyId, 'getUserNotificationPreferences');
    if (this.inDemoMode()) return null;
    try {
      const { data, error } = await this.raceTimeout(
        supabase
          .from('notification_preferences')
          .select('*')
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .maybeSingle(),
        10000,
        'getUserNotificationPreferences'
      );
      if (error) {
        console.error('Error fetching notification preferences:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('getUserNotificationPreferences timed out or failed:', err);
      return null;
    }
  }

  async saveUserNotificationPreferences(
    prefs: DbNotificationPreference
  ): Promise<boolean> {
    assertCompanyId(prefs.company_id, 'saveUserNotificationPreferences');
    if (this.inDemoMode()) return true;
    try {
      const { error } = await this.raceTimeout(
        supabase.from('notification_preferences').upsert(prefs),
        10000,
        'saveUserNotificationPreferences'
      );
      if (error) {
        console.error('Error saving notification preferences:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('saveUserNotificationPreferences timed out or failed:', err);
      return false;
    }
  }

  // Expense operations
  async getExpenses(companyId: string): Promise<DbExpense[]> {
    assertCompanyId(companyId, 'getExpenses');
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('expenses').select('*').eq('company_id', companyId).order('date', { ascending: false });
    if (error) { console.error('Error loading expenses:', error); return []; }
    return (data || []) as DbExpense[];
  }

  async createExpense(expense: Partial<DbExpense>): Promise<DbExpense | null> {
    assertCompanyId(expense.company_id, 'createExpense');
    if (this.inDemoMode()) throw new Error('Expenses are not available in demo mode');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('expenses').insert(expense).select().single(),
        10000, 'createExpense'
      );
      if (error) { console.error('Error creating expense:', error); throw new Error(error.message || 'Failed to save expense'); }
      return data as DbExpense;
    } catch (err) {
      console.error('createExpense timed out or failed:', err);
      throw err instanceof Error ? err : new Error('Failed to create expense');
    }
  }

  async updateExpense(expenseId: string, updates: Partial<DbExpense>): Promise<DbExpense | null> {
    if (this.inDemoMode()) throw new Error('Expenses are not available in demo mode');
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', expenseId).select().single(),
        10000, 'updateExpense'
      );
      if (error) { console.error('Error updating expense:', error); return null; }
      return data as DbExpense;
    } catch (err) { console.error('updateExpense timed out or failed:', err); return null; }
  }

  async deleteExpense(expenseId: string): Promise<boolean> {
    if (this.inDemoMode()) return true;
    try {
      const { error } = await this.raceTimeout(
        supabase.from('expenses').delete().eq('id', expenseId),
        10000, 'deleteExpense'
      );
      if (error) { console.error('Error deleting expense:', error); return false; }
      return true;
    } catch (err) { console.error('deleteExpense timed out or failed:', err); return false; }
  }

  async uploadExpenseReceipt(companyId: string, expenseId: string, file: File): Promise<string | null> {
    assertCompanyId(companyId, 'uploadExpenseReceipt');
    if (this.inDemoMode()) return null;
    const path = `${companyId}/${expenseId}/${file.name}`;
    const { error } = await supabase.storage.from('expense-receipts').upload(path, file, { upsert: true });
    if (error) { console.error('Error uploading receipt:', error); return null; }
    const { data: urlData } = supabase.storage.from('expense-receipts').getPublicUrl(path);
    return urlData.publicUrl;
  }

  // ── Signed document queries (for Documents tab in ContactDetail) ─────────────

  async getSignedEstimatesByContact(contactId: string): Promise<DbEstimate[]> {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('contact_id', contactId)
      .not('signed_by', 'is', null)
      .order('accepted_at', { ascending: false });
    if (error) { console.error('Error fetching signed estimates:', error); return []; }
    return (data || []) as DbEstimate[];
  }

  async getSignedWorkOrdersByContact(contactId: string): Promise<DbWorkOrder[]> {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('contact_id', contactId)
      .not('signed_by', 'is', null)
      .order('completed_at', { ascending: false });
    if (error) { console.error('Error fetching signed work orders:', error); return []; }
    return (data || []) as DbWorkOrder[];
  }

  async getSignedChangeOrdersByContact(contactId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('change_orders')
      .select('*')
      .eq('contact_id', contactId)
      .eq('status', 'signed')
      .order('signed_at', { ascending: false });
    if (error) { console.error('Error fetching signed change orders:', error); return []; }
    return data || [];
  }
}

// ===============================
// TIME TRACKING OPERATIONS
// ===============================

export interface DbTimeEntry {
  id: string;
  work_order_id: string;
  company_id: string;
  user_id?: string;
  description: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function createTimeEntry(entry: {
  work_order_id: string;
  company_id: string;
  description: string;
  start_time: string;
  is_active: boolean;
}): Promise<DbTimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert([entry])
    .select()
    .single();

  if (error) {
    console.error('[DB] Create time entry error:', error);
    throw new Error(`Failed to create time entry: ${error.message}`);
  }

  return data;
}

export async function updateTimeEntry(entryId: string, updates: {
  end_time?: string;
  is_active?: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', entryId);

  if (error) {
    console.error('[DB] Update time entry error:', error);
    throw new Error(`Failed to update time entry: ${error.message}`);
  }
}

export async function getTimeEntries(workOrderId: string): Promise<DbTimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DB] Get time entries error:', error);
    throw new Error(`Failed to get time entries: ${error.message}`);
  }

  return data || [];
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('[DB] Delete time entry error:', error);
    throw new Error(`Failed to delete time entry: ${error.message}`);
  }
}

// ===============================
// LIMITED ROLE SYSTEM OPERATIONS
// ===============================

export interface DbCustomerAssignment {
  id: string;
  company_id: string;
  user_id: string;
  contact_id: string;
  assigned_by?: string;
  assigned_at: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LimitedAccountInfo {
  id: string;
  email: string;
  full_name: string;
  role: 'canvasser' | 'field_contractor';
  is_active: boolean;
  account_expires_at?: string;
  status: 'active' | 'inactive' | 'expired' | 'expiring_soon';
  assigned_customers_count: number;
  created_at: string;
  created_by_name?: string;
}

export async function createDirectAccount(accountData: {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  role: 'canvasser' | 'field_contractor';
  company_id: string;
  expires_at?: string;
  created_by: string;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Check seat availability first
    const canAssign = await checkCanAssignLimitedRole(accountData.company_id, accountData.role);
    if (!canAssign) {
      return { success: false, error: 'No available limited permission seats' };
    }

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: accountData.email,
      password: accountData.password,
      email_confirm: true,
      user_metadata: {
        first_name: accountData.first_name,
        last_name: accountData.last_name || '',
        created_by: accountData.created_by,
        created_directly: true
      }
    });

    if (authError) {
      console.error('[DB] Create auth user error:', authError);
      return { success: false, error: authError.message };
    }

    // Create the profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: accountData.email,
        first_name: accountData.first_name,
        last_name: accountData.last_name || '',
        role: accountData.role,
        company_id: accountData.company_id,
        is_active: true,
        is_limited_account: true,
        created_directly: true,
        account_expires_at: accountData.expires_at,
        must_change_password: false
      });

    if (profileError) {
      console.error('[DB] Create profile error:', profileError);
      // Clean up the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: profileError.message };
    }

    return { success: true, user: authData.user };
  } catch (error) {
    console.error('[DB] Create direct account error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getLimitedAccounts(companyId: string): Promise<LimitedAccountInfo[]> {
  const { data, error } = await supabase
    .from('limited_accounts_view')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DB] Get limited accounts error:', error);
    throw new Error(`Failed to get limited accounts: ${error.message}`);
  }

  return data || [];
}

export async function updateLimitedAccount(userId: string, updates: {
  is_active?: boolean;
  account_expires_at?: string;
  role?: 'canvasser' | 'field_contractor';
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .eq('is_limited_account', true);

  if (error) {
    console.error('[DB] Update limited account error:', error);
    throw new Error(`Failed to update limited account: ${error.message}`);
  }
}

export async function assignCustomerToUser(assignment: {
  user_id: string;
  contact_id: string;
  company_id: string;
  assigned_by: string;
  notes?: string;
}): Promise<DbCustomerAssignment> {
  const { data, error } = await supabase
    .from('customer_assignments')
    .insert([assignment])
    .select()
    .single();

  if (error) {
    console.error('[DB] Create customer assignment error:', error);
    throw new Error(`Failed to assign customer: ${error.message}`);
  }

  return data;
}

export async function getCustomerAssignments(userId: string): Promise<DbCustomerAssignment[]> {
  const { data, error } = await supabase
    .from('customer_assignments')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DB] Get customer assignments error:', error);
    throw new Error(`Failed to get customer assignments: ${error.message}`);
  }

  return data || [];
}

export async function removeCustomerAssignment(userId: string, contactId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_assignments')
    .update({ 
      is_active: false, 
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (error) {
    console.error('[DB] Remove customer assignment error:', error);
    throw new Error(`Failed to remove customer assignment: ${error.message}`);
  }
}

export async function getLimitedSeatUsage(companyId: string): Promise<{
  total: number;
  used: number;
  available: number;
}> {
  // Fetch the seat cap from companies
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('limited_seats_total')
    .eq('id', companyId)
    .single();

  if (companyError) {
    console.error('[DB] Get limited seat usage error:', companyError);
    throw new Error(`Failed to get seat usage: ${companyError.message}`);
  }

  // Count active limited accounts live instead of relying on a cached counter
  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_limited_account', true)
    .eq('is_active', true);

  if (countError) {
    console.error('[DB] Count limited accounts error:', countError);
  }

  const total = company?.limited_seats_total || 5;
  const used = count ?? 0;

  return {
    total,
    used,
    available: Math.max(0, total - used),
  };
}

export async function checkCanAssignLimitedRole(companyId: string, role: string): Promise<boolean> {
  if (!['canvasser', 'field_contractor'].includes(role)) {
    return true; // Not a limited role
  }

  const usage = await getLimitedSeatUsage(companyId);
  return usage.available > 0;
}

export const db = new DatabaseService();
