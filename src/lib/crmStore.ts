// CRM State Management using React Context
import { createContext, useContext } from 'react';
import { isSoldStatus, isLostStatus } from './statusDefinitions';
import { quoteValue } from './crmData';
import type {
  Contact,
  TeamMember,
  KanbanBoard,
  LeadSource,
  Appointment,
  Invoice,
  Automation,
  CustomerStatus,
  UserRole,
  Supplier,
  MaterialOrder,
  QuoteSummary,
  Project,
  WorkOrder,
  DocumentTemplate,
  CompanyGoals,
} from './crmData';

/** A line item handed to the quote builder from elsewhere (e.g. a parsed Roofr report). */
export interface QuoteDraftItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

/**
 * Asks the Quotes view to open its builder when it mounts: on an existing quote,
 * or on a new quote for a contact, optionally pre-filled.
 */
export interface PendingQuote {
  contactId: string;
  quoteId?: string | null;
  title?: string;
  items?: QuoteDraftItem[];
}

/** Another screen asked to invoice a customer's job or record a payment on it. */
export interface PendingQuoteAction {
  contactId: string;
  action: 'invoice' | 'payment';
}

export type ViewType =
  | 'dashboard'
  | 'pipeline'
  | 'contacts'
  | 'contact-detail'
  | 'communications'
  | 'calendar'
  | 'documents'
  | 'document-templates'
  | 'financial'
  | 'invoices'
  | 'expenses'
  | 'team'
  | 'automations'
  | 'settings'
  | 'suppliers'
  | 'estimates'
  | 'quotes'
  | 'storm-search'
  | 'projects'
  | 'work-orders'
  | 'material-orders'
  | 'reports'
  | 'ai-assistant'
  | 'insurance-tracking'
  | 'supplement-tracking'
  | 'crew-schedule'
  | 'equipment'
  | 'commission-payroll'
  | 'sales-analytics'
  | 'inspections';

export interface CRMState {
  // Current user
  currentUser: TeamMember | null;
  companyId: string | null;
  
  // View state
  currentView: ViewType;
  selectedContactId: string | null;
  selectedBoardId: string;
  
  // Data
  contacts: Contact[];
  teamMembers: TeamMember[];
  boards: KanbanBoard[];
  leadSources: LeadSource[];
  appointments: Appointment[];
  invoices: Invoice[];
  automations: Automation[];
  suppliers: Supplier[];
  materialOrders: MaterialOrder[];
  quotes: QuoteSummary[];
  projects: Project[];
  workOrders: WorkOrder[];
  documentTemplates: DocumentTemplate[];
  companyGoals: CompanyGoals[];
  
  // UI state
  sidebarCollapsed: boolean;
  searchQuery: string;
  filterStatus: CustomerStatus | 'all';
  filterAssignee: string | 'all';
  showQuickAdd: boolean;
  showInvoiceModal: boolean;
  selectedInvoiceId: string | null;
  invoiceModalPrefill: { contactId?: string; items?: any[]; notes?: string } | null;
  pendingAppointmentContactId: string | null;
  /** A notification asked the calendar to open this appointment. */
  pendingAppointmentId: string | null;
  pendingQuote: PendingQuote | null;
  pendingQuoteAction: PendingQuoteAction | null;
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Notifications
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  /** The notification's own kind, e.g. hail_event. */
  kind?: string;
  /** What it is about, so clicking it can open that record. */
  relatedType?: string;
  relatedId?: string;
}

export type CRMAction =
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SELECT_CONTACT'; payload: string | null }
  | { type: 'SELECT_BOARD'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER_STATUS'; payload: CustomerStatus | 'all' }
  | { type: 'SET_FILTER_ASSIGNEE'; payload: string | 'all' }
  | { type: 'TOGGLE_QUICK_ADD' }
  | { type: 'TOGGLE_INVOICE_MODAL'; payload?: string | null; prefill?: { contactId?: string; items?: any[]; notes?: string } | null }
  | { type: 'SET_PENDING_APPOINTMENT_CONTACT'; payload: string | null }
  | { type: 'SET_PENDING_APPOINTMENT_ID'; payload: string | null }
  | { type: 'SET_PENDING_QUOTE'; payload: PendingQuote | null }
  | { type: 'SET_PENDING_QUOTE_ACTION'; payload: PendingQuoteAction | null }
  | { type: 'ADD_CONTACT'; payload: Contact }
  | { type: 'UPDATE_CONTACT'; payload: Contact }
  | { type: 'DELETE_CONTACT'; payload: string }
  | { type: 'UPDATE_CONTACT_STATUS'; payload: { contactId: string; status: CustomerStatus } }
  | { type: 'SET_CONTACTS'; payload: Contact[] }
  | { type: 'ADD_BOARD'; payload: KanbanBoard }
  | { type: 'UPDATE_BOARD'; payload: KanbanBoard }
  | { type: 'DELETE_BOARD'; payload: string }
  | { type: 'SET_BOARDS'; payload: KanbanBoard[] }
  | { type: 'ADD_LEAD_SOURCE'; payload: LeadSource }
  | { type: 'DELETE_LEAD_SOURCE'; payload: string }
  | { type: 'SET_LEAD_SOURCES'; payload: LeadSource[] }
  | { type: 'ADD_APPOINTMENT'; payload: Appointment }
  | { type: 'UPDATE_APPOINTMENT'; payload: Appointment }
  | { type: 'DELETE_APPOINTMENT'; payload: string }
  | { type: 'SET_APPOINTMENTS'; payload: Appointment[] }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'DELETE_INVOICE'; payload: string }
  | { type: 'SET_INVOICES'; payload: Invoice[] }
  | { type: 'ADD_TEAM_MEMBER'; payload: TeamMember }
  | { type: 'UPDATE_TEAM_MEMBER'; payload: TeamMember }
  | { type: 'SET_TEAM_MEMBERS'; payload: TeamMember[] }
  | { type: 'TOGGLE_AUTOMATION'; payload: string }
  | { type: 'SET_AUTOMATIONS'; payload: Automation[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'SET_CURRENT_USER'; payload: TeamMember }
  | { type: 'SET_COMPANY_ID'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'DELETE_SUPPLIER'; payload: string }
  | { type: 'SET_SUPPLIERS'; payload: Supplier[] }
  | { type: 'ADD_MATERIAL_ORDER'; payload: MaterialOrder }
  | { type: 'UPDATE_MATERIAL_ORDER'; payload: MaterialOrder }
  | { type: 'DELETE_MATERIAL_ORDER'; payload: string }
  | { type: 'SET_MATERIAL_ORDERS'; payload: MaterialOrder[] }
  | { type: 'SET_QUOTES'; payload: QuoteSummary[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_WORK_ORDER'; payload: WorkOrder }
  | { type: 'UPDATE_WORK_ORDER'; payload: WorkOrder }
  | { type: 'DELETE_WORK_ORDER'; payload: string }
  | { type: 'SET_WORK_ORDERS'; payload: WorkOrder[] }
  | { type: 'ADD_DOCUMENT_TEMPLATE'; payload: DocumentTemplate }
  | { type: 'UPDATE_DOCUMENT_TEMPLATE'; payload: DocumentTemplate }
  | { type: 'DELETE_DOCUMENT_TEMPLATE'; payload: string }
  | { type: 'SET_DOCUMENT_TEMPLATES'; payload: DocumentTemplate[] }
  | { type: 'ADD_COMPANY_GOAL'; payload: CompanyGoals }
  | { type: 'UPDATE_COMPANY_GOAL'; payload: CompanyGoals }
  | { type: 'SET_COMPANY_GOALS'; payload: CompanyGoals[] }
  | { type: 'INITIALIZE_DATA'; payload: {
      contacts: Contact[];
      appointments: Appointment[];
      invoices: Invoice[];
      boards: KanbanBoard[];
      leadSources: LeadSource[];
      automations: Automation[];
      teamMembers: TeamMember[];
      suppliers: Supplier[];
      materialOrders: MaterialOrder[];
      quotes: QuoteSummary[];
      projects: Project[];
      workOrders: WorkOrder[];
      documentTemplates: DocumentTemplate[];
      companyGoals: CompanyGoals[];
    }};

export function crmReducer(state: CRMState, action: CRMAction): CRMState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload, selectedContactId: null };
    
    case 'SELECT_CONTACT':
      return { 
        ...state, 
        selectedContactId: action.payload,
        currentView: action.payload ? 'contact-detail' : state.currentView 
      };
    
    case 'SELECT_BOARD':
      return { ...state, selectedBoardId: action.payload };
    
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload };
    
    case 'SET_FILTER_ASSIGNEE':
      return { ...state, filterAssignee: action.payload };
    
    case 'TOGGLE_QUICK_ADD':
      return { ...state, showQuickAdd: !state.showQuickAdd };
    
    case 'SET_PENDING_APPOINTMENT_CONTACT':
      return { ...state, pendingAppointmentContactId: action.payload };
    case 'SET_PENDING_APPOINTMENT_ID':
      return { ...state, pendingAppointmentId: action.payload };

    case 'SET_PENDING_QUOTE':
      return { ...state, pendingQuote: action.payload };
    case 'SET_PENDING_QUOTE_ACTION':
      return { ...state, pendingQuoteAction: action.payload };

    case 'TOGGLE_INVOICE_MODAL':
      return { 
        ...state, 
        showInvoiceModal: !state.showInvoiceModal,
        selectedInvoiceId: action.payload ?? null,
        invoiceModalPrefill: action.prefill ?? null,
      };
    
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };
    
    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    
    case 'DELETE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.filter((c) => c.id !== action.payload),
        selectedContactId: state.selectedContactId === action.payload ? null : state.selectedContactId,
      };
    
    case 'UPDATE_CONTACT_STATUS':
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload.contactId
            ? { ...c, status: action.payload.status, statusChangedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            : c
        ),
      };
    
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload };
    
    case 'ADD_BOARD':
      return { ...state, boards: [...state.boards, action.payload] };
    
    case 'UPDATE_BOARD':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.payload.id ? action.payload : b
        ),
      };
    
    case 'DELETE_BOARD':
      return {
        ...state,
        boards: state.boards.filter((b) => b.id !== action.payload),
        selectedBoardId: state.selectedBoardId === action.payload ? 'board-sales' : state.selectedBoardId,
      };
    
    case 'SET_BOARDS':
      return { ...state, boards: action.payload };
    
    case 'ADD_LEAD_SOURCE':
      return { ...state, leadSources: [...state.leadSources, action.payload] };

    case 'DELETE_LEAD_SOURCE':
      return { ...state, leadSources: state.leadSources.filter((ls) => ls.id !== action.payload) };
    
    case 'SET_LEAD_SOURCES':
      return { ...state, leadSources: action.payload };
    
    case 'ADD_APPOINTMENT': {
      const newAppt = action.payload;
      let contactsAfterAdd = state.contacts;

      if (newAppt.type === 'inspection') {
        contactsAfterAdd = state.contacts.map((contact) => {
          if (contact.id === newAppt.contactId) {
            const shouldAdvanceStatus =
              contact.status === 'prospect' || contact.status === 'lead';
            return {
              ...contact,
              inspectionScheduled: true,
              inspectionDate: newAppt.date,
              ...(shouldAdvanceStatus ? { status: 'appt_set' as CustomerStatus } : {}),
              updatedAt: new Date().toISOString(),
            };
          }
          return contact;
        });
      }

      return {
        ...state,
        appointments: [...state.appointments, newAppt],
        contacts: contactsAfterAdd,
      };
    }
    
    case 'UPDATE_APPOINTMENT': {
      const updatedAppointment = action.payload;
      const isInspection = updatedAppointment.type === 'inspection';
      const isCompleted = updatedAppointment.status === 'completed';
      
      let updatedContacts = state.contacts;
      
      if (isInspection && isCompleted) {
        updatedContacts = state.contacts.map((contact) => {
          if (contact.id === updatedAppointment.contactId && contact.status === 'appt_set') {
            return {
              ...contact,
              status: 'inspection_completed' as CustomerStatus,
              inspectionCompleted: true,
              inspectionCompletedDate: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          return contact;
        });
      }
      
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
        contacts: updatedContacts,
      };
    }
    
    case 'DELETE_APPOINTMENT':
      return {
        ...state,
        appointments: state.appointments.filter((a) => a.id !== action.payload),
      };
    
    case 'SET_APPOINTMENTS':
      return { ...state, appointments: action.payload };
    
    case 'ADD_INVOICE':
      return { ...state, invoices: [...state.invoices, action.payload] };
    
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === action.payload.id ? action.payload : i
        ),
      };
    
    case 'DELETE_INVOICE':
      return { ...state, invoices: state.invoices.filter((i) => i.id !== action.payload) };

    case 'SET_INVOICES':
      return { ...state, invoices: action.payload };

    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [...state.suppliers, action.payload] };
    
    case 'UPDATE_SUPPLIER':
      return {
        ...state,
        suppliers: state.suppliers.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    
    case 'DELETE_SUPPLIER':
      return { ...state, suppliers: state.suppliers.filter((s) => s.id !== action.payload) };
    
    case 'SET_SUPPLIERS':
      return { ...state, suppliers: action.payload };
    
    case 'ADD_MATERIAL_ORDER':
      return { ...state, materialOrders: [...state.materialOrders, action.payload] };
    
    case 'UPDATE_MATERIAL_ORDER':
      return {
        ...state,
        materialOrders: state.materialOrders.map((mo) =>
          mo.id === action.payload.id ? action.payload : mo
        ),
      };
    
    case 'DELETE_MATERIAL_ORDER':
      return { ...state, materialOrders: state.materialOrders.filter((mo) => mo.id !== action.payload) };
    
    case 'SET_MATERIAL_ORDERS':
      return { ...state, materialOrders: action.payload };
    
    case 'SET_QUOTES':
      return { ...state, quotes: action.payload };
    
    case 'ADD_TEAM_MEMBER':
      return { ...state, teamMembers: [...state.teamMembers, action.payload] };
    
    case 'UPDATE_TEAM_MEMBER':
      return {
        ...state,
        teamMembers: state.teamMembers.map((tm) =>
          tm.id === action.payload.id ? action.payload : tm
        ),
      };
    
    case 'SET_TEAM_MEMBERS':
      return { ...state, teamMembers: action.payload };
    
    case 'TOGGLE_AUTOMATION':
      return {
        ...state,
        automations: state.automations.map((a) =>
          a.id === action.payload ? { ...a, isActive: !a.isActive } : a
        ),
      };
    
    case 'SET_AUTOMATIONS':
      return { ...state, automations: action.payload };
    
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };
    
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
    
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
    
    case 'SET_COMPANY_ID':
      return { ...state, companyId: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
      };
    
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    
    case 'ADD_WORK_ORDER':
      return { ...state, workOrders: [...state.workOrders, action.payload] };
    
    case 'UPDATE_WORK_ORDER':
      return {
        ...state,
        workOrders: state.workOrders.map((wo) =>
          wo.id === action.payload.id ? action.payload : wo
        ),
      };
    
    case 'DELETE_WORK_ORDER':
      return {
        ...state,
        workOrders: state.workOrders.filter((wo) => wo.id !== action.payload),
      };
    
    case 'SET_WORK_ORDERS':
      return { ...state, workOrders: action.payload };
    
    case 'ADD_DOCUMENT_TEMPLATE':
      return { ...state, documentTemplates: [...state.documentTemplates, action.payload] };
    
    case 'UPDATE_DOCUMENT_TEMPLATE':
      return {
        ...state,
        documentTemplates: state.documentTemplates.map((dt) =>
          dt.id === action.payload.id ? action.payload : dt
        ),
      };
    
    case 'DELETE_DOCUMENT_TEMPLATE':
      return { ...state, documentTemplates: state.documentTemplates.filter((dt) => dt.id !== action.payload) };
    
    case 'SET_DOCUMENT_TEMPLATES':
      return { ...state, documentTemplates: action.payload };

    case 'ADD_COMPANY_GOAL':
      return { ...state, companyGoals: [...state.companyGoals, action.payload] };

    case 'UPDATE_COMPANY_GOAL':
      return {
        ...state,
        companyGoals: state.companyGoals.map((g) =>
          g.id === action.payload.id ? action.payload : g
        ),
      };

    case 'SET_COMPANY_GOALS':
      return { ...state, companyGoals: action.payload };
    
    case 'INITIALIZE_DATA': {
      const newBoards = action.payload.boards;
      const currentBoardStillValid = newBoards.some((b) => b.id === state.selectedBoardId);
      const selectedBoardId = currentBoardStillValid
        ? state.selectedBoardId
        : (newBoards[0]?.id ?? state.selectedBoardId);
      return {
        ...state,
        contacts: action.payload.contacts,
        appointments: action.payload.appointments,
        invoices: action.payload.invoices,
        boards: newBoards,
        leadSources: action.payload.leadSources,
        automations: action.payload.automations,
        teamMembers: action.payload.teamMembers,
        suppliers: action.payload.suppliers,
        materialOrders: action.payload.materialOrders,
        quotes: action.payload.quotes,
        projects: action.payload.projects,
        workOrders: action.payload.workOrders,
        // Restore companyId from cache so QuickAdd / saves work immediately
        // before the auth profile finishes loading on refresh.
        companyId: (action.payload as any).companyId ?? state.companyId,
        selectedBoardId,
        isInitialized: true,
        isLoading: false,
      };
    }
    
    default:
      return state;
  }
}

export interface CRMContextType {
  state: CRMState;
  dispatch: React.Dispatch<CRMAction>;
}

export const CRMContext = createContext<CRMContextType | null>(null);

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}

export function useCurrentContact() {
  const { state } = useCRM();
  if (!state.selectedContactId) return null;
  return state.contacts.find((c) => c.id === state.selectedContactId) || null;
}

export function useFilteredContacts() {
  const { state } = useCRM();
  let filtered = [...state.contacts];
  
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.firstName.toLowerCase().includes(query) ||
        c.lastName.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone1.includes(query) ||
        c.address.toLowerCase().includes(query)
    );
  }
  
  if (state.filterStatus !== 'all') {
    filtered = filtered.filter((c) => c.status === state.filterStatus);
  }
  
  if (state.filterAssignee !== 'all') {
    filtered = filtered.filter((c) => c.assignedTo === state.filterAssignee);
  }
  
  return filtered;
}

export function useCurrentBoard() {
  const { state } = useCRM();
  return state.boards.find((b) => b.id === state.selectedBoardId) || state.boards[0];
}

export function useBoardContacts(boardId: string) {
  const { state } = useCRM();
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return {};
  
  const contactsByColumn: Record<string, Contact[]> = {};
  
  board.columns.forEach((col) => {
    contactsByColumn[col.id] = state.contacts.filter((c) => c.status === col.status);
  });
  
  return contactsByColumn;
}

function parseAppointmentDate(appointment: Appointment): Date {
  const raw = appointment.date?.trim();
  if (!raw) return new Date(NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const time = appointment.time?.trim() || '00:00';
    return new Date(`${raw}T${time}`);
  }

  return new Date(raw);
}

export function getUpcomingAppointments(
  appointments: Appointment[],
  now: Date = new Date(),
  days: number = 7
) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const futureDate = new Date(startOfToday);
  futureDate.setDate(futureDate.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);

  return appointments
    .filter((apt) => {
      const aptDate = parseAppointmentDate(apt);
      if (Number.isNaN(aptDate.getTime())) return false;
      return aptDate >= startOfToday && aptDate <= futureDate && apt.status === 'scheduled';
    })
    .sort((a, b) => parseAppointmentDate(a).getTime() - parseAppointmentDate(b).getTime());
}

export function useUpcomingAppointments(days: number = 7) {
  const { state } = useCRM();
  return getUpcomingAppointments(state.appointments, new Date(), days);
}

export function usePipelineStats() {
  const { state } = useCRM();
  
  const stats = {
    totalContacts: state.contacts.length,
    totalValue: state.contacts.reduce((sum, c) => sum + (c.projectValue || 0), 0),
    byStatus: {} as Record<string, number>,
    conversionRate: 0,
    avgDealSize: 0,
  };
  
  state.contacts.forEach((c) => {
    stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
  });
  
  const closedDeals = state.contacts.filter((c) => c.status === 'completed');
  const lostDeals = state.contacts.filter((c) => c.status === 'lost');
  
  if (closedDeals.length + lostDeals.length > 0) {
    stats.conversionRate = (closedDeals.length / (closedDeals.length + lostDeals.length)) * 100;
  }
  
  if (closedDeals.length > 0) {
    stats.avgDealSize = closedDeals.reduce((sum, c) => sum + (c.projectValue || 0), 0) / closedDeals.length;
  }
  
  return stats;
}

export function useFinancialStats() {
  const { state } = useCRM();

  const stats = {
    // ── Revenue ──────────────────────────────────────────────────────────────
    /** Collected payments from contact-level deposit + final payment fields */
    contactRevenue: 0,
    /** Collected payments from paid invoices (may overlap with contactRevenue if
     *  both tracks are used for the same deal — see totalRevenue note below) */
    invoiceRevenue: 0,
    /**
     * Combined revenue.  To avoid double-counting when a contact has both
     * finalPaymentPaid=true AND a paid invoice, we only add invoice revenue for
     * invoices whose contactId does NOT already have a fully-paid final payment.
     */
    totalRevenue: 0,

    // ── Deposits & payments ───────────────────────────────────────────────────
    depositsCollected: 0,
    pendingPayments: 0,
    /** Total collected = deposits + final payments received + paid invoices */
    totalCollected: 0,
    /** Total outstanding = pending final payments + outstanding/overdue invoices */
    totalOutstanding: 0,

    // ── Invoices ─────────────────────────────────────────────────────────────
    paidInvoices: 0,
    outstandingInvoices: 0,
    overdueInvoices: 0,

    // ── Quotes ───────────────────────────────────────────────────────────────
    // Valued with quoteValue(): the chosen tier once signed, the Good tier before.
    /** Value of signed quotes */
    signedQuotesTotal: 0,
    /** Count of signed quotes */
    signedQuotesCount: 0,
    /** Value of quotes sent and awaiting a signature (sent + viewed) */
    pendingQuotesTotal: 0,
    /** Count of quotes sent and awaiting a signature */
    pendingQuotesCount: 0,
    /** Value of every quote that has gone to a customer (sent + viewed + signed + declined) */
    quotesSentTotal: 0,
    /** Count of every quote that has gone to a customer */
    quotesSentCount: 0,

    // ── Costs ────────────────────────────────────────────────────────────────
    deliveredMaterialCost: 0,
    pendingMaterialCost: 0,
    totalSubcontractorCost: 0,
    totalLaborCost: 0,

    // ── Pipeline ─────────────────────────────────────────────────────────────
    /** Number of active leads (not won/lost/closed) */
    leadsGenerated: 0,
    /** Total project value of sold deals (all SOLD_STATUSES) */
    dealsClosed: 0,
    /** Number of sold deals */
    dealsClosedCount: 0,
    /** Total project value of lost deals */
    lostSalesValue: 0,
    /** Number of lost deals */
    lostDealsCount: 0,
  };

  // Build a set of contact IDs that already have a fully-paid final payment so
  // we can skip their invoices and prevent double-counting.
  const contactsWithPaidFinalPayment = new Set<string>();

  state.contacts.forEach((c) => {
    // Deposits
    if (c.depositPaid && c.depositAmount) {
      stats.depositsCollected += c.depositAmount;
      stats.contactRevenue += c.depositAmount;
    }

    // Final payments — deduct deposit to avoid counting it twice (deposit was
    // already added above; here we add only the remaining balance).
    if (c.finalPaymentPaid && c.finalPaymentAmount) {
      const depositAlreadyCounted = c.depositPaid ? (c.depositAmount || 0) : 0;
      const balance = c.finalPaymentAmount - depositAlreadyCounted;
      stats.contactRevenue += balance;
      contactsWithPaidFinalPayment.add(c.id);
    }

    // Pending final payment (not yet collected)
    if (!c.finalPaymentPaid && c.finalPaymentAmount) {
      stats.pendingPayments += c.finalPaymentAmount;
    }

    // Pipeline / sales metrics — use centralized status definitions
    if (isSoldStatus(c.status)) {
      stats.dealsClosed += c.projectValue || 0;
      stats.dealsClosedCount += 1;
    } else if (isLostStatus(c.status)) {
      stats.lostSalesValue += c.projectValue || 0;
      stats.lostDealsCount += 1;
    } else {
      stats.leadsGenerated += 1;
    }
  });

  // Invoices — skip invoices for contacts whose final payment is already tracked
  // at the contact level to prevent double-counting.
  state.invoices.forEach((inv) => {
    if (inv.status === 'paid') {
      stats.paidInvoices += inv.amount;
      // Only add to revenue if this contact's payment isn't already in contactRevenue
      if (!contactsWithPaidFinalPayment.has((inv as any).contactId || '')) {
        stats.invoiceRevenue += inv.amount;
      }
    } else if (inv.status === 'overdue') {
      stats.overdueInvoices += inv.amount;
    } else if (inv.status === 'sent') {
      stats.outstandingInvoices += inv.amount;
    }
  });

  stats.totalRevenue = stats.contactRevenue + stats.invoiceRevenue;
  stats.totalCollected = stats.depositsCollected + stats.paidInvoices +
    // add final payment balance not already in paidInvoices
    state.contacts.reduce((sum, c) => {
      if (c.finalPaymentPaid && c.finalPaymentAmount && !contactsWithPaidFinalPayment.has(c.id)) {
        return sum + c.finalPaymentAmount;
      }
      return sum;
    }, 0);
  stats.totalOutstanding = stats.pendingPayments + stats.outstandingInvoices + stats.overdueInvoices;

  state.quotes.forEach((q) => {
    // Drafts have not been seen by the customer, so they are not pipeline yet.
    if (!['sent', 'viewed', 'signed', 'declined'].includes(q.status)) return;
    const value = quoteValue(q);
    stats.quotesSentTotal += value;
    stats.quotesSentCount += 1;
    if (q.status === 'signed') {
      stats.signedQuotesTotal += value;
      stats.signedQuotesCount += 1;
    } else if (q.status === 'sent' || q.status === 'viewed') {
      stats.pendingQuotesTotal += value;
      stats.pendingQuotesCount += 1;
    }
  });

  state.materialOrders.forEach((order) => {
    if (order.status === 'cancelled') return;
    if (order.status === 'delivered') {
      stats.deliveredMaterialCost += order.total;
    } else {
      stats.pendingMaterialCost += order.total;
    }
  });

  state.projects.forEach((p) => {
    stats.totalSubcontractorCost += (p.actualSubcontractorCost || 0);
  });

  state.workOrders.forEach((wo) => {
    if (wo.isSubcontractor) {
      stats.totalSubcontractorCost += (wo.subcontractorCost || 0);
    } else {
      stats.totalLaborCost += (wo.laborCost || 0);
    }
  });

  return stats;
}

export function canCreateBoard(role: UserRole): boolean {
  return ['owner', 'admin', 'sales_manager', 'production_manager'].includes(role);
}

export function canEditBoard(role: UserRole): boolean {
  return ['owner', 'admin', 'sales_manager', 'production_manager'].includes(role);
}

export function canManageTeam(role: UserRole): boolean {
  return ['owner', 'admin', 'sales_manager', 'production_manager'].includes(role);
}

export function canManageLeadSources(role: UserRole): boolean {
  return ['owner', 'admin', 'sales_manager'].includes(role);
}

export function canViewFinancials(role: UserRole): boolean {
  return ['owner', 'admin', 'sales_manager', 'office_staff', 'manager'].includes(role);
}

export function canCreateInvoice(role: UserRole): boolean {
  return ['owner', 'admin', 'sales_manager', 'sales_rep', 'office_staff'].includes(role);
}

const roleHierarchy: Record<UserRole, number> = {
  owner: 10,
  admin: 9,
  sales_manager: 8,
  production_manager: 8,
  project_manager: 6,
  office_staff: 5,
  sales_rep: 4,
  field_tech: 3,
  subcontractor: 2,
  // Limited permission roles (same tier)
  canvasser: 1,
  field_contractor: 1,
  // Legacy roles (for backward compatibility)
  manager: 8,
  sales: 4,
  production: 8,
  billing: 5,
  canvas: 3,
};

export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole !== 'owner';
  if (actorRole === 'sales_manager' || actorRole === 'production_manager' || actorRole === 'manager') {
    return roleHierarchy[targetRole] < roleHierarchy[actorRole];
  }
  return false;
}

export function getAssignableRoles(actorRole: UserRole): UserRole[] {
  const activeRoles: UserRole[] = [
    'owner',
    'admin',
    'sales_manager',
    'sales_rep',
    'production_manager',
    'project_manager',
    'field_tech',
    'office_staff',
    'subcontractor',
    'canvasser',
    'field_contractor',
  ];
  return activeRoles.filter((role) => canAssignRole(actorRole, role));
}

export function canModifyMember(actorRole: UserRole, memberRole: UserRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return memberRole !== 'owner';
  if (actorRole === 'sales_manager' || actorRole === 'production_manager' || actorRole === 'manager') {
    return roleHierarchy[memberRole] < roleHierarchy[actorRole];
  }
  return false;
}
