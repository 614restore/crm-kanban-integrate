import React, { useReducer, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { CRMContext, crmReducer, CRMState } from '@/lib/crmStore';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import {
  defaultBoards,
  defaultLeadSources,
  Contact,
  Communication,
  Appointment,
  Invoice,
  KanbanBoard,
  LeadSource,
  Automation,
  TeamMember,
} from '@/lib/crmData';

// Import core components (needed immediately)
import Sidebar from './crm/Sidebar';
import TopBar from './crm/TopBar';
import AuthPage from './crm/AuthPage';
import QuickAddModal from './crm/QuickAddModal';
import InvoiceModal from './crm/InvoiceModal';
import ResponsiveLayout from './mobile/ResponsiveLayout';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Building2, Loader2 } from 'lucide-react';

// Lazy load all CRM view components for better code splitting
const Dashboard = lazy(() => import('./crm/Dashboard'));
const PipelineBoard = lazy(() => import('./crm/PipelineBoard'));
const ContactList = lazy(() => import('./crm/ContactList'));
const ContactDetail = lazy(() => import('./crm/ContactDetail'));
const CommunicationHub = lazy(() => import('./crm/CommunicationHub'));
const CalendarView = lazy(() => import('./crm/CalendarView'));
const DocumentCenter = lazy(() => import('./crm/DocumentCenter'));
const FinancialDashboard = lazy(() => import('./crm/FinancialDashboard'));
const TeamView = lazy(() => import('./crm/TeamView'));
const AutomationsView = lazy(() => import('./crm/AutomationsView'));
const SettingsView = lazy(() => import('./crm/SettingsView'));
const AIAssistant = lazy(() => import('./crm/AIAssistant'));
const SuppliersView = lazy(() => import('./crm/SuppliersView'));
const EstimatesView = lazy(() => import('./crm/EstimatesView'));
const ProjectsView = lazy(() => import('./crm/ProjectsView'));
const WorkOrdersView = lazy(() => import('./crm/WorkOrdersView'));
const MaterialOrdersView = lazy(() => import('./crm/MaterialOrdersView'));
const ExpenseTracker = lazy(() => import('./crm/ExpenseTracker'));
const DocumentTemplates = lazy(() => import('./crm/DocumentTemplates'));
const ReportsAnalytics = lazy(() => import('./crm/ReportsAnalytics'));

// Initial CRM state (completely empty)
const initialState: CRMState = {
  currentUser: null,
  companyId: null,
  currentView: 'dashboard',
  selectedContactId: null,
  selectedBoardId: 'board-sales',
  contacts: [],
  teamMembers: [],
  boards: defaultBoards, // Use default boards as fallback
  leadSources: defaultLeadSources,
  appointments: [],
  invoices: [],
  automations: [],
  suppliers: [],
  materialOrders: [],
  estimates: [],
  projects: [],
  workOrders: [],
  sidebarCollapsed: false,
  searchQuery: '',
  filterStatus: 'all',
  filterAssignee: 'all',
  showQuickAdd: false,
  showInvoiceModal: false,
  selectedInvoiceId: null,
  isLoading: true,
  isInitialized: false,
  notifications: [],
};

function buildFallbackAvatar(firstName?: string, lastName?: string, email?: string) {
  const avatarName = `${firstName || ''} ${lastName || ''}`.trim() || email || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=random`;
}

// View Router Component
function ViewRouter() {
  const { state } = React.useContext(CRMContext)!;

  // Wrap each view in Suspense for lazy loading
  const renderView = () => {
    switch (state.currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'pipeline':
        return <PipelineBoard />;
      case 'contacts':
        return <ContactList />;
      case 'contact-detail':
        return <ContactDetail />;
      case 'communications':
        return <CommunicationHub />;
      case 'calendar':
        return <CalendarView />;
      case 'documents':
        return <DocumentCenter />;
      case 'financial':
        return <FinancialDashboard />;
      case 'team':
        return <TeamView />;
      case 'automations':
        return <AutomationsView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'estimates':
        return <EstimatesView />;
      case 'projects':
        return <ProjectsView />;
      case 'work-orders':
        return <WorkOrdersView />;
      case 'material-orders':
        return <MaterialOrdersView />;
      case 'expenses':
        return <ExpenseTracker />;
      case 'document-templates':
        return <DocumentTemplates />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'settings':
        return <SettingsView />;
      case 'ai-assistant':
        return <AIAssistant />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Suspense fallback={<ViewLoadingFallback />}>
      {renderView()}
    </Suspense>
  );
}

// Loading fallback for lazy-loaded views
function ViewLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={32} />
        <p className="text-sm text-muted-foreground">Loading view...</p>
      </div>
    </div>
  );
}

// Loading Screen
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">614 Restore CRM</h1>
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading your data...</span>
        </div>
      </div>
    </div>
  );
}

// Helper function to convert DB contact to app contact
function dbContactToAppContact(dbContact: any): Contact {
  return {
    id: dbContact.id,
    firstName: dbContact.first_name,
    lastName: dbContact.last_name,
    email: dbContact.email || '',
    phone1: dbContact.phone1 || '',
    phone2: dbContact.phone2,
    address: dbContact.address || '',
    city: dbContact.city || '',
    state: dbContact.state || '',
    zip: dbContact.zip || '',
    status: dbContact.status,
    leadSource: dbContact.lead_source || '',
    assignedTo: dbContact.assigned_to || '',
    createdAt: dbContact.created_at,
    updatedAt: dbContact.updated_at,
    tags: dbContact.tags || [],
    insuranceCompany: dbContact.insurance_company,
    policyNumber: dbContact.policy_number,
    claimNumber: dbContact.claim_number,
    adjusterName: dbContact.adjuster_name,
    adjusterPhone: dbContact.adjuster_phone,
    adjusterEmail: dbContact.adjuster_email,
    deductible: dbContact.deductible,
    projectType: dbContact.project_type,
    projectValue: dbContact.project_value,
    depositAmount: dbContact.deposit_amount,
    depositPaid: dbContact.deposit_paid,
    depositDate: dbContact.deposit_date,
    finalPaymentAmount: dbContact.final_payment_amount,
    finalPaymentPaid: dbContact.final_payment_paid,
    finalPaymentDate: dbContact.final_payment_date,
    isRetail: dbContact.is_retail,
    retailNotes: dbContact.retail_notes,
    notes: dbContact.notes,
    communications: [],
  };
}

function dbCommunicationToAppCommunication(dbCommunication: any, fallbackUserName: string): Communication {
  return {
    id: dbCommunication.id,
    contactId: dbCommunication.contact_id,
    type: dbCommunication.type,
    direction: dbCommunication.direction,
    subject: dbCommunication.subject,
    content: dbCommunication.content,
    timestamp: dbCommunication.created_at,
    userId: dbCommunication.user_id || '',
    userName: fallbackUserName,
  };
}

// Helper function to convert DB appointment to app appointment
function dbAppointmentToAppAppointment(dbAppointment: any, contacts: Contact[]): Appointment {
  const contact = contacts.find(c => c.id === dbAppointment.contact_id);

  let date = dbAppointment.date;
  let time = dbAppointment.time;
  let duration = dbAppointment.duration;

  if ((!date || !time) && dbAppointment.start_time) {
    const start = new Date(dbAppointment.start_time);
    const end = dbAppointment.end_time ? new Date(dbAppointment.end_time) : null;

    date = start.toISOString().split('T')[0];
    time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    if (!duration) {
      duration =
        end && !Number.isNaN(end.getTime())
          ? Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60)))
          : 60;
    }
  }

  return {
    id: dbAppointment.id,
    contactId: dbAppointment.contact_id,
    contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown',
    title: dbAppointment.title,
    type: dbAppointment.type,
    date: date || new Date().toISOString().split('T')[0],
    time: time || '09:00',
    duration: duration || 60,
    assignedTo: dbAppointment.assigned_to || '',
    location: dbAppointment.location || '',
    notes: dbAppointment.notes,
    status: dbAppointment.status,
  };
}

// Helper function to convert DB invoice to app invoice
function dbInvoiceToAppInvoice(dbInvoice: any, contacts: Contact[]): Invoice {
  const contact = contacts.find(c => c.id === dbInvoice.contact_id);
  return {
    id: dbInvoice.id,
    contactId: dbInvoice.contact_id,
    contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown',
    jobId: dbInvoice.job_id || '',
    amount: dbInvoice.amount,
    status: dbInvoice.status,
    dueDate: dbInvoice.due_date || '',
    createdAt: dbInvoice.created_at,
    paidAt: dbInvoice.paid_at,
    items: [], // Items loaded separately if needed
  };
}

// CRM App (authenticated view)
function CRMApp() {
  const { profile, user } = useAuth();
  const [state, dispatch] = useReducer(crmReducer, initialState);
  const realtimeFailedRef = useRef(false);
  const isReloadingRef = useRef(false);
  const queuedReloadRef = useRef(false);

  // Load data from database
  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!profile?.company_id) {
      // No company yet - just mark as not loading, don't initialize with empty data yet
      if (!silent) {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
      return;
    }

    if (!silent) {
      dispatch({ type: 'SET_LOADING', payload: true });
    }
    dispatch({ type: 'SET_COMPANY_ID', payload: profile.company_id });

    try {
      // Load all data in parallel
      console.log('[CRM] Loading data from database for company:', profile.company_id);
      const [
        dbContacts,
        dbCommunications,
        dbAppointments,
        dbInvoices,
        dbBoards,
        dbLeadSources,
        dbAutomations,
        dbTeamMembers,
      ] = await Promise.all([
        db.getContacts(profile.company_id),
        db.getCommunications(profile.company_id),
        db.getAppointments(profile.company_id),
        db.getInvoices(profile.company_id),
        db.getKanbanBoards(profile.company_id),
        db.getLeadSources(profile.company_id),
        db.getAutomations(profile.company_id),
        db.getTeamMembers(profile.company_id),
      ]);

      // Convert DB contacts to app contacts
      console.log('[CRM] Loaded contacts from database:', dbContacts.length);
      const contacts = dbContacts.map(dbContactToAppContact);

      // Attach communications to contacts
      const communicationsByContact = (dbCommunications || []).reduce((acc, comm) => {
        if (!acc[comm.contact_id]) {
          acc[comm.contact_id] = [];
        }
        acc[comm.contact_id].push(comm);
        return acc;
      }, {} as Record<string, any[]>);

      const enrichedContacts = contacts.map((contact) => {
        const comms = communicationsByContact[contact.id] || [];
        return {
          ...contact,
          communications: comms.map((comm) => dbCommunicationToAppCommunication(comm, 'Team Member')),
        };
      });

      // Convert DB appointments to app appointments
      const appointments = dbAppointments.map(apt => dbAppointmentToAppAppointment(apt, enrichedContacts));

      // Convert DB invoices to app invoices
      const invoices = dbInvoices.map(inv => dbInvoiceToAppInvoice(inv, enrichedContacts));

      // Convert DB boards to app boards (with columns)
      const boards: KanbanBoard[] = dbBoards.length > 0 
        ? await Promise.all(dbBoards.map(async (board) => {
            const result = await db.getKanbanBoardWithColumns(board.id);
            return {
              id: board.id,
              name: board.name,
              type: board.type as any,
              visibleTo: board.visible_to as any[],
              createdBy: board.created_by || '',
              isDefault: board.is_default,
              columns: result?.columns.map(col => ({
                id: col.id,
                title: col.title,
                status: col.status as any,
                color: col.color,
                order: col.sort_order,
              })) || [],
            };
          }))
        : defaultBoards;

      // Convert DB lead sources to app lead sources
      const leadSources: LeadSource[] = dbLeadSources.length > 0
        ? dbLeadSources.map(ls => ({
            id: ls.id,
            name: ls.name,
            isCustom: ls.is_custom,
            createdBy: ls.created_by,
          }))
        : defaultLeadSources;

      // Convert DB automations to app automations
      const automations: Automation[] = dbAutomations.map(auto => ({
        id: auto.id,
        name: auto.name,
        trigger: auto.trigger_event,
        action: auto.action_type,
        isActive: auto.is_active,
        createdBy: auto.created_by || '',
      }));

      // Convert DB team members to app team members
      console.log('[CRM] Raw dbTeamMembers from database:', dbTeamMembers.length, dbTeamMembers);
      const teamMembers: TeamMember[] = dbTeamMembers.map(tm => ({
        id: tm.id,
        name: `${tm.first_name || ''} ${tm.last_name || ''}`.trim() || tm.email,
        email: tm.email,
        role: (tm.role || 'sales') as any,
        avatar: tm.avatar_url || buildFallbackAvatar(tm.first_name, tm.last_name, tm.email),
        phone: tm.phone || '',
        department: tm.department || 'General',
        isActive: tm.is_active,
      }));
      console.log('[CRM] Converted teamMembers:', teamMembers.length, teamMembers);

      console.log('[CRM] Dispatching INITIALIZE_DATA with', enrichedContacts.length, 'contacts');
      dispatch({
        type: 'INITIALIZE_DATA',
        payload: {
          contacts: enrichedContacts,
          appointments,
          invoices,
          boards,
          leadSources,
          automations,
          teamMembers,
          suppliers: [],
          materialOrders: [],
          estimates: [],
          projects: [],
          workOrders: [],
        },
      });

    } catch (error) {
      console.error('Error loading CRM data:', error);
      // Show empty state on error
      dispatch({
        type: 'INITIALIZE_DATA',
        payload: {
          contacts: [],
          appointments: [],
          invoices: [],
          boards: defaultBoards,
          leadSources: defaultLeadSources,
          automations: [],
          teamMembers: [],
          suppliers: [],
          materialOrders: [],
          estimates: [],
          projects: [],
          workOrders: [],
        },
      });
    }
  }, [profile?.company_id]);

  const requestSoftReload = useCallback(() => {
    if (isReloadingRef.current) {
      queuedReloadRef.current = true;
      return;
    }

    isReloadingRef.current = true;
    void loadData({ silent: true }).finally(() => {
      isReloadingRef.current = false;
      if (queuedReloadRef.current) {
        queuedReloadRef.current = false;
        window.setTimeout(() => {
          requestSoftReload();
        }, 150);
      }
    });
  }, [loadData]);

  // Set up real-time subscriptions (skipped on static GH Pages to avoid noisy websocket failures)
  useEffect(() => {
    const realtimeDisabled =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('github.io') || import.meta.env.VITE_DISABLE_REALTIME === 'true');

    if (realtimeDisabled) return;
    if (!profile?.company_id) return;

    const channel = db.subscribeToAll(profile.company_id, {
      onContactChange: (payload) => {
        console.log('Contact change:', payload);
        if (payload.eventType === 'INSERT') {
          const newContact = dbContactToAppContact(payload.new);
          dispatch({ type: 'ADD_CONTACT', payload: newContact });
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: `notif-${Date.now()}`,
              type: 'info',
              title: 'New Contact Added',
              message: `${newContact.firstName} ${newContact.lastName} was added by a team member.`,
              timestamp: new Date().toISOString(),
              read: false,
            },
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedContact = dbContactToAppContact(payload.new);
          dispatch({ type: 'UPDATE_CONTACT', payload: updatedContact });
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'DELETE_CONTACT', payload: payload.old.id });
        }
      },
      onAppointmentChange: (payload) => {
        console.log('Appointment change:', payload);
        // Reload appointments to get contact names
        requestSoftReload();
      },
      onInvoiceChange: (payload) => {
        console.log('Invoice change:', payload);
        // Reload invoices to get contact names
        requestSoftReload();
      },
      onCommunicationChange: (payload) => {
        console.log('Communication change:', payload);
        requestSoftReload();
      },
      onLeadSourceChange: () => {
        requestSoftReload();
      },
      onBoardChange: () => {
        requestSoftReload();
      },
      onTeamMemberChange: () => {
        requestSoftReload();
      },
      onStatusChange: (status, error) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !realtimeFailedRef.current) {
          realtimeFailedRef.current = true;
          console.warn('Realtime unavailable; continuing with periodic reload fallback.', { status, error });
          // Keep fallback silent in-app; avoid noisy warning notifications for known websocket issues.
        } else if (status === 'SUBSCRIBED') {
          realtimeFailedRef.current = false;
        }
      },
    });

    return () => {
      db.unsubscribe(channel);
    };
  }, [profile?.company_id, loadData, requestSoftReload]);

  // Polling fallback when realtime websocket is unavailable.
  useEffect(() => {
    if (!profile?.company_id) return;

    const poller = window.setInterval(() => {
      if (realtimeFailedRef.current) {
        requestSoftReload();
      }
    }, 20000);

    return () => window.clearInterval(poller);
  }, [profile?.company_id, requestSoftReload]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fail-safe: avoid getting stuck on the loading screen if initial data calls stall
  useEffect(() => {
    if (!state.isLoading || state.isInitialized) return;

    const timer = window.setTimeout(() => {
      console.warn('Initial CRM data load timed out; showing app shell with empty data.');
      dispatch({
        type: 'INITIALIZE_DATA',
        payload: {
          contacts: [],
          appointments: [],
          invoices: [],
          boards: defaultBoards,
          leadSources: defaultLeadSources,
          automations: [],
          teamMembers: [],
        },
      });
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [state.isLoading, state.isInitialized]);

  // Set current user from profile
  useEffect(() => {
    if (profile) {
      const currentUser: TeamMember = {
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        email: profile.email,
        role: (profile.role || 'sales') as any,
        avatar: profile.avatar_url || buildFallbackAvatar(profile.first_name, profile.last_name, profile.email),
        phone: profile.phone || '',
        department: profile.department || 'General',
        isActive: profile.is_active !== false,
      };
      dispatch({ type: 'SET_CURRENT_USER', payload: currentUser });
    }
  }, [profile]);

  if (state.isLoading && !state.isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <CRMContext.Provider value={{ state, dispatch }}>
      <ResponsiveLayout>
        <div className="flex flex-col h-full">
          {/* Top bar only on desktop */}
          <div className="hidden md:block">
            <TopBar />
          </div>
          
          {/* Main content area */}
          <main className="flex-1 overflow-auto">
            <ViewRouter />
          </main>
        </div>
        
        {/* Modals */}
        <QuickAddModal />
        <InvoiceModal />
      </ResponsiveLayout>
    </CRMContext.Provider>
  );
}

// Auth Gate - shows login or CRM based on auth state
function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return <CRMApp />;
}

// Main App Layout with Auth Provider
export default function AppLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
