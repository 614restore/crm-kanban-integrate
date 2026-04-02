import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';
import { fireAutomationEvent } from '@/lib/automationEngine';
import { Estimate, EstimateItem, Contact } from '@/lib/crmData';
import { exportEstimatesToExcel } from '@/lib/exportUtils';
import { SignaturePad } from './SignaturePad';
import { ESTIMATE_TEMPLATES, EstimateTemplate } from '@/lib/estimateTemplates';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Send,
  Eye,
  EyeOff,
  Check,
  XCircle,
  Calendar,
  DollarSign,
  User,
  Clock,
  CheckCircle,
  Download,
  Printer,
  FolderPlus,
  PenLine,
  Mail,
} from 'lucide-react';
import { withTimeout } from '@/lib/utils';

// Status badge component
function StatusBadge({ status }: { status: Estimate['status'] }) {
  const config = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: FileText },
    sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700', icon: Send },
    viewed: { label: 'Viewed', className: 'bg-purple-100 text-purple-700', icon: Eye },
    accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700', icon: CheckCircle },
    declined: { label: 'Declined', className: 'bg-red-100 text-red-700', icon: XCircle },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

export default function EstimatesView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewingEstimate, setViewingEstimate] = useState<Estimate | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState<Estimate | null>(null);
  const [signerName, setSignerName] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [customerViewEstimate, setCustomerViewEstimate] = useState<Estimate | null>(null);
  const [showShareModal, setShowShareModal] = useState<Estimate | null>(null);

  // Form state
  const [selectedContactId, setSelectedContactId] = useState('');
  const [title, setTitle] = useState('');
  const [estimateNumber, setEstimateNumber] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [items, setItems] = useState<EstimateItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'ea', unitPrice: 0, total: 0 }
  ]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [taxRate, setTaxRate] = useState(0);

  // Load estimates when company is available (handles slow auth)
  useEffect(() => {
    if (profile?.company_id) loadEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  const loadEstimates = async () => {
    if (!profile?.company_id) return;
    try {
      const estimates = await db.getEstimates(profile.company_id);
      // Convert DB format to app format
      const appEstimates: Estimate[] = estimates.map((e: any) => ({
        id: e.id,
        contactId: e.contact_id,
        contactName: getContactName(e.contact_id),
        jobId: e.job_id,
        estimateNumber: e.estimate_number,
        title: e.title,
        description: e.description,
        status: e.status,
        amount: Number(e.amount || e.subtotal || 0),
        tax: Number(e.tax),
        total: Number(e.total),
        validUntil: e.valid_until,
        createdAt: e.created_at,
        sentAt: e.sent_at,
        viewedAt: e.viewed_at,
        acceptedAt: e.accepted_at,
        declinedAt: e.declined_at,
        signedBy: e.signed_by,
        signatureData: e.signature_data,
        signToken: e.sign_token,
        items: e.items || [],
        terms: e.terms,
        notes: e.notes,
        createdBy: e.created_by,
        updatedAt: e.updated_at,
      }));
      dispatch({ type: 'SET_ESTIMATES', payload: appEstimates });
    } catch (error) {
      console.error('Error loading estimates:', error);
      toast.error('Failed to load estimates');
    }
  };

  // Helper to convert database estimate to app format
  const mapDbEstimateToApp = (e: any): Estimate => ({
    id: e.id,
    contactId: e.contact_id,
    contactName: getContactName(e.contact_id),
    jobId: e.job_id,
    estimateNumber: e.estimate_number,
    title: e.title,
    description: e.description,
    status: e.status,
    amount: Number(e.amount || e.subtotal || 0),
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
    signToken: e.sign_token,
    items: e.items || [],
    terms: e.terms || e.terms_and_conditions,
    notes: e.notes,
    createdBy: e.created_by,
    updatedAt: e.updated_at,
  });

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  // Update item when fields change
  const updateItem = (index: number, field: keyof EstimateItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total if quantity or unitPrice changed
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'ea', unitPrice: 0, total: 0, hidePrice: false }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleOpenModal = (estimate?: Estimate) => {
    if (estimate) {
      setEditingEstimate(estimate);
      setSelectedContactId(estimate.contactId);
      setTitle(estimate.title);
      setEstimateNumber(estimate.estimateNumber);
      setValidityDate(estimate.validUntil || '');
      setItems(estimate.items);
      setNotes(estimate.notes || '');
      setTerms(estimate.terms || '');
      setTaxRate(estimate.amount > 0 ? (estimate.tax / estimate.amount) * 100 : 0);
    } else {
      // Generate estimate number
      const nextNumber = `EST-${Date.now().toString().slice(-6)}`;
      setEstimateNumber(nextNumber);
      
      // Set default validity (30 days from now)
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setValidityDate(defaultDate.toISOString().split('T')[0]);
    }
    setShowModal(true);
  };

  const handleLoadTemplate = (template: EstimateTemplate) => {
    setTitle(template.name);
    setItems(template.items.map(item => ({ ...item, id: crypto.randomUUID() })));
    setNotes(template.notes || '');
    setTerms(template.terms || '');
    setShowTemplateSelector(false);
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEstimate(null);
    setSelectedContactId('');
    setTitle('');
    setEstimateNumber('');
    setValidityDate('');
    setItems([
      { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'ea', unitPrice: 0, total: 0, hidePrice: false }
    ]);
    setNotes('');
    setTerms('');
    setTaxRate(0);
  };

  const handleSave = async () => {
    if (!profile?.company_id) return;
    
    // Only require a customer and a total > 0 to save as draft
    if (!selectedContactId) {
      toast.error('Please select a customer');
      return;
    }

    const { subtotal, tax, total } = calculateTotals();

    if (total <= 0) {
      toast.error('Please add at least one line item with a total greater than $0');
      return;
    }

    setIsSaving(true);

    // Safety timeout to prevent infinite spinner (30 seconds max)
    const safetyTimeout = setTimeout(() => {
      console.error('EstimateView: Save operation exceeded 30 second limit, forcing reset');
      setIsSaving(false);
      toast.error('Save operation timed out. Please try again.');
    }, 30000);

    try {
      const estimateData = {
        company_id: profile.company_id,
        contact_id: selectedContactId,
        estimate_number: estimateNumber,
        title: title || 'Untitled Estimate',
        items,
        subtotal,
        tax,
        total,
        validity_date: validityDate || undefined,
        status: 'draft' as const,
        notes: notes || undefined,
        terms_and_conditions: terms || undefined,
      };

      if (editingEstimate) {
        const updated = await withTimeout(
          db.updateEstimate(editingEstimate.id, estimateData),
          20000,
          'Update estimate'
        );
        if (updated) {
          dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
          toast.success('Estimate updated');
          handleCloseModal();
        } else {
          toast.error('Failed to save estimate. Please try again.');
        }
      } else {
        const created = await withTimeout(
          db.createEstimate(estimateData),
          20000,
          'Create estimate'
        );
        if (created) {
          dispatch({ type: 'ADD_ESTIMATE', payload: mapDbEstimateToApp(created) });
          toast.success('Estimate created');
          handleCloseModal();
        } else {
          toast.error('Failed to create estimate. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error saving estimate:', error);
      const errorMessage = error?.message || 'Unknown error';
      
      if (errorMessage.includes('timed out')) {
        toast.error('Save timed out - please check your connection and try again');
      } else {
        toast.error(`Failed to save estimate: ${errorMessage}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsSaving(false);
    }
  };

  const handleSendEstimate = async (estimateId: string) => {
    try {
      const estimate = state.estimates.find((e) => e.id === estimateId);
      if (!estimate) { toast.error('Estimate not found'); return; }

      const contact = state.contacts.find((c) => c.id === estimate.contactId);

      // Mark as sent first — this generates the sign_token
      const updated = await db.markEstimateSent(estimateId);
      if (!updated) { toast.error('Failed to mark estimate as sent'); return; }
      dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });

      if (!contact?.email) {
        if (contact && profile?.company_id) {
          // Use centralized status manager for consistent automation
          const { updateContactStatus } = await import('../../lib/statusManager');
          
          updateContactStatus({
            contactId: contact.id,
            newStatus: 'estimate_sent',
            oldStatus: contact.status,
            contactName: `${contact.firstName} ${contact.lastName}`.trim(),
            contactEmail: contact.email || '',
            userId: user?.id || 'system',
            userEmail: user?.email || 'system@trussctr.com',
            companyId: profile.company_id,
            source: 'estimate_manual_sent',
            reason: 'Estimate marked as sent (no email on file)',
          }).then(result => {
            if (result.success) {
              dispatch({
                type: 'UPDATE_CONTACT',
                payload: { ...contact, status: 'estimate_sent', updatedAt: new Date().toISOString() },
              });
            }
          }).catch(console.error);
        }
        toast.success('Estimate marked as sent (no email on file for this customer)');
        return;
      }

      const companyProfile = await db.getCompany(profile?.company_id || '').catch(() => null);

      // Build estimate items HTML (unit price hidden for items with hidePrice: true)
      const itemsHtml = (estimate.items || []).map((item: EstimateItem) =>
        item.hidePrice
          ? `<tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:8px 12px">${item.description}</td>
              <td style="padding:8px 12px;text-align:center">${item.quantity} ${item.unit || ''}</td>
              <td style="padding:8px 12px;text-align:right;color:#9ca3af" colspan="2">Included</td>
            </tr>`
          : `<tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:8px 12px">${item.description}</td>
              <td style="padding:8px 12px;text-align:center">${item.quantity} ${item.unit || ''}</td>
              <td style="padding:8px 12px;text-align:right">$${Number(item.unitPrice).toFixed(2)}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:600">$${Number(item.total).toFixed(2)}</td>
            </tr>`
      ).join('');

      const companyName = companyProfile?.name || 'Your Company';
      const companyPhone = companyProfile?.phone || '';
      const companyEmail = companyProfile?.email || '';
      const companyAddress = companyProfile?.address || '';
      const companyCity = companyProfile?.city || '';
      const companyState = companyProfile?.state || '';
      const companyZip = companyProfile?.zip || '';
      const customerName = `${contact.firstName} ${contact.lastName}`;
      const customerAddress = `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}`;

      // Signing link (sign_token now available after markEstimateSent)
      const signToken = updated.sign_token;
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const signUrl = signToken && appOrigin ? `${appOrigin}/sign-estimate/${signToken}` : null;

      // 3-day right to cancel dates (3 business days from today)
      const sentDate = new Date();
      const cancelDeadline = new Date(sentDate);
      let bizDays = 0;
      while (bizDays < 3) {
        cancelDeadline.setDate(cancelDeadline.getDate() + 1);
        const dow = cancelDeadline.getDay();
        if (dow !== 0 && dow !== 6) bizDays++;
      }
      const fmtD = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      await sendEmail({
        to: contact.email,
        subject: `Estimate ${estimate.estimateNumber} from ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;font-size:24px">${companyName}</h2>
              ${companyAddress ? `<p style="margin:4px 0 0 0;opacity:0.9;font-size:13px">${companyAddress}${companyCity ? `, ${companyCity}, ${companyState} ${companyZip}` : ''}</p>` : ''}
              ${companyPhone ? `<p style="margin:2px 0 0 0;opacity:0.9;font-size:13px">${companyPhone}</p>` : ''}
            </div>
            <div style="padding:24px;background:#f9fafb">
              <h3 style="color:#1e40af;margin-top:0">Estimate ${estimate.estimateNumber}</h3>
              <p>Hi ${contact.firstName},</p>
              <p>Thank you for the opportunity to provide you with an estimate. Please find the details below.</p>

              <div style="background:white;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #e5e7eb">
                <div style="font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;margin-bottom:8px">Prepared For</div>
                <div style="font-weight:600;color:#111">${customerName}</div>
                <div style="color:#6b7280;font-size:14px">${customerAddress}</div>
                ${contact.phone1 ? `<div style="color:#6b7280;font-size:14px">Phone: ${contact.phone1}</div>` : ''}
              </div>

              <h3 style="margin-bottom:4px;color:#111">${estimate.title}</h3>
              <p style="color:#6b7280;font-size:14px;margin-top:4px">Valid until ${estimate.validUntil ? new Date(estimate.validUntil).toLocaleDateString() : 'further notice'}</p>

              <table style="width:100%;border-collapse:collapse;margin:16px 0;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
                <thead style="background:#f3f4f6">
                  <tr>
                    <th style="padding:12px;text-align:left;font-size:13px;color:#374151">Description</th>
                    <th style="padding:12px;text-align:center;font-size:13px;color:#374151">Qty</th>
                    <th style="padding:12px;text-align:right;font-size:13px;color:#374151">Unit Price</th>
                    <th style="padding:12px;text-align:right;font-size:13px;color:#374151">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                  <tr style="background:#f9fafb;font-weight:bold">
                    <td colspan="3" style="padding:16px;text-align:right;font-size:16px;color:#111">Total</td>
                    <td style="padding:16px;text-align:right;font-size:18px;color:#1e40af">$${Number(estimate.total).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              ${estimate.notes ? `<div style="background:white;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #e5e7eb"><strong style="color:#111">Notes:</strong><p style="margin:8px 0 0 0;color:#374151">${estimate.notes}</p></div>` : ''}
              ${estimate.terms ? `<div style="background:#fef3c7;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #fbbf24"><strong style="color:#92400e">Terms & Conditions:</strong><p style="margin:8px 0 0 0;color:#78350f;font-size:13px">${estimate.terms}</p></div>` : ''}

              ${signUrl ? `
              <div style="text-align:center;margin:24px 0">
                <a href="${signUrl}" style="display:inline-block;background:#1e40af;color:white;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none">
                  ✍️ Review &amp; Sign Estimate
                </a>
                <p style="font-size:12px;color:#9ca3af;margin:8px 0 0 0">Or paste this link in your browser: ${signUrl}</p>
              </div>` : ''}

              <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
                <strong style="color:#92400e;display:block;margin-bottom:8px;font-size:14px">⚠️ 3-Day Right to Cancel</strong>
                <p style="color:#78350f;font-size:13px;margin:0 0 12px 0">
                  You have the right to cancel this agreement within three (3) business days from the date of signing, without penalty or obligation.
                </p>
                <table style="width:100%;font-size:13px;border-collapse:collapse">
                  <tr>
                    <td style="color:#92400e;font-weight:600;padding:4px 8px 4px 0;width:50%">Date of Transaction:</td>
                    <td style="color:#78350f">${fmtD(sentDate)}</td>
                  </tr>
                  <tr>
                    <td style="color:#92400e;font-weight:600;padding:4px 8px 4px 0">Cancellation Deadline:</td>
                    <td style="color:#78350f;font-weight:700">${fmtD(cancelDeadline)}</td>
                  </tr>
                </table>
                <p style="color:#92400e;font-size:11px;margin:10px 0 0 0">
                  Per FTC regulations (16 CFR Part 429). To cancel, notify ${companyName} in writing before the deadline above.
                </p>
              </div>

              <p style="margin-top:24px">If you have any questions or would like to discuss this estimate, please don't hesitate to contact us.</p>
              <p style="margin-bottom:0">Thank you,<br/><strong>${companyName}</strong></p>
            </div>
            <div style="background:#e5e7eb;padding:16px;text-align:center;font-size:12px;color:#6b7280;border-radius:0 0 8px 8px">
              ${companyName}${companyPhone ? ` | ${companyPhone}` : ''}${companyEmail ? ` | ${companyEmail}` : ''}<br/>
              This estimate is valid until ${estimate.validUntil ? new Date(estimate.validUntil).toLocaleDateString() : 'further notice'}<br/>
              <span style="font-size:10px;color:#9ca3af;margin-top:4px;display:inline-block">Powered by TrussCTR</span>
            </div>
          </div>`,
      });

      // Sync contact status
      const c = state.contacts.find(x => x.id === updated.contact_id);
      if (c) {
        db.updateContact(c.id, {
          status: 'estimate_sent',
          status_changed_at: new Date().toISOString(),
        }).catch((err) => console.error('Failed to persist estimate_sent status:', err));
        dispatch({
          type: 'UPDATE_CONTACT',
          payload: {
            ...c,
            status: 'estimate_sent',
            projectValue: Math.max(Number(c.projectValue || 0), Number(updated.total || 0)),
            updatedAt: new Date().toISOString(),
          },
        });
        if (profile?.company_id) {
          fireAutomationEvent('estimate_sent', profile.company_id, {
            contactId: c.id,
            contactName: `${c.firstName} ${c.lastName}`.trim(),
            contactEmail: c.email,
            amount: Number(updated.total || 0),
            oldStatus: c.status,
            newStatus: 'estimate_sent',
          }).catch(() => {});
          fireAutomationEvent('contact_status_changed', profile.company_id, {
            contactId: c.id,
            contactName: `${c.firstName} ${c.lastName}`.trim(),
            contactEmail: c.email,
            oldStatus: c.status,
            newStatus: 'estimate_sent',
          }).catch(() => {});
        }
      }
      toast.success(`Estimate emailed to ${contact.email}`);
    } catch (error) {
      console.error('Error sending estimate:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send estimate');
    }
  };

  const handleConvertToProject = async (estimate: Estimate) => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Profile not loaded. Please try again.');
      return;
    }
    // Need the DB estimate to pass to createProjectFromEstimate
    const dbEstimate = {
      id: estimate.id,
      company_id: profile.company_id,
      contact_id: estimate.contactId,
      estimate_number: estimate.estimateNumber,
      title: estimate.title,
      description: estimate.description,
      status: estimate.status,
      total: estimate.total,
      subtotal: estimate.amount,
      tax: estimate.tax,
      notes: estimate.notes,
      items: estimate.items,
      created_at: estimate.createdAt,
      updated_at: estimate.updatedAt || estimate.createdAt,
    } as any;
    try {
      const project = await db.createProjectFromEstimate(dbEstimate, profile.id);
      if (project) {
        toast.success(`Project "${project.name}" created from estimate`);
        setViewingEstimate(null);
      } else {
        toast.error('Failed to create project');
      }
    } catch (err: any) {
      toast.error(`Failed to create project: ${err.message}`);
    }
  };

  const handleAcceptEstimate = async (estimate: Estimate) => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Profile not loaded. Please try again.');
      return;
    }
    try {
      const updated = await db.markEstimateAccepted(estimate.id, profile.id);
      if (updated) {
        dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
        // Sync contact status + projectValue in local state immediately
        const c = state.contacts.find(x => x.id === updated.contact_id);
        if (c) {
          dispatch({
            type: 'UPDATE_CONTACT',
            payload: {
              ...c,
              status: 'signed',
              projectValue: Number(updated.total || c.projectValue || 0),
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // Auto-create project on acceptance
        const dbEstimate = { ...updated, company_id: profile.company_id } as any;
        const project = await db.createProjectFromEstimate(dbEstimate, profile.id);
        if (project) {
          toast.success('Estimate accepted — project created automatically');
        } else {
          toast.success('Estimate marked as accepted');
        }
        setViewingEstimate(null);
      }
    } catch (err: any) {
      toast.error(`Failed to accept estimate: ${err.message}`);
    }
  };

  const handleSignEstimate = async (signatureData: string) => {
    const estimate = showSignatureModal;
    if (!estimate || !profile?.company_id || !profile?.id) return;
    const name = signerName.trim() || profile.id;
    try {
      const updated = await db.markEstimateAccepted(estimate.id, name, signatureData);
      if (updated) {
        const appEstimate = mapDbEstimateToApp(updated);
        dispatch({ type: 'UPDATE_ESTIMATE', payload: appEstimate });
        // Sync contact status + projectValue in local state immediately
        const c = state.contacts.find(x => x.id === updated.contact_id);
        if (c) {
          dispatch({
            type: 'UPDATE_CONTACT',
            payload: {
              ...c,
              status: 'signed',
              projectValue: Number(updated.total || c.projectValue || 0),
              updatedAt: new Date().toISOString(),
            },
          });
        }
        const dbEstimate = { ...updated, company_id: profile.company_id } as any;
        const project = await db.createProjectFromEstimate(dbEstimate, profile.id);
        if (project) {
          toast.success('Estimate signed & accepted — project created automatically');
        } else {
          toast.success('Estimate signed & accepted');
        }
        setShowSignatureModal(null);
        setSignerName('');
        setViewingEstimate(null);
      }
    } catch (err: any) {
      toast.error(`Failed to save signature: ${err.message}`);
    }
  };

  const handleRequestSignature = async (estimate: Estimate) => {
    const contact = state.contacts.find(c => c.id === estimate.contactId);
    if (!contact?.email) {
      toast.error('No email address on file for this customer');
      return;
    }
    try {
      const token = crypto.randomUUID();
      const updated = await db.requestEstimateSignature(estimate.id, token);
      if (updated) {
        dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
      }

      const companyProfile = await db.getCompany(profile?.company_id || '').catch(() => null);
      const companyName = (companyProfile as any)?.name || '614 Restore';
      const fromEmail = (companyProfile as any)?.from_email || undefined;
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const signUrl = `${appUrl}/sign?estimateId=${estimate.id}&token=${token}`;

      await sendEmail({
        to: contact.email,
        subject: `Action Required: Please sign Estimate ${estimate.estimateNumber} from ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1e40af">Signature Requested</h2>
            <p>Hi ${contact.firstName},</p>
            <p>${companyName} is requesting your signature on <strong>Estimate ${estimate.estimateNumber}: ${estimate.title}</strong>.</p>
            <p><strong>Total: $${Number(estimate.total).toFixed(2)}</strong></p>
            <div style="text-align:center;margin:32px 0">
              <a href="${signUrl}" style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1em">
                Review &amp; Sign Estimate
              </a>
            </div>
            <p style="font-size:0.85em;color:#6b7280">Or copy this link into your browser:<br/>${signUrl}</p>
            <p>If you have any questions, please reply to this email or call us.</p>
            <p>Thank you,<br/>${companyName}</p>
          </div>`,
      });

      toast.success(`Signature request sent to ${contact.email}`);
    } catch (err: any) {
      toast.error(`Failed to send signature request: ${err.message}`);
    }
  };

  const handleDelete = async (estimateId: string) => {
    try {
      await db.deleteEstimate(estimateId);
      dispatch({ type: 'DELETE_ESTIMATE', payload: estimateId });
      toast.success('Estimate deleted');
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting estimate:', error);
      toast.error('Failed to delete estimate');
    }
  };

  const handleExport = () => {
    try {
      if (filteredEstimates.length === 0) {
        toast.error('No estimates to export');
        return;
      }
      exportEstimatesToExcel(filteredEstimates);
      toast.success(`Exported ${filteredEstimates.length} estimates to Excel`);
    } catch (error) {
      console.error('Error exporting estimates:', error);
      toast.error('Failed to export estimates');
    }
  };

  // Filter estimates
  const filteredEstimates = state.estimates.filter((estimate) => {
    const contact = state.contacts.find(c => c.id === estimate.contactId);
    const contactName = contact ? `${contact.firstName} ${contact.lastName}`.toLowerCase() : '';
    const query = searchQuery.toLowerCase();
    
    return (
      estimate.title.toLowerCase().includes(query) ||
      estimate.estimateNumber.toLowerCase().includes(query) ||
      contactName.includes(query)
    );
  });

  // Get contact name helper
  const getContactName = (contactId: string) => {
    const contact = state.contacts.find(c => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const printEstimate = async (estimate: Estimate) => {
    const contact = state.contacts.find(c => c.id === estimate.contactId);
    const contactName = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
    const contactAddress = contact ? `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}` : '';
    const contactPhone = contact?.phone1 || '';
    const contactEmail = contact?.email || '';

    // Fetch company info from database
    const companyProfile = await db.getCompany(profile?.company_id || '').catch(() => null);
    const companyName = companyProfile?.name || 'Your Company';
    const companyAddress = companyProfile?.address || '';
    const companyCity = companyProfile?.city || '';
    const companyState = companyProfile?.state || '';
    const companyZip = companyProfile?.zip || '';
    const companyPhone = companyProfile?.phone || '';
    const companyEmail = companyProfile?.email || '';
    const companyLicense = companyProfile?.contractor_license || '';
    const itemsHtml = estimate.items && estimate.items.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;font-size:13px">Description</th>
              <th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e5e7eb;font-size:13px">Qty</th>
              <th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e5e7eb;font-size:13px">Unit Price</th>
              <th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e5e7eb;font-size:13px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${estimate.items.map((item: any) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${item.description || ''}</td>
                <td style="text-align:right;padding:10px 12px;border-bottom:1px solid #f3f4f6">${item.quantity || 0}</td>
                <td style="text-align:right;padding:10px 12px;border-bottom:1px solid #f3f4f6">$${(item.unitPrice || item.unit_price || 0).toFixed(2)}</td>
                <td style="text-align:right;padding:10px 12px;border-bottom:1px solid #f3f4f6">$${(item.total || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Estimate ${estimate.estimateNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; margin: 0; padding: 40px; }
    @media print { body { padding: 20px; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
    .company-info { flex: 1; }
    .company-name { font-size: 24px; font-weight: 700; color: #1d4ed8; margin-bottom: 8px; }
    .company-details { font-size: 13px; color: #6b7280; line-height: 1.6; }
    .estimate-meta { text-align: right; }
    .estimate-number { font-size: 20px; font-weight: 700; color: #111; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #dbeafe; color: #1d4ed8; margin-top: 6px; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin-bottom: 8px; }
    .bill-to { margin-bottom: 32px; background: #f9fafb; padding: 16px; border-radius: 8px; }
    .bill-to p { margin: 2px 0; font-size: 14px; color: #374151; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-box { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #374151; }
    .totals-row.grand { font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb; padding-top: 10px; color: #111; }
    .totals-row.grand span:last-child { color: #1d4ed8; }
    .notes-section { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div class="company-name">${companyName}</div>
      <div class="company-details">
        ${companyAddress ? `<div>${companyAddress}</div>` : ''}
        ${companyCity && companyState ? `<div>${companyCity}, ${companyState} ${companyZip}</div>` : ''}
        ${companyPhone ? `<div>Phone: ${companyPhone}</div>` : ''}
        ${companyEmail ? `<div>Email: ${companyEmail}</div>` : ''}
        ${companyLicense ? `<div>License #: ${companyLicense}</div>` : ''}
      </div>
    </div>
    <div class="estimate-meta">
      <div class="estimate-number">Estimate ${estimate.estimateNumber}</div>
      ${estimate.validUntil ? `<div style="font-size:13px;color:#6b7280;margin-top:4px">Valid until ${new Date(estimate.validUntil).toLocaleDateString()}</div>` : ''}
      <div class="badge">${estimate.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="bill-to">
    <div class="section-title">Prepared For</div>
    <p><strong style="font-size:16px">${contactName}</strong></p>
    ${contactAddress ? `<p>${contactAddress}</p>` : ''}
    ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ''}
    ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ''}
    ${estimate.title ? `<p style="margin-top:8px;color:#1d4ed8;font-weight:600">${estimate.title}</p>` : ''}
  </div>

  ${estimate.description ? `<p style="color:#374151;margin-bottom:24px">${estimate.description}</p>` : ''}

  ${itemsHtml}

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><span>$${(estimate.amount || 0).toFixed(2)}</span></div>
      <div class="totals-row"><span>Tax</span><span>$${(estimate.tax || 0).toFixed(2)}</span></div>
      <div class="totals-row grand"><span>Total</span><span>$${(estimate.total || 0).toFixed(2)}</span></div>
    </div>
  </div>

  ${estimate.notes ? `<div class="notes-section"><div class="section-title">Notes</div><p style="margin:0;font-size:14px;color:#374151">${estimate.notes}</p></div>` : ''}
  ${estimate.terms ? `<div class="notes-section"><div class="section-title">Terms &amp; Conditions</div><p style="margin:0;font-size:14px;color:#374151">${estimate.terms}</p></div>` : ''}

  <div class="footer">Generated ${new Date().toLocaleDateString()} · ${estimate.estimateNumber}<br/><span style="font-size:10px;color:#9ca3af">Powered by TrussCTR</span></div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => win.print();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
            <p className="text-sm text-gray-500">Create and manage customer estimates</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            <Plus size={20} />
            New Estimate
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search estimates by number, title, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Estimates List */}
      {filteredEstimates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No estimates found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Get started by creating your first estimate'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Estimate
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEstimates.map((estimate) => (
            <div
              key={estimate.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{estimate.title}</h3>
                    <StatusBadge status={estimate.status} />
                    {estimate.signatureData && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <PenLine size={11} />
                        Signed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-mono">{estimate.estimateNumber}</span>
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {getContactName(estimate.contactId)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      Valid until {formatDate(estimate.validUntil || '')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Customer Preview Button */}
                  <button
                    onClick={() => setCustomerViewEstimate(estimate)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Customer preview"
                  >
                    <Eye size={18} />
                  </button>
                  
                  {/* Share Button */}
                  <button
                    onClick={() => setShowShareModal(estimate)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Share estimate"
                  >
                    <Mail size={18} />
                  </button>
                  
                  {estimate.status === 'draft' && (
                    <button
                      onClick={() => handleSendEstimate(estimate.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Send estimate"
                    >
                      <Send size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setViewingEstimate(estimate)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View estimate details"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    onClick={() => handleOpenModal(estimate)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(estimate.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Estimate Details */}
              <div className="border-t border-gray-100 pt-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Subtotal</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(estimate.amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Tax</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(estimate.tax)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Total</p>
                    <p className="font-bold text-blue-600 text-lg">{formatCurrency(estimate.total)}</p>
                  </div>
                </div>

                {/* Status Timeline */}
                {estimate.status !== 'draft' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {estimate.sentAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Sent {formatDate(estimate.sentAt)}
                        </span>
                      )}
                      {estimate.viewedAt && (
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          Viewed {formatDate(estimate.viewedAt)}
                        </span>
                      )}
                      {estimate.acceptedAt && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Check size={12} />
                          Accepted {formatDate(estimate.acceptedAt)}
                        </span>
                      )}
                      {estimate.signedBy && (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <PenLine size={12} />
                          Signed by {estimate.signedBy}
                        </span>
                      )}
                      {estimate.declinedAt && (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle size={12} />
                          Declined {formatDate(estimate.declinedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Confirmation */}
              {showDeleteConfirm === estimate.id && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-3">Are you sure you want to delete this estimate?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(estimate.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1 bg-white text-gray-700 text-sm rounded border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingEstimate ? 'Edit Estimate' : 'New Estimate'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Template Selector */}
              {!editingEstimate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-blue-900">Start with a Template</h3>
                      <p className="text-xs text-blue-700">Choose from pre-built estimates for common projects</p>
                    </div>
                    <button
                      onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showTemplateSelector ? 'Hide Templates' : 'Browse Templates'}
                    </button>
                  </div>
                  {showTemplateSelector && (
                    <div className="mt-4 grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                      {ESTIMATE_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleLoadTemplate(template)}
                          className="text-left p-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="text-sm font-semibold text-gray-900">{template.name}</h4>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize">
                              {template.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                          <p className="text-xs text-gray-500">{template.items.length} line items</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a customer</option>
                    {state.contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimate Number
                  </label>
                  <input
                    type="text"
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Kitchen Remodel Estimate"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={item.id} className={`border rounded-lg p-4 ${item.hidePrice ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}>
                      {/* Row 1: description, qty, unit type, price */}
                      <div className="grid grid-cols-12 gap-2 mb-2">
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="Qty"
                            min="0"
                            step="0.01"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="ea">ea (each)</option>
                            <option value="sq">sq (square)</option>
                            <option value="roll">roll</option>
                            <option value="lf">lf (linear ft)</option>
                            <option value="sf">sf (sq ft)</option>
                            <option value="box">box</option>
                            <option value="pcs">pcs</option>
                            <option value="lbs">lbs</option>
                            <option value="hr">hr</option>
                            <option value="day">day</option>
                            <option value="ft">ft</option>
                            <option value="yd">yd</option>
                            <option value="lot">lot</option>
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            placeholder="Unit Price"
                            min="0"
                            step="0.01"
                            value={item.unitPrice || ''}
                            onChange={(e) => updateItem(index, 'unitPrice', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      {/* Row 2: hide price toggle + total + delete */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => updateItem(index, 'hidePrice', !item.hidePrice)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            item.hidePrice
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {item.hidePrice ? <EyeOff size={13} /> : <Eye size={13} />}
                          {item.hidePrice ? 'Price hidden from customer' : 'Hide price from customer'}
                        </button>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(item.total)}
                          </span>
                          {items.length > 1 && (
                            <button
                              onClick={() => removeItem(index)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(calculateTotals().subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Tax ({taxRate}%):</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(calculateTotals().tax)}</span>
                </div>
                <div className="flex justify-between items-center text-lg pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(calculateTotals().total)}</span>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes (not visible to customer)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Payment terms, warranties, etc."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-sm"
              >
                <Eye size={16} />
                Preview Customer View
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  {isSaving ? 'Saving...' : 'Save Estimate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 rounded-t-xl sticky top-0 z-10">
              <div>
                <h2 className="text-base font-bold text-gray-900">Customer Preview</h2>
                <p className="text-xs text-gray-500 mt-0.5">This is what your customer will see</p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Estimate Header */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900">{title || 'Untitled Estimate'}</h3>
                <p className="text-sm text-gray-500 mt-1">Estimate #{estimateNumber}</p>
                {validityDate && (
                  <p className="text-xs text-gray-400 mt-2">
                    Valid until <span className="text-gray-600 font-medium">{new Date(validityDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </p>
                )}
              </div>

              {/* Line Items */}
              {items.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h4>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Unit Price</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3 text-gray-700">{item.description || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{item.quantity} {item.unit}</td>
                          {item.hidePrice ? (
                            <td className="px-4 py-3 text-right text-gray-400 italic" colSpan={2}>Included</td>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-5 py-3 text-right font-medium text-gray-800">{formatCurrency(item.total)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-gray-100 px-5 py-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>{formatCurrency(calculateTotals().subtotal)}</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Tax ({taxRate}%)</span>
                        <span>{formatCurrency(calculateTotals().tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                      <span>Total</span>
                      <span>{formatCurrency(calculateTotals().total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Terms / Notes */}
              {(terms || notes) && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4 text-sm text-gray-600 shadow-sm">
                  {terms && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Terms & Conditions</h4>
                      <p className="whitespace-pre-wrap">{terms}</p>
                    </div>
                  )}
                  {notes && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Notes</h4>
                      <p className="whitespace-pre-wrap">{notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 3-Day Right to Cancel */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm">
                <h4 className="font-bold text-amber-900 mb-2">3-Day Right to Cancel</h4>
                <p className="text-amber-800 mb-3">
                  You have the right to cancel this agreement within three (3) business days from the date of signing,
                  without penalty or obligation. Cancellation deadline and transaction date will be auto-filled when the estimate is sent.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-amber-100">
                    <span className="text-xs text-amber-600 uppercase font-semibold block mb-1">Date of Transaction</span>
                    <span className="font-medium text-gray-700">[Date estimate is sent]</span>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-100">
                    <span className="text-xs text-amber-600 uppercase font-semibold block mb-1">Cancellation Deadline</span>
                    <span className="font-bold text-gray-700">[3 business days later]</span>
                  </div>
                </div>
                <p className="text-xs text-amber-700 mt-3">
                  Per FTC regulations (16 CFR Part 429) — dates will be auto-filled when emailed to customer.
                </p>
              </div>

              {/* Signature area preview */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h4 className="text-base font-semibold text-gray-800 mb-4">Sign to Accept</h4>
                <div className="space-y-3">
                  <div className="h-9 bg-gray-100 rounded-lg w-full" />
                  <div className="h-28 bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs">Signature pad</div>
                  <div className="h-9 bg-blue-600/10 rounded-lg w-full" />
                </div>
                <p className="text-xs text-center text-gray-400 mt-3">By signing, customer accepts this estimate and its terms.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Estimate Detail Modal */}
      {viewingEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{viewingEstimate.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{viewingEstimate.estimateNumber} · {getContactName(viewingEstimate.contactId)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={viewingEstimate.status} />
                <button onClick={() => setViewingEstimate(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              {viewingEstimate.description && (
                <p className="text-gray-600">{viewingEstimate.description}</p>
              )}

              {/* Line Items */}
              {viewingEstimate.items && viewingEstimate.items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Line Items</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Price</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewingEstimate.items.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900">{item.description}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unitPrice || item.unit_price || 0)}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(viewingEstimate.amount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>{formatCurrency(viewingEstimate.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
                    <span>Total</span>
                    <span className="text-blue-600">{formatCurrency(viewingEstimate.total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {(viewingEstimate.notes || viewingEstimate.terms) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewingEstimate.notes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingEstimate.notes}</p>
                    </div>
                  )}
                  {viewingEstimate.terms && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Terms & Conditions</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingEstimate.terms}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Signature Info */}
              {viewingEstimate.signedBy && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
                  <PenLine size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Document Signed</p>
                    <p className="text-sm text-emerald-700">
                      Signed by <strong>{viewingEstimate.signedBy}</strong>
                      {viewingEstimate.acceptedAt && ` on ${new Date(viewingEstimate.acceptedAt).toLocaleDateString()}`}
                    </p>
                    {viewingEstimate.signatureData && (
                      <img
                        src={viewingEstimate.signatureData}
                        alt="Signature"
                        className="mt-2 h-12 border border-emerald-200 rounded bg-white"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Valid Until */}
              {viewingEstimate.validUntil && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Calendar size={14} />
                  Valid until {formatDate(viewingEstimate.validUntil)}
                </p>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setViewingEstimate(null); handleOpenModal(viewingEstimate); }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors text-sm"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => printEstimate(viewingEstimate)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors text-sm"
                >
                  <Printer size={16} />
                  Print / PDF
                </button>
                <button
                  onClick={() => {
                    dispatch({
                      type: 'TOGGLE_INVOICE_MODAL',
                      prefill: {
                        contactId: viewingEstimate.contactId,
                        items: viewingEstimate.items,
                        notes: viewingEstimate.notes,
                      },
                    });
                    setViewingEstimate(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors text-sm"
                >
                  <FileText size={16} />
                  Convert to Invoice
                </button>
                <button
                  onClick={() => handleConvertToProject(viewingEstimate)}
                  className="flex items-center gap-2 px-4 py-2 text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors text-sm"
                >
                  <FolderPlus size={16} />
                  Convert to Project
                </button>
              </div>
              <div className="flex items-center gap-2">
                {viewingEstimate.status === 'draft' && (
                  <button
                    onClick={() => { handleSendEstimate(viewingEstimate.id); setViewingEstimate(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Send size={16} />
                    Send Estimate
                  </button>
                )}
                {(viewingEstimate.status === 'sent' || viewingEstimate.status === 'viewed') && (
                  <>
                    <button
                      onClick={() => handleRequestSignature(viewingEstimate)}
                      className="flex items-center gap-2 px-4 py-2 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                    >
                      <Mail size={16} />
                      Request Signature
                    </button>
                    <button
                      onClick={() => { setShowSignatureModal(viewingEstimate); }}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                    >
                      <PenLine size={16} />
                      Sign Estimate
                    </button>
                    <button
                      onClick={() => handleAcceptEstimate(viewingEstimate)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <CheckCircle size={16} />
                      Mark Accepted → Create Project
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Sign Estimate</h2>
                <p className="text-sm text-gray-500 mt-0.5">{showSignatureModal.estimateNumber} · {showSignatureModal.title}</p>
              </div>
              <button
                onClick={() => { setShowSignatureModal(null); setSignerName(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Full name of signer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Draw Signature
                </label>
                <p className="text-xs text-gray-500 mb-2">Draw your signature in the box below using your mouse or finger</p>
                <SignaturePad
                  onSave={(dataUrl) => {
                    if (!signerName.trim()) {
                      toast.error('Please enter the signer name before saving');
                      return;
                    }
                    handleSignEstimate(dataUrl);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer View Modal */}
      {customerViewEstimate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Customer View</h2>
                <p className="text-sm text-gray-600">This is exactly what your customer will see</p>
              </div>
              <button
                onClick={() => setCustomerViewEstimate(null)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="p-8 bg-gray-50">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                  {/* Company Header */}
                  <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
                    <div>
                      <h1 className="text-2xl font-bold text-blue-600">Your Company Name</h1>
                      <div className="text-gray-600 mt-2 space-y-1">
                        <div>123 Business St, City, ST 12345</div>
                        <div>(555) 123-4567 • info@yourcompany.com</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">ESTIMATE</div>
                      <div className="text-gray-600 mt-1">#{customerViewEstimate.estimateNumber}</div>
                      <div className="text-sm text-gray-500 mt-2">
                        Valid until: {new Date(customerViewEstimate.validUntil || '').toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Prepared For:</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="font-semibold text-gray-900">{customerViewEstimate.contactName}</div>
                      <div className="text-gray-600 mt-1">
                        {/* Add contact details here if needed */}
                      </div>
                    </div>
                  </div>

                  {/* Estimate Details */}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{customerViewEstimate.title}</h3>
                    {customerViewEstimate.description && (
                      <p className="text-gray-600 mb-6">{customerViewEstimate.description}</p>
                    )}

                    {/* Line Items */}
                    {customerViewEstimate.items && customerViewEstimate.items.length > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold text-gray-900">Description</th>
                              <th className="text-center px-4 py-3 font-semibold text-gray-900">Qty</th>
                              <th className="text-right px-4 py-3 font-semibold text-gray-900">Unit Price</th>
                              <th className="text-right px-4 py-3 font-semibold text-gray-900">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {customerViewEstimate.items.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 text-gray-900">{item.description}</td>
                                <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  ${(item.unitPrice || item.unit_price || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                  ${(item.total || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-64">
                        <div className="flex justify-between py-2 text-gray-600">
                          <span>Subtotal:</span>
                          <span>${customerViewEstimate.amount.toFixed(2)}</span>
                        </div>
                        {customerViewEstimate.tax > 0 && (
                          <div className="flex justify-between py-2 text-gray-600">
                            <span>Tax:</span>
                            <span>${customerViewEstimate.tax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-3 text-xl font-bold text-gray-900 border-t border-gray-200">
                          <span>Total:</span>
                          <span className="text-blue-600">${customerViewEstimate.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Terms and Notes */}
                    {(customerViewEstimate.terms || customerViewEstimate.notes) && (
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        {customerViewEstimate.terms && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 mb-2">Terms & Conditions:</h4>
                            <p className="text-gray-700 text-sm leading-relaxed">{customerViewEstimate.terms}</p>
                          </div>
                        )}
                        {customerViewEstimate.notes && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Notes:</h4>
                            <p className="text-gray-700 text-sm leading-relaxed">{customerViewEstimate.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Share Estimate</h3>
              <button
                onClick={() => setShowShareModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Share via Email</h4>
                <p className="text-gray-600 text-sm">
                  Send estimate #{showShareModal.estimateNumber} to your customer
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={async () => {
                    try {
                      await handleSendEstimate(showShareModal.id);
                      setShowShareModal(null);
                      toast.success('Estimate shared successfully!');
                    } catch (error) {
                      toast.error('Failed to share estimate');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Send size={18} />
                  Send to Customer
                </button>

                <button
                  onClick={() => {
                    const url = `${window.location.origin}/estimate/${showShareModal.signToken}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Share link copied to clipboard!');
                    setShowShareModal(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  <Eye size={18} />
                  Copy Share Link
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                The customer will receive a link to view and sign the estimate
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
