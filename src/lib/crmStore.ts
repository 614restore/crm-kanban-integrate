// CRM State Management using React Context
import { createContext, useContext } from 'react';
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
} from './crmData';

export type ViewType =
  | 'dashboard'
  | 'pipeline'
  | 'contacts'
  | 'contact-detail'
  | 'communications'
  | 'calendar'
  | 'documents'
  | 'financial'
  | 'team'
  | 'automations'
  | 'settings'
  | 'ai-assistant';

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
  
  // UI state
  sidebarCollapsed: boolean;
  searchQuery: string;
  filterStatus: CustomerStatus | 'all';
  filterAssignee: string | 'all';
  showQuickAdd: boolean;
  showInvoiceModal: boolean;
  selectedInvoiceId: string | null;
  
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
  | { type: 'TOGGLE_INVOICE_MODAL'; payload?: string | null }
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
  | { type: 'SET_LEAD_SOURCES'; payload: LeadSource[] }
  | { type: 'ADD_APPOINTMENT'; payload: Appointment }
  | { type: 'UPDATE_APPOINTMENT'; payload: Appointment }
  | { type: 'DELETE_APPOINTMENT'; payload: string }
  | { type: 'SET_APPOINTMENTS'; payload: Appointment[] }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
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
  | { type: 'INITIALIZE_DATA'; payload: {
      contacts: Contact[];
      appointments: Appointment[];
      invoices: Invoice[];
      boards: KanbanBoard[];
      leadSources: LeadSource[];
      automations: Automation[];
      teamMembers: TeamMember[];
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
    
    case 'TOGGLE_INVOICE_MODAL':
      return { 
        ...state, 
        showInvoiceModal: !state.showInvoiceModal,
        selectedInvoiceId: action.payload ?? null 
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
            ? { ...c, status: action.payload.status, updatedAt: new Date().toISOString() }
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
    
    case 'SET_LEAD_SOURCES':
      return { ...state, leadSources: action.payload };
    
    case 'ADD_APPOINTMENT':
      return { ...state, appointments: [...state.appointments, action.payload] };
    
    case 'UPDATE_APPOINTMENT':
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    
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
    
    case 'SET_INVOICES':
      return { ...state, invoices: action.payload };
    
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
    
    case 'INITIALIZE_DATA':
      return {
        ...state,
        contacts: action.payload.contacts,
        appointments: action.payload.appointments,
        invoices: action.payload.invoices,
        boards: action.payload.boards,
        leadSources: action.payload.leadSources,
        automations: action.payload.automations,
        teamMembers: action.payload.teamMembers,
        isInitialized: true,
        isLoading: false,
      };
    
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

// Helper hooks
export function useCurrentContact() {
  const { state } = useCRM();
  if (!state.selectedContactId) return null;
  return state.contacts.find((c) => c.id === state.selectedContactId) || null;
}

export function useFilteredContacts() {
  const { state } = useCRM();
  let filtered = [...state.contacts];
  
  // Search filter
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
  
  // Status filter
  if (state.filterStatus !== 'all') {
    filtered = filtered.filter((c) => c.status === state.filterStatus);
  }
  
  // Assignee filter
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

export function useUpcomingAppointments(days: number = 7) {
  const { state } = useCRM();
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return state.appointments
    .filter((apt) => {
      const aptDate = new Date(apt.date);
      return aptDate >= now && aptDate <= futureDate && apt.status === 'scheduled';
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    totalRevenue: 0,
    pendingPayments: 0,
    depositsCollected: 0,
    outstandingInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
  };
  
  state.contacts.forEach((c) => {
    if (c.depositPaid && c.depositAmount) {
      stats.depositsCollected += c.depositAmount;
    }
    if (c.finalPaymentPaid && c.finalPaymentAmount) {
      stats.totalRevenue += c.finalPaymentAmount;
    }
    if (!c.finalPaymentPaid && c.finalPaymentAmount) {
      stats.pendingPayments += c.finalPaymentAmount;
    }
  });
  
  state.invoices.forEach((inv) => {
    if (inv.status === 'paid') {
      stats.paidInvoices += inv.amount;
    } else if (inv.status === 'overdue') {
      stats.overdueInvoices += inv.amount;
    } else if (inv.status === 'sent') {
      stats.outstandingInvoices += inv.amount;
    }
  });
  
  stats.totalRevenue += stats.depositsCollected + stats.paidInvoices;
  
  return stats;
}

// Permission helpers
export function canCreateBoard(role: UserRole): boolean {
  return ['owner', 'manager', 'admin'].includes(role);
}

export function canEditBoard(role: UserRole): boolean {
  return ['owner', 'manager', 'admin'].includes(role);
}

export function canManageTeam(role: UserRole): boolean {
  return ['owner', 'manager', 'admin'].includes(role);
}

export function canManageLeadSources(role: UserRole): boolean {
  return ['owner', 'manager'].includes(role);
}

export function canViewFinancials(role: UserRole): boolean {
  return ['owner', 'manager', 'admin', 'billing'].includes(role);
}

export function canCreateInvoice(role: UserRole): boolean {
  return ['owner', 'manager', 'admin', 'billing'].includes(role);
}
