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
          description: 'Template for change order requests and approvals',
          category: 'change-order',
          content: `# CHANGE ORDER #{{CHANGE_ORDER_NUMBER}}

**Original Contract:** {{CONTRACT_NUMBER}}
**Project:** {{PROJECT_NAME}}
**Client:** {{CLIENT_NAME}}
**Date:** {{CHANGE_DATE}}

## Reason for Change
{{REASON_FOR_CHANGE}}

## Original Scope
{{ORIGINAL_SCOPE}}

## Additional Work Required
{{ADDITIONAL_WORK}}

## Cost Impact
- Additional Materials: {{ADDITIONAL_MATERIALS_COST}}
- Additional Labor: {{ADDITIONAL_LABOR_COST}}
- **Total Additional Cost:** {{TOTAL_ADDITIONAL_COST}}

## Schedule Impact
Original Completion Date: {{ORIGINAL_COMPLETION}}
New Completion Date: {{NEW_COMPLETION}}

**Client Approval Required**

Client Signature: _________________ Date: _______
Contractor Signature: _____________ Date: _______`,
          variables: ['CHANGE_ORDER_NUMBER', 'CONTRACT_NUMBER', 'PROJECT_NAME', 'CLIENT_NAME', 'CHANGE_DATE', 'REASON_FOR_CHANGE', 'ORIGINAL_SCOPE', 'ADDITIONAL_WORK', 'ADDITIONAL_MATERIALS_COST', 'ADDITIONAL_LABOR_COST', 'TOTAL_ADDITIONAL_COST', 'ORIGINAL_COMPLETION', 'NEW_COMPLETION'],
          favorite: false,
          isDefault: false,
          tags: ['change-order', 'approval', 'contract'],
          createdAt: '2026-02-10',
          lastModified: '2026-02-25',
          usageCount: 8,
          fileType: 'pdf'
        },
        {
          id: '4',
          name: 'Daily Safety Checklist',
          description: 'Daily safety inspection form for job sites',
          category: 'safety',
          content: `# Daily Safety Checklist
          
**Date:** {{INSPECTION_DATE}}
**Job Site:** {{JOB_SITE}}
**Inspector:** {{INSPECTOR_NAME}}

## Personal Protective Equipment
- [ ] Hard hats available and worn
- [ ] Safety glasses available and worn  
- [ ] Steel-toed boots worn
- [ ] High-visibility vests worn
- [ ] Fall protection equipment inspected

## Equipment Safety
- [ ] Power tools inspected
- [ ] Ladders inspected and properly positioned
- [ ] Scaffolding secure and inspected
- [ ] Electrical cords and connections safe

## Site Conditions
- [ ] Work area clean and organized
- [ ] Emergency exits clear
- [ ] First aid kit accessible
- [ ] Fire extinguisher accessible

## Weather Conditions
Current Weather: {{WEATHER_CONDITIONS}}
Wind Speed: {{WIND_SPEED}}
Temperature: {{TEMPERATURE}}

**Inspector Signature:** _________________ 
**Date:** {{SIGNATURE_DATE}}`,
          variables: ['INSPECTION_DATE', 'JOB_SITE', 'INSPECTOR_NAME', 'WEATHER_CONDITIONS', 'WIND_SPEED', 'TEMPERATURE', 'SIGNATURE_DATE'],
          favorite: true,
          isDefault: false,
          tags: ['safety', 'inspection', 'daily'],
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
      'PROJECT_NAME': 'Johnson Residence Roof Repair',
      'CLIENT_NAME': 'John & Mary Johnson',
      'PROJECT_ADDRESS': '123 Oak Street, Springfield, IL',
      'ESTIMATE_DATE': new Date().toLocaleDateString(),
      'TOTAL_AMOUNT': '$12,500.00',
      'WORK_ORDER_NUMBER': 'WO-2026-001',
      'START_DATE': new Date().toLocaleDateString(),
      'COMPLETION_DATE': new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString(),
      'INSPECTOR_NAME': 'Mike Wilson',
      'JOB_SITE': '123 Oak Street',
      'WEATHER_CONDITIONS': 'Clear, Sunny'
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
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {getPreviewContent(selectedTemplate)}
                </pre>
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