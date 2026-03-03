import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCRM, useCurrentContact } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import {
  applyMention,
  findActiveMentionQuery,
  getMentionSuggestions,
  getMentionTargets,
  validateMentions,
} from '@/lib/mentions';
import { uploadDocument, validateDocumentFile, formatFileSize, getDocumentSignedUrl, isHttpUrl } from '@/lib/storage';
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
} from 'lucide-react';

type TabType = 'overview' | 'timeline' | 'documents' | 'financial' | 'projects';

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
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [contactDocuments, setContactDocuments] = useState<Document[]>([]);
  
  // Project-related data
  const [contactProjects, setContactProjects] = useState<any[]>([]);
  const [contactEstimates, setContactEstimates] = useState<any[]>([]);
  const [contactWorkOrders, setContactWorkOrders] = useState<any[]>([]);
  const [contactMaterialOrders, setContactMaterialOrders] = useState<any[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  
  const noteInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mentionTargets = useMemo(() => getMentionTargets(state.teamMembers), [state.teamMembers]);
  const contactId = contact?.id;
  const contactNotes = contact?.notes ?? '';

  useEffect(() => {
    if (!contactId) return;
    setQuickNote(contactNotes);
  }, [contactId, contactNotes]);

  // Load contact projects, estimates, work orders, and material orders
  useEffect(() => {
    const loadContactRelatedData = async () => {
      if (!contactId || !profile?.company_id) return;

      console.log(`[ContactDetail] Loading related data for contact: ${contactId}`);
      
      // Load projects for this contact
      const projects = state.projects.filter(p => p.contactId === contactId);
      setContactProjects(projects);
      
      // Load estimates for this contact
      const estimates = state.estimates.filter(e => e.contactId === contactId);
      setContactEstimates(estimates);
      
      // Load work orders for this contact
      const workOrders = state.workOrders.filter(wo => wo.contactId === contactId);
      setContactWorkOrders(workOrders);
      
      // Load material orders for this contact
      const materialOrders = state.materialOrders.filter(mo => mo.contactId === contactId);
      setContactMaterialOrders(materialOrders);
      
      console.log(`[ContactDetail] Loaded: ${projects.length} projects, ${estimates.length} estimates, ${workOrders.length} work orders, ${materialOrders.length} material orders`);
    };

    loadContactRelatedData();
  }, [contactId, profile?.company_id, state.projects, state.estimates, state.workOrders, state.materialOrders]);

  // Load contact documents with signed URLs
  useEffect(() => {
    const loadContactDocuments = async () => {
      if (!contactId) {
        setContactDocuments([]);
        return;
      }

      console.log(`[ContactDetail] Loading documents for contact: ${contactId}`);
      const docs = await db.getDocumentsByContact(contactId);
      console.log(`[ContactDetail] Found ${docs.length} document(s) for this contact`);

      const docsWithSignedUrls = await Promise.all(
        docs.map(async (doc) => {
          // Store the path in the URL field, signed URLs will be created on-demand when opening
          const url = doc.url;

          return {
            id: doc.id,
            contactId: doc.contact_id || '',
            name: doc.name,
            type: doc.type as 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other',
            url,  // Store path, not signed URL - we'll create signed URLs on-demand
            uploadedAt: doc.created_at,
            uploadedBy: doc.uploaded_by || 'Team member',
            size: doc.size || 'Unknown',
          };
        })
      );

      setContactDocuments(docsWithSignedUrls);
    };

    loadContactDocuments();
  }, [contactId]);

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contactId) return;

    if (!effectiveCompanyId) {
      toast.error('No company context available. Please refresh and sign in again.');
      return;
    }

    const validationError = validateDocumentFile(file, 15);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    console.log(`[ContactDetail] Uploading document: ${file.name} for contact ${contactId}`);
    setIsUploadingDocument(true);

    try {
      const uploadResult = await uploadDocument(file, effectiveCompanyId, contactId);

      if (uploadResult.error) {
        console.error('[ContactDetail] Upload failed:', uploadResult.error);
        toast.error(`Upload failed: ${uploadResult.error}`);
        setIsUploadingDocument(false);
        event.target.value = '';
        return;
      }

      console.log(`[ContactDetail] Upload successful, path: ${uploadResult.path}`);

      // Verify the file exists
      const verifyUrl = await getDocumentSignedUrl(uploadResult.path, 60);
      if (!verifyUrl) {
        console.error('[ContactDetail] File upload succeeded but verification failed');
        toast.error('Upload completed but file verification failed.');
        setIsUploadingDocument(false);
        event.target.value = '';
        return;
      }

      // Infer document category
      const inferCategory = (file: File): 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other' => {
        const fileName = file.name.toLowerCase();
        if (fileName.includes('contract')) return 'contract';
        if (fileName.includes('estimate')) return 'estimate';
        if (fileName.includes('invoice')) return 'invoice';
        if (file.type.startsWith('image/')) return 'photo';
        if (fileName.includes('insurance')) return 'insurance';
        return 'other';
      };

      const category = inferCategory(file);
      const created = await db.createDocument({
        company_id: effectiveCompanyId,
        contact_id: contactId,
        name: file.name,
        type: category,
        url: uploadResult.path,
        size: formatFileSize(file.size),
        uploaded_by: profile?.id,
      });

      if (!created) {
        console.error('[ContactDetail] Failed to save document record');
        toast.error('File uploaded but failed to save document record');
        setIsUploadingDocument(false);
        event.target.value = '';
        return;
      }

      console.log(`[ContactDetail] Document record saved with ID: ${created.id}`);

      const newDoc: Document = {
        id: created.id,
        contactId: created.contact_id || '',
        name: created.name,
        type: created.type as 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other',
        url: created.url,  // Store the path, not signed URL
        uploadedAt: created.created_at,
        uploadedBy: created.uploaded_by || 'Team member',
        size: created.size || formatFileSize(file.size),
      };

      setContactDocuments((prev) => [newDoc, ...prev]);
      toast.success(`${file.name} uploaded successfully!`);
    } catch (error) {
      console.error('[ContactDetail] Document upload error:', error);
      toast.error('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploadingDocument(false);
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const confirmed = window.confirm('Delete this document?');
    if (!confirmed) return;

    const ok = await db.deleteDocument(docId);
    if (!ok) {
      toast.error('Failed to delete document');
      return;
    }

    setContactDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    toast.success('Document deleted');
  };

  const handleOpenDocument = async (url?: string, docName?: string) => {
    if (!url) {
      console.error('[ContactDetail] Document URL is missing');
      toast.error('Document URL not available. The document may not have been uploaded correctly.');
      return;
    }

    console.log(`[ContactDetail] Opening document: ${docName || 'unknown'}`);
    console.log(`[ContactDetail] URL type: ${isHttpUrl(url) ? 'HTTP URL' : 'Storage path'}`);

    try {
      // If it's already a full HTTP URL, open it directly
      if (isHttpUrl(url) && !url.includes('/projectceo-documents/')) {
        console.log('[ContactDetail] Opening direct HTTP URL');
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      // If it's a storage path or Supabase URL, try to get/refresh the signed URL
      console.log('[ContactDetail] Attempting to create/refresh signed URL...');
      const signedUrl = await getDocumentSignedUrl(url, 3600);
      
      if (!signedUrl) {
        console.error('[ContactDetail] Failed to create signed URL');
        console.error('[ContactDetail] This usually means:');
        console.error('[ContactDetail]   1. The projectceo-documents bucket does not exist');
        console.error('[ContactDetail]   2. Storage policies are not configured');
        console.error('[ContactDetail]   3. The file was deleted or path is incorrect');
        toast.error(
          'Unable to open document. Check console for details or verify Supabase bucket setup.',
          { duration: 5000 }
        );
        return;
      }

      console.log('[ContactDetail] ✓ Signed URL created, opening document');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('[ContactDetail] Error opening document:', error);
      toast.error('Failed to open document: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Select a contact to view details</p>
      </div>
    );
  }

  const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
  const effectiveCompanyId = profile?.company_id || state.companyId || null;

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

  const handleBack = () => {
    dispatch({ type: 'SELECT_CONTACT', payload: null });
    dispatch({ type: 'SET_VIEW', payload: 'contacts' });
  };

  const handleEdit = () => {
    setEditedContact({ ...contact });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editedContact) return;
    
    setIsSaving(true);
    try {
      if (!effectiveCompanyId) {
        toast.error('No company context available. Please refresh and sign in again.');
        return;
      }

      const updated = await db.updateContact(editedContact.id, {
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
        assigned_to: editedContact.assignedTo,
        insurance_company: editedContact.insuranceCompany,
        policy_number: editedContact.policyNumber,
        claim_number: editedContact.claimNumber,
        adjuster_name: editedContact.adjusterName,
        adjuster_phone: editedContact.adjusterPhone,
        adjuster_email: editedContact.adjusterEmail,
        deductible: editedContact.deductible,
        is_retail: editedContact.isRetail,
        retail_notes: editedContact.retailNotes,
        notes: editedContact.notes,
      });

      if (!updated) {
        toast.error('Failed to save contact changes');
        return;
      }

      dispatch({ type: 'UPDATE_CONTACT', payload: { ...editedContact, updatedAt: new Date().toISOString() } });
      setIsEditing(false);
      setEditedContact(null);
      toast.success('Contact saved');
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContact(null);
  };

  const handleStatusChange = async (newStatus: CustomerStatus) => {
    try {
      if (!effectiveCompanyId) {
        toast.error('No company context available. Please refresh and sign in again.');
        return;
      }

      const updated = await db.updateContact(contact.id, { status: newStatus });
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
      if (!effectiveCompanyId) {
        toast.error('No company context available. Please refresh and sign in again.');
        return;
      }

      const createdCommunication = await db.createCommunication({
        company_id: effectiveCompanyId,
        contact_id: contact.id,
        type: 'note',
        direction: 'outbound',
        content: newNote,
        user_id: profile?.id,
      });

      if (!createdCommunication) {
        toast.error('Failed to save note');
        return;
      }

      const newComm: Communication = {
        id: createdCommunication.id,
        contactId: contact.id,
        type: 'note',
        direction: 'outbound',
        content: newNote,
        timestamp: createdCommunication.created_at || new Date().toISOString(),
        userId: state.currentUser?.id || 'unknown',
        userName: state.currentUser?.name || 'Unknown User',
      };

      const updatedContact = {
        ...contact,
        communications: [...(contact.communications || []), newComm],
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_CONTACT', payload: updatedContact });
      setNewNote('');
      setMentionStart(null);
      setMentionSuggestions([]);
      toast.success('Note saved');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleSaveQuickNote = async () => {
    const trimmed = quickNote.trim();

    setIsSavingQuickNote(true);
    try {
      if (profile?.company_id) {
        const updated = await db.updateContact(contact.id, { notes: trimmed || null });
        if (!updated) {
          toast.error('Failed to save note');
          return;
        }
      }

      dispatch({
        type: 'UPDATE_CONTACT',
        payload: {
          ...contact,
          notes: trimmed || undefined,
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
    dispatch({ type: 'SET_VIEW', payload: 'calendar' });
    toast.info('Use New Appointment in Calendar to schedule this customer');
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
    { id: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign size={16} /> },
    { id: 'projects', label: 'Projects', icon: <Briefcase size={16} /> },
  ];

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
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {contact.firstName[0]}
                {contact.lastName[0]}
              </div>
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
                          setEditedContact({ ...currentData, phone1: e.target.value })
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
                          setEditedContact({ ...currentData, phone2: e.target.value })
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
                                setEditedContact({ ...currentData, adjusterPhone: e.target.value })
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

              {/* Notes */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                {isEditing ? (
                  <textarea
                    value={currentData.notes || ''}
                    onChange={(e) =>
                      setEditedContact({ ...currentData, notes: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {contact.notes || 'No notes added yet.'}
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
                  <button onClick={handleScheduleAppointment} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Calendar size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Schedule Appointment</span>
                  </button>
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
                    placeholder="Add a note... use @jnewell to tag teammates"
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
                {(contact.communications || [])
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
                {(!contact.communications || contact.communications.length === 0) && (
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
          <div className="bg-white rounded-xl border border-gray-200">
            <input
              ref={documentInputRef}
              type="file"
              className="hidden"
              onChange={handleUploadDocument}
              disabled={isUploadingDocument}
            />
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
              <button 
                onClick={() => documentInputRef.current?.click()} 
                disabled={isUploadingDocument}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingDocument ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {isUploadingDocument ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {contactDocuments.map((doc) => (
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
                    <button 
                      onClick={() => handleOpenDocument(doc.url, doc.name)} 
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View document"
                    >
                      <Eye size={18} className="text-gray-500" />
                    </button>
                    <button 
                      onClick={() => handleOpenDocument(doc.url, doc.name)} 
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download document"
                    >
                      <Download size={18} className="text-gray-500" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDocument(doc.id)} 
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
              {contactDocuments.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <FileText size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No documents uploaded yet</p>
                  <button 
                    onClick={() => documentInputRef.current?.click()}
                    className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Upload your first document
                  </button>
                </div>
              )}
            </div>
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

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Actions</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_INVOICE_MODAL' })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Create Invoice
                </button>
                <button onClick={() => { dispatch({ type: 'SET_VIEW', payload: 'financial' }); dispatch({ type: 'TOGGLE_INVOICE_MODAL' }); }} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
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
                    <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">{project.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">#{project.projectNumber}</p>
                        </div>
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
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Budget</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(project.estimatedBudget || 0)}</p>
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

            {/* Estimates Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText size={20} />
                  Estimates ({contactEstimates.length})
                </h3>
                <button
                  onClick={() => setShowEstimateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus size={18} />
                  New Estimate
                </button>
              </div>

              {contactEstimates.length > 0 ? (
                <div className="grid gap-4">
                  {contactEstimates.map((estimate) => (
                    <div key={estimate.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">Estimate #{estimate.estimateNumber}</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Created {formatDate(estimate.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            estimate.status === 'accepted'
                              ? 'bg-green-100 text-green-800'
                              : estimate.status === 'sent'
                              ? 'bg-blue-100 text-blue-800'
                              : estimate.status === 'viewed'
                              ? 'bg-purple-100 text-purple-800'
                              : estimate.status === 'declined'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {estimate.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Amount</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(estimate.total || 0)}</p>
                        </div>
                        {estimate.acceptedAt && (
                          <div>
                            <p className="text-gray-500">Accepted On</p>
                            <p className="font-medium text-green-600">{formatDate(estimate.acceptedAt)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <FileText size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No estimates yet</p>
                  <button
                    onClick={() => setShowEstimateModal(true)}
                    className="mt-4 text-green-600 hover:text-green-700 font-medium"
                  >
                    Create your first estimate
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
                          <p className="font-medium text-gray-900">{workOrder.estimatedHours || 0}h</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Cost</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(workOrder.totalCost || 0)}</p>
                        </div>
                      </div>
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
                    dispatch({ type: 'SET_VIEW', payload: 'materialOrders' });
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
                      dispatch({ type: 'SET_VIEW', payload: 'materialOrders' });
                      toast.info('Create a material order and link it to this customer');
                    }}
                    className="mt-4 text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Create your first material order
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create Project</h2>
                <button
                  onClick={() => setShowProjectModal(false)}
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
                const projectData = {
                  company_id: profile?.company_id,
                  contact_id: contactId,
                  project_number: `PRJ-${Date.now()}`,
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  status: formData.get('status') as string || 'planning',
                  priority: formData.get('priority') as string || 'medium',
                  start_date: formData.get('start_date') as string,
                  end_date: formData.get('end_date') as string,
                  estimated_budget: parseFloat(formData.get('estimated_budget') as string) || 0,
                  actual_cost: 0,
                  project_manager_id: profile?.id,
                  created_by: profile?.id!,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                const newProject = await db.createProject(projectData);
                if (newProject) {
                  toast.success('Project created successfully');
                  setShowProjectModal(false);
                  // Reload data
                  const projects = await db.getProjectsByContact(contactId!);
                  setContactProjects(projects);
                } else {
                  toast.error('Failed to create project');
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estimate Modal */}
      {showEstimateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create Estimate</h2>
                <button
                  onClick={() => setShowEstimateModal(false)}
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
                const amount = parseFloat(formData.get('amount') as string) || 0;
                const taxRate = parseFloat(formData.get('tax_rate') as string) || 0;
                const tax = amount * (taxRate / 100);
                const total = amount + tax;

                const estimateData = {
                  company_id: profile?.company_id,
                  contact_id: contactId,
                  estimate_number: `EST-${Date.now()}`,
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  status: 'draft',
                  amount: amount,
                  tax: tax,
                  total: total,
                  valid_until: formData.get('valid_until') as string,
                  terms: formData.get('terms') as string,
                  notes: formData.get('notes') as string,
                  created_by: profile?.id!,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                const newEstimate = await db.createEstimate(estimateData);
                if (newEstimate) {
                  toast.success('Estimate created successfully');
                  setShowEstimateModal(false);
                  // Reload data
                  const estimates = await db.getEstimatesByContact(contactId!);
                  setContactEstimates(estimates);
                } else {
                  toast.error('Failed to create estimate');
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimate Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter estimate title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Estimate description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    required
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    name="tax_rate"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  name="valid_until"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  name="terms"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Payment terms, conditions, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Internal notes"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEstimateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Create Estimate
                </button>
              </div>
            </form>
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
                  status: formData.get('status') as string || 'pending',
                  priority: formData.get('priority') as string || 'medium',
                  scheduled_date: formData.get('scheduled_date') as string,
                  estimated_hours: parseFloat(formData.get('estimated_hours') as string) || 0,
                  assigned_to: [],
                  labor_cost: laborCost,
                  material_cost: materialCost,
                  total_cost: totalCost,
                  created_by: profile?.id!,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                const newWorkOrder = await db.createWorkOrder(workOrderData);
                if (newWorkOrder) {
                  toast.success('Work order created successfully');
                  setShowWorkOrderModal(false);
                  // Reload data
                  const workOrders = await db.getWorkOrdersByContact(contactId!);
                  setContactWorkOrders(workOrders);
                } else {
                  toast.error('Failed to create work order');
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
                    <option value="pending">Pending</option>
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
      )}    </div>
  );
}