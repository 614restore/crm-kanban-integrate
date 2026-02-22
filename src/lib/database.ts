// Database service layer for CRM data persistence
import { supabase } from './supabase';

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Database service class
class DatabaseService {
  // Company operations
  async getCompany(companyId: string): Promise<DbCompany | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    
    if (error) {
      console.error('Error fetching company:', error);
      return null;
    }
    return data;
  }

  async createCompany(company: Partial<DbCompany>): Promise<DbCompany | null> {
    const { data, error } = await supabase
      .from('companies')
      .insert(company)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating company:', error);
      return null;
    }
    return data;
  }

  async updateCompany(companyId: string, updates: Partial<DbCompany>): Promise<DbCompany | null> {
    const { data, error } = await supabase
      .from('companies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating company:', error);
      return null;
    }
    return data;
  }

  // Contact operations
  async getContacts(companyId: string): Promise<DbContact[]> {
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
    const { data, error } = await supabase
      .from('contacts')
      .insert(contact)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating contact:', error);
      return null;
    }
    return data;
  }

  async updateContact(contactId: string, updates: Partial<DbContact>): Promise<DbContact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', contactId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating contact:', error);
      return null;
    }
    return data;
  }

  async deleteContact(contactId: string): Promise<boolean> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);
    
    if (error) {
      console.error('Error deleting contact:', error);
      return false;
    }
    return true;
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
    const { data, error } = await supabase
      .from('jobs')
      .insert(job)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating job:', error);
      return null;
    }
    return data;
  }

  async updateJob(jobId: string, updates: Partial<DbJob>): Promise<DbJob | null> {
    const { data, error } = await supabase
      .from('jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating job:', error);
      return null;
    }
    return data;
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);
    
    if (error) {
      console.error('Error deleting job:', error);
      return false;
    }
    return true;
  }

  // Appointment operations
  async getAppointments(companyId: string): Promise<DbAppointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: true });
    
    if (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
    return data || [];
  }

  async createAppointment(appointment: Partial<DbAppointment>): Promise<DbAppointment | null> {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating appointment:', error);
      return null;
    }
    return data;
  }

  async updateAppointment(appointmentId: string, updates: Partial<DbAppointment>): Promise<DbAppointment | null> {
    const { data, error } = await supabase
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating appointment:', error);
      return null;
    }
    return data;
  }

  async deleteAppointment(appointmentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId);
    
    if (error) {
      console.error('Error deleting appointment:', error);
      return false;
    }
    return true;
  }

  // Invoice operations
  async getInvoices(companyId: string): Promise<DbInvoice[]> {
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
    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();
    
    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return null;
    }

    if (items.length > 0) {
      const itemsWithInvoiceId = items.map(item => ({
        ...item,
        invoice_id: newInvoice.id
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsWithInvoiceId);
      
      if (itemsError) {
        console.error('Error creating invoice items:', itemsError);
      }
    }

    return newInvoice;
  }

  async updateInvoice(invoiceId: string, updates: Partial<DbInvoice>): Promise<DbInvoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating invoice:', error);
      return null;
    }
    return data;
  }

  // Communication operations
  async getCommunications(companyId: string): Promise<DbCommunication[]> {
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
    const { data, error } = await supabase
      .from('lead_sources')
      .insert(leadSource)
      .select()
      .single();
    
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', companyId)
      .order('first_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching team members:', error);
      return [];
    }
    return data || [];
  }

  async updateProfile(profileId: string, updates: Partial<DbProfile>): Promise<DbProfile | null> {
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

    return channel.subscribe();
  }

  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }
}

export const db = new DatabaseService();
