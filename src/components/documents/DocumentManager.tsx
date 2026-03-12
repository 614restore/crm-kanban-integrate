import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FileText, Plus, Eye, Edit3, Trash2, Copy,
  Search, Star, DollarSign, FileCode, Mail,
  MoreHorizontal, Lock, ChevronDown, ChevronUp,
  X, AlertCircle, CheckCircle
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean; // false = coming soon
  fields: TemplateField[];
  hasLineItems: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  isDefault: boolean;
  tags: string[];
}

interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'address' | 'currency' | 'textarea' | 'boolean';
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
  section: 'customer' | 'project' | 'scope' | 'payment' | 'legal' | 'other';
}

interface GeneratedDocument {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  contactName?: string;
  data: Record<string, any>;
  lineItems: LineItem[];
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'completed';
  createdAt: string;
}

// ─── Template Definitions ────────────────────────────────────────────────────

const ACTIVE_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'contingency',
    name: 'Insurance Restoration Contract',
    description: 'Contingency agreement for insurance claims — covers RCV/ACV, supplement authorization, assignment of benefits, and dual signatures.',
    category: 'Contracts',
    isActive: true,
    hasLineItems: false,
    usageCount: 0,
    isDefault: true,
    tags: ['insurance', 'contingency', 'contract'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Full Name', required: true, section: 'customer' },
      { id: 'customerAddress', name: 'customerAddress', type: 'address', label: 'Property Address', required: true, section: 'customer' },
      { id: 'customerPhone', name: 'customerPhone', type: 'phone', label: 'Phone Number', required: true, section: 'customer' },
      { id: 'customerEmail', name: 'customerEmail', type: 'email', label: 'Email Address', required: false, section: 'customer' },
      { id: 'insuranceCompany', name: 'insuranceCompany', type: 'text', label: 'Insurance Company', required: true, section: 'project' },
      { id: 'claimNumber', name: 'claimNumber', type: 'text', label: 'Claim Number', required: false, section: 'project', placeholder: 'If known' },
      { id: 'dateOfLoss', name: 'dateOfLoss', type: 'date', label: 'Date of Loss', required: true, section: 'project' },
      { id: 'typeOfDamage', name: 'typeOfDamage', type: 'text', label: 'Type of Damage', required: true, section: 'project', placeholder: 'e.g. Wind, Hail, Storm' },
      { id: 'scopeOfWork', name: 'scopeOfWork', type: 'textarea', label: 'Scope of Work', required: true, section: 'scope', placeholder: 'Describe the work to be performed...' },
      { id: 'rcvAmount', name: 'rcvAmount', type: 'currency', label: 'RCV Amount (if known)', required: false, section: 'payment' },
      { id: 'deductible', name: 'deductible', type: 'currency', label: 'Insurance Deductible', required: false, section: 'payment' },
      { id: 'signatureDate', name: 'signatureDate', type: 'date', label: 'Signature Date', required: true, section: 'legal', defaultValue: new Date().toISOString().split('T')[0] },
    ]
  },
  {
    id: 'retail-estimate',
    name: 'Customer Service Agreement',
    description: 'Retail (non-insurance) estimate and service agreement with itemized line items, labor, materials, and payment schedule.',
    category: 'Estimates',
    isActive: true,
    hasLineItems: true,
    usageCount: 0,
    isDefault: true,
    tags: ['retail', 'estimate', 'service agreement'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Full Name', required: true, section: 'customer' },
      { id: 'customerAddress', name: 'customerAddress', type: 'address', label: 'Property Address', required: true, section: 'customer' },
      { id: 'customerPhone', name: 'customerPhone', type: 'phone', label: 'Phone Number', required: true, section: 'customer' },
      { id: 'customerEmail', name: 'customerEmail', type: 'email', label: 'Email Address', required: false, section: 'customer' },
      { id: 'projectDescription', name: 'projectDescription', type: 'textarea', label: 'Project Description', required: true, section: 'project', placeholder: 'Brief description of the work...' },
      { id: 'startDate', name: 'startDate', type: 'date', label: 'Estimated Start Date', required: false, section: 'project' },
      { id: 'completionDate', name: 'completionDate', type: 'date', label: 'Estimated Completion', required: false, section: 'project' },
      { id: 'depositPercent', name: 'depositPercent', type: 'number', label: 'Deposit Required (%)', required: false, section: 'payment', defaultValue: '30', placeholder: 'e.g. 30' },
      { id: 'paymentTerms', name: 'paymentTerms', type: 'textarea', label: 'Payment Terms', required: false, section: 'payment', defaultValue: 'Balance due upon completion of work.' },
      { id: 'signatureDate', name: 'signatureDate', type: 'date', label: 'Signature Date', required: true, section: 'legal', defaultValue: new Date().toISOString().split('T')[0] },
    ]
  },
  {
    id: '3-day-cancel',
    name: '3-Day Right to Cancel',
    description: 'Federally-required Notice of Right to Cancel for door-to-door / home solicitation contracts (FTC Cooling-Off Rule). Must be provided at signing.',
    category: 'Contracts',
    isActive: true,
    hasLineItems: false,
    usageCount: 0,
    isDefault: true,
    tags: ['cancel', 'legal', 'required'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Full Name', required: true, section: 'customer' },
      { id: 'customerAddress', name: 'customerAddress', type: 'address', label: 'Property Address', required: true, section: 'customer' },
      { id: 'saleDate', name: 'saleDate', type: 'date', label: 'Date of Transaction', required: true, section: 'project', defaultValue: new Date().toISOString().split('T')[0] },
      { id: 'cancelDeadline', name: 'cancelDeadline', type: 'date', label: 'Cancellation Deadline (3 business days)', required: true, section: 'project' },
      { id: 'contractAmount', name: 'contractAmount', type: 'currency', label: 'Contract Amount', required: true, section: 'payment' },
      { id: 'signatureDate', name: 'signatureDate', type: 'date', label: 'Customer Signature Date', required: true, section: 'legal', defaultValue: new Date().toISOString().split('T')[0] },
    ]
  },
  {
    id: 'completion-cert',
    name: 'Certificate of Completion',
    description: 'Professional certificate documenting successful project completion with customer satisfaction acknowledgment and dual signatures.',
    category: 'Other',
    isActive: true,
    hasLineItems: false,
    usageCount: 0,
    isDefault: true,
    tags: ['completion', 'certificate', 'sign-off'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Full Name', required: true, section: 'customer' },
      { id: 'customerAddress', name: 'customerAddress', type: 'address', label: 'Property Address', required: true, section: 'customer' },
      { id: 'projectDescription', name: 'projectDescription', type: 'textarea', label: 'Work Completed', required: true, section: 'scope', placeholder: 'Describe the completed work...' },
      { id: 'completionDate', name: 'completionDate', type: 'date', label: 'Date of Completion', required: true, section: 'project', defaultValue: new Date().toISOString().split('T')[0] },
      { id: 'finalAmount', name: 'finalAmount', type: 'currency', label: 'Final Contract Amount', required: true, section: 'payment' },
      { id: 'warrantyPeriod', name: 'warrantyPeriod', type: 'text', label: 'Warranty Period', required: false, section: 'legal', placeholder: 'e.g. 5 years on labor' },
      { id: 'customerNotes', name: 'customerNotes', type: 'textarea', label: 'Customer Comments (optional)', required: false, section: 'other', placeholder: 'Any notes from the customer...' },
      { id: 'signatureDate', name: 'signatureDate', type: 'date', label: 'Signature Date', required: true, section: 'legal', defaultValue: new Date().toISOString().split('T')[0] },
    ]
  },
  {
    id: 'change-order',
    name: 'Change Order Authorization',
    description: 'Professional change order form for scope modifications with cost impact analysis and authorization signatures.',
    category: 'Change Orders',
    isActive: true,
    hasLineItems: true,
    usageCount: 0,
    isDefault: false,
    tags: ['change order', 'modification', 'authorization'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Full Name', required: true, section: 'customer' },
      { id: 'customerAddress', name: 'customerAddress', type: 'address', label: 'Property Address', required: true, section: 'customer' },
      { id: 'changeOrderNumber', name: 'changeOrderNumber', type: 'text', label: 'Change Order #', required: true, section: 'project', placeholder: 'e.g. CO-001' },
      { id: 'originalContractDate', name: 'originalContractDate', type: 'date', label: 'Original Contract Date', required: false, section: 'project' },
      { id: 'reasonForChange', name: 'reasonForChange', type: 'textarea', label: 'Reason for Change', required: true, section: 'scope', placeholder: 'Explain what changed and why...' },
      { id: 'originalAmount', name: 'originalAmount', type: 'currency', label: 'Original Contract Amount', required: true, section: 'payment' },
      { id: 'changeAmount', name: 'changeAmount', type: 'currency', label: 'Change Order Amount', required: true, section: 'payment' },
      { id: 'newTotal', name: 'newTotal', type: 'currency', label: 'New Contract Total', required: true, section: 'payment' },
      { id: 'revisedCompletionDate', name: 'revisedCompletionDate', type: 'date', label: 'Revised Completion Date', required: false, section: 'project' },
      { id: 'signatureDate', name: 'signatureDate', type: 'date', label: 'Authorization Date', required: true, section: 'legal', defaultValue: new Date().toISOString().split('T')[0] },
    ]
  }
];

const COMING_SOON_TEMPLATES = [
  { name: 'Professional Roofing Proposal', category: 'Proposals' },
  { name: 'Professional Invoice', category: 'Invoices' },
  { name: 'Professional Work Order', category: 'Work Orders' },
  { name: 'Property Inspection Report', category: 'Other' },
  { name: 'Daily Safety Checklist', category: 'Safety Forms' },
  { name: 'EPA Lead Safe Disclosure', category: 'Safety Forms' },
  { name: 'Asphalt Shingle Roof Replacement Estimate', category: 'Estimates' },
  { name: 'Metal Roof Estimate', category: 'Estimates' },
  { name: 'Vinyl Siding Estimate', category: 'Estimates' },
  { name: 'Gutters & Downspouts Estimate', category: 'Estimates' },
  { name: 'Window Replacement Contract', category: 'Contracts' },
  { name: 'Siding Replacement Contract', category: 'Contracts' },
  { name: 'Interior Restoration Contract', category: 'Contracts' },
];

const SECTION_LABELS: Record<string, string> = {
  customer: '👤 Customer Information',
  project: '🏠 Project Details',
  scope: '📋 Scope of Work',
  payment: '💰 Payment',
  legal: '✍️ Signature & Legal',
  other: '📝 Additional Notes',
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('generatedDocuments_v2');
    if (saved) setDocuments(JSON.parse(saved));
  }, []);

  const saveDocuments = (docs: GeneratedDocument[]) => {
    setDocuments(docs);
    localStorage.setItem('generatedDocuments_v2', JSON.stringify(docs));
  };

  const handleGenerate = (data: Record<string, any>, lineItems: LineItem[], template: DocumentTemplate) => {
    const doc: GeneratedDocument = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      title: `${template.name} — ${data.customerName || 'Unknown'}`,
      contactName: data.customerName,
      data,
      lineItems,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    const updated = [doc, ...documents];
    saveDocuments(updated);
    setSelectedTemplate(null);
    setSelectedDocument(doc);
    toast.success('Document created successfully!');
  };

  const filteredActive = ACTIVE_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryColor: Record<string, string> = {
    'Contracts': 'bg-purple-100 text-purple-700',
    'Estimates': 'bg-green-100 text-green-700',
    'Change Orders': 'bg-orange-100 text-orange-700',
    'Other': 'bg-gray-100 text-gray-600',
    'Proposals': 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Documents</h1>
        <p className="text-gray-500 text-sm">Create, fill out, and manage your contractor documents.</p>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Active Templates Grid */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActive.map(template => (
            <div key={template.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColor[template.category] || 'bg-gray-100 text-gray-600'}`}>
                      {template.category}
                    </span>
                    {template.isDefault && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug">{template.name}</h3>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4 flex-1 leading-relaxed">{template.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>Used {template.usageCount} times</span>
                {template.hasLineItems && <span className="text-blue-500 font-medium">📊 Line items</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Create
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Documents */}
      {documents.length > 0 && (
        <div className="mt-8 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Documents</h2>
          <div className="space-y-2">
            {documents.slice(0, 10).map(doc => (
              <div
                key={doc.id}
                onClick={() => setSelectedDocument(doc)}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString()} · {doc.templateName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  doc.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                  doc.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                  doc.status === 'signed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coming Soon Section */}
      <div className="mt-8">
        <button
          onClick={() => setShowComingSoon(s => !s)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 hover:text-gray-600 transition-colors"
        >
          <Lock className="w-4 h-4" />
          Coming Soon ({COMING_SOON_TEMPLATES.length} more templates)
          {showComingSoon ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showComingSoon && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMING_SOON_TEMPLATES.map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5 opacity-60">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">{t.category}</span>
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-500">{t.name}</h3>
                <p className="text-xs text-gray-400 mt-1">Coming soon</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {selectedTemplate && (
        <CreateDocumentModal
          template={selectedTemplate}
          onGenerate={(data, lineItems) => handleGenerate(data, lineItems, selectedTemplate)}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* Document Viewer */}
      {selectedDocument && (
        <DocumentViewerModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={updatedDoc => {
            const updated = documents.map(d => d.id === updatedDoc.id ? updatedDoc : d);
            saveDocuments(updated);
            setSelectedDocument(updatedDoc);
          }}
        />
      )}
    </div>
  );
};

// ─── Create Document Modal ────────────────────────────────────────────────────

const CreateDocumentModal: React.FC<{
  template: DocumentTemplate;
  onGenerate: (data: Record<string, any>, lineItems: LineItem[]) => void;
  onClose: () => void;
}> = ({ template, onGenerate, onClose }) => {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const d: Record<string, any> = {};
    template.fields.forEach(f => { d[f.name] = f.defaultValue || ''; });
    return d;
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', qty: 1, unit: 'EA', unitPrice: 0, total: 0 }
  ]);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'unitPrice') {
        updated.total = parseFloat((updated.qty * updated.unitPrice).toFixed(2));
      }
      return updated;
    }));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', qty: 1, unit: 'EA', unitPrice: 0, total: 0 }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = template.fields.filter(f => f.required && !formData[f.name]);
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    onGenerate(formData, template.hasLineItems ? lineItems : []);
  };

  // Group fields by section
  const sections = Array.from(new Set(template.fields.map(f => f.section)));

  const renderField = (field: TemplateField) => {
    const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
    switch (field.type) {
      case 'date':
        return <input type="date" className={base} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'email':
        return <input type="email" className={base} placeholder={field.placeholder || 'email@example.com'} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'phone':
        return <input type="tel" className={base} placeholder={field.placeholder || '(555) 555-5555'} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'number':
        return <input type="number" className={base} placeholder={field.placeholder} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" min="0" className={`${base} pl-7`} placeholder="0.00" value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />
          </div>
        );
      case 'textarea':
        return <textarea rows={3} className={`${base} resize-none`} placeholder={field.placeholder} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      default:
        return <input type="text" className={base} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{template.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
          </div>
          <button onClick={onClose} className="ml-4 p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {sections.map(section => {
            const sectionFields = template.fields.filter(f => f.section === section);
            return (
              <div key={section}>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">
                  {SECTION_LABELS[section] || section}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sectionFields.map(field => (
                    <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Line Items Table */}
          {template.hasLineItems && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">📦 Line Items</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-[40%]">Description</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-[10%]">Qty</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-[12%]">Unit</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-[18%]">Unit Price</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-[15%]">Total</th>
                      <th className="w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            placeholder="Description..."
                            value={item.description}
                            onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={item.qty}
                            onChange={e => updateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm text-center border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={item.unit}
                            onChange={e => updateLineItem(item.id, 'unit', e.target.value)}
                            className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded text-center"
                          >
                            {['EA','SQ','LF','SF','HR','LS','TON','GAL'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full pl-5 pr-2 py-1 text-sm text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right text-sm font-medium text-gray-700">
                          ${item.total.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {lineItems.length > 1 && (
                            <button type="button" onClick={() => removeLineItem(item.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Line
                </button>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Subtotal: <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Generate Document
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Document Viewer Modal ────────────────────────────────────────────────────

const DocumentViewerModal: React.FC<{
  document: GeneratedDocument;
  onClose: () => void;
  onUpdate: (doc: GeneratedDocument) => void;
}> = ({ document, onClose, onUpdate }) => {
  const template = ACTIVE_TEMPLATES.find(t => t.id === document.templateId);

  const subtotal = document.lineItems.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{document.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{new Date(document.createdAt).toLocaleDateString()} · {document.status}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {template && (
            <>
              {Array.from(new Set(template.fields.map(f => f.section))).map(section => (
                <div key={section}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{SECTION_LABELS[section]}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {template.fields.filter(f => f.section === section).map(field => (
                      <div key={field.id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                        <p className="text-xs text-gray-400">{field.label}</p>
                        <p className="text-sm font-medium text-gray-900">
                          {field.type === 'currency' && document.data[field.name] ? `$${parseFloat(document.data[field.name]).toFixed(2)}` : document.data[field.name] || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {document.lineItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📦 Line Items</h3>
                  <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Description</th>
                        <th className="text-center px-3 py-2 text-xs text-gray-500">Qty</th>
                        <th className="text-center px-3 py-2 text-xs text-gray-500">Unit</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500">Price</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {document.lineItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-center">{item.qty}</td>
                          <td className="px-3 py-2 text-center">{item.unit}</td>
                          <td className="px-3 py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium">${item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Subtotal</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">${subtotal.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <select
            value={document.status}
            onChange={e => onUpdate({ ...document, status: e.target.value as GeneratedDocument['status'] })}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="signed">Signed</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Close</button>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
