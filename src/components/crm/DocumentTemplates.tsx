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
  Calendar,
  DollarSign,
  Briefcase,
  FileSignature,
  ClipboardList,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'estimate' | 'invoice' | 'contract' | 'work-order' | 'proposal' | 'change-order' | 'safety' | 'other';
  content: string;
  variables: string[]; // e.g., ['CLIENT_NAME', 'PROJECT_ADDRESS', 'TOTAL_AMOUNT']
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
  
  const { toast } = useToast();

  // Template categories for contractors
  const templateCategories = [
    { id: 'estimate', label: 'Estimates', icon: <DollarSign className="w-4 h-4" />, color: 'bg-green-100 text-green-800' },
    { id: 'invoice', label: 'Invoices', icon: <FileText className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
    { id: 'contract', label: 'Contracts', icon: <FileSignature className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' },
    { id: 'work-order', label: 'Work Orders', icon: <ClipboardList className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800' },
    { id: 'proposal', label: 'Proposals', icon: <Briefcase className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-800' },
    { id: 'change-order', label: 'Change Orders', icon: <Edit className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-800' },
    { id: 'safety', label: 'Safety Forms', icon: <Wrench className="w-4 h-4" />, color: 'bg-red-100 text-red-800' },
    { id: 'other', label: 'Other', icon: <FileText className="w-4 h-4" />, color: 'bg-gray-100 text-gray-800' }
  ];

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
  <!-- Company Header -->
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
    <div class="company-logo">
      <div class="logo-placeholder">{{COMPANY_LOGO}}</div>
    </div>
  </div>

  <!-- Document Title -->
  <div class="document-title">STORM DAMAGE ESTIMATE</div>

  <!-- Customer & Project Information -->
  <div class="info-section">
    <div class="customer-info">
      <div class="section-title">CUSTOMER INFORMATION</div>
      <div class="info-item">
        <span class="info-label">Name:</span>
        <span class="info-value">{{CUSTOMER_NAME}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Phone:</span>
        <span class="info-value">{{CUSTOMER_PHONE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email:</span>
        <span class="info-value">{{CUSTOMER_EMAIL}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Property Address:</span>
        <span class="info-value">{{PROPERTY_ADDRESS}}</span>
      </div>
      <div class="info-item">
        <span class="info-label"></span>
        <span class="info-value">{{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Insurance Company:</span>
        <span class="info-value">{{INSURANCE_COMPANY}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Policy Number:</span>
        <span class="info-value">{{POLICY_NUMBER}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Claim Number:</span>
        <span class="info-value">{{CLAIM_NUMBER}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Adjuster:</span>
        <span class="info-value">{{ADJUSTER_NAME}} - {{ADJUSTER_PHONE}}</span>
      </div>
    </div>
    <div class="project-info">
      <div class="section-title">PROJECT DETAILS</div>
      <div class="info-item">
        <span class="info-label">Estimate Date:</span>
        <span class="info-value">{{ESTIMATE_DATE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Estimate #:</span>
        <span class="info-value">{{ESTIMATE_NUMBER}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Project Type:</span>
        <span class="info-value">{{PROJECT_TYPE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Storm Date:</span>
        <span class="info-value">{{STORM_DATE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Damage Type:</span>
        <span class="info-value">{{DAMAGE_TYPE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Requested Start:</span>
        <span class="info-value">{{REQUESTED_START}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Est. Duration:</span>
        <span class="info-value">{{ESTIMATED_DURATION}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Deductible:</span>
        <span class="info-value">{{DEDUCTIBLE_AMOUNT}}</span>
      </div>
    </div>
  </div>

  <!-- Scope of Work -->
  <div class="scope-section">
    <div class="scope-title">SCOPE OF WORK</div>
    <div class="scope-content">{{SCOPE_OF_WORK}}</div>
  </div>

  <!-- Cost Breakdown -->
  <div class="scope-section">
    <div class="scope-title">COST BREAKDOWN</div>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="width: 100px;">Quantity</th>
          <th style="width: 120px;">Unit Price</th>
          <th style="width: 120px;">Total</th>
        </tr>
      </thead>
      <tbody>
        {{COST_BREAKDOWN_ITEMS}}
      </tbody>
    </table>
    
    <div style="margin-top: 20px; text-align: right;">
      <div style="margin-bottom: 8px;"><strong>Subtotal: {{SUBTOTAL}}</strong></div>
      <div style="margin-bottom: 8px;">Tax ({{TAX_RATE}}%): {{TAX_AMOUNT}}</div>
      <div style="margin-bottom: 8px;">Insurance Deductible: -{{DEDUCTIBLE_AMOUNT}}</div>
    </div>
  </div>

  <!-- Total Amount -->
  <div class="total-section">
    <div class="total-label">TOTAL PROJECT COST</div>
    <div class="total-amount">{{TOTAL_AMOUNT}}</div>
    <div style="font-size: 14px; opacity: 0.9;">Amount due after insurance claim settlement</div>
  </div>

  <!-- Terms and Conditions -->
  <div class="terms">
    <p><strong>Terms & Conditions:</strong></p>
    <p>• This estimate is valid for 30 days from the date above.<br>
    • Work to be completed according to agreed specifications.<br>
    • Final payment due upon completion and customer satisfaction.<br>
    • All materials and workmanship guaranteed for {{WARRANTY_PERIOD}}.<br>
    • Changes to scope of work require written authorization.</p>
  </div>

  <!-- Signatures -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Customer Signature / Date</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Contractor Signature / Date</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    Thank you for choosing {{COMPANY_NAME}} for your restoration needs!<br>
    We're committed to quality workmanship and customer satisfaction.
  </div>
</body>
</html>`,
          variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'REP_NAME', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'CONTRACTOR_LICENSE', 'COMPANY_LOGO', 'CUSTOMER_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL', 'PROPERTY_ADDRESS', 'PROPERTY_CITY', 'PROPERTY_STATE', 'PROPERTY_ZIP', 'INSURANCE_COMPANY', 'POLICY_NUMBER', 'CLAIM_NUMBER', 'ADJUSTER_NAME', 'ADJUSTER_PHONE', 'ESTIMATE_DATE', 'ESTIMATE_NUMBER', 'PROJECT_TYPE', 'STORM_DATE', 'DAMAGE_TYPE', 'REQUESTED_START', 'ESTIMATED_DURATION', 'DEDUCTIBLE_AMOUNT', 'SCOPE_OF_WORK', 'COST_BREAKDOWN_ITEMS', 'SUBTOTAL', 'TAX_RATE', 'TAX_AMOUNT', 'TOTAL_AMOUNT', 'WARRANTY_PERIOD'],
          favorite: true,
          isDefault: true,
          tags: ['storm', 'restoration', 'roofing', 'professional'],
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
          content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Work Order</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .company-info { flex: 1; }
    .company-logo { flex: 0 0 120px; text-align: right; }
    .company-name { font-size: 28px; font-weight: bold; color: #059669; margin-bottom: 5px; }
    .company-tagline { font-size: 14px; color: #666; font-style: italic; margin-bottom: 10px; }
    .contact-info { font-size: 14px; line-height: 1.4; }
    .logo-placeholder { width: 100px; height: 60px; background: #f3f4f6; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280; }
    .document-title { text-align: center; font-size: 24px; font-weight: bold; color: #1f2937; margin: 30px 0; }
    .info-section { display: flex; gap: 30px; margin-bottom: 30px; }
    .customer-info, .project-info { flex: 1; background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; }
    .section-title { font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .info-item { margin-bottom: 8px; display: flex; }
    .info-label { font-weight: 600; min-width: 120px; color: #4b5563; }
    .info-value { color: #1f2937; }
    .work-section { margin: 30px 0; padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; }
    .work-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; }
    .work-content { line-height: 1.8; color: #374151; }
    .crew-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .crew-table th, .crew-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .crew-table th { background: #f3f4f6; font-weight: 600; color: #374151; }
    .safety-section { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 30px 0; }
    .safety-title { color: #dc2626; font-weight: bold; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
    .safety-item { margin: 10px 0; padding: 8px; background: white; border-radius: 4px; }
    .priority-high { background: #dc2626; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
    .signature-section { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
    .signature-box { text-align: center; flex: 1; }
    .signature-line { border-bottom: 2px solid #374151; margin-bottom: 10px; height: 40px; }
    .signature-label { font-size: 14px; color: #6b7280; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    .checkbox-list { list-style: none; padding: 0; }
    .checkbox-list li { margin: 10px 0; padding: 8px; background: #f9fafb; border-radius: 4px; }
    .checkbox-list li:before { content: "☐ "; font-weight: bold; color: #059669; margin-right: 8px; }
  </style>
</head>
<body>
  <!-- Company Header -->
  <div class="header">
    <div class="company-info">
      <div class="company-name">{{COMPANY_NAME}}</div>
      <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
      <div class="contact-info">
        <strong>{{SUPERVISOR_NAME}}</strong> - Project Supervisor<br>
        {{COMPANY_ADDRESS}}<br>
        {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
        Phone: {{SUPERVISOR_PHONE}} | Email: {{SUPERVISOR_EMAIL}}<br>
        License: {{CONTRACTOR_LICENSE}}
      </div>
    </div>
    <div class="company-logo">
      <div class="logo-placeholder">{{COMPANY_LOGO}}</div>
    </div>
  </div>

  <!-- Document Title -->
  <div class="document-title">WORK ORDER #{{WORK_ORDER_NUMBER}}</div>

  <!-- Customer & Project Information -->
  <div class="info-section">
    <div class="customer-info">
      <div class="section-title">CUSTOMER INFORMATION</div>
      <div class="info-item">
        <span class="info-label">Name:</span>
        <span class="info-value">{{CUSTOMER_NAME}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Phone:</span>
        <span class="info-value">{{CUSTOMER_PHONE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email:</span>
        <span class="info-value">{{CUSTOMER_EMAIL}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Job Site Address:</span>
        <span class="info-value">{{JOB_SITE_ADDRESS}}</span>
      </div>
      <div class="info-item">
        <span class="info-label"></span>
        <span class="info-value">{{JOB_SITE_CITY}}, {{JOB_SITE_STATE}} {{JOB_SITE_ZIP}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Access Instructions:</span>
        <span class="info-value">{{ACCESS_INSTRUCTIONS}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Emergency Contact:</span>
        <span class="info-value">{{EMERGENCY_CONTACT}}</span>
      </div>
    </div>
    <div class="project-info">
      <div class="section-title">PROJECT SCHEDULE</div>
      <div class="info-item">
        <span class="info-label">Start Date:</span>
        <span class="info-value">{{START_DATE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Start Time:</span>
        <span class="info-value">{{START_TIME}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Estimated Duration:</span>
        <span class="info-value">{{ESTIMATED_DURATION}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Expected Completion:</span>
        <span class="info-value">{{COMPLETION_DATE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Weather Backup Date:</span>
        <span class="info-value">{{BACKUP_DATE}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Priority Level:</span>
        <span class="info-value">{{PRIORITY_LEVEL}}</span>
      </div>
    </div>
  </div>

  <!-- Work Description -->
  <div class="work-section">
    <div class="work-title">WORK TO BE PERFORMED</div>
    <div class="work-content">{{WORK_DESCRIPTION}}</div>
  </div>

  <!-- Materials Required -->
  <div class="work-section">
    <div class="work-title">MATERIALS REQUIRED</div>
    <div class="work-content">
      <ul class="checkbox-list">
        {{MATERIALS_LIST}}
      </ul>
    </div>
  </div>

  <!-- Crew Assignment -->
  <div class="work-section">
    <div class="work-title">CREW ASSIGNMENT</div>
    <table class="crew-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Phone</th>
          <th>Certification</th>
        </tr>
      </thead>
      <tbody>
        {{CREW_ASSIGNMENTS}}
      </tbody>
    </table>
  </div>

  <!-- Safety Requirements -->
  <div class="safety-section">
    <div class="safety-title">
      ⚠️ SAFETY REQUIREMENTS - MANDATORY COMPLIANCE
    </div>
    <ul class="checkbox-list">
      <li>Hard hats must be worn at all times on site</li>
      <li>Safety harnesses required for all roof work above 6 feet</li>
      <li>Safety glasses and steel-toed boots are mandatory</li>
      <li>High-visibility vests required in traffic areas</li>
      <li>First aid kit must be accessible on site</li>
      <li>All power tools inspected before use</li>
      <li>Ladder safety protocols must be followed</li>
      <li>No work during severe weather conditions</li>
      {{ADDITIONAL_SAFETY_REQUIREMENTS}}
    </ul>
  </div>

  <!-- Important Notes -->
  <div class="priority-high">
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">IMPORTANT REMINDERS</div>
    <div style="font-size: 14px;">
      • Customer must be notified upon arrival and departure<br>
      • Protect all landscaping and customer property<br>
      • Clean up work area daily before leaving<br>
      • Report any issues or changes immediately to supervisor
    </div>
  </div>

  <!-- Signatures -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Supervisor Signature / Date</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Crew Leader Signature / Date</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Customer Acknowledgment / Date</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    {{COMPANY_NAME}} - Professional Storm Restoration Services<br>
    For questions or concerns, contact {{SUPERVISOR_NAME}} at {{SUPERVISOR_PHONE}}
  </div>
</body>
</html>`,
          variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'SUPERVISOR_NAME', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'SUPERVISOR_PHONE', 'SUPERVISOR_EMAIL', 'CONTRACTOR_LICENSE', 'COMPANY_LOGO', 'WORK_ORDER_NUMBER', 'CUSTOMER_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL', 'JOB_SITE_ADDRESS', 'JOB_SITE_CITY', 'JOB_SITE_STATE', 'JOB_SITE_ZIP', 'ACCESS_INSTRUCTIONS', 'EMERGENCY_CONTACT', 'START_DATE', 'START_TIME', 'ESTIMATED_DURATION', 'COMPLETION_DATE', 'BACKUP_DATE', 'PRIORITY_LEVEL', 'WORK_DESCRIPTION', 'MATERIALS_LIST', 'CREW_ASSIGNMENTS', 'ADDITIONAL_SAFETY_REQUIREMENTS'],
          favorite: false,
          isDefault: false,
          tags: ['roofing', 'work-order', 'crew', 'professional'],
          createdAt: '2026-02-01',
          lastModified: '2026-03-03',
          usageCount: 23,
          fileType: 'html'
        },
        {
          id: '3',
          name: 'Change Order Authorization',
          description: 'Professional change order form for scope modifications with cost impact analysis',
          category: 'change-order',
          content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Change Order Authorization #{{CHANGE_ORDER_NUMBER}}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 30px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #b45309; padding-bottom: 20px; margin-bottom: 25px; }
    .company-info { flex: 1; }
    .company-name { font-size: 26px; font-weight: 800; color: #b45309; margin-bottom: 4px; letter-spacing: 0.5px; }
    .company-tagline { font-size: 13px; color: #78716c; font-style: italic; margin-bottom: 8px; }
    .company-contact { font-size: 13px; line-height: 1.5; color: #57534e; }
    .logo-placeholder { width: 100px; height: 60px; background: #fef3c7; border: 2px dashed #d97706; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #92400e; border-radius: 6px; }
    .doc-badge { display: inline-block; background: linear-gradient(135deg, #b45309, #d97706); color: #fff; padding: 8px 24px; border-radius: 6px; font-size: 20px; font-weight: 700; letter-spacing: 1px; margin: 15px 0 20px; text-transform: uppercase; }
    .order-number { text-align: center; font-size: 14px; color: #78716c; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
    .info-card { background: #fffbeb; padding: 18px; border-radius: 8px; border-left: 4px solid #d97706; }
    .info-card h3 { font-size: 14px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #fde68a; }
    .info-row { display: flex; margin-bottom: 6px; font-size: 13px; }
    .info-label { font-weight: 600; min-width: 130px; color: #78716c; }
    .info-value { color: #1f2937; }
    .section { margin: 25px 0; padding: 20px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; }
    .section-title { font-size: 16px; font-weight: 700; color: #292524; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #d97706; display: flex; align-items: center; gap: 8px; }
    .section-content { font-size: 14px; line-height: 1.8; color: #44403c; }
    .cost-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 15px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e7e5e4; }
    .cost-table th { background: linear-gradient(135deg, #292524, #44403c); color: #fff; padding: 12px 16px; text-align: left; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .cost-table td { padding: 12px 16px; border-bottom: 1px solid #e7e5e4; font-size: 14px; }
    .cost-table tr:last-child td { border-bottom: none; }
    .cost-table tr:nth-child(even) td { background: #fafaf9; }
    .cost-total { background: linear-gradient(135deg, #b45309, #d97706); color: #fff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .cost-total .amount { font-size: 28px; font-weight: 800; }
    .cost-total .label { font-size: 13px; opacity: 0.9; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
    .schedule-impact { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .schedule-impact h3 { color: #dc2626; font-size: 15px; font-weight: 700; margin-bottom: 12px; }
    .schedule-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .schedule-row .old { color: #6b7280; text-decoration: line-through; }
    .schedule-row .new { color: #dc2626; font-weight: 700; }
    .authorization { background: #fffbeb; border: 2px solid #d97706; border-radius: 8px; padding: 20px; margin: 25px 0; }
    .authorization h3 { color: #92400e; font-size: 15px; font-weight: 700; margin-bottom: 10px; }
    .authorization p { font-size: 13px; color: #78716c; line-height: 1.7; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 35px; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 2px solid #292524; height: 45px; margin-bottom: 8px; }
    .sig-label { font-size: 12px; color: #78716c; font-weight: 600; }
    .footer { margin-top: 35px; text-align: center; font-size: 11px; color: #a8a29e; border-top: 1px solid #e7e5e4; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div class="company-name">{{COMPANY_NAME}}</div>
      <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
      <div class="company-contact">
        {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
        Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}<br>
        License: {{CONTRACTOR_LICENSE}}
      </div>
    </div>
    <div><div class="logo-placeholder">{{COMPANY_LOGO}}</div></div>
  </div>

  <div style="text-align:center;">
    <div class="doc-badge">Change Order Authorization</div>
    <div class="order-number">Change Order #{{CHANGE_ORDER_NUMBER}} &mdash; Original Contract #{{CONTRACT_NUMBER}}</div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <h3>Project Information</h3>
      <div class="info-row"><span class="info-label">Project:</span><span class="info-value">{{PROJECT_NAME}}</span></div>
      <div class="info-row"><span class="info-label">Client:</span><span class="info-value">{{CLIENT_NAME}}</span></div>
      <div class="info-row"><span class="info-label">Property:</span><span class="info-value">{{PROJECT_ADDRESS}}</span></div>
      <div class="info-row"><span class="info-label">Insurance Claim:</span><span class="info-value">{{CLAIM_NUMBER}}</span></div>
    </div>
    <div class="info-card">
      <h3>Change Order Details</h3>
      <div class="info-row"><span class="info-label">CO Date:</span><span class="info-value">{{CHANGE_DATE}}</span></div>
      <div class="info-row"><span class="info-label">Requested By:</span><span class="info-value">{{REQUESTED_BY}}</span></div>
      <div class="info-row"><span class="info-label">Priority:</span><span class="info-value">{{PRIORITY_LEVEL}}</span></div>
      <div class="info-row"><span class="info-label">Adjuster:</span><span class="info-value">{{ADJUSTER_NAME}}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">&#128269; Reason for Change</div>
    <div class="section-content">{{REASON_FOR_CHANGE}}</div>
  </div>

  <div class="section">
    <div class="section-title">&#128196; Original Scope</div>
    <div class="section-content">{{ORIGINAL_SCOPE}}</div>
  </div>

  <div class="section">
    <div class="section-title">&#128736; Additional Work Required</div>
    <div class="section-content">{{ADDITIONAL_WORK}}</div>
  </div>

  <div class="section">
    <div class="section-title">&#128176; Cost Impact Analysis</div>
    <table class="cost-table">
      <thead>
        <tr><th>Description</th><th style="width:140px;text-align:right;">Amount</th></tr>
      </thead>
      <tbody>
        <tr><td>Additional Materials</td><td style="text-align:right;">{{ADDITIONAL_MATERIALS_COST}}</td></tr>
        <tr><td>Additional Labor</td><td style="text-align:right;">{{ADDITIONAL_LABOR_COST}}</td></tr>
        <tr><td>Permit / Inspection Fees</td><td style="text-align:right;">{{PERMIT_FEES}}</td></tr>
        {{ADDITIONAL_COST_ITEMS}}
      </tbody>
    </table>
  </div>

  <div class="cost-total">
    <div class="label">Total Additional Cost</div>
    <div class="amount">{{TOTAL_ADDITIONAL_COST}}</div>
    <div style="font-size:12px;opacity:0.85;margin-top:4px;">New Revised Contract Total: {{REVISED_CONTRACT_TOTAL}}</div>
  </div>

  <div class="schedule-impact">
    <h3>&#9200; Schedule Impact</h3>
    <div class="schedule-row"><span>Original Completion Date:</span><span class="old">{{ORIGINAL_COMPLETION}}</span></div>
    <div class="schedule-row"><span>New Estimated Completion:</span><span class="new">{{NEW_COMPLETION}}</span></div>
    <div class="schedule-row"><span>Additional Days:</span><span class="new">{{ADDITIONAL_DAYS}} days</span></div>
  </div>

  <div class="authorization">
    <h3>Authorization &amp; Acknowledgment</h3>
    <p>By signing below, the customer authorizes the above-described additional work and agrees to the associated cost and schedule changes. This change order becomes a binding amendment to the original contract #{{CONTRACT_NUMBER}}. All other terms and conditions of the original contract remain in full effect.</p>
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Customer Signature / Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Contractor Signature / Date</div>
    </div>
  </div>
  <div class="sig-grid" style="margin-top:20px;">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Insurance Adjuster Approval / Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Project Manager / Date</div>
    </div>
  </div>

  <div class="footer">
    {{COMPANY_NAME}} &bull; {{COMPANY_PHONE}} &bull; {{COMPANY_EMAIL}} &bull; License #{{CONTRACTOR_LICENSE}}<br>
    This document is a legally binding amendment to the original contract. Retain a copy for your records.
  </div>
</body>
</html>`,
          variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'CONTRACTOR_LICENSE', 'COMPANY_LOGO', 'CHANGE_ORDER_NUMBER', 'CONTRACT_NUMBER', 'PROJECT_NAME', 'CLIENT_NAME', 'PROJECT_ADDRESS', 'CLAIM_NUMBER', 'CHANGE_DATE', 'REQUESTED_BY', 'PRIORITY_LEVEL', 'ADJUSTER_NAME', 'REASON_FOR_CHANGE', 'ORIGINAL_SCOPE', 'ADDITIONAL_WORK', 'ADDITIONAL_MATERIALS_COST', 'ADDITIONAL_LABOR_COST', 'PERMIT_FEES', 'ADDITIONAL_COST_ITEMS', 'TOTAL_ADDITIONAL_COST', 'REVISED_CONTRACT_TOTAL', 'ORIGINAL_COMPLETION', 'NEW_COMPLETION', 'ADDITIONAL_DAYS'],
          favorite: false,
          isDefault: false,
          tags: ['change-order', 'approval', 'contract', 'insurance', 'professional'],
          createdAt: '2026-02-10',
          lastModified: '2026-02-25',
          usageCount: 8,
          fileType: 'html'
        },
        {
          id: '4',
          name: 'Daily Safety Checklist',
          description: 'Professional daily safety inspection form for OSHA-compliant job site documentation',
          category: 'safety',
          content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily Safety Checklist - {{JOB_SITE}}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 25px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #dc2626; padding-bottom: 18px; margin-bottom: 20px; }
    .company-info { flex: 1; }
    .company-name { font-size: 24px; font-weight: 800; color: #dc2626; margin-bottom: 4px; }
    .company-tagline { font-size: 12px; color: #6b7280; font-style: italic; margin-bottom: 6px; }
    .company-contact { font-size: 12px; color: #57534e; }
    .logo-placeholder { width: 90px; height: 55px; background: #fef2f2; border: 2px dashed #fca5a5; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #dc2626; border-radius: 6px; }
    .title-bar { background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; padding: 14px 24px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
    .title-bar h1 { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
    .title-bar p { font-size: 12px; opacity: 0.9; margin: 4px 0 0; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .meta-card { background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
    .meta-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; font-weight: 700; margin-bottom: 4px; }
    .meta-card .value { font-size: 14px; font-weight: 600; color: #1f2937; }
    .weather-bar { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
    .weather-item { text-align: center; }
    .weather-item .wi-label { font-size: 10px; text-transform: uppercase; color: #3b82f6; font-weight: 700; }
    .weather-item .wi-value { font-size: 14px; font-weight: 600; color: #1e40af; margin-top: 2px; }
    .checklist-section { margin-bottom: 18px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .checklist-header { padding: 12px 16px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
    .checklist-header.ppe { background: #dbeafe; color: #1e40af; border-bottom: 2px solid #3b82f6; }
    .checklist-header.equipment { background: #fef3c7; color: #92400e; border-bottom: 2px solid #d97706; }
    .checklist-header.site { background: #d1fae5; color: #065f46; border-bottom: 2px solid #059669; }
    .checklist-header.hazard { background: #fef2f2; color: #991b1b; border-bottom: 2px solid #dc2626; }
    .check-item { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .check-item:last-child { border-bottom: none; }
    .check-item:nth-child(even) { background: #fafafa; }
    .checkbox { width: 20px; height: 20px; border: 2px solid #d1d5db; border-radius: 4px; margin-right: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; }
    .pass-fail { display: flex; gap: 12px; margin-left: auto; font-size: 11px; font-weight: 600; }
    .pass-fail span { padding: 2px 10px; border-radius: 4px; }
    .pf-pass { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .pf-fail { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
    .notes-section { margin: 20px 0; }
    .notes-section h3 { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 8px; }
    .notes-box { border: 1px solid #d1d5db; border-radius: 6px; min-height: 70px; padding: 12px; font-size: 13px; color: #6b7280; background: #f9fafb; }
    .emergency-banner { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; padding: 14px 20px; border-radius: 8px; margin: 20px 0; }
    .emergency-banner h3 { font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px; }
    .emergency-banner p { font-size: 12px; margin: 3px 0; opacity: 0.95; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 2px solid #374151; height: 40px; margin-bottom: 6px; }
    .sig-label { font-size: 11px; color: #6b7280; font-weight: 600; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-pass { background: #d1fae5; color: #065f46; }
    .status-fail { background: #fef2f2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div class="company-name">{{COMPANY_NAME}}</div>
      <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
      <div class="company-contact">{{COMPANY_PHONE}} | {{COMPANY_EMAIL}} | License #{{CONTRACTOR_LICENSE}}</div>
    </div>
    <div><div class="logo-placeholder">{{COMPANY_LOGO}}</div></div>
  </div>

  <div class="title-bar">
    <h1>&#9888;&#65039; Daily Job Site Safety Checklist</h1>
    <p>OSHA Compliance Documentation &mdash; Complete Before Work Begins</p>
  </div>

  <div class="meta-grid">
    <div class="meta-card"><div class="label">Inspection Date</div><div class="value">{{INSPECTION_DATE}}</div></div>
    <div class="meta-card"><div class="label">Job Site</div><div class="value">{{JOB_SITE}}</div></div>
    <div class="meta-card"><div class="label">Safety Inspector</div><div class="value">{{INSPECTOR_NAME}}</div></div>
  </div>

  <div class="weather-bar">
    <div class="weather-item"><div class="wi-label">Conditions</div><div class="wi-value">{{WEATHER_CONDITIONS}}</div></div>
    <div class="weather-item"><div class="wi-label">Wind Speed</div><div class="wi-value">{{WIND_SPEED}}</div></div>
    <div class="weather-item"><div class="wi-label">Temperature</div><div class="wi-value">{{TEMPERATURE}}</div></div>
    <div class="weather-item"><div class="wi-label">Visibility</div><div class="wi-value">{{VISIBILITY}}</div></div>
  </div>

  <!-- PPE Checklist -->
  <div class="checklist-section">
    <div class="checklist-header ppe">&#129521; Personal Protective Equipment</div>
    <div class="check-item"><div class="checkbox"></div>Hard hats available and worn by all crew members<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Safety glasses / goggles available and worn<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Steel-toed boots worn by all workers<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>High-visibility vests worn in traffic areas<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Fall protection / harnesses inspected and worn (above 6 ft)<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Hearing protection available for power tool use<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Gloves available (cut-resistant / chemical as needed)<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
  </div>

  <!-- Equipment Checklist -->
  <div class="checklist-section">
    <div class="checklist-header equipment">&#128736; Equipment &amp; Tools</div>
    <div class="check-item"><div class="checkbox"></div>All power tools inspected and in working order<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Ladders inspected, properly positioned, secured<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Scaffolding secure, level, and inspected<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Electrical cords intact with no exposed wires<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>GFCI protection in use for all electrical connections<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Nail guns and compressors inspected and safe<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
  </div>

  <!-- Site Conditions -->
  <div class="checklist-section">
    <div class="checklist-header site">&#127968; Site Conditions</div>
    <div class="check-item"><div class="checkbox"></div>Work area clean, organized, and free of tripping hazards<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Emergency exits clearly marked and unobstructed<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>First aid kit stocked and accessible<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Fire extinguisher charged and accessible<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Perimeter secure, caution tape / barriers in place<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Customer property protected (landscaping, vehicles, etc.)<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
  </div>

  <!-- Hazard Assessment -->
  <div class="checklist-section">
    <div class="checklist-header hazard">&#9888;&#65039; Hazard Assessment</div>
    <div class="check-item"><div class="checkbox"></div>No overhead power line hazards identified<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Roof deck integrity verified before access<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>No hazardous materials present (asbestos, lead, etc.)<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    <div class="check-item"><div class="checkbox"></div>Weather conditions safe for work to proceed<div class="pass-fail"><span class="pf-pass">PASS</span><span class="pf-fail">FAIL</span></div></div>
    {{ADDITIONAL_HAZARD_ITEMS}}
  </div>

  <div class="notes-section">
    <h3>Inspector Notes / Corrective Actions Required</h3>
    <div class="notes-box">{{INSPECTOR_NOTES}}</div>
  </div>

  <div class="emergency-banner">
    <h3>&#128680; Emergency Information</h3>
    <p><strong>Emergency Contact:</strong> {{EMERGENCY_CONTACT}} | <strong>Nearest Hospital:</strong> {{NEAREST_HOSPITAL}}</p>
    <p><strong>Site Address:</strong> {{JOB_SITE}} | <strong>Crew Size:</strong> {{CREW_SIZE}} workers on site</p>
  </div>

  <div style="text-align:center;margin:20px 0;">
    <span class="status-badge status-pass">SITE CLEARED FOR WORK</span>
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Safety Inspector Signature / Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Crew Leader Acknowledgment / Date</div>
    </div>
  </div>

  <div class="footer">
    {{COMPANY_NAME}} &bull; Safety First, Quality Always &bull; OSHA Compliant<br>
    This checklist must be completed daily before work commences. Retain on file for a minimum of 3 years.
  </div>
</body>
</html>`,
          variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'CONTRACTOR_LICENSE', 'COMPANY_LOGO', 'INSPECTION_DATE', 'JOB_SITE', 'INSPECTOR_NAME', 'WEATHER_CONDITIONS', 'WIND_SPEED', 'TEMPERATURE', 'VISIBILITY', 'ADDITIONAL_HAZARD_ITEMS', 'INSPECTOR_NOTES', 'EMERGENCY_CONTACT', 'NEAREST_HOSPITAL', 'CREW_SIZE', 'SIGNATURE_DATE'],
          favorite: true,
          isDefault: false,
          tags: ['safety', 'inspection', 'daily', 'OSHA', 'compliance'],
          createdAt: '2026-01-20',
          lastModified: '2026-02-15',
          usageCount: 156,
          fileType: 'html'
    },
    {
      id: '5',
      name: 'Job Completion Certificate',
      description: 'Professional certificate documenting successful project completion with customer satisfaction guarantee',
      category: 'other',
      content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Job Completion Certificate - {{PROJECT_NAME}}</title>
    <style>
        body {
            font-family: 'Georgia', serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 40px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            line-height: 1.6;
        }
        .certificate-container {
            background: white;
            padding: 60px 40px;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
        }
        .certificate-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8px;
            background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #e5e7eb;
            padding-bottom: 30px;
        }
        .company-logo {
            max-height: 80px;
            margin-bottom: 20px;
        }
        .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 8px;
            letter-spacing: 1px;
        }
        .company-tagline {
            font-size: 16px;
            color: #6b7280;
            font-style: italic;
        }
        .certificate-title {
            font-size: 36px;
            font-weight: bold;
            text-align: center;
            color: #1e40af;
            margin: 40px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .completion-statement {
            font-size: 18px;
            text-align: center;
            margin: 30px 0;
            color: #374151;
            font-style: italic;
        }
        .project-details {
            background: #f9fafb;
            padding: 30px;
            border-radius: 10px;
            margin: 30px 0;
            border-left: 5px solid #3b82f6;
        }
        .project-details h3 {
            color: #1e40af;
            margin-bottom: 20px;
            font-size: 20px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            padding: 8px 0;
            border-bottom: 1px dotted #d1d5db;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
            min-width: 150px;
        }
        .detail-value {
            color: #6b7280;
            flex: 1;
            text-align: right;
        }
        .quality-guarantee {
            background: #ecfdf5;
            border: 2px solid #10b981;
            border-radius: 10px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
        }
        .guarantee-title {
            color: #059669;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .guarantee-text {
            color: #065f46;
            font-size: 16px;
            line-height: 1.8;
        }
        .completion-items {
            margin: 30px 0;
        }
        .completion-items h4 {
            color: #1e40af;
            margin-bottom: 15px;
            font-size: 18px;
        }
        .completion-item {
            display: flex;
            align-items: center;
            margin: 10px 0;
            padding: 10px;
            background: #f8fafc;
            border-radius: 5px;
        }
        .checkmark {
            color: #10b981;
            font-weight: bold;
            margin-right: 10px;
            font-size: 18px;
        }
        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin: 50px 0 30px 0;
        }
        .signature-box {
            text-align: center;
        }
        .signature-line {
            border-bottom: 2px solid #374151;
            height: 40px;
            margin-bottom: 10px;
            position: relative;
        }
        .signature-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
        .contact-info {
            margin: 10px 0;
        }
        .review-request {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
            text-align: center;
        }
        .review-title {
            color: #92400e;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .review-text {
            color: #a16207;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <!-- Header -->
        <div class="header">
            <div class="company-name">{{COMPANY_NAME}}</div>
            <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
        </div>

        <!-- Certificate Title -->
        <h1 class="certificate-title">Certificate of Completion</h1>

        <!-- Completion Statement -->
        <div class="completion-statement">
            This certifies that {{CUSTOMER_NAME}} has received professional restoration services
            and that all contracted work has been completed to the highest industry standards.
        </div>

        <!-- Project Details -->
        <div class="project-details">
            <h3>Project Information</h3>
            <div class="detail-row">
                <span class="detail-label">Customer:</span>
                <span class="detail-value">{{CUSTOMER_NAME}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Project Address:</span>
                <span class="detail-value">{{PROJECT_ADDRESS}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Project Type:</span>
                <span class="detail-value">{{PROJECT_TYPE}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Completion Date:</span>
                <span class="detail-value">{{COMPLETION_DATE}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Project Manager:</span>
                <span class="detail-value">{{PROJECT_MANAGER}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Insurance Claim #:</span>
                <span class="detail-value">{{CLAIM_NUMBER}}</span>
            </div>
        </div>

        <!-- Completion Items -->
        <div class="completion-items">
            <h4>Work Completed</h4>
            <div class="completion-item">
                <span class="checkmark">✓</span>
                <span>All contracted work performed according to specifications</span>
            </div>
            <div class="completion-item">
                <span class="checkmark">✓</span>
                <span>Final inspection completed and passed</span>
            </div>
            <div class="completion-item">
                <span class="checkmark">✓</span>
                <span>Job site cleaned and debris removed</span>
            </div>
            <div class="completion-item">
                <span class="checkmark">✓</span>
                <span>All permits and inspections finalized</span>
            </div>
            <div class="completion-item">
                <span class="checkmark">✓</span>
                <span>Customer walkthrough and approval obtained</span>
            </div>
        </div>

        <!-- Quality Guarantee -->
        <div class="quality-guarantee">
            <div class="guarantee-title">Our Quality Guarantee</div>
            <div class="guarantee-text">
                TrussCTR stands behind our work with a comprehensive warranty. 
                All materials and workmanship are guaranteed according to manufacturer specifications 
                and industry standards. We're committed to your complete satisfaction.
            </div>
        </div>

        <!-- Review Request -->
        <div class="review-request">
            <div class="review-title">Help Others Find Quality Service</div>
            <div class="review-text">
                Your experience matters! We'd appreciate a review to help other homeowners 
                find quality restoration services. A team member will follow up to assist 
                with this process.
            </div>
        </div>

        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">{{PROJECT_MANAGER}}<br>Project Manager / Date</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">{{CUSTOMER_NAME}}<br>Customer Acceptance / Date</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="contact-info">
                {{COMPANY_NAME}} | {{COMPANY_PHONE}} | {{COMPANY_EMAIL}}
            </div>
            <div class="contact-info">
                {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}
            </div>
            <div class="contact-info">
                License #{{CONTRACTOR_LICENSE}} | Fully Insured
            </div>
        </div>
    </div>
</body>
</html>`,
      variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'CUSTOMER_NAME', 'PROJECT_ADDRESS', 'PROJECT_TYPE', 'COMPLETION_DATE', 'PROJECT_MANAGER', 'CLAIM_NUMBER', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'CONTRACTOR_LICENSE'],
      favorite: false,
      isDefault: false,
      tags: ['completion', 'certificate', 'professional', 'customer'],
      createdAt: '2026-03-03',
      lastModified: '2026-03-03',
      usageCount: 0,
      fileType: 'html'
    },
    {
      id: '6',
      name: 'Professional Invoice',
      description: 'Polished invoice template for billing customers and insurance companies with detailed line items',
      category: 'invoice',
      content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #{{INVOICE_NUMBER}}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 30px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
    .company-block { flex: 1; }
    .company-name { font-size: 28px; font-weight: 800; color: #1e40af; margin-bottom: 4px; letter-spacing: 0.5px; }
    .company-tagline { font-size: 13px; color: #6b7280; font-style: italic; margin-bottom: 10px; }
    .company-details { font-size: 13px; color: #4b5563; line-height: 1.6; }
    .logo-placeholder { width: 110px; height: 65px; background: #eff6ff; border: 2px dashed #93c5fd; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #3b82f6; border-radius: 8px; }
    .invoice-badge { background: linear-gradient(135deg, #1e40af, #3b82f6); color: #fff; padding: 10px 30px; border-radius: 8px; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; text-align: center; margin-bottom: 5px; }
    .invoice-number { text-align: center; font-size: 14px; color: #6b7280; margin-bottom: 25px; }
    .divider { height: 3px; background: linear-gradient(90deg, #1e40af, #3b82f6, #93c5fd, transparent); margin: 20px 0; border-radius: 2px; }
    .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px; }
    .address-card { padding: 18px; border-radius: 8px; }
    .bill-to { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .project-ref { background: #f0fdf4; border-left: 4px solid #10b981; }
    .address-card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin: 0 0 10px; }
    .address-card p { font-size: 14px; margin: 3px 0; color: #1f2937; }
    .address-card .name { font-weight: 700; font-size: 16px; color: #111827; }
    .meta-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
    .meta-item { background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e5e7eb; text-align: center; }
    .meta-item .ml { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; font-weight: 700; }
    .meta-item .mv { font-size: 15px; font-weight: 700; color: #1f2937; margin-top: 2px; }
    .line-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; margin-bottom: 20px; }
    .line-table th { background: linear-gradient(135deg, #1e3a5f, #1e40af); color: #fff; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .line-table th:nth-child(3), .line-table th:nth-child(4) { text-align: right; }
    .line-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .line-table td:nth-child(3), .line-table td:nth-child(4) { text-align: right; font-family: 'SF Mono', 'Consolas', monospace; }
    .line-table tr:nth-child(even) td { background: #f8fafc; }
    .line-table tr:last-child td { border-bottom: none; }
    .totals-area { display: flex; justify-content: flex-end; margin-bottom: 25px; }
    .totals-box { width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.subtotal { border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 8px; }
    .total-row.grand { background: linear-gradient(135deg, #1e40af, #3b82f6); color: #fff; padding: 14px 16px; border-radius: 8px; font-size: 18px; font-weight: 800; margin-top: 8px; }
    .total-row .tr-label { color: #6b7280; }
    .total-row.grand .tr-label { color: #fff; opacity: 0.9; }
    .payment-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
    .payment-card { padding: 18px; border-radius: 8px; }
    .payment-terms { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .payment-methods { background: #f0fdf4; border-left: 4px solid #10b981; }
    .payment-card h3 { font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .payment-card p { font-size: 13px; color: #4b5563; margin: 4px 0; }
    .insurance-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .insurance-note p { font-size: 13px; color: #1e40af; margin: 2px 0; }
    .insurance-note strong { color: #1e3a5f; }
    .thank-you { text-align: center; margin: 30px 0 15px; font-size: 18px; font-weight: 600; color: #374151; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-block">
      <div class="company-name">{{COMPANY_NAME}}</div>
      <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
      <div class="company-details">
        {{COMPANY_ADDRESS}}<br>
        {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
        Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}<br>
        License #{{CONTRACTOR_LICENSE}} | Tax ID: {{TAX_ID}}
      </div>
    </div>
    <div><div class="logo-placeholder">{{COMPANY_LOGO}}</div></div>
  </div>

  <div class="divider"></div>

  <div style="text-align:center;">
    <div class="invoice-badge">Invoice</div>
    <div class="invoice-number">#{{INVOICE_NUMBER}}</div>
  </div>

  <div class="meta-row">
    <div class="meta-item"><div class="ml">Invoice Date</div><div class="mv">{{INVOICE_DATE}}</div></div>
    <div class="meta-item"><div class="ml">Due Date</div><div class="mv">{{DUE_DATE}}</div></div>
    <div class="meta-item"><div class="ml">Payment Terms</div><div class="mv">{{PAYMENT_TERMS}}</div></div>
    <div class="meta-item"><div class="ml">Project #</div><div class="mv">{{PROJECT_NUMBER}}</div></div>
  </div>

  <div class="addresses">
    <div class="address-card bill-to">
      <h3>Bill To</h3>
      <p class="name">{{CUSTOMER_NAME}}</p>
      <p>{{BILLING_ADDRESS}}</p>
      <p>{{BILLING_CITY}}, {{BILLING_STATE}} {{BILLING_ZIP}}</p>
      <p>Phone: {{CUSTOMER_PHONE}}</p>
      <p>Email: {{CUSTOMER_EMAIL}}</p>
    </div>
    <div class="address-card project-ref">
      <h3>Project Reference</h3>
      <p class="name">{{PROJECT_NAME}}</p>
      <p>{{PROJECT_ADDRESS}}</p>
      <p>Insurance: {{INSURANCE_COMPANY}}</p>
      <p>Claim #: {{CLAIM_NUMBER}}</p>
      <p>Policy #: {{POLICY_NUMBER}}</p>
    </div>
  </div>

  <table class="line-table">
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {{INVOICE_LINE_ITEMS}}
    </tbody>
  </table>

  <div class="totals-area">
    <div class="totals-box">
      <div class="total-row subtotal"><span class="tr-label">Subtotal</span><span>{{SUBTOTAL}}</span></div>
      <div class="total-row"><span class="tr-label">Tax ({{TAX_RATE}}%)</span><span>{{TAX_AMOUNT}}</span></div>
      <div class="total-row"><span class="tr-label">Insurance Payment Received</span><span>-{{INSURANCE_PAYMENT}}</span></div>
      <div class="total-row"><span class="tr-label">Previous Payments</span><span>-{{PREVIOUS_PAYMENTS}}</span></div>
      <div class="total-row grand"><span class="tr-label">Amount Due</span><span>{{AMOUNT_DUE}}</span></div>
    </div>
  </div>

  <div class="insurance-note">
    <p><strong>Insurance Claim Reference</strong></p>
    <p>Carrier: {{INSURANCE_COMPANY}} | Claim #{{CLAIM_NUMBER}} | Adjuster: {{ADJUSTER_NAME}}</p>
  </div>

  <div class="payment-info">
    <div class="payment-card payment-terms">
      <h3>Payment Terms</h3>
      <p>Payment is due within {{PAYMENT_DAYS}} days of invoice date.</p>
      <p>Late payments subject to 1.5% monthly finance charge.</p>
      <p>Questions? Contact us at {{COMPANY_PHONE}}.</p>
    </div>
    <div class="payment-card payment-methods">
      <h3>Payment Methods</h3>
      <p>&#10003; Check (payable to {{COMPANY_NAME}})</p>
      <p>&#10003; Credit / Debit Card</p>
      <p>&#10003; Bank Transfer / ACH</p>
      <p>&#10003; Online Payment Portal</p>
    </div>
  </div>

  <div class="thank-you">Thank you for your business!</div>

  <div class="footer">
    {{COMPANY_NAME}} &bull; {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}} &bull; {{COMPANY_PHONE}} &bull; {{COMPANY_EMAIL}}<br>
    License #{{CONTRACTOR_LICENSE}} | Fully Licensed &amp; Insured
  </div>
</body>
</html>`,
      variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'CONTRACTOR_LICENSE', 'TAX_ID', 'COMPANY_LOGO', 'INVOICE_NUMBER', 'INVOICE_DATE', 'DUE_DATE', 'PAYMENT_TERMS', 'PROJECT_NUMBER', 'CUSTOMER_NAME', 'BILLING_ADDRESS', 'BILLING_CITY', 'BILLING_STATE', 'BILLING_ZIP', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL', 'PROJECT_NAME', 'PROJECT_ADDRESS', 'INSURANCE_COMPANY', 'CLAIM_NUMBER', 'POLICY_NUMBER', 'INVOICE_LINE_ITEMS', 'SUBTOTAL', 'TAX_RATE', 'TAX_AMOUNT', 'INSURANCE_PAYMENT', 'PREVIOUS_PAYMENTS', 'AMOUNT_DUE', 'ADJUSTER_NAME', 'PAYMENT_DAYS'],
      favorite: true,
      isDefault: true,
      tags: ['invoice', 'billing', 'insurance', 'professional', 'payment'],
      createdAt: '2026-03-03',
      lastModified: '2026-03-03',
      usageCount: 0,
      fileType: 'html'
    },
    {
      id: '7',
      name: 'Property Inspection Report',
      description: 'Detailed inspection report for insurance adjusters and customers with damage assessment and photo documentation sections',
      category: 'other',
      content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Inspection Report - {{PROPERTY_ADDRESS}}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 30px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #7c3aed; padding-bottom: 18px; margin-bottom: 20px; }
    .company-info { flex: 1; }
    .company-name { font-size: 26px; font-weight: 800; color: #7c3aed; margin-bottom: 4px; }
    .company-tagline { font-size: 12px; color: #6b7280; font-style: italic; margin-bottom: 6px; }
    .company-contact { font-size: 12px; color: #4b5563; line-height: 1.5; }
    .logo-placeholder { width: 100px; height: 60px; background: #f5f3ff; border: 2px dashed #a78bfa; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #7c3aed; border-radius: 6px; }
    .title-bar { background: linear-gradient(135deg, #5b21b6, #7c3aed); color: #fff; padding: 16px 24px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
    .title-bar h1 { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
    .title-bar p { font-size: 12px; opacity: 0.9; margin: 4px 0 0; }
    .report-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .report-meta-item { background: #f5f3ff; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #e9d5ff; }
    .report-meta-item .rml { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #7c3aed; font-weight: 700; }
    .report-meta-item .rmv { font-size: 14px; font-weight: 700; color: #1f2937; margin-top: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }
    .info-card { padding: 16px; border-radius: 8px; border-left: 4px solid; }
    .card-property { background: #f5f3ff; border-color: #7c3aed; }
    .card-insurance { background: #eff6ff; border-color: #3b82f6; }
    .info-card h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,0.08); }
    .card-property h3 { color: #5b21b6; }
    .card-insurance h3 { color: #1e40af; }
    .info-card .row { display: flex; font-size: 13px; margin-bottom: 5px; }
    .info-card .row .lbl { min-width: 110px; color: #6b7280; font-weight: 600; }
    .info-card .row .val { color: #1f2937; }
    .damage-section { margin: 20px 0; }
    .damage-section h2 { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #7c3aed; }
    .damage-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; margin-bottom: 20px; }
    .damage-table th { background: linear-gradient(135deg, #3b0764, #5b21b6); color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .damage-table td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .damage-table tr:last-child td { border-bottom: none; }
    .damage-table tr:nth-child(even) td { background: #fafafa; }
    .severity-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .sev-critical { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
    .sev-major { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
    .sev-moderate { background: #fefce8; color: #854d0e; border: 1px solid #fde68a; }
    .sev-minor { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 15px 0; }
    .photo-placeholder { background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; font-size: 11px; }
    .photo-placeholder .cam { font-size: 24px; margin-bottom: 4px; }
    .summary-section { background: #f5f3ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .summary-section h2 { color: #5b21b6; font-size: 16px; margin: 0 0 12px; }
    .summary-content { font-size: 14px; line-height: 1.8; color: #374151; }
    .recommendations { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .recommendations h2 { color: #1e40af; font-size: 16px; margin: 0 0 12px; }
    .rec-item { display: flex; align-items: flex-start; gap: 10px; margin: 10px 0; padding: 10px; background: #fff; border-radius: 6px; border-left: 3px solid #3b82f6; font-size: 13px; }
    .rec-num { background: #3b82f6; color: #fff; min-width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .cost-estimate { background: linear-gradient(135deg, #5b21b6, #7c3aed); color: #fff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .cost-estimate .ce-label { font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
    .cost-estimate .ce-amount { font-size: 32px; font-weight: 800; margin: 5px 0; }
    .cost-estimate .ce-note { font-size: 12px; opacity: 0.85; }
    .disclaimer { background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 20px 0; font-size: 12px; color: #92400e; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 35px; margin: 30px 0; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 2px solid #374151; height: 40px; margin-bottom: 6px; }
    .sig-label { font-size: 11px; color: #6b7280; font-weight: 600; }
    .footer { text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 25px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div class="company-name">{{COMPANY_NAME}}</div>
      <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
      <div class="company-contact">
        {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
        Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}} | License #{{CONTRACTOR_LICENSE}}
      </div>
    </div>
    <div><div class="logo-placeholder">{{COMPANY_LOGO}}</div></div>
  </div>

  <div class="title-bar">
    <h1>&#128270; Property Inspection Report</h1>
    <p>Comprehensive Damage Assessment &amp; Restoration Recommendation</p>
  </div>

  <div class="report-meta">
    <div class="report-meta-item"><div class="rml">Report #</div><div class="rmv">{{REPORT_NUMBER}}</div></div>
    <div class="report-meta-item"><div class="rml">Inspection Date</div><div class="rmv">{{INSPECTION_DATE}}</div></div>
    <div class="report-meta-item"><div class="rml">Inspector</div><div class="rmv">{{INSPECTOR_NAME}}</div></div>
    <div class="report-meta-item"><div class="rml">Storm Date</div><div class="rmv">{{STORM_DATE}}</div></div>
  </div>

  <div class="info-grid">
    <div class="info-card card-property">
      <h3>Property Information</h3>
      <div class="row"><span class="lbl">Owner:</span><span class="val">{{CUSTOMER_NAME}}</span></div>
      <div class="row"><span class="lbl">Address:</span><span class="val">{{PROPERTY_ADDRESS}}</span></div>
      <div class="row"><span class="lbl">City/State:</span><span class="val">{{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</span></div>
      <div class="row"><span class="lbl">Phone:</span><span class="val">{{CUSTOMER_PHONE}}</span></div>
      <div class="row"><span class="lbl">Property Type:</span><span class="val">{{PROPERTY_TYPE}}</span></div>
      <div class="row"><span class="lbl">Year Built:</span><span class="val">{{YEAR_BUILT}}</span></div>
      <div class="row"><span class="lbl">Roof Type:</span><span class="val">{{ROOF_TYPE}}</span></div>
      <div class="row"><span class="lbl">Roof Age:</span><span class="val">{{ROOF_AGE}}</span></div>
    </div>
    <div class="info-card card-insurance">
      <h3>Insurance Information</h3>
      <div class="row"><span class="lbl">Carrier:</span><span class="val">{{INSURANCE_COMPANY}}</span></div>
      <div class="row"><span class="lbl">Policy #:</span><span class="val">{{POLICY_NUMBER}}</span></div>
      <div class="row"><span class="lbl">Claim #:</span><span class="val">{{CLAIM_NUMBER}}</span></div>
      <div class="row"><span class="lbl">Adjuster:</span><span class="val">{{ADJUSTER_NAME}}</span></div>
      <div class="row"><span class="lbl">Adj. Phone:</span><span class="val">{{ADJUSTER_PHONE}}</span></div>
      <div class="row"><span class="lbl">Deductible:</span><span class="val">{{DEDUCTIBLE_AMOUNT}}</span></div>
      <div class="row"><span class="lbl">Date of Loss:</span><span class="val">{{STORM_DATE}}</span></div>
    </div>
  </div>

  <div class="damage-section">
    <h2>Damage Assessment</h2>
    <table class="damage-table">
      <thead>
        <tr><th>Area / Component</th><th>Damage Type</th><th>Severity</th><th>Notes</th></tr>
      </thead>
      <tbody>
        {{DAMAGE_ASSESSMENT_ROWS}}
      </tbody>
    </table>
  </div>

  <div class="damage-section">
    <h2>Photo Documentation</h2>
    <div class="photo-grid">
      <div class="photo-placeholder"><span class="cam">&#128247;</span>Front Elevation</div>
      <div class="photo-placeholder"><span class="cam">&#128247;</span>Roof Overview</div>
      <div class="photo-placeholder"><span class="cam">&#128247;</span>Damage Close-up 1</div>
      <div class="photo-placeholder"><span class="cam">&#128247;</span>Damage Close-up 2</div>
      <div class="photo-placeholder"><span class="cam">&#128247;</span>Interior (if applicable)</div>
      <div class="photo-placeholder"><span class="cam">&#128247;</span>Additional Evidence</div>
    </div>
    <p style="font-size:12px;color:#6b7280;text-align:center;">Full photo documentation attached separately. Reference photos labeled per damage area above.</p>
  </div>

  <div class="summary-section">
    <h2>Inspection Summary</h2>
    <div class="summary-content">{{INSPECTION_SUMMARY}}</div>
  </div>

  <div class="recommendations">
    <h2>Recommended Repairs</h2>
    {{REPAIR_RECOMMENDATIONS}}
  </div>

  <div class="cost-estimate">
    <div class="ce-label">Estimated Repair Cost</div>
    <div class="ce-amount">{{ESTIMATED_REPAIR_COST}}</div>
    <div class="ce-note">Subject to final adjuster approval &bull; Detailed estimate available upon request</div>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This inspection report is based on a visual assessment performed on the date indicated. Hidden or concealed damage may exist that was not visible during the inspection. Final scope and cost may change based on findings during repair work. This report is intended for the property owner and their insurance carrier.
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Inspector Signature / Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Property Owner Acknowledgment / Date</div>
    </div>
  </div>

  <div class="footer">
    {{COMPANY_NAME}} &bull; {{COMPANY_PHONE}} &bull; {{COMPANY_EMAIL}} &bull; License #{{CONTRACTOR_LICENSE}}<br>
    Confidential &mdash; This report is the property of {{COMPANY_NAME}} and the named property owner.
  </div>
</body>
</html>`,
      variables: ['COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'CONTRACTOR_LICENSE', 'COMPANY_LOGO', 'REPORT_NUMBER', 'INSPECTION_DATE', 'INSPECTOR_NAME', 'STORM_DATE', 'CUSTOMER_NAME', 'PROPERTY_ADDRESS', 'PROPERTY_CITY', 'PROPERTY_STATE', 'PROPERTY_ZIP', 'CUSTOMER_PHONE', 'PROPERTY_TYPE', 'YEAR_BUILT', 'ROOF_TYPE', 'ROOF_AGE', 'INSURANCE_COMPANY', 'POLICY_NUMBER', 'CLAIM_NUMBER', 'ADJUSTER_NAME', 'ADJUSTER_PHONE', 'DEDUCTIBLE_AMOUNT', 'DAMAGE_ASSESSMENT_ROWS', 'INSPECTION_SUMMARY', 'REPAIR_RECOMMENDATIONS', 'ESTIMATED_REPAIR_COST'],
      favorite: false,
      isDefault: false,
      tags: ['inspection', 'damage-assessment', 'insurance', 'adjuster', 'professional'],
      createdAt: '2026-03-03',
      lastModified: '2026-03-03',
      usageCount: 0,
      fileType: 'html'
    }
      ];
      setTemplates(mockTemplates);
      setFilteredTemplates(mockTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error",
        description: "Could not load document templates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...templates];

    // Apply filters
    if (filters.category !== 'all') {
      filtered = filtered.filter(template => template.category === filters.category);
    }
    if (filters.favorite) {
      filtered = filtered.filter(template => template.favorite);
    }
    if (filters.tag !== 'all') {
      filtered = filtered.filter(template => template.tags.includes(filters.tag));
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredTemplates(filtered);
  }, [templates, filters, searchQuery]);

  // Toggle favorite
  const toggleFavorite = (templateId: string) => {
    setTemplates(prev => prev.map(template => 
      template.id === templateId 
        ? { ...template, favorite: !template.favorite }
        : template
    ));
    
    toast({
      title: "Updated",
      description: "Template favorite status updated",
      variant: "default"
    });
  };

  // Duplicate template
  const duplicateTemplate = (template: DocumentTemplate) => {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      usageCount: 0
    };
    
    setTemplates(prev => [newTemplate, ...prev]);
    
    toast({
      title: "Template Duplicated",
      description: `Created copy of "${template.name}"`,
      variant: "default"
    });
  };

  // Preview template with sample data
  const getPreviewContent = (template: DocumentTemplate) => {
    let content = template.content;
    
    // Replace variables with sample data
    const sampleData: Record<string, string> = {
      // Company info
      'COMPANY_NAME': '614 Restore',
      'COMPANY_TAGLINE': 'Professional Storm Damage Restoration',
      'COMPANY_ADDRESS': '1234 Commerce Blvd',
      'COMPANY_CITY': 'Columbus',
      'COMPANY_STATE': 'OH',
      'COMPANY_ZIP': '43215',
      'COMPANY_PHONE': '(614) 555-0199',
      'COMPANY_EMAIL': 'info@614restore.com',
      'CONTRACTOR_LICENSE': 'OH-RC-2024-8812',
      'COMPANY_LOGO': 'LOGO',
      'TAX_ID': '31-1234567',
      'REP_NAME': 'David Mitchell',
      // Customer info
      'CUSTOMER_NAME': 'John & Mary Johnson',
      'CUSTOMER_PHONE': '(614) 555-0142',
      'CUSTOMER_EMAIL': 'johnson.family@email.com',
      'CLIENT_NAME': 'John & Mary Johnson',
      // Property info
      'PROPERTY_ADDRESS': '456 Maple Drive',
      'PROPERTY_CITY': 'Springfield',
      'PROPERTY_STATE': 'OH',
      'PROPERTY_ZIP': '45503',
      'PROPERTY_TYPE': 'Single Family Residential',
      'YEAR_BUILT': '2005',
      'ROOF_TYPE': '3-Tab Asphalt Shingle',
      'ROOF_AGE': '18 years',
      'PROJECT_ADDRESS': '456 Maple Drive, Springfield, OH 45503',
      'BILLING_ADDRESS': '456 Maple Drive',
      'BILLING_CITY': 'Springfield',
      'BILLING_STATE': 'OH',
      'BILLING_ZIP': '45503',
      'JOB_SITE_ADDRESS': '456 Maple Drive',
      'JOB_SITE_CITY': 'Springfield',
      'JOB_SITE_STATE': 'OH',
      'JOB_SITE_ZIP': '45503',
      'JOB_SITE': '456 Maple Drive, Springfield',
      'ACCESS_INSTRUCTIONS': 'Gate code: 4521. Park on street.',
      'EMERGENCY_CONTACT': 'Mary Johnson — (614) 555-0143',
      // Insurance info
      'INSURANCE_COMPANY': 'State Farm Insurance',
      'POLICY_NUMBER': 'SF-OH-2024-98712',
      'CLAIM_NUMBER': 'CLM-2026-04418',
      'ADJUSTER_NAME': 'Robert Chen',
      'ADJUSTER_PHONE': '(614) 555-0188',
      'DEDUCTIBLE_AMOUNT': '$1,500.00',
      // Project info
      'PROJECT_NAME': 'Johnson Residence Roof Replacement',
      'PROJECT_TYPE': 'Full Roof Replacement — Storm Damage',
      'PROJECT_NUMBER': 'PRJ-2026-042',
      'STORM_DATE': 'March 15, 2026',
      'DAMAGE_TYPE': 'Hail & Wind Damage',
      'ESTIMATED_DURATION': '3-5 Business Days',
      // Dates
      'ESTIMATE_DATE': new Date().toLocaleDateString(),
      'ESTIMATE_NUMBER': 'EST-2026-0089',
      'REQUESTED_START': new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString(),
      'START_DATE': new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString(),
      'START_TIME': '7:00 AM',
      'COMPLETION_DATE': new Date(Date.now() + 14*24*60*60*1000).toLocaleDateString(),
      'BACKUP_DATE': new Date(Date.now() + 9*24*60*60*1000).toLocaleDateString(),
      'INSPECTION_DATE': new Date().toLocaleDateString(),
      'SIGNATURE_DATE': new Date().toLocaleDateString(),
      'INVOICE_DATE': new Date().toLocaleDateString(),
      'DUE_DATE': new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString(),
      // Cost info
      'SCOPE_OF_WORK': 'Complete tear-off and replacement of existing 3-tab asphalt shingle roof system. Includes removal of existing shingles and underlayment, inspection and repair of roof decking as needed, installation of new synthetic underlayment, new architectural shingles (GAF Timberline HDZ — Charcoal), new drip edge and flashing, new ridge vent system, and full cleanup with magnetic nail sweep.',
      'COST_BREAKDOWN_ITEMS': '<tr><td>Tear-off existing roof system (24 squares)</td><td>24 SQ</td><td>$85.00</td><td>$2,040.00</td></tr><tr><td>GAF Timberline HDZ Architectural Shingles</td><td>28 SQ</td><td>$195.00</td><td>$5,460.00</td></tr><tr><td>Synthetic underlayment (GAF FeltBuster)</td><td>28 SQ</td><td>$32.00</td><td>$896.00</td></tr><tr><td>Drip edge &amp; flashing (aluminum)</td><td>310 LF</td><td>$4.50</td><td>$1,395.00</td></tr><tr><td>Ridge vent system</td><td>45 LF</td><td>$12.00</td><td>$540.00</td></tr><tr><td>Decking repair (OSB replacement)</td><td>3 sheets</td><td>$65.00</td><td>$195.00</td></tr><tr><td>Dumpster &amp; debris removal</td><td>1</td><td>$450.00</td><td>$450.00</td></tr>',
      'SUBTOTAL': '$10,976.00',
      'TAX_RATE': '7.5',
      'TAX_AMOUNT': '$823.20',
      'TOTAL_AMOUNT': '$12,299.20',
      'WARRANTY_PERIOD': '10 years',
      'PRIORITY_LEVEL': 'High — Storm Season',
      // Work order
      'WORK_ORDER_NUMBER': 'WO-2026-042',
      'SUPERVISOR_NAME': 'James Rodriguez',
      'SUPERVISOR_PHONE': '(614) 555-0177',
      'SUPERVISOR_EMAIL': 'james@614restore.com',
      'WORK_DESCRIPTION': 'Complete tear-off and replacement of existing roof system per approved estimate EST-2026-0089. Begin with south-facing slope, then proceed clockwise. Replace damaged decking on east slope as identified in inspection. Install GAF Timberline HDZ architectural shingles in Charcoal. All work per manufacturer specifications and local building code requirements.',
      'MATERIALS_LIST': '<li>28 squares GAF Timberline HDZ shingles (Charcoal)</li><li>28 rolls GAF FeltBuster synthetic underlayment</li><li>310 LF aluminum drip edge</li><li>45 LF ridge vent</li><li>3 sheets 7/16" OSB for decking repair</li><li>Roofing nails, sealant, flashing cement</li><li>Ice &amp; water shield (valleys and penetrations)</li>',
      'CREW_ASSIGNMENTS': '<tr><td>Carlos Mendez</td><td>Crew Leader</td><td>(614) 555-0155</td><td>OSHA 30, Fall Protection</td></tr><tr><td>Miguel Santos</td><td>Installer</td><td>(614) 555-0156</td><td>OSHA 10</td></tr><tr><td>Tony Williams</td><td>Installer</td><td>(614) 555-0157</td><td>OSHA 10</td></tr><tr><td>Ryan Cooper</td><td>Laborer / Cleanup</td><td>(614) 555-0158</td><td>OSHA 10</td></tr>',
      'ADDITIONAL_SAFETY_REQUIREMENTS': '',
      // Change order
      'CHANGE_ORDER_NUMBER': 'CO-2026-003',
      'CONTRACT_NUMBER': 'CTR-2026-042',
      'CHANGE_DATE': new Date().toLocaleDateString(),
      'REQUESTED_BY': 'Insurance Adjuster — Robert Chen',
      'REASON_FOR_CHANGE': 'During tear-off, additional damage discovered on the east-facing slope. Three areas of soft/rotted decking identified that were not visible during initial inspection. Insurance adjuster approved supplemental claim for additional decking replacement and related work.',
      'ORIGINAL_SCOPE': 'Replace 3 sheets of OSB decking as identified in initial inspection. Original estimate included only the areas visible from exterior assessment.',
      'ADDITIONAL_WORK': 'Replace an additional 8 sheets of 7/16" OSB decking on the east slope. Reinforce two rafters showing moisture damage. Apply additional ice & water shield membrane to affected areas before re-shingling.',
      'ADDITIONAL_MATERIALS_COST': '$780.00',
      'ADDITIONAL_LABOR_COST': '$1,200.00',
      'PERMIT_FEES': '$0.00',
      'ADDITIONAL_COST_ITEMS': '',
      'TOTAL_ADDITIONAL_COST': '$1,980.00',
      'REVISED_CONTRACT_TOTAL': '$14,279.20',
      'ORIGINAL_COMPLETION': new Date(Date.now() + 14*24*60*60*1000).toLocaleDateString(),
      'NEW_COMPLETION': new Date(Date.now() + 16*24*60*60*1000).toLocaleDateString(),
      'ADDITIONAL_DAYS': '2',
      // Safety checklist
      'INSPECTOR_NAME': 'Mike Wilson',
      'WEATHER_CONDITIONS': 'Partly Cloudy',
      'WIND_SPEED': '8 mph SW',
      'TEMPERATURE': '72°F',
      'VISIBILITY': 'Good (10+ mi)',
      'ADDITIONAL_HAZARD_ITEMS': '',
      'INSPECTOR_NOTES': 'All safety checks passed. New crew member (Ryan Cooper) briefed on fall protection procedures. Ladder positioned on east side secured with stabilizer bar.',
      'NEAREST_HOSPITAL': 'Springfield Regional Medical — 2.3 mi',
      'CREW_SIZE': '4',
      // Completion certificate
      'PROJECT_MANAGER': 'David Mitchell',
      // Invoice
      'INVOICE_NUMBER': 'INV-2026-0089',
      'PAYMENT_TERMS': 'Net 30',
      'PAYMENT_DAYS': '30',
      'INVOICE_LINE_ITEMS': '<tr><td>Complete roof replacement — GAF Timberline HDZ (Charcoal)</td><td>1</td><td>$10,976.00</td><td>$10,976.00</td></tr><tr><td>Supplemental decking repair (Change Order CO-2026-003)</td><td>1</td><td>$1,980.00</td><td>$1,980.00</td></tr><tr><td>Permit fees</td><td>1</td><td>$150.00</td><td>$150.00</td></tr>',
      'INSURANCE_PAYMENT': '$10,806.20',
      'PREVIOUS_PAYMENTS': '$0.00',
      'AMOUNT_DUE': '$2,299.00',
      // Inspection report
      'REPORT_NUMBER': 'RPT-2026-0089',
      'DAMAGE_ASSESSMENT_ROWS': '<tr><td>Roof — South Slope</td><td>Hail Impact</td><td><span class="severity-badge sev-major">Major</span></td><td>Multiple hail strikes, granule loss across 60% of surface</td></tr><tr><td>Roof — East Slope</td><td>Hail &amp; Wind</td><td><span class="severity-badge sev-critical">Critical</span></td><td>Lifted shingles, exposed underlayment, soft decking</td></tr><tr><td>Roof — North Slope</td><td>Hail Impact</td><td><span class="severity-badge sev-moderate">Moderate</span></td><td>Scattered granule loss, functional damage</td></tr><tr><td>Gutters</td><td>Dent/Deform</td><td><span class="severity-badge sev-minor">Minor</span></td><td>3 dented sections, still functional</td></tr><tr><td>Ridge Cap</td><td>Wind Lift</td><td><span class="severity-badge sev-major">Major</span></td><td>Multiple ridge cap shingles lifted and cracked</td></tr>',
      'INSPECTION_SUMMARY': 'Property sustained significant hail and wind damage from the March 15, 2026 storm event. The roof system shows widespread hail impact damage across all slopes, with the most severe damage on the south and east-facing slopes. Multiple shingles exhibit granule loss, cracking, and wind-lifted edges. The east slope has areas of compromised decking requiring replacement. Gutters show cosmetic damage. Overall assessment supports a full roof replacement claim.',
      'REPAIR_RECOMMENDATIONS': '<div class="rec-item"><div class="rec-num">1</div><div>Full roof replacement — Remove and replace all existing shingles with GAF Timberline HDZ architectural shingles</div></div><div class="rec-item"><div class="rec-num">2</div><div>Replace damaged roof decking — Minimum 11 sheets of 7/16" OSB on east and south slopes</div></div><div class="rec-item"><div class="rec-num">3</div><div>New synthetic underlayment, drip edge, and flashing throughout</div></div><div class="rec-item"><div class="rec-num">4</div><div>Install ridge vent system for proper attic ventilation</div></div><div class="rec-item"><div class="rec-num">5</div><div>Gutter repair/replacement — 3 sections on south side</div></div>',
      'ESTIMATED_REPAIR_COST': '$12,299.20'
    };
    
    template.variables.forEach(variable => {
      const replacement = sampleData[variable] || `[${variable}]`;
      content = content.replace(new RegExp(`{{${variable}}}`, 'g'), replacement);
    });
    
    return content;
  };

  // Get all unique tags
  const allTags = Array.from(new Set(templates.flatMap(t => t.tags))).sort();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Document Templates</h1>
        </div>
        <Button onClick={() => setShowCreateTemplate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Category Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {templateCategories.map(category => {
          const count = templates.filter(t => t.category === category.id).length;
          return (
            <Card 
              key={category.id} 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                filters.category === category.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setFilters({
                ...filters,
                category: filters.category === category.id ? 'all' : category.id
              })}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {category.icon}
                    <div>
                      <p className="font-medium">{category.label}</p>
                      <p className="text-sm text-gray-600">{count} templates</p>
                    </div>
                  </div>
                  <Badge className={category.color}>
                    {count}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {templateCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.tag} onValueChange={(value) => setFilters({...filters, tag: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch 
                checked={filters.favorite}
                onCheckedChange={(checked) => setFilters({...filters, favorite: checked})}
              />
              <Label>Favorites only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({length: 6}).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))
        ) : filteredTemplates.length === 0 ? (
          <div className="md:col-span-3 text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No templates found</p>
            <Button 
              onClick={() => setShowCreateTemplate(true)} 
              className="mt-4"
            >
              Create Your First Template
            </Button>
          </div>
        ) : (
          filteredTemplates.map(template => {
            const category = templateCategories.find(c => c.id === template.category);
            return (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          {template.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(template.id)}
                      >
                        {template.favorite ? (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge className={category?.color}>
                        <div className="flex items-center gap-1">
                          {category?.icon}
                          {category?.label}
                        </div>
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Used {template.usageCount} times
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Modified {new Date(template.lastModified).toLocaleDateString()}</span>
                      <span className="capitalize">{template.fileType}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setPreviewMode(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => duplicateTemplate(template)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && previewMode && (
        <Dialog open={previewMode} onOpenChange={() => {
          setPreviewMode(false);
          setSelectedTemplate(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.name} - Preview</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <Label>Variables in this template:</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedTemplate.variables.map(variable => (
                    <Badge key={variable} variant="secondary" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="border rounded p-4 bg-white">
                {selectedTemplate.content.trim().startsWith('<!DOCTYPE') || selectedTemplate.content.trim().startsWith('<html') ? (
                  <iframe
                    srcDoc={getPreviewContent(selectedTemplate)}
                    className="w-full border-0 rounded"
                    style={{ minHeight: '600px', height: '70vh' }}
                    title={`Preview: ${selectedTemplate.name}`}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {getPreviewContent(selectedTemplate)}
                  </pre>
                )}
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => duplicateTemplate(selectedTemplate)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </Button>
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Generate Document
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DocumentTemplates;