import React, { useReducer, useEffect, useCallback, useRef, Suspense, lazy, useState } from 'react';
import { CRMContext, crmReducer, CRMState, ViewType } from '@/lib/crmStore';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { PermissionProvider } from '@/lib/permissions/PermissionProvider';
import { db, DbCompany } from '@/lib/database';
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
  Estimate,
} from '@/lib/crmData';
import { runStaleLeadDetection, detectAndNotifyUnassignedContacts } from '@/lib/staleLeadDetection';

// Import core components (needed immediately)
import Sidebar from './crm/Sidebar';
import TopBar from './crm/TopBar';
import AuthPage from './crm/AuthPage';
import UpdatePassword from '@/pages/UpdatePassword';
import QuickAddModal from './crm/QuickAddModal';
import InvoiceModal from './crm/InvoiceModal';
import ResponsiveLayout from './mobile/ResponsiveLayout';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Building2, Loader2, Zap, X, Tag } from 'lucide-react';

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
const InsuranceTrackingView = lazy(() => import('./crm/InsuranceTrackingView'));
const SupplementTrackingView = lazy(() => import('./crm/SupplementTrackingView'));
const CrewScheduleView = lazy(() => import('./crm/CrewScheduleView'));
const EquipmentView = lazy(() => import('./crm/EquipmentView'));
const CommissionPayrollView = lazy(() => import('./crm/CommissionPayrollView'));

// --- LocalStorage data cache (stale-while-revalidate) ---
const DATA_CACHE_KEY = 'crm_app_data_v1';
const DATA_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function readDataCache(companyId: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return null;
    const { v, cid, ts, data } = JSON.parse(raw);
    if (v !== 1 || cid !== companyId || Date.now() - ts > DATA_CACHE_TTL) return null;
    return data as Record<string, unknown>;
  } catch { return null; }
}

function writeDataCache(companyId: string, data: unknown): void {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ v: 1, cid: companyId, ts: Date.now(), data }));
  } catch { /* quota exceeded or private browsing — silently skip */ }
}

// Initial CRM state (completely empty)
const getInitialView = (): ViewType => {
  try {
    const saved = localStorage.getItem('crm_current_view');
    if (saved) return saved as ViewType;
  } catch (e) { console.warn('[AppLayout] sessionStorage read failed (private browsing?):', e); }
  return 'dashboard';
};

const initialState: CRMState = {
  currentUser: null,
  companyId: null,
  currentView: getInitialView(),
  selectedContactId: null,
  selectedBoardId: 'board-retail',
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
  invoiceModalPrefill: null,
  pendingAppointmentContactId: null,
  isLoading: true,
  isInitialized: false,
  notifications: [],
  documentTemplates: [],
  companyGoals: [],
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
      case 'insurance-tracking':
        return <InsuranceTrackingView />;
      case 'supplement-tracking':
        return <SupplementTrackingView />;
      case 'crew-schedule':
        return <CrewScheduleView />;
      case 'equipment':
        return <EquipmentView />;
      case 'commission-payroll':
        return <CommissionPayrollView />;
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
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Spotlight effect */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,170,80,0.18) 0%, transparent 70%)'
      }} />
      {/* Dark vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)'
      }} />

      <div className="relative text-center flex flex-col items-center">
        {/* Shield logo */}
        <img
          src="/trussctr-logo-shield.png"
          alt="TrussCTR Logo"
          className="w-56 h-56 object-contain mb-6 drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 0 32px rgba(212,170,80,0.35))' }}
        />

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-white tracking-wide mb-1"
            style={{ textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>
          TrussCTR Web&nbsp;
          <span className="text-yellow-400">•</span>
          &nbsp;v1.0
        </h1>

        {/* Loader */}
        <div className="flex items-center justify-center gap-2 mt-4 text-slate-400">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm tracking-wider uppercase">Loading your data...</span>
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
    statusChangedAt: dbContact.status_changed_at,
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

// Trial banner shown when subscription_status is 'trialing'
// Days 1-7: shows 50% off launch offer with promo code
// Days 1-3 of trial (>11 days left on 14-day trial): emphasise urgency
const LAUNCH_PROMO_CODE = 'LAUNCH50';
const BILLING_SETTINGS_VIEW = 'billing';

function TrialBanner({ companyId }: { companyId: string | null }) {
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    db.getCompany(companyId).then((c) => { if (c) setCompany(c); });
  }, [companyId]);

  if (dismissed || !company) return null;
  if (company.subscription_status !== 'trialing') return null;
  if (!company.trial_ends_at) return null;

  const trialEndMs = new Date(company.trial_ends_at).getTime();
  const daysLeft = Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return null;

  // Show discount offer during first 7 days of trial (trial days 1-7 = >7 days left on 14-day trial)
  const showDiscount = daysLeft > 7;
  // Show urgency warning last 7 days
  const showUrgency = daysLeft <= 7;

  const handleCopy = () => {
    navigator.clipboard.writeText(LAUNCH_PROMO_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (showDiscount) {
    return (
      <div className="flex items-center justify-between gap-3 bg-indigo-600 px-4 py-2 text-sm text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            <strong>Launch offer:</strong> Get <strong>50% off your first 3 months</strong> on any <strong>monthly</strong> plan — subscribe within your trial week.
          </span>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center gap-1 bg-white/20 hover:bg-white/30 border border-white/40 rounded px-2 py-0.5 text-xs font-mono font-bold transition-colors"
            title="Copy promo code"
          >
            {copied ? '✓ Copied!' : LAUNCH_PROMO_CODE}
          </button>
          <span className="text-white/70 text-xs flex-shrink-0">Enter at checkout → Billing</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (showUrgency) {
    return (
      <div className="flex items-center justify-between gap-3 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span>
            Your free trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>.{' '}
            Use code at checkout for <strong>50% off 3 months</strong> (monthly plans only).
          </span>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center gap-1 bg-yellow-200 hover:bg-yellow-300 border border-yellow-400 rounded px-2 py-0.5 text-xs font-mono font-bold transition-colors"
            title="Copy promo code"
          >
            {copied ? '✓ Copied!' : LAUNCH_PROMO_CODE}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded hover:bg-yellow-100 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
}

// CRM App (authenticated view)
function CRMApp() {
  const { profile, user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(crmReducer, initialState);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('crm_current_view', state.currentView); } catch (e) { console.warn('[AppLayout] localStorage write failed (private browsing?):', e); }
  }, [state.currentView]);
  const realtimeFailedRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);
  const isReloadingRef = useRef(false);
  const queuedReloadRef = useRef(false);
  const lastHiddenAtRef = useRef<number>(0);

  // Race a DB fetch against a per-query timeout; resolves to fallback on timeout instead of
  // blocking the whole Promise.all. Prevents a single slow Supabase query from stalling the UI.
  const withFetchTimeout = <T,>(p: Promise<T>, fallback: T, ms = 7000): Promise<T> =>
    Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

  // Load data from database
  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!profile?.company_id) {
      // profile.company_id not yet available — keep the loading screen up.
      // The LoadingScreen is now also shown while !profile?.company_id, so we
      // don't need to dispatch SET_LOADING: false here. Dispatching it too early
      // caused a blank-contacts flash before the profile arrived.
      return;
    }

    dispatch({ type: 'SET_COMPANY_ID', payload: profile.company_id });

    // Serve cached data immediately so the UI isn't blank while fresh data loads.
    // On the first-ever load (no cache) we show the loading screen as before.
    const cached = !silent ? readDataCache(profile.company_id) : null;
    if (cached) {
      dispatch({ type: 'INITIALIZE_DATA', payload: cached as any });
      // Don't show the loading screen — continue fetching fresh data silently.
    } else if (!silent) {
      dispatch({ type: 'SET_LOADING', payload: true });
    }

    try {
      // Load all data in parallel (including company to pre-warm cache for Sidebar)
      // Each query is individually capped at 7 s to prevent a single slow call from
      // blocking the entire load; timed-out queries fall back to their empty value.
      const [
        dbContacts,
        dbCommunications,
        dbAppointments,
        dbInvoices,
        dbBoards,
        dbLeadSources,
        dbAutomations,
        dbTeamMembers,
        , // getCompany result — pre-warm only, not used directly
        dbEstimates,
        dbProjects,
        dbWorkOrders,
        dbSuppliers,
        dbMaterialOrders,
      ] = await Promise.all([
        withFetchTimeout(db.getContacts(profile.company_id), []),
        withFetchTimeout(db.getCommunications(profile.company_id), []),
        withFetchTimeout(db.getAppointments(profile.company_id), []),
        withFetchTimeout(db.getInvoices(profile.company_id), []),
        withFetchTimeout(db.getKanbanBoards(profile.company_id), []),
        withFetchTimeout(db.getLeadSources(profile.company_id), []),
        withFetchTimeout(db.getAutomations(profile.company_id), []),
        withFetchTimeout(db.getTeamMembers(profile.company_id), []),
        withFetchTimeout(db.getCompany(profile.company_id), null), // pre-warm company cache
        withFetchTimeout(db.getEstimates(profile.company_id), []),
        withFetchTimeout(db.getProjects(profile.company_id), []),
        withFetchTimeout(db.getWorkOrders(profile.company_id), []),
        withFetchTimeout(db.getSuppliers(profile.company_id), []),
        withFetchTimeout(db.getMaterialOrders(profile.company_id), []),
      ]);

      // Convert DB contacts to app contacts
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

        // Derive inspection state from the appointments for this contact
        const contactInspections = (dbAppointments || []).filter(
          (a) => a.contact_id === contact.id && a.type === 'inspection'
        );
        const hasScheduledInspection = contactInspections.some(
          (a) => a.status === 'scheduled' || a.status === 'confirmed'
        );
        const hasCompletedInspection = contactInspections.some(
          (a) => a.status === 'completed'
        );
        // Pick the most relevant inspection (completed first, then earliest scheduled)
        const scheduledInspection = contactInspections.find(
          (a) => a.status === 'scheduled' || a.status === 'confirmed'
        );
        const completedInspection = contactInspections.find(
          (a) => a.status === 'completed'
        );

        return {
          ...contact,
          communications: comms.map((comm) => dbCommunicationToAppCommunication(comm, 'Team Member')),
          inspectionScheduled: hasScheduledInspection || hasCompletedInspection,
          inspectionDate: scheduledInspection?.date || completedInspection?.date || undefined,
          inspectionCompleted: hasCompletedInspection,
          inspectionCompletedDate: completedInspection?.date || undefined,
          inspectionNotes: (completedInspection?.notes || scheduledInspection?.notes) || undefined,
        };
      });

      // Convert DB appointments to app appointments
      const appointments = dbAppointments.map(apt => dbAppointmentToAppAppointment(apt, enrichedContacts));

      // Convert DB invoices to app invoices
      const invoices = dbInvoices.map(inv => dbInvoiceToAppInvoice(inv, enrichedContacts));

      // Convert DB boards to app boards (with columns)
      // Each getKanbanBoardWithColumns call is individually capped at 6 s so a slow
      // Supabase cold-start on a board column query can't stall the whole loadData.
      const boards: KanbanBoard[] = dbBoards.length > 0
        ? await Promise.all(dbBoards.map(async (board) => {
            const result = await withFetchTimeout(
              db.getKanbanBoardWithColumns(board.id),
              null,
              6000
            );
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
            isActive: true,
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
        messageBody: (auto as any).message_body || undefined,
        triggerDelayHours: (auto as any).trigger_delay_hours || undefined,
      }));

      // Convert DB team members to app team members
      const teamMembers: TeamMember[] = dbTeamMembers.map(tm => ({
        id: tm.id,
        name: `${tm.first_name || ''} ${tm.last_name || ''}`.trim() || tm.email,
        email: tm.email,
        role: (tm.role || 'sales') as any,
        avatar: tm.avatar_url || buildFallbackAvatar(tm.first_name, tm.last_name, tm.email),
        phone: tm.phone || '',
        department: tm.department || 'General',
        isActive: tm.is_active,
        commission_rate: tm.commission_rate,
        commission_rate_self_gen: tm.commission_rate_self_gen,
        commission_rate_company: tm.commission_rate_company,
        commission_rate_custom: tm.commission_rate_custom,
        member_type: tm.member_type,
        subcontractor_company: tm.subcontractor_company,
      }));

      const estimates: Estimate[] = (dbEstimates || []).map((e: any) => ({
        id: e.id,
        contactId: e.contact_id,
        contactName: (() => { const _c = enrichedContacts.find(c => c.id === e.contact_id); return _c ? `${_c.firstName} ${_c.lastName}`.trim() : ''; })(),
        jobId: e.job_id,
        estimateNumber: e.estimate_number,
        title: e.title,
        description: e.description,
        status: e.status,
        amount: Number(e.subtotal || e.amount || 0),
        tax: Number(e.tax || 0),
        total: Number(e.total || 0),
        validUntil: e.valid_until || e.validity_date,
        createdAt: e.created_at,
        sentAt: e.sent_at,
        viewedAt: e.viewed_at,
        acceptedAt: e.accepted_at,
        declinedAt: e.declined_at,
        signedBy: e.signed_by,
        signatureData: e.signature_data,
        items: e.items || [],
        terms: e.terms || e.terms_and_conditions,
        notes: e.notes,
        createdBy: e.created_by,
        updatedAt: e.updated_at,
      }));

      const projects = (dbProjects || []).map((p: any) => ({
        id: p.id,
        projectNumber: p.project_number,
        name: p.name,
        contactId: p.contact_id,
        contactName: (() => { const _c = enrichedContacts.find(c => c.id === p.contact_id); return _c ? `${_c.firstName} ${_c.lastName}`.trim() : ''; })(),
        estimateId: p.estimate_id,
        description: p.description,
        status: p.status,
        priority: p.priority,
        startDate: p.start_date,
        endDate: p.end_date,
        completedDate: p.completed_date,
        estimatedBudget: Number(p.estimated_budget || 0),
        actualCost: Number(p.actual_cost || 0),
        materialCostGoal: Number(p.material_cost_goal || 0),
        subcontractorCostGoal: Number(p.subcontractor_cost_goal || 0),
        salesRepPayGoal: Number(p.labor_cost_goal || 0),
        otherExpensesGoal: Number(p.other_cost_goal || 0),
        actualMaterialCost: Number(p.material_cost || 0),
        actualSubcontractorCost: Number(p.subcontractor_cost || 0),
        actualSalesRepPay: Number(p.labor_cost || 0),
        actualOtherExpenses: Number(p.other_cost || 0),
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        projectManagerId: p.project_manager_id,
        projectManagerName: '',
        notes: p.notes,
        tags: p.tags || [],
        createdBy: p.created_by,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      const workOrders = (dbWorkOrders || []).map((wo: any) => ({
        id: wo.id,
        workOrderNumber: wo.work_order_number,
        projectId: wo.project_id,
        projectName: projects.find((p: any) => p.id === wo.project_id)?.name || '',
        contactId: wo.contact_id,
        contactName: (() => { const _c = enrichedContacts.find(c => c.id === wo.contact_id); return _c ? `${_c.firstName} ${_c.lastName}`.trim() : ''; })(),
        title: wo.title,
        description: wo.description,
        status: wo.status,
        priority: wo.priority,
        scheduledDate: wo.scheduled_date,
        startedAt: wo.started_at,
        completedAt: wo.completed_at,
        assignedTo: wo.assigned_to || [],
        assignedToNames: [],
        estimatedHours: wo.estimated_hours ? Number(wo.estimated_hours) : undefined,
        actualHours: wo.actual_hours ? Number(wo.actual_hours) : undefined,
        laborCost: Number(wo.labor_cost || 0),
        materialCost: Number(wo.material_cost || 0),
        totalCost: Number(wo.total_cost || 0),
        address: wo.address,
        city: wo.city,
        state: wo.state,
        zip: wo.zip,
        notes: wo.notes,
        attachments: wo.attachments || [],
        checklistItems: wo.checklist_items || [],
        createdBy: wo.created_by,
        createdAt: wo.created_at,
        updatedAt: wo.updated_at,
      }));

      const suppliers = (dbSuppliers || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        contactName: s.contact_name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        state: s.state,
        zip: s.zip,
        website: s.website,
        accountNumber: s.account_number,
        paymentTerms: s.payment_terms,
        notes: s.notes,
        isActive: s.is_active,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));

      const materialOrders = (dbMaterialOrders || []).map((mo: any) => ({
        id: mo.id,
        orderNumber: mo.order_number || '',
        supplierId: mo.supplier_id,
        supplierName: suppliers.find((s: any) => s.id === mo.supplier_id)?.name || '',
        contactId: mo.contact_id,
        projectId: mo.project_id || mo.job_id,
        jobId: mo.job_id || mo.project_id,
        status: mo.status,
        orderDate: mo.order_date,
        expectedDeliveryDate: mo.expected_delivery_date,
        actualDeliveryDate: mo.actual_delivery_date,
        subtotal: Number(mo.subtotal || mo.total_cost || 0),
        tax: Number(mo.tax || 0),
        shipping: Number(mo.shipping || 0),
        total: Number(mo.total || mo.total_cost || 0),
        items: [],
        notes: mo.notes,
        createdBy: mo.created_by,
        createdAt: mo.created_at,
        updatedAt: mo.updated_at,
      }));

      const freshPayload = {
        contacts: enrichedContacts,
        appointments,
        invoices,
        boards,
        leadSources,
        automations,
        teamMembers,
        suppliers,
        materialOrders,
        estimates,
        projects,
        workOrders,
        documentTemplates: [],
        companyGoals: [],
      };

      dispatch({ type: 'INITIALIZE_DATA', payload: freshPayload });

      // Persist to localStorage so next refresh shows data instantly
      writeDataCache(profile.company_id, freshPayload);

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
          documentTemplates: [],
          companyGoals: [],
        },
      });
    }
  }, [profile?.company_id, authLoading]);

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
        // Reload appointments to get contact names
        requestSoftReload();
      },
      onInvoiceChange: (payload) => {
        // Reload invoices to get contact names
        requestSoftReload();
      },
      onCommunicationChange: (payload) => {
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
          // Remove the channel entirely to stop Supabase from retrying the WebSocket connection.
          if (realtimeChannelRef.current) {
            db.unsubscribe(realtimeChannelRef.current);
            realtimeChannelRef.current = null;
          }
        } else if (status === 'SUBSCRIBED') {
          realtimeFailedRef.current = false;
        }
      },
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        db.unsubscribe(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
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

// Load data whenever company_id becomes available (fires on mount AND when profile arrives late)
useEffect(() => {
  if (authLoading || !profile?.company_id) return;
  loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile?.company_id, authLoading]);

  // Track idle time and reload data when the tab regains focus.
  // Only reload after the tab has been hidden for >5 min so that brief
  // context switches (e.g. copy-pasting an address, checking a text) never
  // interrupt an active editing session (template editor, note, form, etc.).
  // After >30 min dormant, also re-validate the auth session before refreshing.
  useEffect(() => {
    if (!profile?.company_id) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const idleMs = lastHiddenAtRef.current ? Date.now() - lastHiddenAtRef.current : 0;
        // Skip reload for brief tab switches — anything under 5 minutes is noise
        if (idleMs < 5 * 60 * 1000) return;

        if (idleMs > 30 * 60 * 1000) {
          // Dormant >30 min — re-validate session first, then reload
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) requestSoftReload();
            // No session → onAuthStateChange listener handles sign-out automatically
          });
        } else {
          // Dormant 5–30 min — refresh data but skip session re-check
          requestSoftReload();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [profile?.company_id, requestSoftReload]);

  // Keep the Supabase auth token alive during long page sessions.
  // Supabase auto-refreshes tokens, but this ensures we catch silent expiry.
  useEffect(() => {
    const interval = window.setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && profile?.company_id) {
        await supabase.auth.signOut();
      }
    }, 10 * 60 * 1000); // every 10 minutes
    return () => window.clearInterval(interval);
  }, [profile?.company_id]);

  // Fail-safe: avoid getting stuck on the loading screen if initial data calls stall
  useEffect(() => {
    if (!state.isLoading || state.isInitialized) return;
    // Don't start the timeout until auth has finished loading
    if (authLoading) return;

    const timer = window.setTimeout(() => {
      console.warn('Initial CRM data load timed out after 8 s; showing app shell with empty data.');
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
          documentTemplates: [],
          companyGoals: [],
        },
      });
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [state.isLoading, state.isInitialized, authLoading]);

  // Check subscription status after data loads — enforce paywall on expired/canceled accounts
  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id).then((company) => {
      if (!company) return;
      const trialExpired =
        company.subscription_status === 'trialing' &&
        !!company.trial_ends_at &&
        new Date(company.trial_ends_at) < new Date();
      const blocked =
        trialExpired ||
        company.subscription_status === 'canceled' ||
        company.subscription_status === 'past_due';
      setSubscriptionBlocked(blocked);
    });
  }, [profile?.company_id]);

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

  // Automatic stale lead detection system
  useEffect(() => {
    if (!profile?.company_id || !state.isInitialized) return;

    let staleLeadTimer: NodeJS.Timeout;
    let unassignedTimer: NodeJS.Timeout;

    // Run initial detection after app loads (delay to avoid blocking startup)
    const initialDelay = setTimeout(() => {
      console.log('[StaleLeads] Running initial stale lead detection...');
      
      // Run stale lead detection immediately
      runStaleLeadDetection(profile.company_id).catch(error => {
        console.warn('[StaleLeads] Initial stale lead detection failed:', error);
      });

      // Run unassigned contact detection
      detectAndNotifyUnassignedContacts(profile.company_id).catch(error => {
        console.warn('[UnassignedContacts] Initial unassigned contact detection failed:', error);
      });

      // Set up recurring intervals
      // Stale lead detection every 4 hours
      staleLeadTimer = setInterval(() => {
        console.log('[StaleLeads] Running scheduled stale lead detection...');
        runStaleLeadDetection(profile.company_id).catch(error => {
          console.warn('[StaleLeads] Scheduled stale lead detection failed:', error);
        });
      }, 4 * 60 * 60 * 1000); // 4 hours

      // Unassigned contact detection every 2 hours 
      unassignedTimer = setInterval(() => {
        console.log('[UnassignedContacts] Running scheduled unassigned contact detection...');
        detectAndNotifyUnassignedContacts(profile.company_id).catch(error => {
          console.warn('[UnassignedContacts] Scheduled unassigned contact detection failed:', error);
        });
      }, 2 * 60 * 60 * 1000); // 2 hours

    }, 10000); // 10 second delay after app initialization

    return () => {
      clearTimeout(initialDelay);
      if (staleLeadTimer) clearInterval(staleLeadTimer);
      if (unassignedTimer) clearInterval(unassignedTimer);
    };
  }, [profile?.company_id, state.isInitialized]);

  // Keep the loading screen visible while:
  // 1. CRM data is still being fetched (isLoading, not yet initialized), OR
  // 2. Auth finished but profile.company_id hasn't arrived yet (prevents blank-contacts flash).
  //    The 12s auth timeout in authContext is the outer safety net.
  if ((state.isLoading && !state.isInitialized) || (!profile?.company_id && !state.isInitialized)) {
    return <LoadingScreen />;
  }

  if (subscriptionBlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Subscription Required</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your free trial has ended. Subscribe to continue using TrussCTR.
            Use code <strong className="font-mono text-indigo-600">LAUNCH50</strong> for 50% off your first 3 months on any monthly plan.
          </p>
          <button
            onClick={() => {
              setSubscriptionBlocked(false);
              dispatch({ type: 'SET_VIEW', payload: 'settings' });
              // Navigate to billing tab after SettingsView mounts
              window.setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('crm-open-settings-tab', { detail: { tab: 'billing' } })
                );
              }, 50);
              // Re-verify subscription status after a short delay to prevent long-term bypass
              window.setTimeout(() => {
                if (profile?.company_id) {
                  db.getCompany(profile.company_id).then((company) => {
                    if (!company) return;
                    const isBlocked =
                      company.subscription_status === 'canceled' ||
                      company.subscription_status === 'past_due' ||
                      (company.subscription_status === 'trialing' &&
                        !!company.trial_ends_at &&
                        new Date(company.trial_ends_at) < new Date());
                    setSubscriptionBlocked(isBlocked);
                  });
                }
              }, 5000);
            }}
            className="inline-block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
          >
            Subscribe Now
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Already subscribed?{' '}
            <button
              onClick={() => window.location.reload()}
              className="text-indigo-500 hover:underline"
            >
              Refresh to continue
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <CRMContext.Provider value={{ state, dispatch }}>
      <ResponsiveLayout>
        <div className="flex flex-col h-full">
          {/* Top bar only on desktop */}
          <div className="hidden md:block">
            <TopBar />
          </div>

          {/* Trial banner (shown when trial ends within 7 days) */}
          <TrialBanner companyId={profile?.company_id ?? state.companyId ?? null} />
          
          {/* Main content area */}
          <main className="flex-1 min-h-0 overflow-auto">
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
  const { session, loading, isPasswordReset } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthPage />;
  }

  if (isPasswordReset) {
    return <UpdatePassword />;
  }

  return <CRMApp />;
}

// Main App Layout with Auth Provider
export default function AppLayout() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <AuthGate />
      </PermissionProvider>
    </AuthProvider>
  );
}
