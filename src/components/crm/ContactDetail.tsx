import React, { useEffect, useMemo, useRef, useState } from 'react';
import { consumePendingContactTab, getNextStepForStatus, type NextStep } from '@/lib/nextStepActions';

// ── Schedule-data helpers ──────────────────────────────────────────────────
// The mobile app serialises milestone data into the notes field using the
// format: [TRUSSCTR_SCHEDULE]{json}\n\nplain notes
// The web app should strip that prefix before displaying or editing notes,
// and restore it when saving so mobile data is not lost.
const TRUSSCTR_SCHEDULE_PREFIX = '[TRUSSCTR_SCHEDULE]';

function stripSchedulePrefix(notes: string | null | undefined): string {
  if (!notes) return '';
  if (!notes.startsWith(TRUSSCTR_SCHEDULE_PREFIX)) return notes;
  const brk = notes.indexOf('\n\n');
  return brk === -1 ? '' : notes.slice(brk + 2);
}

function rebuildWithSchedulePrefix(original: string | null | undefined, newPlainNotes: string): string {
  if (!original?.startsWith(TRUSSCTR_SCHEDULE_PREFIX)) return newPlainNotes;
  const brk = original.indexOf('\n\n');
  const prefix = brk === -1 ? original : original.slice(0, brk);
  return `${prefix}\n\n${newPlainNotes.trim()}`;
}
// ──────────────────────────────────────────────────────────────────────────
import { useCRM, useCurrentContact } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { quoteValue, toQuoteSummary, type QuoteSummary } from '@/lib/crmData';
import { formatPhoneNumber } from '@/lib/utils';
import JobStatusTimeline from './JobStatusTimeline';
import CustomerSurvey from './CustomerSurvey';
import AppointmentModal from './AppointmentModal';
import ContactTemplateModal from './ContactTemplateModal';
import ChangeOrderModal, { ChangeOrder } from './ChangeOrderModal';
import HailTracePanel from './HailTracePanel';
import { openLiveRadar } from '@/lib/stormNavigation';
import WeatherWidget from '@/components/integrations/WeatherWidget';
import EagleViewPanel from './EagleViewPanel';
import RoofrPanel from './RoofrPanel';
import InsuranceTrackingView from './InsuranceTrackingView';
import ContactInsuranceSummary from './ContactInsuranceSummary';
import SupplementTrackingView from './SupplementTrackingView';
import { PipelineStageTracker } from './PipelineStageTracker';
import {
  applyMention,
  findActiveMentionQuery,
  getMentionSuggestions,
  getMentionTargets,
  validateMentions,
} from '@/lib/mentions';
import { uploadDocument, validateDocumentFile, formatFileSize, getDocumentSignedUrl, isHttpUrl, isSupabaseStorageUrl } from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';
import { htmlStringToPdfBlob } from '@/lib/pdfService';
import { resolveDocumentSignedUrl } from '@/lib/documentAccess';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'sonner';
import {
  Contact,
  Job,
  Communication,
  Document,
  statusLabels,
  statusColors,
  formatCurrency,
  formatDate,
  formatDateTime,
  getContactFullName,
  defaultLeadSources,
  CustomerStatus,
} from '@/lib/crmData';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Save,
  X,
  Plus,
  DollarSign,
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  Briefcase,
  Clock,
  Send,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  User,
  Building,
  Tag,
  Loader2,
  Eye,
  Package,
  ClipboardList,
  Truck,
  Activity,
  Star,
  Zap,
  CloudLightning,
  Radio,
  Wind,
  RefreshCw,
  Camera,
  Folder,
  FolderOpen,
  Image,
  Copy,
} from 'lucide-react';

type TabType = 'overview' | 'timeline' | 'documents' | 'financial' | 'projects' | 'jobStatus' | 'survey' | 'insurance';

interface SignedDoc {
  id: string;
  docType: 'estimate' | 'work_order' | 'change_order';
  label: string;
  title: string;
  signedBy: string;
  signedAt: string;
  amount?: number;
  viewUrl?: string;
}

// Communication templates for quick responses
const communicationTemplates = [
  {
    id: 'initial-contact',
    title: 'Initial Contact',
    type: 'email',
    subject: 'Your Storm Damage Assessment Request',
    content: `Hi {{CUSTOMER_NAME}},

Thank you for reaching out about storm damage assessment. We understand how stressful property damage can be, and we're here to help.

Our next available inspection slot is {{INSPECTION_DATE}}. During this comprehensive assessment, we will:

- Thoroughly inspect all affected areas
- Document damage with detailed photos  
- Provide a detailed estimate for insurance
- Coordinate directly with your insurance adjuster

Please confirm this appointment time works for you. We look forward to helping restore your property.

Best regards,
{{AGENT_NAME}}`
  },
  {
    id: 'insurance-claim',
    title: 'Insurance Claim Update',
    type: 'email',
    subject: 'Insurance Claim Status Update - Claim #{{CLAIM_NUMBER}}',
    content: `Hi {{CUSTOMER_NAME}},

I wanted to update you on the progress of your insurance claim (#{{CLAIM_NUMBER}}).

Current Status: {{STATUS}}
Next Steps: {{NEXT_STEPS}}

We're working closely with {{ADJUSTER_NAME}} to ensure your claim is processed quickly and fairly. 

If you have any questions, please don't hesitate to reach out.

Best regards,
{{AGENT_NAME}}`
  },
  {
    id: 'estimate-ready',
    title: 'Estimate Ready for Review',
    type: 'email',
    subject: 'Your Storm Damage Estimate is Ready',
    content: `Hi {{CUSTOMER_NAME}},

Great news! We've completed our assessment and your storm damage estimate is ready for review.

Total Estimate: {{ESTIMATE_AMOUNT}}
Insurance Deductible: {{DEDUCTIBLE}}

The estimate has been sent to your insurance adjuster and is attached for your records. We recommend reviewing it carefully and let us know if you have any questions.

Next steps:
1. Review the estimate
2. Insurance approval process (typically 3-5 business days)
3. Schedule work commencement

Thank you for choosing us for your restoration needs.

Best regards,
{{AGENT_NAME}}`
  },
  {
    id: 'work-scheduled',
    title: 'Work Scheduled',
    type: 'sms',
    subject: '',
    content: `Hi {{CUSTOMER_NAME}}! Your roof work is scheduled to begin {{START_DATE}}. Our crew will arrive by {{START_TIME}}. Please ensure clear driveway access. Any questions? Call {{PHONE}}.`
  },
  {
    id: 'work-complete',
    title: 'Work Completion',
    type: 'email',
    subject: 'Your Roofing Project is Complete!',
    content: `Hi {{CUSTOMER_NAME}},

Excellent news! We've successfully completed your roofing project.

Project Summary:
- Start Date: {{START_DATE}}
- Completion Date: {{COMPLETION_DATE}}
- Work Performed: {{WORK_DESCRIPTION}}

Your warranty information and final photos are attached. We'll handle the final insurance paperwork and coordinate payment.

Thank you for choosing us. We're here if you need anything!

Best regards,
{{AGENT_NAME}}`
  }
];

// Same palette as QuotesView so a status reads the same in both places.
const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  signed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};


export default function ContactDetail() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const contact = useCurrentContact();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [editedContact, setEditedContact] = useState<Contact | null>(null);
  const [newNote, setNewNote] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [isSavingQuickNote, setIsSavingQuickNote] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<ReturnType<typeof getMentionTargets>>([]);
  // Notes from the shared notes table, which the mobile app writes too.
  const [teamNotes, setTeamNotes] = useState<Communication[]>([]);
  const [teamNotesVersion, setTeamNotesVersion] = useState(0);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [contactDocuments, setContactDocuments] = useState<Document[]>([]);
  const [salesFolderOpen, setSalesFolderOpen] = useState(true);
  const [fieldFolderOpen, setFieldFolderOpen] = useState(true);
  const [weatherAlerts, setWeatherAlerts] = useState<{
    alerts: Array<{
      type: string; severity: string; urgency: string; certainty: string;
      headline: string; instruction: string | null; areaDesc: string;
      onset: string; expires: string;
    }>;
    hasActiveStorm: boolean;
    location?: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [signedDocs, setSignedDocs] = useState<SignedDoc[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [viewingDocHtml, setViewingDocHtml] = useState<{ name: string; html: string } | null>(null);
  const [templateRoofrData, setTemplateRoofrData] = useState<{ measurements: any; structures?: any[] } | undefined>(undefined);

  // Project-related data
  const [contactProjects, setContactProjects] = useState<any[]>([]);
  const [contactWorkOrders, setContactWorkOrders] = useState<any[]>([]);
  const [contactMaterialOrders, setContactMaterialOrders] = useState<any[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [editingProjectInDetail, setEditingProjectInDetail] = useState<any>(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [contactChangeOrders, setContactChangeOrders] = useState<ChangeOrder[]>([]);
  const [showChangeOrderModal, setShowChangeOrderModal] = useState(false);
  const [viewingChangeOrder, setViewingChangeOrder] = useState<ChangeOrder | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateMessage, setTemplateMessage] = useState('');
  
  const [showRoofrPicker, setShowRoofrPicker] = useState(false);
  const [contactQuotes, setContactQuotes] = useState<QuoteSummary[]>([]);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Document naming dialog state
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadName, setPendingUploadName] = useState('');
  const [pendingUploadCategory, setPendingUploadCategory] = useState<'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other'>('other');
  const [showUploadNameDialog, setShowUploadNameDialog] = useState(false);

  // Avatar state
  const [contactAvatarUrl, setContactAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const mentionTargets = useMemo(() => getMentionTargets(state.teamMembers), [state.teamMembers]);
  const effectiveCompanyId = profile?.company_id || state.companyId || null;
  const contactId = contact?.id;
  const contactNotes = stripSchedulePrefix(contact?.notes);

  useEffect(() => {
    if (!contactId) return;
    setQuickNote(contactNotes);
  }, [contactId, contactNotes]);

  // When opening a contact from a "Next Step" pill, jump straight to the requested tab
  useEffect(() => {
    if (!contactId) return;
    const tab = consumePendingContactTab();
    if (tab) setActiveTab(tab as TabType);
  }, [contactId]);

  // Notes live in the shared notes table: the mobile app writes them there, and an
  // @mention in one notifies the people tagged (notify_note_mentions trigger).
  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    supabase
      .from('notes')
      .select('id, body, created_at, author_id, tags, author:team_members(full_name)')
      .eq('entity_type', 'customer')
      .eq('entity_id', contactId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[ContactDetail] notes load failed:', error.message);
          return;
        }
        setTeamNotes((data || []).map((row: any) => ({
          id: `note-${row.id}`,
          contactId,
          type: 'note' as const,
          direction: 'outbound' as const,
          content: row.body ?? '',
          timestamp: row.created_at,
          userId: row.author_id ?? '',
          userName: row.author?.full_name ?? 'Team member',
          mentions: row.tags ?? [],
        })));
      });
    return () => { cancelled = true; };
  }, [contactId, teamNotesVersion]);

  // Load contact projects, work orders, material orders and change orders
  useEffect(() => {
    const loadContactRelatedData = async () => {
      if (!contactId || !profile?.company_id) return;

      
      // Load projects for this contact
      const projects = state.projects.filter(p => p.contactId === contactId);
      setContactProjects(projects);
      
      // Load work orders for this contact
      const workOrders = state.workOrders.filter(wo => wo.contactId === contactId);
      setContactWorkOrders(workOrders);
      
      // Load material orders for this contact
      const materialOrders = state.materialOrders.filter(mo => mo.contactId === contactId);
      setContactMaterialOrders(materialOrders);

      // Load change orders for this contact
      const { data: changeOrders } = await supabase
        .from('change_orders')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      setContactChangeOrders((changeOrders as ChangeOrder[]) ?? []);
      
    };

    loadContactRelatedData();
  }, [contactId, profile?.company_id, state.projects, state.workOrders, state.materialOrders]);

  // Load contact documents and signed docs in parallel
  useEffect(() => {
    const loadContactDocuments = async () => {
      if (!contactId) {
        setContactDocuments([]);
        setSignedDocs([]);
        return;
      }

      const [docs, signedEstimates, signedWorkOrders, signedChangeOrders] = await Promise.all([
        db.getDocumentsByContact(contactId, profile?.company_id || state.companyId || ''),
        db.getSignedEstimatesByContact(contactId),
        db.getSignedWorkOrdersByContact(contactId),
        db.getSignedChangeOrdersByContact(contactId),
      ]);

      const docsWithSignedUrls = await Promise.all(
        docs.map(async (doc) => {
          const url = doc.url;
          return {
            id: doc.id,
            contactId: doc.contact_id || '',
            name: doc.name,
            type: doc.type as 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other',
            url,
            uploadedAt: doc.created_at,
            uploadedBy: doc.uploaded_by || 'Team member',
            size: doc.size || 'Unknown',
            htmlContent: doc.html_content || undefined,
          };
        })
      );

      // Handle avatar: find avatar doc, get signed URL, filter it out of visible docs
      const avatarDoc = docsWithSignedUrls.find(d => d.name === '__contact_avatar__');
      if (avatarDoc) {
        try {
          const signedUrl = await getDocumentSignedUrl(avatarDoc.url, 3600);
          setContactAvatarUrl(signedUrl);
        } catch {
          setContactAvatarUrl(null);
        }
      } else {
        setContactAvatarUrl(null);
      }
      const visibleDocs = docsWithSignedUrls.filter(d => d.name !== '__contact_avatar__');
      setContactDocuments(visibleDocs);

      const origin = window.location.origin;
      const normalized: SignedDoc[] = [
        ...signedEstimates.map(est => ({
          id: est.id,
          docType: 'estimate' as const,
          label: est.estimate_number,
          title: est.title,
          signedBy: est.signed_by || 'Customer',
          signedAt: est.accepted_at || est.updated_at,
          amount: est.total,
          viewUrl: est.sign_token
            ? `${origin}/sign?estimateId=${est.id}&token=${est.sign_token}`
            : undefined,
        })),
        ...signedWorkOrders.map(wo => ({
          id: wo.id,
          docType: 'work_order' as const,
          label: wo.work_order_number,
          title: wo.title,
          signedBy: wo.signed_by || 'Customer',
          signedAt: wo.completed_at || wo.updated_at,
          amount: wo.total_cost,
          viewUrl: undefined,
        })),
        ...signedChangeOrders.map((co: any) => ({
          id: co.id,
          docType: 'change_order' as const,
          label: co.change_order_number,
          title: co.title,
          signedBy: co.signed_by_name || 'Customer',
          signedAt: co.signed_at || co.created_at,
          amount: co.total,
          viewUrl: co.sign_token
            ? `${origin}/sign-change-order/${co.sign_token}`
            : undefined,
        })),
      ];

      normalized.sort(
        (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()
      );
      setSignedDocs(normalized);
    };

    loadContactDocuments();
  }, [contactId]);

  // NOAA weather alerts for this contact's zip code
  const fetchWeatherAlerts = async (zip: string) => {
    if (!zip || zip.trim().length < 5) return;
    setWeatherLoading(true);
    try {
      const res = await fetch('/api/eagleview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'weather', zipCode: zip.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWeatherAlerts(data);
      }
    } catch {
      // silently fail — no weather is fine
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (contact?.zip) fetchWeatherAlerts(contact.zip);
  }, [contact?.zip]);

  // Infer document category from file
  const inferCategory = (file: File): 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other' => {
    const fileName = file.name.toLowerCase();
    if (fileName.includes('contract')) return 'contract';
    if (fileName.includes('estimate')) return 'estimate';
    if (fileName.includes('invoice')) return 'invoice';
    if (file.type.startsWith('image/')) return 'photo';
    if (fileName.includes('insurance')) return 'insurance';
    return 'other';
  };

  const handleUploadDocument = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contactId) return;

    if (!effectiveCompanyId) {
      toast.error('No company context available. Please refresh and sign in again.');
      return;
    }

    const validationError = validateDocumentFile(file, 15);
    if (validationError) {
      toast.error(validationError);
      event.target.value = '';
      return;
    }

    // Strip extension for default display name
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setPendingUploadFile(file);
    setPendingUploadName(nameWithoutExt);
    setPendingUploadCategory(inferCategory(file));
    setShowUploadNameDialog(true);
    // Don't clear event.target.value here — we still hold reference to the file
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile || !contactId || !effectiveCompanyId) return;

    setIsUploadingDocument(true);
    setShowUploadNameDialog(false);

    try {
      const fileToUpload = pendingUploadFile.type.startsWith('image/')
        ? await compressImage(pendingUploadFile, { maxSide: 1600, quality: 0.85, targetBytes: 1_000_000 })
        : pendingUploadFile;
      const uploadResult = await uploadDocument(fileToUpload, effectiveCompanyId, contactId);

      if (uploadResult.error) {
        console.error('[ContactDetail] Upload failed:', uploadResult.error);
        toast.error(`Upload failed: ${uploadResult.error}`);
        return;
      }

      const created = await db.createDocument({
        company_id: effectiveCompanyId,
        contact_id: contactId,
        name: pendingUploadName || pendingUploadFile.name,
        type: pendingUploadCategory,
        url: uploadResult.path,
        size: formatFileSize(fileToUpload.size),
        uploaded_by: profile?.id,
      });

      if (!created) {
        console.error('[ContactDetail] Failed to save document record');
        toast.error('File uploaded but failed to save document record');
        return;
      }

      const newDoc: Document = {
        id: created.id,
        contactId: created.contact_id || '',
        name: created.name,
        type: created.type as 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other',
        url: created.url,
        uploadedAt: created.created_at,
        uploadedBy: created.uploaded_by || 'Team member',
        size: created.size || formatFileSize(fileToUpload.size),
      };

      setContactDocuments((prev) => [newDoc, ...prev]);
      toast.success(`${created.name} uploaded successfully!`);
    } catch (error) {
      console.error('[ContactDetail] Document upload error:', error);
      toast.error('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploadingDocument(false);
      setPendingUploadFile(null);
      setPendingUploadName('');
      setPendingUploadCategory('other');
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleCancelUploadDialog = () => {
    setShowUploadNameDialog(false);
    setPendingUploadFile(null);
    setPendingUploadName('');
    setPendingUploadCategory('other');
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contactId || !effectiveCompanyId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      event.target.value = '';
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressed = await compressImage(file, { maxSide: 1600, quality: 0.85, targetBytes: 1_000_000 });
      const uploadResult = await uploadDocument(compressed, effectiveCompanyId, contactId);
      if (uploadResult.error) {
        toast.error(`Avatar upload failed: ${uploadResult.error}`);
        return;
      }

      const created = await db.createDocument({
        company_id: effectiveCompanyId,
        contact_id: contactId,
        name: '__contact_avatar__',
        type: 'photo',
        url: uploadResult.path,
        size: formatFileSize(compressed.size),
        uploaded_by: profile?.id,
      });

      if (!created) {
        toast.error('Failed to save avatar record');
        return;
      }

      const signedUrl = await getDocumentSignedUrl(uploadResult.path, 3600);
      setContactAvatarUrl(signedUrl);
      toast.success('Profile photo updated!');
    } catch (error) {
      console.error('[ContactDetail] Avatar upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleDeleteDocument = (docId: string) => {
    toast.warning('Delete this document? This cannot be undone.', {
      action: {
        label: 'Delete',
        onClick: async () => {
          const ok = await db.deleteDocument(docId);
          if (!ok) { toast.error('Failed to delete document'); return; }
          setContactDocuments((prev) => prev.filter((doc) => doc.id !== docId));
          toast.success('Document deleted');
        },
      },
      cancel: { label: 'Cancel' },
      duration: 8000,
    });
  };

  const handleOpenDocument = async (url?: string, _docName?: string) => {
    if (!url) {
      toast.error('Document URL not available.');
      return;
    }

    // Open a blank tab immediately (within the user gesture) so the browser
    // doesn't treat the later window.open as a popup. We update its location
    // once the signed URL is ready.
    const newTab = window.open('', '_blank', 'noopener,noreferrer');

    try {
      // Non-Supabase URLs (EagleView reports, external links) — open directly
      if (isHttpUrl(url) && !isSupabaseStorageUrl(url)) {
        if (newTab) newTab.location.href = url;
        return;
      }

      // Use resolveDocumentSignedUrl — handles both legacy Supabase public URLs
      // and hash-encoded bucket/path metadata from buildStoredDocumentUrl
      const { signedUrl } = await resolveDocumentSignedUrl(url);

      if (!signedUrl) {
        if (newTab) newTab.close();
        toast.error('Unable to open document. The file may have been deleted.', { duration: 5000 });
        return;
      }

      if (newTab) {
        newTab.location.href = signedUrl;
      } else {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      if (newTab) newTab.close();
      console.error('[ContactDetail] Error opening document:', error);
      toast.error('Failed to open document: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleViewDoc = (doc: Document) => {
    if (doc.htmlContent) {
      setViewingDocHtml({ name: doc.name, html: doc.htmlContent });
    } else {
      handleOpenDocument(doc.url, doc.name);
    }
  };

  const handleDownloadDoc = async (doc: Document) => {
    if (doc.htmlContent) {
      try {
        const safeName = doc.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'document';
        const blob = await htmlStringToPdfBlob(doc.htmlContent, `${safeName}.pdf`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Failed to generate PDF for download.');
      }
    } else {
      handleOpenDocument(doc.url, doc.name);
    }
  };

  const handleLoadRoofrMeasurements = async (doc: Document) => {
    const isPdf = doc.name?.toLowerCase().endsWith('.pdf') || doc.url?.toLowerCase().includes('.pdf');
    if (!isPdf) { toast.error('Only PDF files can be read as Roofr reports'); return; }

    toast.info(`Parsing ${doc.name}…`);
    try {
      let url = doc.url;
      if (!isHttpUrl(url) || isSupabaseStorageUrl(url)) {
        const { signedUrl } = await resolveDocumentSignedUrl(url);
        if (!signedUrl) throw new Error('Could not generate a download URL for this document');
        url = signedUrl;
      }
      const { parseRoofrPDFFromUrl } = await import('@/lib/roofrParser');
      const result = await parseRoofrPDFFromUrl(url);

      const order = {
        reportId: `UPLOADED-${Date.now()}`,
        address: contact.address || '',
        reportType: 'premium',
        orderedAt: new Date().toISOString(),
        status: 'completed',
        statusMessage: result.hasMultipleStructures
          ? `${result.structures.length} structures detected`
          : `Parsed from ${doc.name}`,
        measurements: result.combinedMeasurements,
        structures: result.structures,
      };
      localStorage.setItem(`roofr_order_${contact.id}`, JSON.stringify(order));
      window.dispatchEvent(new CustomEvent('roofr-order-updated', { detail: { contactId: contact.id } }));
      toast.success('Measurements extracted — see the Roofr panel above.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to parse PDF: ${msg}`, { duration: 8000 });
    }
  };

  const handleQuoteFromDoc = async (doc: Document) => {
    setShowRoofrPicker(false);
    if (!contact) return;
    toast.info(`Parsing ${doc.name}…`);
    try {
      let url = doc.url;
      if (!isHttpUrl(url) || isSupabaseStorageUrl(url)) {
        const { signedUrl } = await resolveDocumentSignedUrl(url);
        if (!signedUrl) throw new Error('Could not generate a download URL for this document');
        url = signedUrl;
      }
      const { parseRoofrPDFFromUrl } = await import('@/lib/roofrParser');
      const { generateEstimateFromMeasurements } = await import('@/lib/roofrEstimateGenerator');
      const result = await parseRoofrPDFFromUrl(url);
      const lineItems = generateEstimateFromMeasurements(result.combinedMeasurements);
      // Hand the parsed measurements to the Quotes builder, which assigns the
      // quote number and share link itself rather than duplicating that here.
      dispatch({
        type: 'SET_PENDING_QUOTE',
        payload: {
          contactId: contact.id,
          title: `Roofr Quote — ${doc.name.replace(/\.pdf$/i, '')}`,
          items: lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unit: li.unit,
            unitPrice: li.rate,
          })),
        },
      });
      dispatch({ type: 'SET_VIEW', payload: 'quotes' });
      toast.success('Measurements loaded — review the quote and save it');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to parse PDF: ${msg}`, { duration: 8000 });
    }
  };

  // Quotes made on web set both ids; quotes made in the mobile app set only customer_id.
  useEffect(() => {
    if (!contactId || !profile?.company_id) return;
    let cancelled = false;
    supabase
      .from('quotes')
      .select('id, quote_number, cover_page_title, status, contact_id, customer_id, good_total, better_total, best_total, selected_tier, created_at')
      .eq('company_id', profile.company_id)
      .eq('is_archived', false)
      .or(`customer_id.eq.${contactId},contact_id.eq.${contactId}`)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[ContactDetail] Failed to load quotes:', error); return; }
        setContactQuotes((data || []).map(toQuoteSummary));
      });
    return () => { cancelled = true; };
  }, [contactId, profile?.company_id]);

  const openNewQuote = () => {
    if (!contact) return;
    dispatch({ type: 'SET_PENDING_QUOTE', payload: { contactId: contact.id } });
    dispatch({ type: 'SET_VIEW', payload: 'quotes' });
  };

  const openQuote = (quoteId: string) => {
    if (!contact) return;
    dispatch({ type: 'SET_PENDING_QUOTE', payload: { contactId: contact.id, quoteId } });
    dispatch({ type: 'SET_VIEW', payload: 'quotes' });
  };

  const openQuoteAction = (action: 'invoice' | 'payment') => {
    if (!contact) return;
    dispatch({ type: 'SET_PENDING_QUOTE_ACTION', payload: { contactId: contact.id, action } });
    dispatch({ type: 'SET_VIEW', payload: 'quotes' });
  };

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Select a contact to view details</p>
      </div>
    );
  }

  const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);

  const syncMentionSuggestions = (text: string, caret: number) => {
    const active = findActiveMentionQuery(text, caret);
    if (!active) {
      setMentionStart(null);
      setMentionSuggestions([]);
      return;
    }

    const suggestions = getMentionSuggestions(mentionTargets, active.query);
    setMentionStart(active.start);
    setMentionSuggestions(suggestions);
  };

  const insertMention = (handle: string) => {
    if (!noteInputRef.current || mentionStart === null) return;
    const caret = noteInputRef.current.selectionStart ?? newNote.length;
    const updated = applyMention(newNote, mentionStart, caret, handle);

    setNewNote(updated.text);
    setMentionStart(null);
    setMentionSuggestions([]);

    requestAnimationFrame(() => {
      noteInputRef.current?.focus();
      noteInputRef.current?.setSelectionRange(updated.caret, updated.caret);
    });
  };

  // Back goes to the screen you came from (a board, the dashboard, a search
  // result), not always the contact list.
  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const handleEdit = () => {
    // Explicitly copy all fields including firstName/lastName to ensure they're editable
    setEditedContact({
      ...contact,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editedContact) return;
    
    console.log('ContactDetail: Starting save process for contact:', editedContact.id);
    
    // Enhanced debugging for mobile save issues
    console.log('ContactDetail: Authentication state check:');
    console.log('- profile?.company_id:', profile?.company_id);
    console.log('- state.companyId:', state.companyId);
    console.log('- effectiveCompanyId:', effectiveCompanyId);
    console.log('- profile exists:', !!profile);
    console.log('- user authenticated:', !!state.currentUser);
    
    if (!effectiveCompanyId) {
      console.error('ContactDetail: CRITICAL - No company context available');
      console.error('ContactDetail: Authentication details:', {
        profile: profile ? { id: profile.id, company_id: profile.company_id } : null,
        stateCompanyId: state.companyId,
        currentUser: state.currentUser ? { id: state.currentUser.id, email: state.currentUser.email } : null
      });
      toast.error('Authentication error: No company context. Please sign out and sign back in.');
      return;
    }
    
    setIsSaving(true);
    
    // Extend safety timeout for slower mobile connections (45 seconds)
    const safetyTimeout = setTimeout(() => {
      console.error('ContactDetail: Save operation exceeded 45 second limit, forcing reset');
      setIsSaving(false);
      toast.error('Save operation timed out. Please check your connection and try again.');
    }, 45000);
    
    const attemptSave = async (attempt: number = 1): Promise<boolean> => {
      try {
        console.log(`ContactDetail: Save attempt ${attempt} - Updating contact with company ID:`, effectiveCompanyId);
        const updateData = {
          first_name: editedContact.firstName,
          last_name: editedContact.lastName,
          email: editedContact.email,
          phone1: editedContact.phone1,
          phone2: editedContact.phone2,
          address: editedContact.address,
          city: editedContact.city,
          state: editedContact.state,
          zip: editedContact.zip,
          lead_source: editedContact.leadSource,
          assigned_to: editedContact.assignedTo || null,
          tags: editedContact.tags || [],
          // Project / Financial fields — critical for pipeline board dollar totals
          project_type: editedContact.projectType,
          project_value: editedContact.projectValue ?? null,
          deposit_amount: editedContact.depositAmount ?? null,
          deposit_paid: editedContact.depositPaid ?? false,
          deposit_date: editedContact.depositDate ?? null,
          final_payment_amount: editedContact.finalPaymentAmount ?? null,
          final_payment_paid: editedContact.finalPaymentPaid ?? false,
          final_payment_date: editedContact.finalPaymentDate ?? null,
          // Insurance fields
          insurance_company: editedContact.insuranceCompany,
          policy_number: editedContact.policyNumber,
          claim_number: editedContact.claimNumber,
          adjuster_name: editedContact.adjusterName,
          adjuster_phone: editedContact.adjusterPhone,
          adjuster_email: editedContact.adjusterEmail,
          deductible: editedContact.deductible ?? null,
          is_retail: editedContact.isRetail ?? false,
          retail_notes: editedContact.retailNotes,
          notes: editedContact.notes,
        };

        console.log('ContactDetail: Sending update data:', updateData);
        console.log('ContactDetail: Database connection test - attempting save...');
        
        const updated = await db.updateContact(editedContact.id, updateData);
        console.log('ContactDetail: Database response:', updated);

        if (!updated) {
          console.error('ContactDetail: Update returned null/undefined');
          throw new Error('Failed to save contact changes - no data returned from database');
        }

        dispatch({ type: 'UPDATE_CONTACT', payload: { ...editedContact, updatedAt: new Date().toISOString() } });
        // Auto-log contact field changes
        if (effectiveCompanyId && contact) {
          const changedFields: string[] = [];
          if (editedContact.firstName !== contact.firstName || editedContact.lastName !== contact.lastName) changedFields.push('name');
          if (editedContact.email !== contact.email) changedFields.push('email');
          if (editedContact.phone1 !== contact.phone1) changedFields.push('phone');
          if (editedContact.address !== contact.address || editedContact.city !== contact.city) changedFields.push('address');
          if (editedContact.insuranceCompany !== contact.insuranceCompany) changedFields.push('insurance company');
          if (editedContact.claimNumber !== contact.claimNumber) changedFields.push('claim number');
          if (editedContact.projectValue !== contact.projectValue) changedFields.push('project value');
          if (editedContact.notes !== contact.notes) changedFields.push('notes');
          const summary = changedFields.length > 0 ? changedFields.join(', ') : 'details';
          logActivity({
            contactId: editedContact.id,
            companyId: effectiveCompanyId,
            userId: profile?.id,
            content: `👤 Contact updated: ${summary} edited`,
          }).catch(() => {});
        }
        setIsEditing(false);
        setEditedContact(null);
        toast.success('Contact saved successfully');
        console.log('ContactDetail: Save completed successfully');
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`ContactDetail: Save attempt ${attempt} failed:`, errorMessage);
        console.error('ContactDetail: Full error object:', error);
        
        // Retry logic for network/timeout errors
        if ((errorMessage.includes('timed out') || errorMessage.includes('network') || errorMessage.includes('fetch')) && attempt < 3) {
          console.log(`ContactDetail: Retrying save operation (attempt ${attempt + 1}/3) after 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptSave(attempt + 1);
        }
        
        // Final error handling
        if (errorMessage.includes('timed out')) {
          toast.error('Save timed out after multiple attempts - please check your connection');
        } else if (errorMessage.includes('permission')) {
          toast.error('Permission denied - you may not have access to edit this contact');
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          toast.error('Network error - please check your connection and try again');
        } else if (errorMessage.includes('Contact not found')) {
          toast.error('Contact not found - it may have been deleted by another user');
        } else {
          toast.error(`Failed to save contact: ${errorMessage}`);
        }
        
        throw error;
      }
    };

    try {
      await attemptSave();
    } catch (error) {
      // Final catch - error already handled in attemptSave
    } finally {
      clearTimeout(safetyTimeout);
      console.log('ContactDetail: Save process completed, resetting loading state');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContact(null);
  };

  // Pipeline Progress's Next step button: what to do to move this contact along.
  const latestQuote = contactQuotes.reduce<QuoteSummary | null>(
    (latest, q) => (!latest || q.createdAt > latest.createdAt ? q : latest),
    null,
  );
  const nextStep = getNextStepForStatus(contact.status, {
    hasQuote: contactQuotes.length > 0,
    inspectionCompleted: !!(contact.inspectionCompleted ?? (contact as any).inspection_completed),
  });

  const runNextStep = (step: NextStep) => {
    switch (step.action) {
      case 'calendar':
        handleScheduleAppointment();
        break;
      case 'inspection':
        dispatch({ type: 'NAVIGATE_TO_CONTACT_VIEW', payload: { view: 'inspections', contactId: contact.id } });
        break;
      case 'quotes':
        if (latestQuote) openQuote(latestQuote.id);
        else openNewQuote();
        break;
      case 'invoice':
        openQuoteAction('invoice');
        break;
      case 'quote-payment':
        openQuoteAction('payment');
        break;
      case 'material-orders':
        dispatch({ type: 'SET_VIEW', payload: 'material-orders' });
        break;
      case 'crew-schedule':
        dispatch({ type: 'SET_VIEW', payload: 'crew-schedule' });
        break;
      case 'documents-tab':
        setActiveTab('documents');
        break;
      case 'financial-tab':
        setActiveTab('financial');
        break;
      case 'job-status-tab':
        setActiveTab('jobStatus');
        break;
      case 'select':
      default:
        setActiveTab('timeline');
        break;
    }
  };

  const handleStatusChange = async (newStatus: CustomerStatus) => {
    try {
      if (!effectiveCompanyId) {
        toast.error('No company context available. Please refresh and sign in again.');
        return;
      }

      const updated = await db.updateContact(contact.id, { status: newStatus, status_changed_at: new Date().toISOString() });
      if (!updated) {
        toast.error('Failed to update status');
        return;
      }

      dispatch({
        type: 'UPDATE_CONTACT_STATUS',
        payload: { contactId: contact.id, status: newStatus },
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const { invalid } = validateMentions(newNote, mentionTargets);
    if (invalid.length > 0) {
      toast.error(`Unknown mention(s): ${invalid.map((handle) => `@${handle}`).join(', ')}`);
      return;
    }

    try {
      if (!effectiveCompanyId || !profile?.id) {
        toast.error('No company context available. Please refresh and sign in again.');
        return;
      }

      // Notes go to the shared notes table, as on mobile. The notify_note_mentions
      // trigger notifies everyone in tags, which holds team_members ids; mention
      // targets carry sign-in user ids, so map the mentioned handles to members.
      const { valid } = validateMentions(newNote, mentionTargets);
      const mentionedUserIds = mentionTargets
        .filter((target) => valid.includes(target.handle.toLowerCase()))
        .map((target) => target.id);
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id')
        .eq('company_id', effectiveCompanyId)
        .eq('is_active', true)
        .in('user_id', Array.from(new Set([profile.id, ...mentionedUserIds])));
      if (membersError) throw membersError;
      const author = (members || []).find((m: any) => m.user_id === profile.id);
      if (!author) {
        toast.error('Your team profile could not be found. Please refresh and try again.');
        return;
      }
      const tags = (members || [])
        .filter((m: any) => mentionedUserIds.includes(m.user_id) && m.id !== author.id)
        .map((m: any) => m.id as string);

      const { error: insertError } = await supabase.from('notes').insert({
        company_id: effectiveCompanyId,
        entity_type: 'customer',
        entity_id: contact.id,
        author_id: author.id,
        body: newNote.trim(),
        tags,
      });
      if (insertError) throw insertError;

      setNewNote('');
      setMentionStart(null);
      setMentionSuggestions([]);
      setTeamNotesVersion((v) => v + 1);
      toast.success(tags.length > 0
        ? `Note saved. ${tags.length === 1 ? '1 teammate was' : `${tags.length} teammates were`} notified.`
        : 'Note saved');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleSaveQuickNote = async () => {
    const trimmed = quickNote.trim();
    // Preserve any [TRUSSCTR_SCHEDULE] prefix that the mobile app wrote
    const fullNotes = rebuildWithSchedulePrefix(contact.notes, trimmed);

    setIsSavingQuickNote(true);
    try {
      if (profile?.company_id) {
        const updated = await db.updateContact(contact.id, { notes: fullNotes || null });
        if (!updated) {
          toast.error('Failed to save note');
          return;
        }
      }

      dispatch({
        type: 'UPDATE_CONTACT',
        payload: {
          ...contact,
          notes: fullNotes || undefined,
          updatedAt: new Date().toISOString(),
        },
      });
      toast.success('Note saved');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setIsSavingQuickNote(false);
    }
  };

  const handleQuickCall = () => {
    if (!contact.phone1) {
      toast.error('No phone number available');
      return;
    }
    window.open(`tel:${contact.phone1}`, '_self');
  };

  const handleQuickEmail = () => {
    if (!contact.email) {
      toast.error('No email available');
      return;
    }
    window.open(`mailto:${contact.email}`, '_self');
  };

  const handleQuickSms = () => {
    if (!contact.phone1) {
      toast.error('No phone number available');
      return;
    }
    window.open(`sms:${contact.phone1}`, '_self');
  };

  const handleScheduleAppointment = () => {
    setShowAppointmentModal(true);
  };

  const handleUseTemplate = (template: typeof communicationTemplates[0]) => {
    // Replace template variables with actual data
    let content = template.content;
    const replacements = {
      '{{CUSTOMER_NAME}}': getContactFullName(contact),
      '{{AGENT_NAME}}': state.currentUser?.name || 'Your Agent',
      '{{PHONE}}': state.currentUser?.phone || '(555) 123-4567',
      '{{CLAIM_NUMBER}}': contact.claimNumber || '[CLAIM_NUMBER]',
      '{{ADJUSTER_NAME}}': contact.adjusterName || '[ADJUSTER_NAME]',
      '{{DEDUCTIBLE}}': contact.deductible ? `$${contact.deductible}` : '[DEDUCTIBLE]',
      '{{INSPECTION_DATE}}': '[INSPECTION_DATE]',
      '{{ESTIMATE_AMOUNT}}': contact.projectValue ? `$${contact.projectValue.toLocaleString()}` : '[ESTIMATE_AMOUNT]',
      '{{START_DATE}}': '[START_DATE]',
      '{{START_TIME}}': '[START_TIME]',
      '{{COMPLETION_DATE}}': '[COMPLETION_DATE]',
      '{{WORK_DESCRIPTION}}': '[WORK_DESCRIPTION]',
      '{{STATUS}}': '[STATUS]',
      '{{NEXT_STEPS}}': '[NEXT_STEPS]',
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      content = content.replace(new RegExp(placeholder, 'g'), value);
    });

    setTemplateMessage(content);
    setShowTemplates(false);
    toast.success(`Template "${template.title}" loaded — review and send`);
  };

  const handleReassignContact = async (newAssigneeId: string) => {
    if (newAssigneeId === contact.assignedTo) return;

    setIsReassigning(true);
    try {
      const updated = await db.updateContact(contact.id, {
        assigned_to: newAssigneeId || null,
      });

      if (!updated) {
        toast.error('Failed to reassign contact');
        return;
      }

      dispatch({
        type: 'UPDATE_CONTACT',
        payload: {
          ...contact,
          assignedTo: newAssigneeId,
          updatedAt: new Date().toISOString(),
        },
      });

      const newAssignee = state.teamMembers.find((tm) => tm.id === newAssigneeId);
      toast.success(`Reassigned to ${newAssignee?.name || 'team member'}`);
    } catch (error) {
      console.error('Error reassigning contact:', error);
      toast.error('Failed to reassign contact');
    } finally {
      setIsReassigning(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <User size={16} /> },
    { id: 'jobStatus', label: 'Job Status', icon: <Activity size={16} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign size={16} /> },
    { id: 'projects', label: 'Projects', icon: <Briefcase size={16} /> },
    { id: 'insurance', label: 'Insurance & Supplements', icon: <Shield size={16} /> },
  ];

  // Add survey trigger functionality
  const handleRequestReview = () => {
    setShowSurveyModal(true);
  };

  const handleSurveyComplete = (surveyData: any) => {
    // Add survey completion note to contact
    const surveyNote = `Customer survey completed - Overall satisfaction: ${surveyData.overallSatisfaction}/5 stars. ${surveyData.wouldRecommend ? 'Would recommend.' : 'Would not recommend.'}`;
    handleAddNote();
    setShowSurveyModal(false);
  };

  const currentData = isEditing && editedContact ? editedContact : contact;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer w-14 h-14" onClick={() => avatarInputRef.current?.click()}>
                {contactAvatarUrl ? (
                  <img src={contactAvatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {isUploadingAvatar ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {getContactFullName(contact)}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      statusColors[contact.status]
                    }`}
                  >
                    {statusLabels[contact.status]}
                  </span>
                  {(contact.inspectionCompleted ?? (contact as any).inspection_completed) && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                      <CheckCircle size={14} />
                      Inspection Complete
                    </span>
                  )}
                  {(contact.inspectionScheduled ?? (contact as any).inspection_scheduled) && !(contact.inspectionCompleted ?? (contact as any).inspection_completed) && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center gap-1">
                      <Clock size={14} />
                      Inspection Scheduled
                    </span>
                  )}
                  {contact.isRetail && (
                    <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-medium">
                      Retail
                    </span>
                  )}
                  {contact.insuranceCompany && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      Insurance
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <select
                  value={contact.status}
                  onChange={(e) => handleStatusChange(e.target.value as CustomerStatus)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Edit2 size={18} />
                  Edit
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">First Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={currentData.firstName || ''}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, firstName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <span className="text-gray-900">{contact.firstName || '-'}</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Last Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={currentData.lastName || ''}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, lastName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <span className="text-gray-900">{contact.lastName || '-'}</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={currentData.email}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, email: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.email || '-'}
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Primary Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={currentData.phone1}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, phone1: formatPhoneNumber(e.target.value) })
                        }
                        onBlur={(e) =>
                          setEditedContact({ ...currentData, phone1: formatPhoneNumber(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        <a href={`tel:${contact.phone1}`} className="text-blue-600 hover:underline">
                          {contact.phone1 || '-'}
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Secondary Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={currentData.phone2 || ''}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, phone2: formatPhoneNumber(e.target.value) })
                        }
                        onBlur={(e) =>
                          setEditedContact({ ...currentData, phone2: formatPhoneNumber(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-gray-900">{contact.phone2 || '-'}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Lead Source
                    </label>
                    {isEditing ? (
                      <select
                        value={currentData.leadSource}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, leadSource: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      >
                        {defaultLeadSources.map((ls) => (
                          <option key={ls.id} value={ls.name}>
                            {ls.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-gray-400" />
                        <span className="text-gray-900">{contact.leadSource || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                  {isEditing ? (
                    <div className="grid grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={currentData.address}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, address: e.target.value })
                        }
                        placeholder="Street Address"
                        className="col-span-4 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={currentData.city}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, city: e.target.value })
                        }
                        placeholder="City"
                        className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={currentData.state}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, state: e.target.value })
                        }
                        placeholder="State"
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={currentData.zip}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, zip: e.target.value })
                        }
                        placeholder="ZIP"
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-gray-400 mt-0.5" />
                      <span className="text-gray-900">
                        {contact.address ? `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}` : '-'}
                      </span>
                      {contact.address && (
                        <button
                          type="button"
                          onClick={() => {
                            const propertyAddress = [contact.address, contact.city, [contact.state, contact.zip].filter(Boolean).join(' ')]
                              .filter(Boolean)
                              .join(', ');
                            openLiveRadar(dispatch, { address: propertyAddress, label: propertyAddress, state: contact.state || null });
                          }}
                          title="View live radar for this address"
                          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          <Radio size={12} /> Live radar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Insurance Info */}
              {(!currentData.isRetail || contact.insuranceCompany || contact.policyNumber || contact.claimNumber || isEditing) && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="text-blue-600" size={20} />
                    <h3 className="text-lg font-semibold text-gray-900">Insurance Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Customer Type</label>
                      {isEditing ? (
                        <select
                          value={currentData.isRetail ? 'retail' : 'insurance'}
                          onChange={(e) =>
                            setEditedContact({
                              ...currentData,
                              isRetail: e.target.value === 'retail',
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        >
                          <option value="insurance">Insurance</option>
                          <option value="retail">Retail</option>
                        </select>
                      ) : (
                        <p className="text-gray-900">{contact.isRetail ? 'Retail' : 'Insurance'}</p>
                      )}
                    </div>

                    {currentData.isRetail ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Retail Notes</label>
                        {isEditing ? (
                          <textarea
                            value={currentData.retailNotes || ''}
                            onChange={(e) =>
                              setEditedContact({ ...currentData, retailNotes: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                          />
                        ) : (
                          <p className="text-gray-900">{contact.retailNotes || '-'}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Insurance Company</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.insuranceCompany || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, insuranceCompany: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.insuranceCompany || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Policy Number</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.policyNumber || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, policyNumber: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.policyNumber || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Claim Number</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.claimNumber || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, claimNumber: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.claimNumber || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Deductible</label>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentData.deductible ?? ''}
                              onChange={(e) =>
                                setEditedContact({
                                  ...currentData,
                                  deductible: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">
                              {contact.deductible ? formatCurrency(contact.deductible) : '-'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Adjuster Name</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.adjusterName || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, adjusterName: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.adjusterName || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Adjuster Phone</label>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={currentData.adjusterPhone || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, adjusterPhone: formatPhoneNumber(e.target.value) })
                              }
                              onBlur={(e) =>
                                setEditedContact({ ...currentData, adjusterPhone: formatPhoneNumber(e.target.value) })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.adjusterPhone || '-'}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">Adjuster Email</label>
                          {isEditing ? (
                            <input
                              type="email"
                              value={currentData.adjusterEmail || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, adjusterEmail: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : contact.adjusterEmail ? (
                            <a href={`mailto:${contact.adjusterEmail}`} className="text-blue-600 hover:underline">{contact.adjusterEmail}</a>
                          ) : (
                            <p className="text-gray-900">-</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Inspection Information */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="text-blue-600" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">Inspection Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Inspection Status</label>
                    <div className="flex items-center gap-2">
                      {contact.inspectionCompleted ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          <CheckCircle size={14} />
                          Completed
                        </span>
                      ) : contact.inspectionScheduled ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                          <Clock size={14} />
                          Scheduled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                          <AlertCircle size={14} />
                          Not Scheduled
                        </span>
                      )}
                    </div>
                  </div>
                  {contact.inspectionDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Inspection Date</label>
                      <p className="text-gray-900">{formatDate(contact.inspectionDate)}</p>
                    </div>
                  )}
                  {contact.inspectionCompletedDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Completion Date</label>
                      <p className="text-gray-900">{formatDate(contact.inspectionCompletedDate)}</p>
                    </div>
                  )}
                  {contact.inspectionNotes && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Inspection Notes</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{contact.inspectionNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                {isEditing ? (
                  <textarea
                    value={stripSchedulePrefix(currentData.notes) || ''}
                    onChange={(e) =>
                      setEditedContact({ ...currentData, notes: rebuildWithSchedulePrefix(contact.notes, e.target.value) })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {stripSchedulePrefix(contact.notes) || 'No notes added yet.'}
                    </p>
                    <textarea
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      rows={4}
                      placeholder="Add or update internal notes for this customer..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => { void handleSaveQuickNote(); }}
                        disabled={isSavingQuickNote}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingQuickNote ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pipeline Stage Tracker */}
              <PipelineStageTracker
                currentStatus={contact.status}
                statusChangedAt={contact.statusChangedAt ?? (contact as any).status_changed_at}
                inspectionCompleted={contact.inspectionCompleted ?? (contact as any).inspection_completed}
                nextStep={nextStep}
                onNextStep={nextStep ? () => runNextStep(nextStep) : undefined}
              />

              {/* Project Pricing Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">Project Pricing</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-blue-200 text-sm">Project Value</p>
                    <p className="text-3xl font-bold">
                      {contact.projectValue ? formatCurrency(contact.projectValue) : '-'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-blue-200 text-sm">Deposit</p>
                      <p className="text-xl font-semibold">
                        {contact.depositAmount ? formatCurrency(contact.depositAmount) : '-'}
                      </p>
                      {contact.depositPaid ? (
                        <span className="inline-flex items-center gap-1 text-green-300 text-xs mt-1">
                          <CheckCircle size={12} /> Paid
                        </span>
                      ) : contact.depositAmount ? (
                        <span className="inline-flex items-center gap-1 text-yellow-300 text-xs mt-1">
                          <AlertCircle size={12} /> Pending
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-blue-200 text-sm">Final Payment</p>
                      <p className="text-xl font-semibold">
                        {contact.finalPaymentAmount
                          ? formatCurrency(contact.finalPaymentAmount)
                          : '-'}
                      </p>
                      {contact.finalPaymentPaid ? (
                        <span className="inline-flex items-center gap-1 text-green-300 text-xs mt-1">
                          <CheckCircle size={12} /> Paid
                        </span>
                      ) : contact.finalPaymentAmount ? (
                        <span className="inline-flex items-center gap-1 text-yellow-300 text-xs mt-1">
                          <AlertCircle size={12} /> Pending
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assigned To */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned To</h3>
                {assignee ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={assignee.avatar}
                      alt={assignee.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{assignee.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{assignee.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Not assigned</p>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Reassign Contact
                  </label>
                  <select
                    value={contact.assignedTo || ''}
                    onChange={(e) => {
                      void handleReassignContact(e.target.value);
                    }}
                    disabled={isReassigning}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {state.teamMembers.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* NOAA Storm Alerts */}
              {contact?.zip && (
                <div className={`rounded-xl border p-4 ${
                  weatherAlerts?.hasActiveStorm
                    ? 'bg-red-50 border-red-300'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CloudLightning size={16} className={weatherAlerts?.hasActiveStorm ? 'text-red-600' : 'text-gray-500'} />
                      <h3 className={`text-sm font-semibold ${weatherAlerts?.hasActiveStorm ? 'text-red-700' : 'text-gray-700'}`}>
                        NOAA Storm Alerts
                      </h3>
                    </div>
                    <button
                      onClick={() => fetchWeatherAlerts(contact.zip || '')}
                      disabled={weatherLoading}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Refresh alerts"
                    >
                      <RefreshCw size={13} className={weatherLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {weatherLoading && !weatherAlerts && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Checking alerts…
                    </p>
                  )}

                  {weatherAlerts && !weatherAlerts.hasActiveStorm && (
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle size={13} className="text-green-500" />
                      <span>No active storm alerts</span>
                      {weatherAlerts.location && (
                        <span className="text-gray-400">· {weatherAlerts.location}</span>
                      )}
                    </div>
                  )}

                  {weatherAlerts?.hasActiveStorm && weatherAlerts.alerts.map((alert, i) => (
                    <div key={i} className="mb-2 last:mb-0 bg-white/80 rounded-lg p-3 border border-red-200">
                      <div className="flex items-start gap-2">
                        <Wind size={13} className="text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-red-700 truncate">{alert.type}</p>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{alert.headline}</p>
                          {alert.instruction && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">{alert.instruction}</p>
                          )}
                          <div className="flex gap-2 mt-1 text-[10px] text-gray-400">
                            <span className={`font-medium ${alert.severity === 'Extreme' || alert.severity === 'Severe' ? 'text-red-500' : 'text-orange-500'}`}>
                              {alert.severity}
                            </span>
                            {alert.urgency && <span>· {alert.urgency}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!weatherLoading && !weatherAlerts && (
                    <button
                      onClick={() => fetchWeatherAlerts(contact.zip || '')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Check alerts for {contact.zip}
                    </button>
                  )}

                  <p className="text-[10px] text-gray-300 mt-2">NOAA National Weather Service</p>
                </div>
              )}

              {/* Live weather forecast for this job site (OpenWeather — only renders if API key configured) */}
              {contact && effectiveCompanyId && (contact.address || contact.city) && (
                <WeatherWidget
                  address={[contact.address, contact.city, contact.state].filter(Boolean).join(', ')}
                  companyId={effectiveCompanyId}
                />
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button onClick={handleQuickCall} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Phone size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Call Customer</span>
                  </button>
                  <button onClick={handleQuickEmail} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Mail size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Send Email</span>
                  </button>
                  <button onClick={handleQuickSms} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <MessageSquare size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Send SMS</span>
                  </button>
                  <button onClick={() => setShowTemplates(true)} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <FileText size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Use Template</span>
                  </button>
                  <button onClick={handleScheduleAppointment} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Calendar size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Schedule Appointment</span>
                  </button>
                  <button
                    onClick={() => {
                      dispatch({ type: 'NAVIGATE_TO_CONTACT_VIEW', payload: { view: 'inspections', contactId: contact.id } });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                  >
                    <Camera size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Start Inspection</span>
                  </button>

                  {/* Mark Inspection Complete - show if contact is in appt_set or inspection status */}
                  {(contact.status === 'appt_set' || contact.status === 'inspection_scheduled') && (
                    <button 
                      onClick={() => handleStatusChange('inspection_completed')} 
                      className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
                    >
                      <CheckCircle size={18} className="text-green-600" />
                      <span className="font-medium text-gray-700">Mark Inspection Complete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 relative">
                  <input
                    ref={noteInputRef}
                    type="text"
                    value={newNote}
                    onChange={(e) => {
                      setNewNote(e.target.value);
                      const caret = e.target.selectionStart ?? e.target.value.length;
                      syncMentionSuggestions(e.target.value, caret);
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLInputElement;
                      const caret = target.selectionStart ?? target.value.length;
                      syncMentionSuggestions(target.value, caret);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setMentionSuggestions([]);
                        setMentionStart(null);
                        return;
                      }

                      if (e.key === 'Enter' && mentionSuggestions.length > 0) {
                        e.preventDefault();
                        insertMention(mentionSuggestions[0].handle);
                        return;
                      }

                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddNote();
                      }
                    }}
                    placeholder="Add a note… type @ to tag a teammate and notify them"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                  {mentionSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {mentionSuggestions.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => insertMention(target.handle)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-900">@{target.handle}</p>
                          <p className="text-xs text-gray-500">
                            {target.name} • {target.email}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {[...(contact.communications || []), ...teamNotes]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((comm) => (
                    <div key={comm.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          comm.type === 'email'
                            ? 'bg-blue-100 text-blue-600'
                            : comm.type === 'sms'
                            ? 'bg-green-100 text-green-600'
                            : comm.type === 'call'
                            ? 'bg-purple-100 text-purple-600'
                            : comm.type === 'insurance'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {comm.type === 'email' ? (
                          <Mail size={18} />
                        ) : comm.type === 'sms' ? (
                          <MessageSquare size={18} />
                        ) : comm.type === 'call' ? (
                          <Phone size={18} />
                        ) : comm.type === 'insurance' ? (
                          <Shield size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">{comm.userName}</span>
                          <span className="text-sm text-gray-500">
                            {formatDateTime(comm.timestamp)}
                          </span>
                        </div>
                        {comm.subject && (
                          <p className="text-sm font-medium text-gray-700 mb-1">{comm.subject}</p>
                        )}
                        <p className="text-gray-600">{comm.content}</p>
                      </div>
                    </div>
                  ))}
                {(contact.communications?.length ?? 0) + teamNotes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* ── Aerial Measurement Reports ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <EagleViewPanel
                address={contact.address || ''}
                city={contact.city || ''}
                state={contact.state || ''}
                zip={contact.zip || ''}
                companyId={effectiveCompanyId || ''}
                contactId={contact.id}
                contactName={getContactFullName(contact)}
                userId={profile?.id}
                onDocumentSaved={(doc) => setContactDocuments(prev => [doc, ...prev])}
              />
              <RoofrPanel
                address={contact.address || ''}
                city={contact.city || ''}
                state={contact.state || ''}
                zip={contact.zip || ''}
                companyId={effectiveCompanyId || ''}
                contactId={contact.id}
                contactName={getContactFullName(contact)}
                userId={profile?.id}
                onDocumentSaved={(doc) => setContactDocuments(prev => [doc, ...prev])}
              />
            </div>

            {/* ── Signed Documents ── */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-5 border-b border-gray-200 flex items-center gap-3">
                <CheckCircle size={20} className="text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Signed Documents</h3>
                {signedDocs.length > 0 && (
                  <span className="ml-auto bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {signedDocs.length}
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {signedDocs.map((doc) => (
                  <div key={`${doc.docType}-${doc.id}`} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={20} className="text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            doc.docType === 'estimate'
                              ? 'bg-blue-100 text-blue-700'
                              : doc.docType === 'work_order'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {doc.docType === 'estimate'
                              ? 'Estimate'
                              : doc.docType === 'work_order'
                              ? 'Work Order'
                              : 'Change Order'}
                          </span>
                          <span className="text-xs text-gray-400">{doc.label}</span>
                        </div>
                        <p className="font-medium text-gray-900">{doc.title}</p>
                        <p className="text-sm text-gray-500">
                          Signed by {doc.signedBy} · {formatDate(doc.signedAt)}
                          {doc.amount != null && ` · ${formatCurrency(doc.amount)}`}
                        </p>
                      </div>
                    </div>
                    {doc.viewUrl && (
                      <a
                        href={doc.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        title="View signed document"
                      >
                        <ExternalLink size={18} className="text-gray-500" />
                      </a>
                    )}
                  </div>
                ))}
                {signedDocs.length === 0 && (
                  <div className="p-8 text-center text-gray-400">
                    <CheckCircle size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No signed documents yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Uploaded Files ── */}
            {(() => {
              const FIELD_ROLES = new Set(['subcontractor','canvasser','field_tech','field_contractor','production_manager','project_manager']);
              const getRoleForUploader = (uploadedBy: string) => {
                const member = state.teamMembers.find(tm => tm.id === uploadedBy);
                return member?.role ?? null;
              };
              const photos = contactDocuments.filter(d => d.type === 'photo');
              const nonPhotoDocs = contactDocuments.filter(d => d.type !== 'photo');
              const salesPhotos = photos.filter(d => {
                const role = getRoleForUploader(d.uploadedBy);
                return role === null || !FIELD_ROLES.has(role);
              });
              const fieldPhotos = photos.filter(d => {
                const role = getRoleForUploader(d.uploadedBy);
                return role !== null && FIELD_ROLES.has(role);
              });

              const DocRow = ({ doc }: { doc: Document }) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.size} • Uploaded {formatDate(doc.uploadedAt)} by {doc.uploadedBy}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleViewDoc(doc)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View"><Eye size={18} className="text-gray-500" /></button>
                    <button onClick={() => handleDownloadDoc(doc)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Download"><Download size={18} className="text-gray-500" /></button>
                    {(doc.name?.toLowerCase().endsWith('.pdf') || doc.url?.toLowerCase().includes('.pdf')) && (
                      <button onClick={() => handleLoadRoofrMeasurements(doc)} className="p-2 hover:bg-blue-100 rounded-lg transition-colors" title="Load Roofr measurements"><Zap size={18} className="text-blue-500" /></button>
                    )}
                    <button onClick={() => handleDeleteDocument(doc.id)} className="p-2 hover:bg-red-100 rounded-lg transition-colors" title="Delete"><Trash2 size={18} className="text-red-500" /></button>
                  </div>
                </div>
              );

              const PhotoThumbnail = ({ doc }: { doc: Document }) => {
                const [thumbUrl, setThumbUrl] = useState<string | null>(null);
                useEffect(() => {
                  getDocumentSignedUrl(doc.url, 3600).then(url => {
                    if (url) setThumbUrl(url);
                  });
                }, [doc.url]);
                return (
                  <div key={doc.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={doc.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText size={24} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button onClick={() => handleOpenDocument(doc.url, doc.name)} className="p-1.5 bg-white rounded-md" title="View"><Eye size={14} className="text-gray-700" /></button>
                      <button onClick={() => handleDeleteDocument(doc.id)} className="p-1.5 bg-white rounded-md" title="Delete"><Trash2 size={14} className="text-red-500" /></button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{doc.name}</p>
                  </div>
                );
              };

              return (
                <div className="bg-white rounded-xl border border-gray-200">
                  <input ref={documentInputRef} type="file" className="hidden" onChange={handleUploadDocument} disabled={isUploadingDocument} />
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Uploaded Files</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { try { const raw = localStorage.getItem(`roofr_order_${contact.id}`); if (raw) { const o = JSON.parse(raw); if (o.measurements) setTemplateRoofrData({ measurements: o.measurements, structures: o.structures }); } } catch { /* ignore parse errors */ } setShowTemplateModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        <FileText size={18} />Use Template
                      </button>
                      <button onClick={() => documentInputRef.current?.click()} disabled={isUploadingDocument} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isUploadingDocument ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {isUploadingDocument ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </div>

                  {/* ── Photos section with folders ── */}
                  {photos.length > 0 && (
                    <div className="border-b border-gray-100">
                      {/* Sales Team Photos folder */}
                      {salesPhotos.length > 0 && (
                        <div>
                          <button
                            onClick={() => setSalesFolderOpen(o => !o)}
                            className="w-full flex items-center gap-3 px-5 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            {salesFolderOpen ? <FolderOpen size={18} className="text-blue-600" /> : <Folder size={18} className="text-blue-600" />}
                            <span className="font-medium text-blue-800 text-sm">Sales Team Photos</span>
                            <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{salesPhotos.length}</span>
                          </button>
                          {salesFolderOpen && (
                            <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                              {salesPhotos.map(doc => <PhotoThumbnail key={doc.id} doc={doc} />)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Field / Crew Photos folder */}
                      {fieldPhotos.length > 0 && (
                        <div>
                          <button
                            onClick={() => setFieldFolderOpen(o => !o)}
                            className="w-full flex items-center gap-3 px-5 py-3 bg-orange-50 hover:bg-orange-100 transition-colors"
                          >
                            {fieldFolderOpen ? <FolderOpen size={18} className="text-orange-600" /> : <Folder size={18} className="text-orange-600" />}
                            <span className="font-medium text-orange-800 text-sm">Field / Crew Photos</span>
                            <span className="ml-auto text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{fieldPhotos.length}</span>
                          </button>
                          {fieldFolderOpen && (
                            <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                              {fieldPhotos.map(doc => <PhotoThumbnail key={doc.id} doc={doc} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Non-photo documents ── */}
                  <div className="divide-y divide-gray-100">
                    {nonPhotoDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
                    {contactDocuments.length === 0 && (
                      <div className="p-12 text-center text-gray-500">
                        <FileText size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No uploaded files yet</p>
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <button onClick={() => { try { const raw = localStorage.getItem(`roofr_order_${contact.id}`); if (raw) { const o = JSON.parse(raw); if (o.measurements) setTemplateRoofrData({ measurements: o.measurements, structures: o.structures }); } } catch { /* ignore parse errors */ } setShowTemplateModal(true); }} className="text-green-600 hover:text-green-700 text-sm font-medium">Use a template</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => documentInputRef.current?.click()} className="text-blue-600 hover:text-blue-700 text-sm font-medium">Upload a file</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Project Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {contact.projectValue ? formatCurrency(contact.projectValue) : '-'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Deposit</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {contact.depositAmount ? formatCurrency(contact.depositAmount) : '-'}
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-sm mt-2 ${
                    contact.depositPaid ? 'text-green-600' : 'text-amber-600'
                  }`}
                >
                  {contact.depositPaid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {contact.depositPaid ? `Paid ${formatDate(contact.depositDate!)}` : 'Pending'}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Final Payment</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {contact.finalPaymentAmount ? formatCurrency(contact.finalPaymentAmount) : '-'}
                </p>
                {contact.finalPaymentAmount && (
                  <span
                    className={`inline-flex items-center gap-1 text-sm mt-2 ${
                      contact.finalPaymentPaid ? 'text-green-600' : 'text-amber-600'
                    }`}
                  >
                    {contact.finalPaymentPaid ? (
                      <CheckCircle size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    {contact.finalPaymentPaid
                      ? `Paid ${formatDate(contact.finalPaymentDate!)}`
                      : 'Pending'}
                  </span>
                )}
              </div>
            </div>

            <ContactInsuranceSummary contactId={contact.id} />

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={openNewQuote}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus size={18} />
                  New Quote
                </button>
                {(() => {
                  const pdfs = (contactDocuments || []).filter(d =>
                    d.name?.toLowerCase().endsWith('.pdf') || d.url?.toLowerCase().includes('.pdf')
                  );
                  if (pdfs.length === 0) return null;
                  return (
                    <div className="relative">
                      <button
                        onClick={() => setShowRoofrPicker(p => !p)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Zap size={18} />
                        Quote from PDF
                      </button>
                      {showRoofrPicker && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[220px]">
                          <p className="text-xs font-medium text-gray-500 px-3 pt-3 pb-1">Choose a Roofr PDF</p>
                          {pdfs.map(doc => (
                            <button
                              key={doc.id}
                              onClick={() => handleQuoteFromDoc(doc)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-sm text-gray-800 last:rounded-b-xl"
                            >
                              <FileText size={14} className="text-blue-500 flex-shrink-0" />
                              <span className="truncate">{doc.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <button
                  onClick={() => openQuoteAction('invoice')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Create Invoice
                </button>
                <button onClick={() => openQuoteAction('payment')} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <DollarSign size={18} />
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}


{activeTab === 'projects' && (
          <div className="space-y-6">
            {/* Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Briefcase size={20} />
                  Projects ({contactProjects.length})
                </h3>
                <button
                  onClick={() => setShowProjectModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  New Project
                </button>
              </div>

              {contactProjects.length > 0 ? (
                <div className="grid gap-4">
                  {contactProjects.map((project) => (
                    <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setViewingProject(project)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">{project.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">#{project.projectNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              project.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : project.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : project.status === 'planning'
                                ? 'bg-purple-100 text-purple-800'
                                : project.status === 'on_hold'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {project.status.replace('_', ' ')}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewingProject(project); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Project"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Budget</p>
                          <p className="font-semibold text-indigo-600">{formatCurrency(project.estimatedBudget || 0)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Start Date</p>
                          <p className="font-medium text-gray-900">
                            {project.startDate ? formatDate(project.startDate) : 'Not set'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Completion</p>
                          <p className="font-medium text-gray-900">
                            {project.endDate ? formatDate(project.endDate) : 'Not set'}
                          </p>
                        </div>
                      </div>
                      
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                          {project.description}
                        </p>
                      )}

                      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingProject(project); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                          <Eye size={14} /> View Project
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProjectInDetail(project); setShowProjectModal(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Briefcase size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No projects yet</p>
                  <button
                    onClick={() => setShowProjectModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first project
                  </button>
                </div>
              )}
            </div>

            {/* Quotes Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText size={20} />
                  Quotes ({contactQuotes.length})
                </h3>
                <button
                  onClick={openNewQuote}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus size={18} />
                  New Quote
                </button>
              </div>

              {contactQuotes.length > 0 ? (
                <div className="grid gap-3">
                  {contactQuotes.map((q) => {
                    return (
                      <button
                        key={q.id}
                        onClick={() => openQuote(q.id)}
                        className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{q.quoteNumber}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{new Date(q.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUOTE_STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-700'}`}>
                            {q.status}
                          </span>
                          <p className="font-bold text-blue-600 whitespace-nowrap">
                            {q.status === 'signed' ? formatCurrency(quoteValue(q)) : `From ${formatCurrency(q.goodTotal)}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <FileText size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No quotes yet</p>
                  <button
                    onClick={openNewQuote}
                    className="mt-4 text-green-600 hover:text-green-700 font-medium"
                  >
                    Create your first quote
                  </button>
                </div>
              )}
            </div>

            {/* Work Orders Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardList size={20} />
                  Work Orders ({contactWorkOrders.length})
                </h3>
                <button
                  onClick={() => setShowWorkOrderModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus size={18} />
                  New Work Order
                </button>
              </div>

              {contactWorkOrders.length > 0 ? (
                <div className="grid gap-4">
                  {contactWorkOrders.map((workOrder) => (
                    <div key={workOrder.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">WO #{workOrder.workOrderNumber}</h4>
                          <p className="text-sm text-gray-500 mt-1">{workOrder.title || 'Work Order'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              workOrder.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : workOrder.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : workOrder.status === 'scheduled'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {workOrder.status.replace('_', ' ')}
                          </span>
                          <button
                            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'work-orders' })}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Open in Work Orders"
                          >
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Scheduled</p>
                          <p className="font-medium text-gray-900">
                            {workOrder.scheduledDate ? formatDate(workOrder.scheduledDate) : 'Not set'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Hours Est.</p>
                          <p className="font-medium text-gray-900">{workOrder.estimatedHours ? `${workOrder.estimatedHours}h` : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Cost</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(workOrder.totalCost || 0)}</p>
                        </div>
                      </div>
                      {workOrder.notes && (
                        <p className="mt-3 text-sm text-gray-500 border-t border-gray-100 pt-3">{workOrder.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <ClipboardList size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No work orders yet</p>
                  <button
                    onClick={() => setShowWorkOrderModal(true)}
                    className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Create your first work order
                  </button>
                </div>
              )}
            </div>

            {/* Material Orders Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package size={20} />
                  Material Orders ({contactMaterialOrders.length})
                </h3>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_VIEW', payload: 'material-orders' });
                    toast.info('Create a material order and link it to this customer');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Plus size={18} />
                  New Material Order
                </button>
              </div>

              {contactMaterialOrders.length > 0 ? (
                <div className="grid gap-4">
                  {contactMaterialOrders.map((materialOrder) => (
                    <div key={materialOrder.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">Order #{materialOrder.orderNumber}</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            {materialOrder.supplierName || 'Supplier'}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            materialOrder.status === 'delivered'
                              ? 'bg-green-100 text-green-800'
                              : materialOrder.status === 'ordered'
                              ? 'bg-blue-100 text-blue-800'
                              : materialOrder.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {materialOrder.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Amount</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(materialOrder.total || 0)}</p>
                        </div>
                        {materialOrder.expectedDeliveryDate && (
                          <div>
                            <p className="text-gray-500">Expected Delivery</p>
                            <p className="font-medium text-gray-900">
                              {formatDate(materialOrder.expectedDeliveryDate)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Truck size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No material orders yet</p>
                  <button
                    onClick={() => {
                      dispatch({ type: 'SET_VIEW', payload: 'material-orders' });
                      toast.info('Create a material order and link it to this customer');
                    }}
                    className="mt-4 text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Create your first material order
                  </button>
                </div>
              )}
            </div>

            {/* Change Orders Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText size={20} />
                  Change Orders ({contactChangeOrders.length})
                </h3>
                <button
                  onClick={() => { setViewingChangeOrder(null); setShowChangeOrderModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Plus size={18} />
                  New Change Order
                </button>
              </div>

              {contactChangeOrders.length > 0 ? (
                <div className="grid gap-4">
                  {contactChangeOrders.map((co) => (
                    <div key={co.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">{co.change_order_number}</h4>
                          <p className="text-sm text-gray-500 mt-1">{co.title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              co.status === 'signed'
                                ? 'bg-green-100 text-green-800'
                                : co.status === 'sent'
                                ? 'bg-blue-100 text-blue-800'
                                : co.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : co.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {co.status}
                          </span>
                          <button
                            onClick={() => { setViewingChangeOrder(co); setShowChangeOrderModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit change order"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Created</p>
                          <p className="font-medium text-gray-900">{formatDate(co.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Subtotal</p>
                          <p className="font-medium text-gray-900">{formatCurrency(co.subtotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(co.total)}</p>
                        </div>
                      </div>
                      {co.notes && (
                        <p className="mt-3 text-sm text-gray-500 border-t border-gray-100 pt-3">{co.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <FileText size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No change orders yet</p>
                  <button
                    onClick={() => { setViewingChangeOrder(null); setShowChangeOrderModal(true); }}
                    className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Create your first change order
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'jobStatus' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Job Status & Progress</h2>
              {(contact.status === 'completed' || contactWorkOrders.some(wo => wo.status === 'completed')) && (
                <button
                  onClick={handleRequestReview}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <Star size={18} />
                  Request Customer Review
                </button>
              )}
            </div>
            
            <JobStatusTimeline 
              contact={contact} 
              jobs={contactWorkOrders.map(wo => ({
                id: wo.id,
                contactId: wo.contactId || contact.id,
                title: wo.title || `Work Order #${wo.workOrderNumber}`,
                description: wo.description || '',
                status: wo.status as 'new' | 'estimating' | 'scheduled' | 'in_progress' | 'complete' | 'invoiced' | 'paid',
                scheduledDate: wo.scheduledDate,
                completedDate: wo.completedDate,
                estimatedValue: wo.totalCost || 0,
                actualValue: wo.actualCost,
                assignedTeam: [], // Add team assignment logic if available
                materials: [], // Add materials logic if available  
                notes: wo.notes
              }))}
              onStatusChange={handleStatusChange}
              onScheduleInspection={() => setShowAppointmentModal(true)}
              onCreateQuote={openNewQuote}
            />
          </div>
        )}

        {activeTab === 'survey' && (
          <div className="space-y-6">
            <CustomerSurvey
              contact={contact}
              companyGoogleUrl="https://www.google.com/search?q=TrussCTR+reviews" // Replace with actual Google Business URL
              onSurveyComplete={handleSurveyComplete}
              onClose={() => setActiveTab('overview')}
            />
          </div>
        )}

        {activeTab === 'insurance' && (
          <div className="space-y-6">
            {(() => {
              const propertyAddress = [contact.address, contact.city, [contact.state, contact.zip].filter(Boolean).join(' ')]
                .filter(Boolean)
                .join(', ');
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Live radar for this property</p>
                    <p className="text-xs text-gray-600">
                      {propertyAddress
                        ? `Current radar, active warnings and today's storm reports around ${propertyAddress}.`
                        : 'Add an address to this contact to see live radar for the property.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!propertyAddress}
                    onClick={() => openLiveRadar(dispatch, { address: propertyAddress, label: propertyAddress, state: contact.state || null })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Radio size={16} /> View live radar
                  </button>
                </div>
              );
            })()}
            <HailTracePanel
              address={contact.address || ''}
              city={contact.city || ''}
              state={contact.state || ''}
              zip={contact.zip || ''}
              companyId={effectiveCompanyId || ''}
              contactId={contact.id}
              contactName={getContactFullName(contact)}
              onEventsFound={async (count, severities) => {
                const hasSevere = severities.some(s => s === 'severe');
                try {
                  await db.createNotification({
                    company_id: effectiveCompanyId || '',
                    user_id: profile?.id,
                    type: 'hail_event',
                    title: `${hasSevere ? '🚨' : '⚡'} Hail Event — ${getContactFullName(contact)}`,
                    message: `${count} storm event(s) (${severities.join(', ')}) detected at ${contact.address || 'this property'}. Review the insurance tab for details.`,
                    related_id: contact.id,
                    related_type: 'contact',
                    read: false,
                  });
                } catch { /* non-critical */ }
              }}
              onStartClaim={() => {
                // Scroll user to the InsuranceTrackingView below
                setTimeout(() => {
                  document.querySelector('[data-section="insurance-claims"]')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            />
            <div data-section="insurance-claims">
              <InsuranceTrackingView
                contactId={contact.id}
                contactName={getContactFullName(contact)}
              />
            </div>
            <SupplementTrackingView
              contactId={contact.id}
              contactName={getContactFullName(contact)}
            />
          </div>
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Communication Templates</h3>
                  <p className="text-gray-500 mt-1">For {getContactFullName(contact)}</p>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {communicationTemplates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {template.type === 'email' ? (
                          <Mail size={20} className="text-blue-600" />
                        ) : (
                          <MessageSquare size={20} className="text-green-600" />
                        )}
                        <h4 className="font-medium text-gray-900">{template.title}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        template.type === 'email' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {template.type.toUpperCase()}
                      </span>
                    </div>
                    
                    {template.subject && (
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Subject: {template.subject}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {template.content.substring(0, 150)}...
                    </p>
                    
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Zap size={16} />
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Message Preview/Edit Modal */}
      {templateMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Review & Send Message</h3>
              <button onClick={() => setTemplateMessage('')} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <p className="text-gray-900">{getContactFullName(contact)} ({contact.email || contact.phone1})</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={templateMessage}
                  onChange={(e) => setTemplateMessage(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setTemplateMessage('')} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!templateMessage.trim()) return;
                  if (!effectiveCompanyId) {
                    toast.error('No company context. Please refresh and sign in again.');
                    return;
                  }
                  const created = await db.createCommunication({
                    company_id: effectiveCompanyId,
                    contact_id: contact.id,
                    type: 'email',
                    direction: 'outbound',
                    content: templateMessage.trim(),
                    user_id: profile?.id,
                  });
                  if (!created) {
                    toast.error('Failed to save message. Please try again.');
                    return;
                  }
                  const newComm: Communication = {
                    id: created.id,
                    contactId: contact.id,
                    type: 'email',
                    direction: 'outbound',
                    content: templateMessage.trim(),
                    timestamp: created.created_at || new Date().toISOString(),
                    userId: state.currentUser?.id || 'unknown',
                    userName: state.currentUser?.name || 'Unknown User',
                  };
                  dispatch({ type: 'UPDATE_CONTACT', payload: {
                    ...contact,
                    communications: [...(contact.communications || []), newComm],
                    updatedAt: new Date().toISOString(),
                  }});
                  setTemplateMessage('');
                  toast.success('Message saved to timeline');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Send size={16} />
                Save to Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Survey Modal */}
      {showSurveyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full">
            <CustomerSurvey
              contact={contact}
              companyGoogleUrl="https://www.google.com/search?q=TrussCTR+reviews" // Replace with actual Google Business URL
              onSurveyComplete={handleSurveyComplete}
              onClose={() => setShowSurveyModal(false)}
              autoTrigger={true}
            />
          </div>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">{editingProjectInDetail ? 'Edit Project' : 'Create Project'}</h2>
                <button
                  onClick={() => { setShowProjectModal(false); setEditingProjectInDetail(null); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const materialCostGoal = parseFloat(formData.get('material_cost_goal') as string) || 0;
                const subcontractorCostGoal = parseFloat(formData.get('subcontractor_cost_goal') as string) || 0;
                const laborCostGoal = parseFloat(formData.get('labor_cost_goal') as string) || 0;
                const otherCostGoal = parseFloat(formData.get('other_cost_goal') as string) || 0;
                const materialCostActual = parseFloat(formData.get('material_cost') as string) || 0;
                const subcontractorCostActual = parseFloat(formData.get('subcontractor_cost') as string) || 0;
                const laborCostActual = parseFloat(formData.get('labor_cost') as string) || 0;
                const otherCostActual = parseFloat(formData.get('other_cost') as string) || 0;
                const actualCostTotal = materialCostActual + subcontractorCostActual + laborCostActual + otherCostActual;
                const projectData = {
                  company_id: profile?.company_id,
                  contact_id: contactId,
                  project_number: editingProjectInDetail?.projectNumber || `PRJ-${Date.now()}`,
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  status: formData.get('status') as string || 'planning',
                  priority: formData.get('priority') as string || 'medium',
                  start_date: (formData.get('start_date') as string) || undefined,
                  end_date: (formData.get('end_date') as string) || undefined,
                  estimated_budget: parseFloat(formData.get('estimated_budget') as string) || 0,
                  actual_cost: actualCostTotal,
                  material_cost_goal: materialCostGoal,
                  subcontractor_cost_goal: subcontractorCostGoal,
                  labor_cost_goal: laborCostGoal,
                  other_cost_goal: otherCostGoal,
                  material_cost: materialCostActual,
                  subcontractor_cost: subcontractorCostActual,
                  labor_cost: laborCostActual,
                  other_cost: otherCostActual,
                  address: (formData.get('address') as string) || undefined,
                  city: (formData.get('city') as string) || undefined,
                  state: (formData.get('state') as string) || undefined,
                  zip: (formData.get('zip') as string) || undefined,
                  project_manager_id: (formData.get('project_manager_id') as string) || profile?.id || undefined,
                  notes: (formData.get('notes') as string) || undefined,
                  updated_at: new Date().toISOString(),
                  ...(!editingProjectInDetail && { created_by: profile?.id || undefined, created_at: new Date().toISOString() }),
                };

                try {
                  let saved;
                  if (editingProjectInDetail) {
                    saved = await db.updateProject(editingProjectInDetail.id, projectData);
                    if (saved) toast.success('Project updated successfully');
                  } else {
                    saved = await db.createProject(projectData);
                    if (saved) toast.success('Project created successfully');
                  }
                  if (saved) {
                    setShowProjectModal(false);
                    setEditingProjectInDetail(null);
                    const projects = await db.getProjectsByContact(contactId!);
                    setContactProjects(projects);
                  } else {
                    toast.error(editingProjectInDetail ? 'Failed to update project' : 'Failed to create project');
                  }
                } catch (err: any) {
                  toast.error(err.message || 'Failed to save project');
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  key={editingProjectInDetail?.id || 'new'}
                  type="text"
                  name="name"
                  required
                  defaultValue={editingProjectInDetail?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingProjectInDetail?.description || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Project description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={editingProjectInDetail?.status || 'planning'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    defaultValue={editingProjectInDetail?.priority || 'medium'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={editingProjectInDetail?.startDate || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    defaultValue={editingProjectInDetail?.endDate || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Budget
                </label>
                <input
                  type="number"
                  name="estimated_budget"
                  step="0.01"
                  min="0"
                  defaultValue={editingProjectInDetail?.estimatedBudget || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* Cost Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-200">
                    <span>Category</span><span className="text-right">Budgeted</span><span className="text-right">Actual</span>
                  </div>
                  {[
                    { label: 'Materials', goalName: 'material_cost_goal', actualName: 'material_cost', goalVal: editingProjectInDetail?.materialCostGoal, actualVal: editingProjectInDetail?.actualMaterialCost },
                    { label: 'Subcontractors', goalName: 'subcontractor_cost_goal', actualName: 'subcontractor_cost', goalVal: editingProjectInDetail?.subcontractorCostGoal, actualVal: editingProjectInDetail?.actualSubcontractorCost },
                    { label: 'Labor / Payroll', goalName: 'labor_cost_goal', actualName: 'labor_cost', goalVal: editingProjectInDetail?.salesRepPayGoal, actualVal: editingProjectInDetail?.actualSalesRepPay },
                    { label: 'Other', goalName: 'other_cost_goal', actualName: 'other_cost', goalVal: editingProjectInDetail?.otherExpensesGoal, actualVal: editingProjectInDetail?.actualOtherExpenses },
                  ].map(({ label, goalName, actualName, goalVal, actualVal }) => (
                    <div key={label} className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-sm text-gray-700 font-medium">{label}</span>
                      <input type="number" name={goalName} min="0" step="0.01" placeholder="0.00" defaultValue={goalVal || ''}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="number" name={actualName} min="0" step="0.01" placeholder="0.00" defaultValue={actualVal || ''}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Manager */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Manager
                </label>
                <select
                  name="project_manager_id"
                  defaultValue={editingProjectInDetail?.projectManagerId || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No manager assigned</option>
                  {state.teamMembers.filter(m => m.isActive).map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              {/* Project Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Location</h3>
                <div className="space-y-3">
                  <input type="text" name="address" placeholder="Street Address" defaultValue={editingProjectInDetail?.address || contact?.address || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" name="city" placeholder="City" defaultValue={editingProjectInDetail?.city || contact?.city || ''}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <input type="text" name="state" placeholder="State" defaultValue={editingProjectInDetail?.state || contact?.state || ''}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <input type="text" name="zip" placeholder="ZIP" defaultValue={editingProjectInDetail?.zip || contact?.zip || ''}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea name="notes" rows={3} placeholder="Additional notes..." defaultValue={editingProjectInDetail?.notes || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowProjectModal(false); setEditingProjectInDetail(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingProjectInDetail ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project View Modal */}
      {viewingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{viewingProject.name}</h2>
                <p className="text-sm text-gray-500 mt-1">#{viewingProject.projectNumber} · {contact ? getContactFullName(contact) : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  viewingProject.status === 'completed' ? 'bg-green-100 text-green-800'
                  : viewingProject.status === 'in_progress' ? 'bg-blue-100 text-blue-800'
                  : viewingProject.status === 'planning' ? 'bg-purple-100 text-purple-800'
                  : viewingProject.status === 'on_hold' ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-800'
                }`}>{viewingProject.status?.replace(/_/g, ' ')}</span>
                {viewingProject.priority && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    viewingProject.priority === 'urgent' ? 'bg-red-100 text-red-700'
                    : viewingProject.priority === 'high' ? 'bg-orange-100 text-orange-700'
                    : viewingProject.priority === 'medium' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>{viewingProject.priority}</span>
                )}
                <button onClick={() => setViewingProject(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Dates + Manager */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><p className="text-gray-500 mb-1">Start Date</p><p className="font-medium">{viewingProject.startDate ? formatDate(viewingProject.startDate) : '—'}</p></div>
                <div><p className="text-gray-500 mb-1">End Date</p><p className="font-medium">{viewingProject.endDate ? formatDate(viewingProject.endDate) : '—'}</p></div>
                <div><p className="text-gray-500 mb-1">Completed</p><p className="font-medium">{viewingProject.completedDate ? formatDate(viewingProject.completedDate) : '—'}</p></div>
                <div><p className="text-gray-500 mb-1">Project Manager</p><p className="font-medium">{viewingProject.projectManagerName || '—'}</p></div>
              </div>

              {/* Description */}
              {viewingProject.description && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Description</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewingProject.description}</p>
                </div>
              )}

              {/* Budget + Cost Breakdown */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Financials</p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 border-b border-gray-200">
                    <span>Category</span><span className="text-right">Budgeted</span><span className="text-right">Actual</span>
                  </div>
                  {[
                    { label: 'Contract / Budget', goal: viewingProject.estimatedBudget, actual: null, isBudget: true },
                    { label: 'Materials', goal: viewingProject.materialCostGoal, actual: viewingProject.actualMaterialCost },
                    { label: 'Subcontractors', goal: viewingProject.subcontractorCostGoal, actual: viewingProject.actualSubcontractorCost },
                    { label: 'Labor / Payroll', goal: viewingProject.salesRepPayGoal, actual: viewingProject.actualSalesRepPay },
                    { label: 'Other', goal: viewingProject.otherExpensesGoal, actual: viewingProject.actualOtherExpenses },
                  ].map(({ label, goal, actual, isBudget }) => (
                    <div key={label} className={`grid grid-cols-3 gap-2 text-sm ${isBudget ? 'font-semibold text-indigo-700 border-b border-gray-200 pb-2' : ''}`}>
                      <span className={isBudget ? '' : 'text-gray-700'}>{label}</span>
                      <span className="text-right">{goal ? formatCurrency(goal) : '—'}</span>
                      <span className="text-right">{actual !== null && actual !== undefined ? formatCurrency(actual) : '—'}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2 text-sm font-bold border-t border-gray-300 pt-2">
                    <span className="text-gray-900">Total Costs</span>
                    <span className="text-right text-gray-700">{formatCurrency((viewingProject.materialCostGoal || 0) + (viewingProject.subcontractorCostGoal || 0) + (viewingProject.salesRepPayGoal || 0) + (viewingProject.otherExpensesGoal || 0))}</span>
                    <span className="text-right text-gray-700">{formatCurrency(viewingProject.actualCost || 0)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm font-bold">
                    <span className="text-green-700">Est. Profit</span>
                    <span className={`text-right ${(viewingProject.estimatedBudget || 0) - ((viewingProject.materialCostGoal || 0) + (viewingProject.subcontractorCostGoal || 0) + (viewingProject.salesRepPayGoal || 0) + (viewingProject.otherExpensesGoal || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency((viewingProject.estimatedBudget || 0) - ((viewingProject.materialCostGoal || 0) + (viewingProject.subcontractorCostGoal || 0) + (viewingProject.salesRepPayGoal || 0) + (viewingProject.otherExpensesGoal || 0)))}
                    </span>
                    <span className={`text-right ${(viewingProject.estimatedBudget || 0) - (viewingProject.actualCost || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency((viewingProject.estimatedBudget || 0) - (viewingProject.actualCost || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location */}
              {(viewingProject.address || viewingProject.city) && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Project Location</p>
                  <p className="text-sm text-gray-600">{[viewingProject.address, viewingProject.city, viewingProject.state, viewingProject.zip].filter(Boolean).join(', ')}</p>
                </div>
              )}

              {/* Notes */}
              {viewingProject.notes && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewingProject.notes}</p>
                </div>
              )}

              {/* Linked Work Orders */}
              {(() => {
                const linkedWOs = state.workOrders.filter(wo => wo.projectId === viewingProject.id);
                return linkedWOs.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Work Orders ({linkedWOs.length})</p>
                    <div className="space-y-2">
                      {linkedWOs.map(wo => (
                        <div key={wo.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-900">#{wo.workOrderNumber}</span>
                            <span className="text-gray-500 ml-2">{wo.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wo.status === 'completed' ? 'bg-green-100 text-green-700' : wo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{wo.status.replace('_', ' ')}</span>
                            <span className="font-semibold text-gray-700">{formatCurrency(wo.totalCost || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Linked Material Orders */}
              {(() => {
                const linkedMOs = state.materialOrders.filter(mo => (mo as any).projectId === viewingProject.id || mo.jobId === viewingProject.id);
                return linkedMOs.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Material Orders ({linkedMOs.length})</p>
                    <div className="space-y-2">
                      {linkedMOs.map(mo => (
                        <div key={mo.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-900">#{mo.orderNumber}</span>
                            <span className="text-gray-500 ml-2">{mo.supplierName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${mo.status === 'delivered' ? 'bg-green-100 text-green-700' : mo.status === 'ordered' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{mo.status}</span>
                            <span className="font-semibold text-gray-700">{formatCurrency(mo.total || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button onClick={() => setViewingProject(null)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingProjectInDetail(viewingProject); setViewingProject(null); setShowProjectModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  <Edit2 size={14} /> Edit Project
                </button>
                <button
                  onClick={() => { setViewingProject(null); dispatch({ type: 'SET_VIEW', payload: 'projects' }); }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <ExternalLink size={14} /> Open in Projects
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Order Modal */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create Work Order</h2>
                <button
                  onClick={() => setShowWorkOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const laborCost = parseFloat(formData.get('labor_cost') as string) || 0;
                const materialCost = parseFloat(formData.get('material_cost') as string) || 0;
                const totalCost = laborCost + materialCost;

                // Get selected project if any
                const projectId = formData.get('project_id') as string;

                const workOrderData = {
                  company_id: profile?.company_id,
                  contact_id: contactId,
                  project_id: projectId || undefined,
                  work_order_number: `WO-${Date.now()}`,
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  // work_orders.status has no 'pending'; new work orders start as scheduled.
                  status: formData.get('status') as string || 'scheduled',
                  priority: formData.get('priority') as string || 'medium',
                  scheduled_date: (formData.get('scheduled_date') as string) || undefined,
                  estimated_hours: parseFloat(formData.get('estimated_hours') as string) || 0,
                  assigned_to: [],
                  labor_cost: laborCost,
                  material_cost: materialCost,
                  total_cost: totalCost,
                  created_by: profile?.id || undefined,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                try {
                  const newWorkOrder = await db.createWorkOrder(workOrderData);
                  if (newWorkOrder) {
                    toast.success('Work order created successfully');
                    setShowWorkOrderModal(false);
                    // Reload data
                    if (contactId) {
                      const workOrders = await db.getWorkOrdersByContact(contactId);
                      setContactWorkOrders(workOrders);
                    }
                  } else {
                    toast.error('Failed to create work order');
                  }
                } catch (err) {
                  console.error('Error creating work order:', err);
                  toast.error(err instanceof Error ? err.message : 'Failed to create work order');
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Order Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter work order title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link to Project (Optional)
                </label>
                <select
                  name="project_id"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">No project</option>
                  {contactProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} (#{project.projectNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Work order description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    name="scheduled_date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    name="estimated_hours"
                    step="0.5"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Labor Cost
                  </label>
                  <input
                    type="number"
                    name="labor_cost"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Cost
                  </label>
                  <input
                    type="number"
                    name="material_cost"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowWorkOrderModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        preselectedContactId={contact.id}
      />

      {/* Template Modal — create a document from a template and attach it to this customer */}
      {showTemplateModal && (
        <ContactTemplateModal
          contact={contact}
          onClose={() => { setShowTemplateModal(false); setTemplateRoofrData(undefined); }}
          onDocumentSaved={(doc) => {
            setContactDocuments(prev => [doc, ...prev]);
          }}
          roofrData={templateRoofrData}
        />
      )}

      {/* Change Order Modal */}
      <ChangeOrderModal
        isOpen={showChangeOrderModal}
        onClose={() => { setShowChangeOrderModal(false); setViewingChangeOrder(null); }}
        onSave={async () => {
          setShowChangeOrderModal(false);
          setViewingChangeOrder(null);
          // Reload change orders after save
          if (contactId) {
            const { data } = await supabase
              .from('change_orders')
              .select('*')
              .eq('contact_id', contactId)
              .order('created_at', { ascending: false });
            setContactChangeOrders((data as ChangeOrder[]) ?? []);
          }
        }}
        contactId={contact.id}
        contactName={getContactFullName(contact)}
        contactEmail={contact.email ?? undefined}
        changeOrder={viewingChangeOrder}
        companyId={profile?.company_id || ''}
      />

      {/* In-app document viewer for template documents (HTML-based) */}
      {viewingDocHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl" style={{ height: '92vh' }}>
            {/* Viewer header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-blue-600" />
                <h2 className="text-base font-bold text-gray-900 truncate max-w-lg">{viewingDocHtml.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadDoc({ id: '', contactId: contact.id, name: viewingDocHtml.name, type: 'other', url: '', uploadedAt: '', uploadedBy: '', size: '', htmlContent: viewingDocHtml.html })}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download size={15} /> Download PDF
                </button>
                <button
                  onClick={() => setViewingDocHtml(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
            {/* Document preview */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                <iframe
                  srcDoc={viewingDocHtml.html}
                  className="w-full border-0"
                  style={{ minHeight: '800px', height: '100%' }}
                  title="Document View"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document naming dialog */}
      {showUploadNameDialog && pendingUploadFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Name Your Document</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Original file</p>
                <p className="text-sm text-gray-400 truncate">{pendingUploadFile.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document name</label>
                <input
                  type="text"
                  value={pendingUploadName}
                  onChange={(e) => setPendingUploadName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter document name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Folder / Category</label>
                <select
                  value={pendingUploadCategory}
                  onChange={(e) => setPendingUploadCategory(e.target.value as typeof pendingUploadCategory)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="insurance">Insurance Documents</option>
                  <option value="contract">Contracts</option>
                  <option value="estimate">Estimates</option>
                  <option value="invoice">Invoices</option>
                  <option value="photo">Photos</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelUploadDialog}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={!pendingUploadName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
