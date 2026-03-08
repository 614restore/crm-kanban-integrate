// Database service layer for CRM data persistence
import { supabase, isDemoMode } from './supabase';

// Types matching database schema
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
  subscription_plan?: 'starter' | 'professional' | 'enterprise' | 'trial';
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing';
  trial_ends_at?: string;
  subscription_ends_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
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
  project_id?: string;
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
  attachments?: string[];
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
}

export interface DbEstimateItem {
  id: string;
  estimate_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
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
  // Helper to check if we're in demo mode
  private inDemoMode(): boolean {
    return isDemoMode;
  }

  // Company operations

  /** Read company from localStorage cache (instant). */
  private getCachedCompany(companyId: string): DbCompany | null {
    try {
      const raw = localStorage.getItem(`company_cache_${companyId}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw) as { data: DbCompany; ts: number };
      // Cache valid for 5 minutes
      if (Date.now() - ts > 5 * 60 * 1000) return null;
      return data;
    } catch {
      return null;
    }
  }

  /** Write company to localStorage cache. */
  private setCachedCompany(companyId: string, company: DbCompany): void {
    try {
      localStorage.setItem(
        `company_cache_${companyId}`,
        JSON.stringify({ data: company, ts: Date.now() }),
      );
    } catch { /* quota exceeded — ignore */ }
  }

  /** Race a promise against a timeout (ms). Rejects with a clear message. */
  private raceTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }

  async getCompany(companyId: string): Promise<DbCompany | null> {
    if (this.inDemoMode()) {
      try {
        const demoCompanyKey = `demo_company_${companyId}`;
        const stored = localStorage.getItem(demoCompanyKey);
        if (stored) {
          return JSON.parse(stored) as DbCompany;
        }
      } catch (error) {
        console.warn('[Database] Failed to retrieve company from localStorage:', error);
      }
      return null;
    }

    // 1. Return from cache instantly while we refresh in the background
    const cached = this.getCachedCompany(companyId);
    if (cached) return cached;

    // 2. Try direct table query first (fast path) — 5 s cap
    try {
      const { data, error } = await this.raceTimeout(
        supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single(),
        5000,
        'companies direct query',
      );

      if (!error && data) {
        this.setCachedCompany(companyId, data);
        return data;
      }
      if (error) {
        console.warn('[Database] Direct company query failed, trying RPC:', error.message);
      }
    } catch (directErr) {
      console.warn('[Database] Direct query timed-out, trying RPC');
    }

    // 3. Fallback: RPC (SECURITY DEFINER, bypasses RLS) — 5 s cap
    try {
      const { data: rpcData, error: rpcError } = await this.raceTimeout(
        supabase.rpc('get_my_company'),
        5000,
        'get_my_company RPC',
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        const company = rpcData[0] as DbCompany;
        this.setCachedCompany(companyId, company);
        return company;
      }
      if (rpcError) {
        console.warn('[Database] get_my_company RPC also failed:', rpcError.message);
      }
    } catch (rpcErr) {
      console.warn('[Database] RPC unavailable/timed-out');
    }

    // 4. Both paths failed
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
        const demoCompanyKey = `demo_company_${newCompany.id}`;
        localStorage.setItem(demoCompanyKey, JSON.stringify(newCompany));
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
        // Store in localStorage for persistence
        const demoCompanyKey = `demo_company_${companyId}`;
        const existing = localStorage.getItem(demoCompanyKey);
        const companyData = existing ? JSON.parse(existing) : { id: companyId };
        const updated = { ...companyData, ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem(demoCompanyKey, JSON.stringify(updated));
        return updated as DbCompany;
      } catch (error) {
        console.warn('[Database] Failed to save company to localStorage:', error);
        // Return a mock successful response even if localStorage fails
        return { id: companyId, ...updates, updated_at: new Date().toISOString() } as DbCompany;
      }
    }
    
    // Try RPC first (SECURITY DEFINER, bypasses RLS) — 5 s cap
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
        return rpcData as DbCompany;
      }
      if (rpcError) {
        console.warn('[Database] update_my_company RPC failed, falling back:', rpcError.message);
      }
    } catch (rpcErr) {
      console.warn('[Database] update RPC timed-out or not available, using direct query');
    }

    // Fallback: direct table update — 5 s cap
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('companies').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', companyId).select().single(),
        5000, 'updateCompany direct'
      );
      if (error) { console.error('Error updating company:', error); return null; }
      return data;
    } catch (err) { console.error('updateCompany timed out or failed:', err); return null; }
  }

  // Contact operations
  async getContacts(companyId: string): Promise<DbContact[]> {
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
    return data || [];
  }

  async getContact(contactId: string): Promise<DbContact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();
    
    if (error) {
      console.error('Error fetching contact:', error);
      return null;
    }
    return data;
  }

  async createContact(contact: Partial<DbContact>): Promise<DbContact | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase
          .from('contacts')
          .insert(contact)
          .select()
          .single(),
        10000,
        'createContact'
      );
      if (error) {
        console.error('Error creating contact:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('createContact timed out or failed:', err);
      return null;
    }
  }

  async updateContact(contactId: string, updates: Partial<DbContact>): Promise<DbContact | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase
          .from('contacts')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', contactId)
          .select()
          .single(),
        10000,
        'updateContact',
      );

      if (error) {
        console.error('Error updating contact:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('updateContact timed out or failed:', err);
      return null;
    }
  }

  async deleteContact(contactId: string): Promise<boolean> {
    try {
      const { error } = await this.raceTimeout(
        supabase.from('contacts').delete().eq('id', contactId),
        10000,
        'deleteContact'
      );
      if (error) {
        console.error('Error deleting contact:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('deleteContact timed out or failed:', err);
      return false;
    }
  }

  // Job operations
  async getJobs(companyId: string): Promise<DbJob[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
    return data || [];
  }

  async getJobsByContact(contactId: string): Promise<DbJob[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
    return data || [];
  }

  async createJob(job: Partial<DbJob>): Promise<DbJob | null> {
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
    if (this.inDemoMode()) {
      return [];
    }
    // Support both legacy schema (date/time/duration) and newer schema (start_time/end_time).
    const tryFetch = async (orderBy: 'date' | 'start_time') =>
      supabase
        .from('appointments')
        .select('*')
        .eq('company_id', companyId)
        .order(orderBy, { ascending: true });

    let data: any[] | null = null;
    let error: any = null;

    const startTimeResult = await tryFetch('start_time');
    if (startTimeResult.error) {
      const dateResult = await tryFetch('date');
      data = dateResult.data;
      error = dateResult.error;
    } else {
      data = startTimeResult.data;
      error = null;
    }

    if (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }

    const normalized = (data || []).map((apt: any) => {
      if (apt.date && apt.time) return apt as DbAppointment;

      if (apt.start_time) {
        const start = new Date(apt.start_time);
        const end = apt.end_time ? new Date(apt.end_time) : null;
        const duration =
          end && !Number.isNaN(end.getTime())
            ? Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60)))
            : 60;

        const hh = String(start.getHours()).padStart(2, '0');
        const mm = String(start.getMinutes()).padStart(2, '0');

        return {
          ...apt,
          date: start.toISOString().split('T')[0],
          time: `${hh}:${mm}`,
          duration,
        } as DbAppointment;
      }

      return {
        ...apt,
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: 60,
      } as DbAppointment;
    });

    return normalized;
  }

  async createAppointment(appointment: Partial<DbAppointment>): Promise<DbAppointment | null> {
    const toStartAndEnd = () => {
      const date = appointment.date || new Date().toISOString().split('T')[0];
      const time = appointment.time || '09:00';
      const duration = appointment.duration || 60;
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + duration * 60 * 1000);

      return {
        company_id: appointment.company_id,
        contact_id: appointment.contact_id,
        title: appointment.title,
        type: appointment.type,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        assigned_to: appointment.assigned_to,
        location: appointment.location,
        notes: appointment.notes,
        status: appointment.status,
      };
    };

    const toDateTime = () => ({
      company_id: appointment.company_id,
      contact_id: appointment.contact_id,
      title: appointment.title,
      type: appointment.type,
      date: appointment.date,
      time: appointment.time,
      duration: appointment.duration,
      assigned_to: appointment.assigned_to,
      location: appointment.location,
      notes: appointment.notes,
      status: appointment.status,
    });

    const firstAttempt = await this.raceTimeout(
      supabase.from('appointments').insert(toStartAndEnd()).select().single(),
      10000, 'createAppointment-v1'
    ).catch(() => ({ data: null, error: new Error('timeout') }));

    if (firstAttempt.data && !(firstAttempt as any).error) {
      return firstAttempt.data as DbAppointment;
    }

    try {
      const secondAttempt = await this.raceTimeout(
        supabase.from('appointments').insert(toDateTime()).select().single(),
        10000, 'createAppointment-v2'
      );
      if ((secondAttempt as any).error) {
        console.error('Error creating appointment:', (secondAttempt as any).error);
        return null;
      }
      return secondAttempt.data as DbAppointment;
    } catch (err) {
      console.error('createAppointment timed out or failed:', err);
      return null;
    }
  }

  async updateAppointment(appointmentId: string, updates: Partial<DbAppointment>): Promise<DbAppointment | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('appointments').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', appointmentId).select().single(),
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
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
    return data || [];
  }

  async getInvoiceWithItems(invoiceId: string): Promise<{ invoice: DbInvoice; items: DbInvoiceItem[] } | null> {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();
    
    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      return null;
    }

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);
    
    if (itemsError) {
      console.error('Error fetching invoice items:', itemsError);
      return { invoice, items: [] };
    }

    return { invoice, items: items || [] };
  }

  async createInvoice(invoice: Partial<DbInvoice>, items: Partial<DbInvoiceItem>[]): Promise<DbInvoice | null> {
    try {
      const { data: newInvoice, error: invoiceError } = await this.raceTimeout(
        supabase.from('invoices').insert(invoice).select().single(),
        10000, 'createInvoice'
      );
      if (invoiceError) { console.error('Error creating invoice:', invoiceError); return null; }

      if (items.length > 0) {
        const itemsWithInvoiceId = items.map(item => ({ ...item, invoice_id: newInvoice.id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithInvoiceId);
        if (itemsError) { console.error('Error creating invoice items:', itemsError); }
      }
      return newInvoice;
    } catch (err) { console.error('createInvoice timed out or failed:', err); return null; }
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
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching communications:', error);
      return [];
    }
    return data || [];
  }

  async getCommunicationsByContact(contactId: string): Promise<DbCommunication[]> {
    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching communications:', error);
      return [];
    }
    return data || [];
  }

  async createCommunication(communication: Partial<DbCommunication>): Promise<DbCommunication | null> {
    const { data, error } = await supabase
      .from('communications')
      .insert(communication)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating communication:', error);
      return null;
    }
    return data;
  }

  // Document operations
  async getDocuments(companyId: string): Promise<DbDocument[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
      return [];
    }
    return data || [];
  }

  async getDocumentsByContact(contactId: string): Promise<DbDocument[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
      return [];
    }
    return data || [];
  }

  async createDocument(document: Partial<DbDocument>): Promise<DbDocument | null> {
    const { data, error } = await supabase
      .from('documents')
      .insert(document)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating document:', error);
      return null;
    }
    return data;
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);
    
    if (error) {
      console.error('Error deleting document:', error);
      return false;
    }
    return true;
  }

  // Kanban board operations
  async getKanbanBoards(companyId: string): Promise<DbKanbanBoard[]> {
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('kanban_boards')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching kanban boards:', error);
      return [];
    }
    return data || [];
  }

  async getKanbanBoardWithColumns(boardId: string): Promise<{ board: DbKanbanBoard; columns: DbKanbanColumn[] } | null> {
    const { data: board, error: boardError } = await supabase
      .from('kanban_boards')
      .select('*')
      .eq('id', boardId)
      .single();
    
    if (boardError) {
      console.error('Error fetching board:', boardError);
      return null;
    }

    const { data: columns, error: columnsError } = await supabase
      .from('kanban_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: true });
    
    if (columnsError) {
      console.error('Error fetching columns:', columnsError);
      return { board, columns: [] };
    }

    return { board, columns: columns || [] };
  }

  async createKanbanBoard(board: Partial<DbKanbanBoard>, columns: Partial<DbKanbanColumn>[]): Promise<DbKanbanBoard | null> {
    const { data: newBoard, error: boardError } = await supabase
      .from('kanban_boards')
      .insert(board)
      .select()
      .single();
    
    if (boardError) {
      console.error('Error creating board:', boardError);
      return null;
    }

    if (columns.length > 0) {
      const columnsWithBoardId = columns.map((col, index) => ({
        ...col,
        board_id: newBoard.id,
        sort_order: index
      }));

      const { error: columnsError } = await supabase
        .from('kanban_columns')
        .insert(columnsWithBoardId);
      
      if (columnsError) {
        console.error('Error creating columns:', columnsError);
      }
    }

    return newBoard;
  }

  async updateKanbanBoard(boardId: string, updates: Partial<DbKanbanBoard>): Promise<DbKanbanBoard | null> {
    const { data, error } = await supabase
      .from('kanban_boards')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', boardId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating board:', error);
      return null;
    }
    return data;
  }

  async replaceKanbanColumns(boardId: string, columns: Partial<DbKanbanColumn>[]): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('kanban_columns')
      .delete()
      .eq('board_id', boardId);

    if (deleteError) {
      console.error('Error deleting existing kanban columns:', deleteError);
      return false;
    }

    if (columns.length === 0) {
      return true;
    }

    const payload = columns.map((col, index) => ({
      board_id: boardId,
      title: col.title,
      status: col.status,
      color: col.color,
      sort_order: col.sort_order ?? index,
    }));

    const { error: insertError } = await supabase
      .from('kanban_columns')
      .insert(payload);

    if (insertError) {
      console.error('Error inserting kanban columns:', insertError);
      return false;
    }

    return true;
  }

  async deleteKanbanBoard(boardId: string): Promise<boolean> {
    const { error } = await supabase
      .from('kanban_boards')
      .delete()
      .eq('id', boardId);
    
    if (error) {
      console.error('Error deleting board:', error);
      return false;
    }
    return true;
  }

  // Lead source operations
  async getLeadSources(companyId: string): Promise<DbLeadSource[]> {
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('lead_sources')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching lead sources:', error);
      return [];
    }
    return data || [];
  }

  async createLeadSource(leadSource: Partial<DbLeadSource>): Promise<DbLeadSource | null> {
    const { data, error } = await this.raceTimeout(
      supabase
        .from('lead_sources')
        .insert(leadSource)
        .select()
        .single(),
      10000,
      'createLeadSource'
    );
    
    if (error) {
      console.error('Error creating lead source:', error);
      return null;
    }
    return data;
  }

  async deleteLeadSource(leadSourceId: string): Promise<boolean> {
    const { error } = await supabase
      .from('lead_sources')
      .delete()
      .eq('id', leadSourceId);
    
    if (error) {
      console.error('Error deleting lead source:', error);
      return false;
    }
    return true;
  }

  // Automation operations
  async getAutomations(companyId: string): Promise<DbAutomation[]> {
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching automations:', error);
      return [];
    }
    return data || [];
  }

  async createAutomation(automation: Partial<DbAutomation>): Promise<DbAutomation | null> {
    const { data, error } = await supabase
      .from('automations')
      .insert(automation)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating automation:', error);
      return null;
    }
    return data;
  }

  async updateAutomation(automationId: string, updates: Partial<DbAutomation>): Promise<DbAutomation | null> {
    const { data, error } = await supabase
      .from('automations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', automationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating automation:', error);
      return null;
    }
    return data;
  }

  async deleteAutomation(automationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', automationId);
    
    if (error) {
      console.error('Error deleting automation:', error);
      return false;
    }
    return true;
  }

  // Team member operations
  async getTeamMembers(companyId: string): Promise<DbProfile[]> {
    if (this.inDemoMode()) {
      return [];
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', companyId)
      .order('first_name', { ascending: true });
    
    if (error) {
      console.error('[Database] Error fetching team members:', error);
      console.error('[Database] Error details:', JSON.stringify(error, null, 2));
      return [];
    }
    return data || [];
  }

  async updateProfile(profileId: string, updates: Partial<DbProfile>): Promise<DbProfile | null> {
    // Try RPC first (SECURITY DEFINER, bypasses RLS)
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('update_team_member_profile', {
          p_profile_id: profileId,
          p_first_name: updates.first_name ?? null,
          p_last_name: updates.last_name ?? null,
          p_email: updates.email ?? null,
          p_role: updates.role ?? null,
          p_department: updates.department ?? null,
          p_phone: updates.phone ?? null,
          p_is_active: updates.is_active ?? null,
        });
      
      if (!rpcError && rpcData) {
        return rpcData as DbProfile;
      }
      if (rpcError) {
        console.warn('[Database] update_team_member_profile RPC failed, falling back:', rpcError.message);
      }
    } catch (rpcErr) {
      console.warn('[Database] Profile update RPC not available, using direct query');
    }

    // Fallback: direct table update
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }
    return data;
  }

  // Invite operations
  async createInvite(invite: Partial<DbInvite>): Promise<DbInvite | null> {
    const tables: Array<'invitations' | 'invites'> = ['invitations', 'invites'];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .insert(invite)
        .select()
        .single();

      if (!error) {
        return data as DbInvite;
      }

      const missingTable = error.code === '42P01' || /relation .* does not exist/i.test(error.message || '');
      if (missingTable) {
        continue;
      }

      console.error('Error creating invite in table', table, error);
      return null;
    }

    console.error('Error creating invite: neither invitations nor invites table exists.');
    return null;
  }
  // Real-time subscriptions
  subscribeToContacts(companyId: string, callback: (payload: any) => void) {
    return supabase
      .channel('contacts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `company_id=eq.${companyId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToAppointments(companyId: string, callback: (payload: any) => void) {
    return supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `company_id=eq.${companyId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToInvoices(companyId: string, callback: (payload: any) => void) {
    return supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `company_id=eq.${companyId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToCommunications(companyId: string, callback: (payload: any) => void) {
    return supabase
      .channel('communications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communications',
          filter: `company_id=eq.${companyId}`
        },
        callback
      )
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
    onStatusChange?: (status: string, error?: Error) => void;
  }) {
    const channel = supabase.channel('all-changes');

    if (callbacks.onContactChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${companyId}` },
        callbacks.onContactChange
      );
    }

    if (callbacks.onAppointmentChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `company_id=eq.${companyId}` },
        callbacks.onAppointmentChange
      );
    }

    if (callbacks.onInvoiceChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` },
        callbacks.onInvoiceChange
      );
    }

    if (callbacks.onCommunicationChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'communications', filter: `company_id=eq.${companyId}` },
        callbacks.onCommunicationChange
      );
    }

    if (callbacks.onLeadSourceChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_sources', filter: `company_id=eq.${companyId}` },
        callbacks.onLeadSourceChange
      );
    }

    if (callbacks.onBoardChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_boards', filter: `company_id=eq.${companyId}` },
        callbacks.onBoardChange
      );
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_columns' },
        callbacks.onBoardChange
      );
    }

    if (callbacks.onTeamMemberChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `company_id=eq.${companyId}` },
        callbacks.onTeamMemberChange
      );
    }

    return channel.subscribe((status, error) => {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange(status, error || undefined);
      }
    });
  }

  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }

  // Supplier operations
  async getSuppliers(companyId: string): Promise<DbSupplier[]> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching suppliers:', error);
      return [];
    }
    return data || [];
  }

  async createSupplier(supplier: Partial<DbSupplier>): Promise<DbSupplier | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('suppliers').insert(supplier).select().single(),
        10000, 'createSupplier'
      );
      if (error) { console.error('Error creating supplier:', error); return null; }
      return data;
    } catch (err) { console.error('createSupplier timed out or failed:', err); return null; }
  }

  async updateSupplier(supplierId: string, updates: Partial<DbSupplier>): Promise<DbSupplier | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('suppliers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', supplierId).select().single(),
        10000, 'updateSupplier'
      );
      if (error) { console.error('Error updating supplier:', error); return null; }
      return data;
    } catch (err) { console.error('updateSupplier timed out or failed:', err); return null; }
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
    const { data, error } = await supabase
      .from('material_orders')
      .select('*')
      .eq('company_id', companyId)
      .order('order_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching material orders:', error);
      return [];
    }
    return data || [];
  }

  async createMaterialOrder(order: Partial<DbMaterialOrder>): Promise<DbMaterialOrder | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('material_orders').insert(order).select().single(),
        10000, 'createMaterialOrder'
      );
      if (error) { console.error('Error creating material order:', error); return null; }
      return data;
    } catch (err) { console.error('createMaterialOrder timed out or failed:', err); return null; }
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

  // Estimate operations
  async getEstimates(companyId: string): Promise<DbEstimate[]> {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching estimates:', error);
      return [];
    }
    return data || [];
  }

  async getEstimatesByContact(contactId: string): Promise<DbEstimate[]> {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching estimates:', error);
      return [];
    }
    return data || [];
  }

  async createEstimate(estimate: Partial<DbEstimate>): Promise<DbEstimate | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('estimates').insert(estimate).select().single(),
        10000, 'createEstimate'
      );
      if (error) { console.error('Error creating estimate:', error); return null; }
      return data;
    } catch (err) { console.error('createEstimate timed out or failed:', err); return null; }
  }

  async updateEstimate(estimateId: string, updates: Partial<DbEstimate>): Promise<DbEstimate | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('estimates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', estimateId).select().single(),
        10000, 'updateEstimate'
      );
      if (error) { console.error('Error updating estimate:', error); return null; }
      return data;
    } catch (err) { console.error('updateEstimate timed out or failed:', err); return null; }
  }
  async deleteEstimate(estimateId: string): Promise<boolean> {
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', estimateId);
    
    if (error) {
      console.error('Error deleting estimate:', error);
      return false;
    }
    return true;
  }

  // Update estimate status with tracking
  async markEstimateSent(estimateId: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, {
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }

  async markEstimateViewed(estimateId: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, {
      status: 'viewed',
      viewed_at: new Date().toISOString(),
    });
  }

  async markEstimateAccepted(estimateId: string, signedBy: string, signatureData?: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      signed_by: signedBy,
      signature_data: signatureData,
    });
  }

  async requestEstimateSignature(estimateId: string, token: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, { sign_token: token });
  }

  async markEstimateDeclined(estimateId: string): Promise<DbEstimate | null> {
    return this.updateEstimate(estimateId, {
      status: 'declined',
      declined_at: new Date().toISOString(),
    });
  }

  // Project operations
  async getProjects(companyId: string): Promise<DbProject[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
    return data || [];
  }

  async getProjectsByContact(contactId: string): Promise<DbProject[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching projects by contact:', error);
      return [];
    }
    return data || [];
  }

  async createProject(project: Partial<DbProject>): Promise<DbProject | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('projects').insert([project]).select().single(),
        10000, 'createProject'
      );
      if (error) { console.error('Error creating project:', error); return null; }
      return data;
    } catch (err) { console.error('createProject timed out or failed:', err); return null; }
  }

  async createProjectFromEstimate(estimate: DbEstimate, userId: string): Promise<DbProject | null> {
    return this.createProject({
      company_id: estimate.company_id,
      contact_id: estimate.contact_id,
      estimate_id: estimate.id,
      project_number: `PRJ-${Date.now()}`,
      name: estimate.title,
      description: estimate.description,
      status: 'planning',
      priority: 'medium',
      estimated_budget: estimate.total,
      actual_cost: 0,
      notes: estimate.notes,
      created_by: userId,
    });
  }

  async updateProject(projectId: string, updates: Partial<DbProject>): Promise<DbProject | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', projectId).select().single(),
        10000, 'updateProject'
      );
      if (error) { console.error('Error updating project:', error); return null; }
      return data;
    } catch (err) { console.error('updateProject timed out or failed:', err); return null; }
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
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching work orders:', error);
      return [];
    }
    return data || [];
  }

  async getWorkOrdersByProject(projectId: string): Promise<DbWorkOrder[]> {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('project_id', projectId)
      .order('scheduled_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching work orders by project:', error);
      return [];
    }
    return data || [];
  }

  async getWorkOrdersByContact(contactId: string): Promise<DbWorkOrder[]> {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('contact_id', contactId)
      .order('scheduled_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching work orders by contact:', error);
      return [];
    }
    return data || [];
  }

  async createWorkOrder(workOrder: Partial<DbWorkOrder>): Promise<DbWorkOrder | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('work_orders').insert([workOrder]).select().single(),
        10000, 'createWorkOrder'
      );
      if (error) { console.error('Error creating work order:', error); return null; }
      return data;
    } catch (err) { console.error('createWorkOrder timed out or failed:', err); return null; }
  }

  async updateWorkOrder(workOrderId: string, updates: Partial<DbWorkOrder>): Promise<DbWorkOrder | null> {
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('work_orders').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', workOrderId).select().single(),
        10000, 'updateWorkOrder'
      );
      if (error) { console.error('Error updating work order:', error); return null; }
      return data;
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

  // Update work order status helpers
  async startWorkOrder(workOrderId: string): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });
  }

  async completeWorkOrder(workOrderId: string, actualHours?: number): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(actualHours !== undefined && { actual_hours: actualHours }),
    });
  }

  async markWorkOrderSigned(workOrderId: string, signedBy: string, signatureData?: string): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      signed_by: signedBy,
      signature_data: signatureData,
    });
  }

  async requestWorkOrderSignature(workOrderId: string, token: string): Promise<DbWorkOrder | null> {
    return this.updateWorkOrder(workOrderId, { sign_token: token });
  }

  // ── Notification operations ──────────────────────────────────────

  async getNotifications(companyId: string): Promise<DbNotification[]> {
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return (data || []) as DbNotification[];
  }

  async getUnreadNotifications(companyId: string, userId?: string): Promise<DbNotification[]> {
    if (this.inDemoMode()) return [];
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching unread notifications:', error);
      return [];
    }
    return (data || []) as DbNotification[];
  }

  async createNotification(notification: Partial<DbNotification>): Promise<DbNotification | null> {
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
    if (this.inDemoMode()) return true;
    let query = supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('read', false);
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    const { error } = await query;
    if (error) {
      console.error('Error marking all notifications read:', error);
      return false;
    }
    return true;
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    if (this.inDemoMode()) return true;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
    return true;
  }

  // ─── Expenses ─────────────────────────────────────────────────────────

  async getExpenses(companyId: string): Promise<DbExpense[]> {
    if (this.inDemoMode()) return [];
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false });
    if (error) { console.error('Error loading expenses:', error); return []; }
    return (data || []) as DbExpense[];
  }

  async createExpense(expense: Partial<DbExpense>): Promise<DbExpense | null> {
    if (this.inDemoMode()) return null;
    try {
      const { data, error } = await this.raceTimeout(
        supabase.from('expenses').insert(expense).select().single(),
        10000, 'createExpense'
      );
      if (error) { console.error('Error creating expense:', error); return null; }
      return data as DbExpense;
    } catch (err) { console.error('createExpense timed out or failed:', err); return null; }
  }

  async updateExpense(expenseId: string, updates: Partial<DbExpense>): Promise<DbExpense | null> {
    if (this.inDemoMode()) return null;
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
    if (this.inDemoMode()) return null;
    const path = `${companyId}/${expenseId}/${file.name}`;
    const { error } = await supabase.storage
      .from('expense-receipts')
      .upload(path, file, { upsert: true });
    if (error) { console.error('Error uploading receipt:', error); return null; }
    const { data: urlData } = supabase.storage
      .from('expense-receipts')
      .getPublicUrl(path);
    return urlData.publicUrl;
  }
}

export const db = new DatabaseService();
