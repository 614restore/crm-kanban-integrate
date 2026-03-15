// Document Templates for Contractors
// Pre-built templates for estimates, invoices, contracts, work orders

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Edit,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  Eye,
  Star,
  StarOff,
  User,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderX,
  X,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { useCRM } from '@/lib/crmStore';
import { getContactFullName } from '@/lib/crmData';
import { getContractorEstimateTemplates } from '@/lib/contractorTemplates';
import { DOCUMENT_CATEGORIES, type DocumentCategoryId } from '@/lib/documentCategories';
import { getCertificateOfCompletionTemplate } from '@/lib/certificateTemplate';
import DocumentEditor from './DocumentEditor';
import InlineDocumentEditor from './InlineDocumentEditor';
import SimpleDocumentEditor from './SimpleDocumentEditor';
import UnifiedDocumentBuilder from './UnifiedDocumentBuilder';
import FullScreenDocumentEditor from './FullScreenDocumentEditor';

interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: DocumentCategoryId;
  content: string;
  variables: string[]; // e.g., ['CLIENT_NAME', 'PROJECT_ADDRESS', 'TOTAL_AMOUNT']
  fields?: DocumentField[]; // Simple form fields for easy editing
  favorite: boolean;
  isDefault: boolean;
  tags: string[];
  createdAt: string;
  lastModified: string;
  usageCount: number;
  fileType: 'pdf' | 'docx' | 'html';
}

interface TemplateFilters {
  category: string;
  tag: string;
  favorite: boolean;
}

const DocumentTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<DocumentTemplate[]>([]);
  const [filters, setFilters] = useState<TemplateFilters>({
    category: 'all',
    tag: 'all',
    favorite: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [customerEditMode, setCustomerEditMode] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [showSimpleEditor, setShowSimpleEditor] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<DocumentTemplate | null>(null);

  // ── Full-screen editor state ─────────────────────────────────────────────
  const [fullScreenTemplate, setFullScreenTemplate] = useState<DocumentTemplate | null>(null);
  const [fullScreenContactId, setFullScreenContactId] = useState<string>('');

  // ── Folder state ────────────────────────────────────────────────────────
  // 'all' = show everything; 'cat:CATEGORY_ID' = system folder; custom string = user folder
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  // templateFolderMap: templateId → custom folder name
  const [templateFolderMap, setTemplateFolderMap] = useState<Record<string, string>>({});
  const [folderPrefsLoaded, setFolderPrefsLoaded] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingTemplateId, setMovingTemplateId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { profile } = useAuth();
  const { state: crmState, dispatch } = useCRM();

  // Load company profile for template variable replacement
  useEffect(() => {
    const loadCompany = async () => {
      if (!profile?.company_id) return;
      try {
        const company = await db.getCompany(profile.company_id);
        if (company) setCompanyProfile(company);
      } catch (err) {
        console.warn('[DocumentTemplates] Failed to load company profile:', err);
      }
    };
    loadCompany();

    // Refresh if company updated elsewhere
    const onCompanyUpdated = () => { loadCompany(); };
    window.addEventListener('crm-company-updated', onCompanyUpdated);
    return () => window.removeEventListener('crm-company-updated', onCompanyUpdated);
  }, [profile?.company_id]);

  // Load folder prefs from profile.ui_prefs (fall back to localStorage for migration)
  useEffect(() => {
    if (!profile?.id) return;
    const prefs = (profile as any).ui_prefs as Record<string, unknown> | undefined;
    if (prefs) {
      try {
        const folders = prefs.dt_custom_folders;
        const folderMap = prefs.dt_folder_map;
        if (Array.isArray(folders)) setCustomFolders(folders as string[]);
        else {
          // one-time migration from localStorage
          const stored = localStorage.getItem('dt_custom_folders');
          if (stored) setCustomFolders(JSON.parse(stored));
        }
        if (folderMap && typeof folderMap === 'object') {
          setTemplateFolderMap(folderMap as Record<string, string>);
        } else {
          const stored = localStorage.getItem('dt_folder_map');
          if (stored) setTemplateFolderMap(JSON.parse(stored));
        }
      } catch {
        // ignore corrupted prefs
      }
    } else {
      // Profile doesn't have ui_prefs yet — try legacy localStorage
      try {
        const folders = localStorage.getItem('dt_custom_folders');
        const folderMap = localStorage.getItem('dt_folder_map');
        if (folders) setCustomFolders(JSON.parse(folders));
        if (folderMap) setTemplateFolderMap(JSON.parse(folderMap));
      } catch {
        // ignore
      }
    }
    setFolderPrefsLoaded(true);
  }, [profile?.id]);

  // Persist folder prefs to Supabase whenever they change (after initial load)
  useEffect(() => {
    if (!folderPrefsLoaded || !profile?.id) return;
    const prefs: Record<string, unknown> = {
      ...((profile as any).ui_prefs ?? {}),
      dt_custom_folders: customFolders,
      dt_folder_map: templateFolderMap,
    };
    db.saveUiPrefs(profile.id, prefs);
    // Clean up legacy localStorage entries
    localStorage.removeItem('dt_custom_folders');
    localStorage.removeItem('dt_folder_map');
  }, [customFolders, templateFolderMap, folderPrefsLoaded, profile?.id]);

  // Use centralized category configuration
  const templateCategories = DOCUMENT_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: <cat.icon className="w-4 h-4" />,
    color: cat.color
  }));

  // Load templates from storage/API
  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Professional document templates with company branding and customer info
      const mockTemplates: DocumentTemplate[] = [
        {
          id: '1',
          name: 'Professional Storm Damage Estimate',
          description: 'Comprehensive, professional estimate template for storm damage restoration projects',
          category: 'estimate',
          content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Storm Damage Estimate</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .company-info { flex: 1; }
    .company-logo { flex: 0 0 120px; text-align: right; }
    .company-name { font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
    .company-tagline { font-size: 14px; color: #666; font-style: italic; margin-bottom: 10px; }
    .contact-info { font-size: 14px; line-height: 1.4; }
    .logo-placeholder { width: 100px; height: 60px; background: #f3f4f6; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280; }
    .document-title { text-align: center; font-size: 24px; font-weight: bold; color: #1f2937; margin: 30px 0; }
    .info-section { display: flex; gap: 30px; margin-bottom: 30px; }
    .customer-info, .project-info { flex: 1; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .section-title { font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .info-item { margin-bottom: 8px; display: flex; }
    .info-label { font-weight: 600; min-width: 120px; color: #4b5563; }
    .info-value { color: #1f2937; }
    .scope-section { margin: 30px 0; padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; }
    .scope-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; }
    .scope-content { line-height: 1.8; color: #374151; }
    .breakdown-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .breakdown-table th, .breakdown-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .breakdown-table th { background: #f3f4f6; font-weight: 600; color: #374151; }
    .total-section { background: #3b82f6; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
    .total-amount { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .total-label { font-size: 16px; opacity: 0.9; }
    .terms { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 30px; }
    .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature-box { text-align: center; flex: 1; margin: 0 20px; }
    .signature-line { border-bottom: 2px solid #374151; margin-bottom: 10px; height: 40px; }
    .signature-label { font-size: 14px; color: #6b7280; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div class="company-name">{{COMPANY_NAME}}</div>
      <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
      <div class="contact-info">
        <strong>{{REP_NAME}}</strong> - Licensed Contractor<br>
        {{COMPANY_ADDRESS}}<br>
        {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
        Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}<br>
        License: {{CONTRACTOR_LICENSE}}
      </div>
    </div>
    <div class="company-logo"><div class="logo-placeholder">{{COMPANY_LOGO}}</div></div>
  </div>
  <div class="document-title">STORM DAMAGE ESTIMATE</div>
  <div class="info-section">
    <div class="customer-info">
      <div class="section-title">CUSTOMER INFORMATION</div>
      <div class="info-item"><span class="info-label">Name:</span><span class="info-value">{{CUSTOMER_NAME}}</span></div>
      <div class="info-item"><span class="info-label">Phone:</span><span class="info-value">{{CUSTOMER_PHONE}}</span></div>
      <div class="info-item"><span class="info-label">Email:</span><span class="info-value">{{CUSTOMER_EMAIL}}</span></div>
      <div class="info-item"><span class="info-label">Property:</span><span class="info-value">{{PROPERTY_ADDRESS}}, {{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</span></div>
      <div class="info-item"><span class="info-label">Insurance:</span><span class="info-value">{{INSURANCE_COMPANY}}</span></div>
      <div class="info-item"><span class="info-label">Policy #:</span><span class="info-value">{{POLICY_NUMBER}}</span></div>
      <div class="info-item"><span class="info-label">Claim #:</span><span class="info-value">{{CLAIM_NUMBER}}</span></div>
      <div class="info-item"><span class="info-label">Adjuster:</span><span class="info-value">{{ADJUSTER_NAME}} - {{ADJUSTER_PHONE}}</span></div>
    </div>
    <div class="project-info">
      <div class="section-title">PROJECT DETAILS</div>
      <div class="info-item"><span class="info-label">Estimate Date:</span><span class="info-value">{{ESTIMATE_DATE}}</span></div>
      <div class="info-item"><span class="info-label">Estimate #:</span><span class="info-value">{{ESTIMATE_NUMBER}}</span></div>
      <div class="info-item"><span class="info-label">Project Type:</span><span class="info-value">{{PROJECT_TYPE}}</span></div>
      <div class="info-item"><span class="info-label">Storm Date:</span><span class="info-value">{{STORM_DATE}}</span></div>
      <div class="info-item"><span class="info-label">Damage Type:</span><span class="info-value">{{DAMAGE_TYPE}}</span></div>
      <div class="info-item"><span class="info-label">Start:</span><span class="info-value">{{REQUESTED_START}}</span></div>
      <div class="info-item"><span class="info-label">Duration:</span><span class="info-value">{{ESTIMATED_DURATION}}</span></div>
      <div class="info-item"><span class="info-label">Deductible:</span><span class="info-value">{{DEDUCTIBLE_AMOUNT}}</span></div>
    </div>
  </div>
  <div class="scope-section"><div class="scope-title">SCOPE OF WORK</div><div class="scope-content">{{SCOPE_OF_WORK}}</div></div>
  <div class="scope-section">
    <div class="scope-title">COST BREAKDOWN</div>
    <table class="breakdown-table">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>{{COST_BREAKDOWN_ITEMS}}</tbody>
    </table>
    <div style="text-align:right;margin-top:10px;">
      <div><strong>Subtotal: {{SUBTOTAL}}</strong></div>
      <div>Tax ({{TAX_RATE}}%): {{TAX_AMOUNT}}</div>
      <div>Deductible: -{{DEDUCTIBLE_AMOUNT}}</div>
    </div>
  </div>
  <div class="total-section"><div class="total-label">TOTAL PROJECT COST</div><div class="total-amount">{{TOTAL_AMOUNT}}</div></div>
  <div class="terms"><strong>Terms:</strong> Valid 30 days. Warranty: {{WARRANTY_PERIOD}}. Payment due on completion.</div>
  <div class="signature-section">
    <div class="signature-box"><div class="signature-line"></div><div class="signature-label">Customer Signature / Date</div></div>
    <div class="signature-box"><div class="signature-line"></div><div class="signature-label">Contractor Signature / Date</div></div>
  </div>
  <div class="footer">Thank you for choosing {{COMPANY_NAME}}!</div>
</body></html>`,
          variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','INSURANCE_COMPANY','POLICY_NUMBER','CLAIM_NUMBER','ADJUSTER_NAME','ADJUSTER_PHONE','ESTIMATE_DATE','ESTIMATE_NUMBER','PROJECT_TYPE','STORM_DATE','DAMAGE_TYPE','REQUESTED_START','ESTIMATED_DURATION','DEDUCTIBLE_AMOUNT','SCOPE_OF_WORK','COST_BREAKDOWN_ITEMS','SUBTOTAL','TAX_RATE','TAX_AMOUNT','TOTAL_AMOUNT','WARRANTY_PERIOD'],
          favorite: true,
          isDefault: true,
          tags: ['storm','restoration','roofing','professional'],
          createdAt: '2026-01-15',
          lastModified: '2026-03-03',
          usageCount: 47,
          fileType: 'html'
        },
        {
          id: '2',
          name: 'Professional Work Order',
          description: 'Comprehensive work order template for roofing and restoration projects',
          category: 'work-order',
          content: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Work Order</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}.header{border-bottom:3px solid #059669;padding-bottom:20px;margin-bottom:30px}.company-name{font-size:28px;font-weight:bold;color:#059669}.document-title{text-align:center;font-size:24px;font-weight:bold;margin:20px 0}.info-section{display:flex;gap:20px;margin-bottom:20px}.info-card{flex:1;background:#f0fdf4;padding:15px;border-radius:8px;border-left:4px solid #059669}.section-title{font-weight:bold;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:5px}.work-section{border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0}.signature-section{display:flex;gap:40px;margin-top:40px}.signature-box{flex:1;text-align:center}.signature-line{border-bottom:2px solid #374151;height:40px;margin-bottom:8px}</style></head><body><div class="header"><div class="company-name">{{COMPANY_NAME}}</div><div>{{COMPANY_TAGLINE}}</div><div>{{SUPERVISOR_NAME}} | {{SUPERVISOR_PHONE}} | {{SUPERVISOR_EMAIL}} | License: {{CONTRACTOR_LICENSE}}</div></div><div class="document-title">WORK ORDER #{{WORK_ORDER_NUMBER}}</div><div class="info-section"><div class="info-card"><div class="section-title">CUSTOMER</div><div>{{CUSTOMER_NAME}}</div><div>{{CUSTOMER_PHONE}}</div><div>{{CUSTOMER_EMAIL}}</div><div>{{JOB_SITE_ADDRESS}}, {{JOB_SITE_CITY}}, {{JOB_SITE_STATE}} {{JOB_SITE_ZIP}}</div><div>Access: {{ACCESS_INSTRUCTIONS}}</div><div>Emergency: {{EMERGENCY_CONTACT}}</div></div><div class="info-card"><div class="section-title">SCHEDULE</div><div>Start: {{START_DATE}} at {{START_TIME}}</div><div>Duration: {{ESTIMATED_DURATION}}</div><div>Completion: {{COMPLETION_DATE}}</div><div>Backup: {{BACKUP_DATE}}</div><div>Priority: {{PRIORITY_LEVEL}}</div></div></div><div class="work-section"><div class="section-title">WORK TO BE PERFORMED</div><div>{{WORK_DESCRIPTION}}</div></div><div class="work-section"><div class="section-title">MATERIALS REQUIRED</div><div>{{MATERIALS_LIST}}</div></div><div class="work-section"><div class="section-title">CREW ASSIGNMENT</div><div>{{CREW_ASSIGNMENTS}}</div></div><div class="signature-section"><div class="signature-box"><div class="signature-line"></div><div>Supervisor / Date</div></div><div class="signature-box"><div class="signature-line"></div><div>Crew Leader / Date</div></div><div class="signature-box"><div class="signature-line"></div><div>Customer / Date</div></div></div></body></html>`,
          variables: ['COMPANY_NAME','COMPANY_TAGLINE','SUPERVISOR_NAME','SUPERVISOR_PHONE','SUPERVISOR_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','WORK_ORDER_NUMBER','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','JOB_SITE_ADDRESS','JOB_SITE_CITY','JOB_SITE_STATE','JOB_SITE_ZIP','ACCESS_INSTRUCTIONS','EMERGENCY_CONTACT','START_DATE','START_TIME','ESTIMATED_DURATION','COMPLETION_DATE','BACKUP_DATE','PRIORITY_LEVEL','WORK_DESCRIPTION','MATERIALS_LIST','CREW_ASSIGNMENTS','ADDITIONAL_SAFETY_REQUIREMENTS'],
          favorite: false,
          isDefault: false,
          tags: ['roofing','work-order','crew','professional'],
          createdAt: '2026-02-01',
          lastModified: '2026-03-03',
          usageCount: 23,
          fileType: 'html'
        },
        {
          id: '3',
          name: '3-Day Right to Cancel (Right to Rescind)',
          description: 'FTC-compliant 3-Day Right to Cancel form for home improvement contracts. Required for door-to-door sales and home solicitations.',
          category: '3_day_cancel',
          content: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>3-Day Right to Cancel</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto;line-height:1.6}.header{text-align:center;border-bottom:3px solid #dc2626;padding-bottom:20px;margin-bottom:30px}.title{font-size:24px;font-weight:bold;color:#dc2626;margin-bottom:10px}.subtitle{font-size:14px;color:#666;font-style:italic}.notice-box{background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:20px;margin:20px 0}.notice-title{font-size:18px;font-weight:bold;color:#dc2626;margin-bottom:15px}.notice-text{font-size:14px;line-height:1.8;color:#374151}.info-section{margin:25px 0;padding:15px;background:#f9fafb;border-left:4px solid #6b7280;border-radius:4px}.info-label{font-weight:600;color:#374151;margin-bottom:5px}.cancellation-form{border:2px dashed #9ca3af;padding:20px;margin:25px 0;background:#fff}.form-title{font-weight:bold;margin-bottom:15px;color:#1f2937}.form-field{margin:10px 0;padding:8px 0;border-bottom:1px solid #e5e7eb}.signature-section{margin-top:30px;padding-top:20px;border-top:2px solid #e5e7eb}.sig-line{border-bottom:2px solid #374151;margin:30px 0 10px;height:40px}.sig-label{font-size:13px;color:#6b7280}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}</style></head><body><div class="header"><div class="title">NOTICE OF RIGHT TO CANCEL</div><div class="subtitle">3-Day Cancellation Period for Home Improvement Contracts</div></div><div class="info-section"><div class="info-label">Contract Date:</div><div>{{CONTRACT_DATE}}</div></div><div class="info-section"><div class="info-label">Customer Name:</div><div>{{CUSTOMER_NAME}}</div></div><div class="info-section"><div class="info-label">Property Address:</div><div>{{PROPERTY_ADDRESS}}, {{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</div></div><div class="info-section"><div class="info-label">Contractor:</div><div>{{COMPANY_NAME}}</div><div>{{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}</div><div>Phone: {{COMPANY_PHONE}} | License: {{CONTRACTOR_LICENSE}}</div></div><div class="notice-box"><div class="notice-title">YOUR RIGHT TO CANCEL</div><div class="notice-text"><p><strong>You may cancel this transaction, without any penalty or obligation, within THREE BUSINESS DAYS from the date you signed this contract.</strong></p><p>If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within TEN BUSINESS DAYS following receipt by the seller of your cancellation notice, and any security interest arising out of the transaction will be cancelled.</p><p>If you cancel, you must make available to the seller at your residence, in substantially as good condition as when received, any goods delivered to you under this contract or sale; or you may, if you wish, comply with the instructions of the seller regarding the return shipment of the goods at the seller's expense and risk.</p><p>If you do make the goods available to the seller and the seller does not pick them up within 20 days of the date of your notice of cancellation, you may retain or dispose of the goods without any further obligation.</p><p>If you fail to make the goods available to the seller, or if you agree to return the goods to the seller and fail to do so, then you remain liable for performance of all obligations under the contract.</p></div></div><div class="notice-box"><div class="notice-title">HOW TO CANCEL</div><div class="notice-text"><p>To cancel this transaction, you may use the cancellation form below or send a written notice to:</p><p><strong>{{COMPANY_NAME}}</strong><br>{{COMPANY_ADDRESS}}<br>{{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>Phone: {{COMPANY_PHONE}}<br>Email: {{COMPANY_EMAIL}}</p><p><strong>The notice must be postmarked, sent by email, or delivered in person no later than midnight of {{CANCELLATION_DEADLINE}}.</strong></p></div></div><div class="cancellation-form"><div class="form-title">CANCELLATION FORM</div><div class="form-field">Date: _______________________</div><div class="form-field">To: {{COMPANY_NAME}}</div><div style="margin:20px 0;padding:15px;background:#f9fafb"><p>I/We hereby cancel this transaction.</p></div><div class="form-field">Customer Name (Print): _______________________________________</div><div class="sig-line"></div><div class="sig-label">Customer Signature</div><div class="form-field" style="margin-top:20px">Customer Address: _______________________________________</div><div class="form-field">City, State, ZIP: _______________________________________</div></div><div class="signature-section"><div style="margin-bottom:20px;font-weight:600">ACKNOWLEDGMENT OF RECEIPT</div><p style="font-size:13px;margin-bottom:20px">I/We acknowledge receipt of two copies of this Notice of Right to Cancel and one copy of the contract.</p><div class="sig-line"></div><div class="sig-label">Customer Signature / Date</div><div class="sig-line"></div><div class="sig-label">Customer Signature / Date (if joint contract)</div></div><div class="footer">This notice is provided in compliance with the Federal Trade Commission's Cooling-Off Rule (16 CFR Part 429) and applicable state laws.</div></body></html>`,
          variables: ['CONTRACT_DATE','CUSTOMER_NAME','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','COMPANY_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','CONTRACTOR_LICENSE','COMPANY_EMAIL','CANCELLATION_DEADLINE'],
          favorite: false,
          isDefault: true,
          tags: ['legal','compliance','ftc','required','contract'],
          createdAt: '2026-01-15',
          lastModified: '2026-03-03',
          usageCount: 0,
          fileType: 'html'
        },
        {
          id: '4',
          name: 'Change Order Authorization',
          description: 'Professional change order form for scope modifications with cost impact analysis',
          category: 'change-order',
          content: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Change Order</title><style>body{font-family:Arial,sans-serif;padding:30px;max-width:800px;margin:0 auto}.header{border-bottom:4px solid #b45309;padding-bottom:20px;margin-bottom:25px}.company-name{font-size:26px;font-weight:800;color:#b45309}.doc-title{text-align:center;font-size:22px;font-weight:700;margin:15px 0}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:25px}.info-card{background:#fffbeb;padding:18px;border-radius:8px;border-left:4px solid #d97706}.info-card h3{font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;margin:0 0 10px}.section{border:1px solid #e7e5e4;border-radius:8px;padding:20px;margin:20px 0}.cost-total{background:#b45309;color:#fff;padding:20px;border-radius:8px;text-align:center;margin:20px 0}.amount{font-size:28px;font-weight:800}.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:35px}.sig-box{text-align:center}.sig-line{border-bottom:2px solid #374151;height:45px;margin-bottom:8px}</style></head><body><div class="header"><div class="company-name">{{COMPANY_NAME}}</div><div>{{COMPANY_TAGLINE}}</div><div>{{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}} | {{COMPANY_PHONE}} | {{COMPANY_EMAIL}} | License: {{CONTRACTOR_LICENSE}}</div></div><div class="doc-title">CHANGE ORDER AUTHORIZATION</div><div style="text-align:center;color:#78716c;margin-bottom:20px">Change Order #{{CHANGE_ORDER_NUMBER}} — Original Contract #{{CONTRACT_NUMBER}}</div><div class="info-grid"><div class="info-card"><h3>Project Information</h3><div>Project: {{PROJECT_NAME}}</div><div>Client: {{CLIENT_NAME}}</div><div>Property: {{PROJECT_ADDRESS}}</div><div>Claim #: {{CLAIM_NUMBER}}</div></div><div class="info-card"><h3>Change Order Details</h3><div>Date: {{CHANGE_DATE}}</div><div>Requested By: {{REQUESTED_BY}}</div><div>Priority: {{PRIORITY_LEVEL}}</div><div>Adjuster: {{ADJUSTER_NAME}}</div></div></div><div class="section"><strong>Reason for Change:</strong><p>{{REASON_FOR_CHANGE}}</p></div><div class="section"><strong>Original Scope:</strong><p>{{ORIGINAL_SCOPE}}</p></div><div class="section"><strong>Additional Work Required:</strong><p>{{ADDITIONAL_WORK}}</p></div><div class="section"><strong>Cost Impact:</strong><p>Materials: {{ADDITIONAL_MATERIALS_COST}} | Labor: {{ADDITIONAL_LABOR_COST}} | Permits: {{PERMIT_FEES}}</p><div>{{ADDITIONAL_COST_ITEMS}}</div></div><div class="cost-total"><div style="font-size:13px;margin-bottom:5px">TOTAL ADDITIONAL COST</div><div class="amount">{{TOTAL_ADDITIONAL_COST}}</div><div style="font-size:12px;margin-top:4px">New Revised Total: {{REVISED_CONTRACT_TOTAL}}</div></div><div class="section"><strong>Schedule Impact:</strong> Original: {{ORIGINAL_COMPLETION}} → New: {{NEW_COMPLETION}} (+{{ADDITIONAL_DAYS}} days)</div><div class="sig-grid"><div class="sig-box"><div class="sig-line"></div><div>Customer Signature / Date</div></div><div class="sig-box"><div class="sig-line"></div><div>Contractor Signature / Date</div></div></div></body></html>`,
          variables: ['COMPANY_NAME','COMPANY_TAGLINE','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CHANGE_ORDER_NUMBER','CONTRACT_NUMBER','PROJECT_NAME','CLIENT_NAME','PROJECT_ADDRESS','CLAIM_NUMBER','CHANGE_DATE','REQUESTED_BY','PRIORITY_LEVEL','ADJUSTER_NAME','REASON_FOR_CHANGE','ORIGINAL_SCOPE','ADDITIONAL_WORK','ADDITIONAL_MATERIALS_COST','ADDITIONAL_LABOR_COST','PERMIT_FEES','ADDITIONAL_COST_ITEMS','TOTAL_ADDITIONAL_COST','REVISED_CONTRACT_TOTAL','ORIGINAL_COMPLETION','NEW_COMPLETION','ADDITIONAL_DAYS'],
          favorite: false,
          isDefault: false,
          tags: ['change-order','approval','contract','insurance','professional'],
          createdAt: '2026-02-10',
          lastModified: '2026-02-25',
          usageCount: 8,
          fileType: 'html'
        },
      ];

      // Load contractor estimate templates and certificate template
      try {
        const contractorTemplates = getContractorEstimateTemplates();
        const certTemplate = getCertificateOfCompletionTemplate();
        const allTemplates = [...mockTemplates, ...contractorTemplates, certTemplate].filter(Boolean) as DocumentTemplate[];
        setTemplates(allTemplates);
        setFilteredTemplates(allTemplates);
      } catch {
        setTemplates(mockTemplates);
        setFilteredTemplates(mockTemplates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // ── Filter templates ─────────────────────────────────────────────────────
  useEffect(() => {
    let filtered = templates;

    if (selectedFolder !== 'all') {
      if (selectedFolder.startsWith('cat:')) {
        const catId = selectedFolder.slice(4);
        filtered = filtered.filter(t => t.category === catId);
      } else {
        filtered = filtered.filter(t => templateFolderMap[t.id] === selectedFolder);
      }
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }
    if (filters.tag !== 'all') {
      filtered = filtered.filter(t => t.tags.includes(filters.tag));
    }
    if (filters.favorite) {
      filtered = filtered.filter(t => t.favorite);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    setFilteredTemplates(filtered);
  }, [templates, filters, searchQuery, selectedFolder, templateFolderMap]);

  const toggleFavorite = (id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, favorite: !t.favorite } : t));
  };

  const duplicateTemplate = (template: DocumentTemplate) => {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      favorite: false,
      isDefault: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      usageCount: 0,
    };
    setTemplates(prev => [...prev, newTemplate]);
    toast({ title: 'Template duplicated', description: `"${newTemplate.name}" has been created.` });
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
    toast({ title: 'Template deleted' });
  };

  // ── Folder helpers ────────────────────────────────────────────────────────
  const addCustomFolder = () => {
    const name = newFolderName.trim();
    if (!name || customFolders.includes(name)) return;
    setCustomFolders(prev => [...prev, name]);
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const removeCustomFolder = (folder: string) => {
    setCustomFolders(prev => prev.filter(f => f !== folder));
    setTemplateFolderMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => { if (next[id] === folder) delete next[id]; });
      return next;
    });
    if (selectedFolder === folder) setSelectedFolder('all');
  };

  const moveToFolder = (templateId: string, folder: string) => {
    setTemplateFolderMap(prev => ({ ...prev, [templateId]: folder }));
    setMovingTemplateId(null);
    toast({ title: 'Template moved', description: `Moved to "${folder}"` });
  };

  const getCategoryInfo = (categoryId: string) => {
    return DOCUMENT_CATEGORIES.find(c => c.id === categoryId) ?? DOCUMENT_CATEGORIES[0];
  };

  const allTags = Array.from(new Set(templates.flatMap(t => t.tags)));

  // ── If full-screen editor is open, render it exclusively ─────────────────
  if (fullScreenTemplate) {
    return (
      <FullScreenDocumentEditor
        template={fullScreenTemplate}
        onBack={() => {
          // Preserve all list state — just close the editor
          setFullScreenTemplate(null);
          setFullScreenContactId('');
        }}
        companyProfile={companyProfile}
        contacts={crmState.contacts}
        initialContactId={fullScreenContactId || selectedContactId}
        initialContent={editedContent}
      />
    );
  }

  // ── Main templates list ───────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-gray-50">

      {/* Sidebar: folders */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 text-sm">Templates</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* All */}
          <button
            onClick={() => setSelectedFolder('all')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedFolder === 'all'
                ? 'bg-green-50 text-green-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            All Templates
            <span className="ml-auto text-xs text-gray-400">{templates.length}</span>
          </button>

          {/* System category folders */}
          {DOCUMENT_CATEGORIES.map(cat => {
            const count = templates.filter(t => t.category === cat.id).length;
            if (count === 0) return null;
            const folderId = `cat:${cat.id}`;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedFolder(folderId)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFolder === folderId
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                {cat.label}
                <span className="ml-auto text-xs text-gray-400">{count}</span>
              </button>
            );
          })}

          {/* Divider */}
          {customFolders.length > 0 && <div className="border-t border-gray-100 my-2" />}

          {/* Custom folders */}
          {customFolders.map(folder => (
            <div key={folder} className="flex items-center group">
              <button
                onClick={() => setSelectedFolder(folder)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFolder === folder
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {selectedFolder === folder
                  ? <FolderOpen className="w-4 h-4" />
                  : <Folder className="w-4 h-4" />}
                <span className="truncate">{folder}</span>
              </button>
              <button
                onClick={() => removeCustomFolder(folder)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
              >
                <FolderX className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add folder */}
        <div className="p-3 border-t border-gray-200">
          {showNewFolderInput ? (
            <div className="space-y-2">
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomFolder(); if (e.key === 'Escape') setShowNewFolderInput(false); }}
                placeholder="Folder name…"
                className="h-7 text-xs focus:ring-green-500 focus:border-green-500"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={addCustomFolder} className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white flex-1">Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewFolderInput(false)} className="h-6 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-green-700 hover:bg-green-50 rounded-lg transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Folder
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search templates…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Filters */}
          <Select value={filters.category} onValueChange={v => setFilters(p => ({ ...p, category: v }))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DOCUMENT_CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={filters.favorite ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters(p => ({ ...p, favorite: !p.favorite }))}
            className={filters.favorite ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-green-300 text-green-700 hover:bg-green-50'}
          >
            <Star className="w-4 h-4 mr-1" />
            Favorites
          </Button>

          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white ml-auto"
            onClick={() => setShowCreateTemplate(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Template
          </Button>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading templates…</div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p>No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map(template => {
                const cat = getCategoryInfo(template.category);
                return (
                  <Card key={template.id} className="group hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-green-300">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: cat.color + '22' }}
                          >
                            <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold text-gray-800 leading-tight truncate">
                              {template.name}
                            </CardTitle>
                            <Badge
                              className="text-xs mt-0.5"
                              style={{ backgroundColor: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44` }}
                            >
                              {cat.label}
                            </Badge>
                          </div>
                        </div>

                        {/* Actions menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => {
                              setFullScreenContactId(selectedContactId);
                              setFullScreenTemplate(template);
                            }}>
                              <Edit className="w-4 h-4 mr-2 text-green-600" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedTemplate(template);
                              setPreviewMode(true);
                            }}>
                              <Eye className="w-4 h-4 mr-2" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFavorite(template.id)}>
                              {template.favorite
                                ? <><StarOff className="w-4 h-4 mr-2" /> Unfavorite</>
                                : <><Star className="w-4 h-4 mr-2" /> Favorite</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
                              <Copy className="w-4 h-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            {customFolders.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                {customFolders.map(folder => (
                                  <DropdownMenuItem key={folder} onClick={() => moveToFolder(template.id, folder)}>
                                    <Folder className="w-4 h-4 mr-2" /> Move to {folder}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteTemplate(template.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{template.description}</p>

                      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                        <span>{template.usageCount} uses</span>
                        <span>{template.variables.length} fields</span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {template.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>

                      {/* Favorite star */}
                      {template.favorite && (
                        <div className="flex items-center gap-1 text-xs text-amber-500 mb-2">
                          <Star className="w-3 h-3 fill-current" /> Favorite
                        </div>
                      )}

                      {/* Edit button */}
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                        onClick={() => {
                          setFullScreenContactId(selectedContactId);
                          setFullScreenTemplate(template);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Edit Template
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplates;
