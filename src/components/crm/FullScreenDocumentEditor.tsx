// FullScreenDocumentEditor.tsx
// Full-screen document template editor — replaces the old modal/side-panel Edit flow.
// All green brand colors, seamless state carry-over, live preview.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Edit3,
  Download,
  Printer,
  Send,
  Save,
  Search,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DbCompany } from '@/lib/database';
import { getContactFullName } from '@/lib/crmData';
import { DOCUMENT_CATEGORIES } from '@/lib/documentCategories';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  category: string;
  content: string;
  variables: string[];
  fields?: DocumentField[];
  favorite: boolean;
  isDefault: boolean;
  tags: string[];
  createdAt: string;
  lastModified: string;
  usageCount: number;
  fileType: 'pdf' | 'docx' | 'html';
}

export interface FullScreenDocumentEditorProps {
  template: DocumentTemplate;
  onBack: () => void;
  companyProfile: DbCompany | null;
  contacts: any[];
  initialContactId?: string;
  initialContent?: string;
}

// ─── Variable grouping ───────────────────────────────────────────────────────

const COMPANY_VARS = [
  'COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_ADDRESS', 'COMPANY_CITY',
  'COMPANY_STATE', 'COMPANY_ZIP', 'COMPANY_PHONE', 'COMPANY_EMAIL',
  'COMPANY_LOGO', 'COMPANY_WEBSITE', 'CONTRACTOR_LICENSE', 'REP_NAME',
  'SUPERVISOR_NAME', 'SUPERVISOR_PHONE', 'SUPERVISOR_EMAIL',
];

const CUSTOMER_VARS = [
  'CUSTOMER_NAME', 'CLIENT_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL',
  'PROPERTY_ADDRESS', 'PROPERTY_CITY', 'PROPERTY_STATE', 'PROPERTY_ZIP',
  'JOB_SITE_ADDRESS', 'JOB_SITE_CITY', 'JOB_SITE_STATE', 'JOB_SITE_ZIP',
  'EMERGENCY_CONTACT', 'ACCESS_INSTRUCTIONS',
];

const INSURANCE_VARS = [
  'INSURANCE_COMPANY', 'POLICY_NUMBER', 'CLAIM_NUMBER',
  'ADJUSTER_NAME', 'ADJUSTER_PHONE', 'DEDUCTIBLE_AMOUNT',
];

const DATE_VARS = [
  'ESTIMATE_DATE', 'START_DATE', 'COMPLETION_DATE', 'STORM_DATE',
  'REQUESTED_START', 'BACKUP_DATE', 'CHANGE_DATE', 'INSPECTION_DATE',
  'ORIGINAL_COMPLETION', 'NEW_COMPLETION',
];

const FINANCIAL_VARS = [
  'TOTAL_AMOUNT', 'SUBTOTAL', 'TAX_RATE', 'TAX_AMOUNT',
  'TOTAL_ADDITIONAL_COST', 'REVISED_CONTRACT_TOTAL',
  'ADDITIONAL_MATERIALS_COST', 'ADDITIONAL_LABOR_COST', 'PERMIT_FEES',
  'WARRANTY_PERIOD',
];

function groupVar(varName: string): string {
  if (COMPANY_VARS.includes(varName)) return 'Company Info';
  if (CUSTOMER_VARS.includes(varName)) return 'Customer Info';
  if (INSURANCE_VARS.includes(varName)) return 'Insurance';
  if (DATE_VARS.includes(varName)) return 'Dates';
  if (FINANCIAL_VARS.includes(varName)) return 'Financial';
  return 'Project Details';
}

const GROUP_ORDER = ['Company Info', 'Customer Info', 'Insurance', 'Dates', 'Financial', 'Project Details'];

const GROUP_COLORS: Record<string, string> = {
  'Company Info': 'text-green-700',
  'Customer Info': 'text-green-700',
  'Insurance': 'text-green-700',
  'Dates': 'text-green-700',
  'Financial': 'text-green-700',
  'Project Details': 'text-green-700',
};

function varToLabel(v: string): string {
  return v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isTextareaVar(v: string): boolean {
  return ['SCOPE_OF_WORK', 'WORK_DESCRIPTION', 'REASON_FOR_CHANGE',
    'ORIGINAL_SCOPE', 'ADDITIONAL_WORK', 'MATERIALS_LIST',
    'CREW_ASSIGNMENTS', 'COST_BREAKDOWN_ITEMS', 'ADDITIONAL_COST_ITEMS',
    'ADDITIONAL_SAFETY_REQUIREMENTS', 'WORK_TO_BE_PERFORMED'].includes(v);
}

// ─── Seed company values ──────────────────────────────────────────────────────

function seedFromCompany(company: DbCompany | null): Record<string, string> {
  if (!company) return {};
  return {
    COMPANY_NAME: (company as any).name ?? '',
    COMPANY_TAGLINE: (company as any).tagline ?? '',
    COMPANY_ADDRESS: (company as any).address ?? '',
    COMPANY_CITY: (company as any).city ?? '',
    COMPANY_STATE: (company as any).state ?? '',
    COMPANY_ZIP: (company as any).zip ?? '',
    COMPANY_PHONE: (company as any).phone ?? '',
    COMPANY_EMAIL: (company as any).email ?? '',
    CONTRACTOR_LICENSE: (company as any).contractor_license ?? '',
    COMPANY_LOGO: (company as any).logo_url ? `<img src="${(company as any).logo_url}" style="max-height:60px" />` : 'LOGO',
  };
}

function seedFromContact(contact: any): Record<string, string> {
  if (!contact) return {};
  const fullName = getContactFullName(contact);
  const address = `${contact.address ?? ''}`;
  return {
    CUSTOMER_NAME: fullName,
    CLIENT_NAME: fullName,
    CUSTOMER_PHONE: contact.phone1 ?? contact.phone ?? '',
    CUSTOMER_EMAIL: contact.email ?? '',
    PROPERTY_ADDRESS: address,
    PROPERTY_CITY: contact.city ?? '',
    PROPERTY_STATE: contact.state ?? '',
    PROPERTY_ZIP: contact.zip ?? '',
    JOB_SITE_ADDRESS: address,
    JOB_SITE_CITY: contact.city ?? '',
    JOB_SITE_STATE: contact.state ?? '',
    JOB_SITE_ZIP: contact.zip ?? '',
    INSURANCE_COMPANY: contact.insurance_company ?? '',
    POLICY_NUMBER: contact.policy_number ?? '',
    CLAIM_NUMBER: contact.claim_number ?? '',
  };
}

// ─── Replace {{VARS}} in template content ─────────────────────────────────────

function applyVars(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

// ─── Main component ───────────────────────────────────────────────────────────

const FullScreenDocumentEditor: React.FC<FullScreenDocumentEditorProps> = ({
  template,
  onBack,
  companyProfile,
  contacts,
  initialContactId = '',
  initialContent,
}) => {
  const { toast } = useToast();

  // Seed initial values from company + selected contact
  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === initialContactId) ?? null,
    [contacts, initialContactId]
  );

  const initialValues = useMemo(() => {
    const base: Record<string, string> = {};
    template.variables.forEach((v) => { base[v] = ''; });
    // Seed from company
    Object.assign(base, seedFromCompany(companyProfile));
    // Seed from contact
    Object.assign(base, seedFromContact(selectedContact));
    // Seed today's date for common date fields
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (base.ESTIMATE_DATE === '') base.ESTIMATE_DATE = today;
    if (base.INSPECTION_DATE === '') base.INSPECTION_DATE = today;
    if (base.CHANGE_DATE === '') base.CHANGE_DATE = today;
    return base;
  }, [template.variables, companyProfile, selectedContact]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [search, setSearch] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  // Update a single variable field
  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  // Rendered HTML with all vars replaced
  const renderedHtml = useMemo(() => applyVars(template.content, values), [template.content, values]);

  // Group variables
  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    template.variables.forEach((v) => {
      const g = groupVar(v);
      if (!map[g]) map[g] = [];
      map[g].push(v);
    });
    return map;
  }, [template.variables]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result: Record<string, string[]> = {};
    Object.entries(grouped).forEach(([group, vars]) => {
      const filtered = vars.filter(
        (v) => v.toLowerCase().includes(q) || varToLabel(v).toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[group] = filtered;
    });
    return result;
  }, [grouped, search]);

  // Completion stats
  const totalVars = template.variables.length;
  const filledVars = template.variables.filter((v) => values[v]?.trim()).length;
  const completionPct = totalVars > 0 ? Math.round((filledVars / totalVars) * 100) : 0;

  // Category badge
  const cat = DOCUMENT_CATEGORIES.find((c) => c.id === template.category);

  // Toggle group collapse
  const toggleGroup = (g: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const handleSave = () => {
    setSaved(true);
    toast({ title: 'Draft saved', description: `${template.name} has been saved.` });
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(renderedHtml);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownload = () => {
    const blob = new Blob([renderedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b-2 border-green-600 shadow-sm flex-shrink-0">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-green-700 hover:text-green-800 font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </button>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-gray-800 truncate text-sm">{template.name}</span>
            {cat && (
              <Badge
                className="text-xs shrink-0"
                style={{ backgroundColor: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44` }}
              >
                {cat.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Completion counter */}
          <span className="text-xs text-green-700 font-medium hidden sm:block">
            {filledVars} / {totalVars} fields filled
          </span>

          {/* Preview toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode((p) => !p)}
            className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5"
          >
            {previewMode ? (
              <><Edit3 className="w-3.5 h-3.5" /> Edit Mode</>
            ) : (
              <><Eye className="w-3.5 h-3.5" /> Preview Mode</>
            )}
          </Button>

          {/* Print */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>

          {/* Download */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>

          {/* Save Draft */}
          <Button
            size="sm"
            onClick={handleSave}
            className={`gap-1.5 ${
              saved
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? 'Saved' : 'Save Draft'}
          </Button>

          {/* Send to Customer */}
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => toast({ title: 'Coming soon', description: 'Send to customer functionality is coming soon.' })}
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send to Customer</span>
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: variable fields ── */}
        <div
          className={`flex flex-col bg-gray-50 border-r border-gray-200 transition-all duration-300 overflow-hidden ${
            previewMode ? 'w-0 opacity-0 pointer-events-none' : 'w-72 opacity-100'
          }`}
        >
          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
            {/* Progress bar */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-700">{filledVars} / {totalVars} filled</span>
              <span className="text-xs text-gray-500">{completionPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>

            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search fields…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Variable groups */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {GROUP_ORDER.filter((g) => filteredGrouped[g]?.length).map((group) => {
              const vars = filteredGrouped[group];
              const isCollapsed = collapsedGroups.has(group);
              const groupFilled = vars.filter((v) => values[v]?.trim()).length;

              return (
                <div key={group} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-green-50 transition-colors"
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide ${GROUP_COLORS[group]}`}>
                      {group}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{groupFilled}/{vars.length}</span>
                      {isCollapsed
                        ? <ChevronRight className="w-3 h-3 text-gray-400" />
                        : <ChevronDown className="w-3 h-3 text-gray-400" />}
                    </div>
                  </button>

                  {/* Fields */}
                  {!isCollapsed && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
                      {vars.map((varName) => {
                        const filled = !!values[varName]?.trim();
                        const isTextarea = isTextareaVar(varName);
                        return (
                          <div key={varName} className="pt-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              {filled
                                ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                : <Circle className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                              <Label className="text-xs text-gray-600 font-medium leading-none">
                                {varToLabel(varName)}
                              </Label>
                            </div>
                            {isTextarea ? (
                              <Textarea
                                value={values[varName] ?? ''}
                                onChange={(e) => handleChange(varName, e.target.value)}
                                placeholder={`Enter ${varToLabel(varName).toLowerCase()}…`}
                                rows={3}
                                className={`text-xs resize-none focus:ring-green-500 focus:border-green-500 ${
                                  !filled ? 'bg-yellow-50 border-yellow-200' : ''
                                }`}
                              />
                            ) : (
                              <Input
                                value={values[varName] ?? ''}
                                onChange={(e) => handleChange(varName, e.target.value)}
                                placeholder={`Enter ${varToLabel(varName).toLowerCase()}…`}
                                className={`h-7 text-xs focus:ring-green-500 focus:border-green-500 ${
                                  !filled ? 'bg-yellow-50 border-yellow-200' : ''
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: live preview ── */}
        <div className="flex-1 bg-gray-100 overflow-auto">
          <div
            className="max-w-4xl mx-auto my-6 bg-white shadow-lg rounded-lg overflow-hidden"
            style={{ minHeight: '1100px' }}
          >
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenDocumentEditor;
