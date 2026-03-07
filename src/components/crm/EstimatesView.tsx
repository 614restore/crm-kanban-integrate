import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { fireAutomationEvent } from '@/lib/automationEngine';
import { sendEmail } from '@/lib/emailApi';
import { Estimate, EstimateItem, Contact } from '@/lib/crmData';
import { exportEstimatesToExcel } from '@/lib/exportUtils';
import SignaturePad from '@/components/ui/SignaturePad';
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
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isRequestingSignature, setIsRequestingSignature] = useState(false);

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

  // Load estimates on mount
  useEffect(() => {
    loadEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        amount: Number(e.amount),
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
      { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'ea', unitPrice: 0, total: 0 }
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
      setTaxRate(estimate.tax / estimate.amount * 100 || 0);
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

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEstimate(null);
    setSelectedContactId('');
    setTitle('');
    setEstimateNumber('');
    setValidityDate('');
    setItems([
      { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'ea', unitPrice: 0, total: 0 }
    ]);
    setNotes('');
    setTerms('');
    setTaxRate(0);
  };

  const handleSave = async () => {
    if (!profile?.company_id) return;
    
    // Validate
    if (!selectedContactId) {
      toast.error('Please select a customer');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (items.some(item => !item.description.trim())) {
      toast.error('All line items must have a description');
      return;
    }

    setIsSaving(true);

    try {
      const { subtotal, tax, total } = calculateTotals();
      
      const estimateData = {
        company_id: profile.company_id,
        contact_id: selectedContactId,
        estimate_number: estimateNumber,
        title,
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
        const updated = await db.updateEstimate(editingEstimate.id, estimateData);
        if (updated) {
          dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
          toast.success('Estimate updated');
          handleCloseModal();
        } else {
          toast.error('Failed to save estimate. Please try again.');
        }
      } else {
        const created = await db.createEstimate(estimateData);
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
      toast.error(`Failed to save estimate: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEstimate = async (estimateId: string) => {
    try {
      const estimate = state.estimates.find((e) => e.id === estimateId);
      if (!estimate) { toast.error('Estimate not found'); return; }

      const contact = state.contacts.find((c) => c.id === estimate.contactId);
      if (!contact?.email) {
        // Still mark as sent even without email
        const updated = await db.markEstimateSent(estimateId);
        if (updated) {
          dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
          toast.success('Estimate marked as sent (no email on file for this customer)');
        }
        return;
      }

      const companyProfile = await db.getCompany(profile?.company_id || '').catch(() => null);
      const fromEmail = (companyProfile as any)?.from_email || undefined;

      // Build estimate items HTML
      const itemsHtml = (estimate.items || []).map((item: EstimateItem) =>
        `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 12px">${item.description}</td>
          <td style="padding:8px 12px;text-align:center">${item.quantity} ${item.unit || ''}</td>
          <td style="padding:8px 12px;text-align:right">$${Number(item.unitPrice).toFixed(2)}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:600">$${Number(item.total).toFixed(2)}</td>
        </tr>`
      ).join('');

      const companyName = (companyProfile as any)?.name || '614 Restore';

      await sendEmail({
        to: contact.email,
        from: fromEmail,
        subject: `Estimate ${estimate.estimateNumber} from ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1e40af">Estimate from ${companyName}</h2>
            <p>Hi ${contact.firstName},</p>
            <p>Please find your estimate below. It is valid until ${estimate.validUntil ? new Date(estimate.validUntil).toLocaleDateString() : 'further notice'}.</p>
            <h3 style="margin-bottom:4px">${estimate.title}</h3>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead style="background:#f3f4f6">
                <tr>
                  <th style="padding:8px 12px;text-align:left">Description</th>
                  <th style="padding:8px 12px;text-align:center">Qty</th>
                  <th style="padding:8px 12px;text-align:right">Unit Price</th>
                  <th style="padding:8px 12px;text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding:12px;text-align:right;font-weight:bold">Total</td>
                  <td style="padding:12px;text-align:right;font-weight:bold;font-size:1.1em">$${Number(estimate.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            ${estimate.notes ? `<p><strong>Notes:</strong> ${estimate.notes}</p>` : ''}
            ${estimate.terms ? `<p style="font-size:0.85em;color:#6b7280"><strong>Terms:</strong> ${estimate.terms}</p>` : ''}
            <p>Please reply to this email or call us if you have any questions.</p>
            <p>Thank you,<br/>${companyName}</p>
          </div>`,
      });

      const updated = await db.markEstimateSent(estimateId);
      if (updated) {
        dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
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

  const handleSignEstimate = async (signatureData: string) => {
    if (!viewingEstimate || !signatureName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    setIsSigning(true);
    try {
      const updated = await db.markEstimateAccepted(viewingEstimate.id, signatureName.trim(), signatureData);
      if (updated) {
        dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
        // Auto-create project
        const dbEstimate = { ...updated, company_id: profile?.company_id } as any;
        const project = await db.createProjectFromEstimate(dbEstimate, profile?.id || '');
        toast.success(project ? 'Estimate signed — project created!' : 'Estimate signed successfully!');
        setShowSignModal(false);
        setViewingEstimate(null);
      }
    } catch (err: any) {
      toast.error(`Failed to sign: ${err.message}`);
    } finally {
      setIsSigning(false);
    }
  };

  const handleRequestSignature = async (estimate: Estimate) => {
    const contact = state.contacts.find((c) => c.id === estimate.contactId);
    if (!contact?.email) {
      toast.error('Customer has no email on file');
      return;
    }
    setIsRequestingSignature(true);
    try {
      const companyProfile = await db.getCompany(profile?.company_id || '').catch(() => null);
      const companyName = (companyProfile as any)?.name || '614 Restore';
      const fromEmail = (companyProfile as any)?.from_email || undefined;
      // The signing link points to the app's sign page
      const signingUrl = `${window.location.origin}${window.location.pathname}#/sign/${estimate.id}`;
      const vercelBase = 'https://crm-kanban-integrate.vercel.app';
      const apiSignUrl = `${vercelBase}/sign/${estimate.id}`;

      await sendEmail({
        to: contact.email,
        from: fromEmail,
        subject: `Please sign your estimate from ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1e40af">Estimate Ready for Your Signature</h2>
            <p>Hi ${contact.firstName},</p>
            <p><strong>${companyName}</strong> has prepared estimate <strong>${estimate.estimateNumber}</strong> — <em>${estimate.title}</em> — for your review and signature.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px">
              <tr><td style="padding:12px 16px;color:#6b7280">Estimate Total</td><td style="padding:12px 16px;font-weight:bold;font-size:1.2em;color:#1e40af">$${Number(estimate.total).toFixed(2)}</td></tr>
              ${estimate.validUntil ? `<tr><td style="padding:8px 16px;color:#6b7280">Valid Until</td><td style="padding:8px 16px">${new Date(estimate.validUntil).toLocaleDateString()}</td></tr>` : ''}
            </table>
            <p>Click below to review and sign electronically:</p>
            <p style="margin:24px 0">
              <a href="${apiSignUrl}" style="display:inline-block;padding:14px 28px;background:#1e40af;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:1.05em">
                Review &amp; Sign Estimate →
              </a>
            </p>
            <p style="color:#6b7280;font-size:0.85em">If you have questions, reply to this email or call us directly.</p>
            <p>Thank you,<br/>${companyName}</p>
          </div>`,
      });

      // Mark as sent if still draft
      if (estimate.status === 'draft') {
        const updated = await db.markEstimateSent(estimate.id);
        if (updated) dispatch({ type: 'UPDATE_ESTIMATE', payload: mapDbEstimateToApp(updated) });
      }
      toast.success(`Signing request sent to ${contact.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send signing request');
    } finally {
      setIsRequestingSignature(false);
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
        // Auto-create project on acceptance
        const dbEstimate = { ...updated, company_id: profile.company_id } as any;
        const project = await db.createProjectFromEstimate(dbEstimate, profile.id);
        if (project) {
          toast.success('Estimate accepted — project created automatically');
        } else {
          toast.success('Estimate marked as accepted');
        }

        const contact = state.contacts.find((c) => c.id === estimate.contactId);
        fireAutomationEvent('estimate_accepted', profile.company_id, {
          contactId: estimate.contactId,
          contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : undefined,
          amount: estimate.total,
        }).catch(() => {});

        setViewingEstimate(null);
      }
    } catch (err: any) {
      toast.error(`Failed to accept estimate: ${err.message}`);
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

  const printEstimate = (estimate: Estimate) => {
    const contactName = getContactName(estimate.contactId);
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
    .company-name { font-size: 24px; font-weight: 700; color: #1d4ed8; }
    .estimate-meta { text-align: right; }
    .estimate-number { font-size: 20px; font-weight: 700; color: #111; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #dbeafe; color: #1d4ed8; margin-top: 6px; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin-bottom: 8px; }
    .bill-to { margin-bottom: 32px; }
    .bill-to p { margin: 2px 0; font-size: 15px; }
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
    <div>
      <div class="company-name">${profile?.company_id ? 'TrussCTR' : 'Your Company'}</div>
    </div>
    <div class="estimate-meta">
      <div class="estimate-number">Estimate ${estimate.estimateNumber}</div>
      ${estimate.validUntil ? `<div style="font-size:13px;color:#6b7280;margin-top:4px">Valid until ${new Date(estimate.validUntil).toLocaleDateString()}</div>` : ''}
      <div class="badge">${estimate.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="bill-to">
    <div class="section-title">Prepared For</div>
    <p><strong>${contactName}</strong></p>
    ${estimate.title ? `<p style="color:#6b7280">${estimate.title}</p>` : ''}
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

  <div class="footer">Generated ${new Date().toLocaleDateString()} · ${estimate.estimateNumber}</div>
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
                    {estimate.signedBy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
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
                  {estimate.status === 'draft' && (
                    <button
                      onClick={() => handleSendEstimate(estimate.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Send estimate"
                    >
                      <Send size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setViewingEstimate(estimate)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="View estimate"
                  >
                    <Eye size={18} />
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
                    Estimate Number *
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
                    Title *
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
                    Valid Until *
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
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-12 gap-3 mb-2">
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="Description *"
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
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="text"
                            placeholder="Unit"
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="Price"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(item.total)}
                          </span>
                          {items.length > 1 && (
                            <button
                              onClick={() => removeItem(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={16} />
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
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
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
                {/* Signed badge */}
                {viewingEstimate.signedBy && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                    <PenLine size={14} />
                    Signed by {viewingEstimate.signedBy}
                  </span>
                )}
                {viewingEstimate.status !== 'accepted' && (
                  <button
                    onClick={() => { setSignatureName(''); setShowSignModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <PenLine size={16} />
                    Get Signature
                  </button>
                )}
                {viewingEstimate.status !== 'accepted' && (
                  <button
                    onClick={() => void handleRequestSignature(viewingEstimate)}
                    disabled={isRequestingSignature}
                    className="flex items-center gap-2 px-4 py-2 border border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition-colors text-sm disabled:opacity-50"
                  >
                    <Mail size={16} />
                    {isRequestingSignature ? 'Sending...' : 'Request Signature'}
                  </button>
                )}
                {viewingEstimate.status === 'draft' && (
                  <button
                    onClick={() => { handleSendEstimate(viewingEstimate.id); setViewingEstimate(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Send size={16} />
                    Send Estimate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignModal && viewingEstimate && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Sign Estimate</h3>
                <p className="text-sm text-gray-500 mt-0.5">{viewingEstimate.estimateNumber} — {viewingEstimate.title}</p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
                <SignaturePad
                  onSave={(dataUrl) => {
                    if (!signatureName.trim()) {
                      toast.error('Please enter your full name first');
                      return;
                    }
                    void handleSignEstimate(dataUrl);
                  }}
                />
              </div>
              <p className="text-xs text-gray-400">
                By signing, you agree to the terms of estimate {viewingEstimate.estimateNumber} totaling <strong>${Number(viewingEstimate.total).toFixed(2)}</strong>.
                This constitutes a legally binding electronic signature.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
