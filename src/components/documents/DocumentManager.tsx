import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import {
  FileText, Plus, Eye, Trash2, Search, Star, Lock,
  ChevronDown, ChevronUp, X, Printer, Send, PenLine,
  CheckCircle, RotateCcw, Upload, Type
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  isActive: boolean;
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

interface SignatureData {
  dataUrl: string;
  signedAt: string;
  signerName: string;
  method: 'draw' | 'type' | 'upload';
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
  signatureData?: SignatureData;
  signingToken?: string;
}

// ─── Template Definitions ─────────────────────────────────────────────────────

const ACTIVE_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'contingency',
    name: 'Insurance Restoration Contract',
    description: 'Contingency agreement for insurance claims — covers RCV/ACV, supplement authorization, assignment of benefits, and dual signatures.',
    category: 'Contracts', isActive: true, hasLineItems: false, usageCount: 0, isDefault: true,
    tags: ['insurance', 'contingency', 'contract'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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
    category: 'Estimates', isActive: true, hasLineItems: true, usageCount: 0, isDefault: true,
    tags: ['retail', 'estimate', 'service agreement'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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
    description: 'Federally-required Notice of Right to Cancel for door-to-door / home solicitation contracts (FTC Cooling-Off Rule).',
    category: 'Contracts', isActive: true, hasLineItems: false, usageCount: 0, isDefault: true,
    tags: ['cancel', 'legal', 'required'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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
    description: 'Professional certificate documenting successful project completion with customer satisfaction acknowledgment.',
    category: 'Other', isActive: true, hasLineItems: false, usageCount: 0, isDefault: true,
    tags: ['completion', 'certificate', 'sign-off'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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
    category: 'Change Orders', isActive: true, hasLineItems: true, usageCount: 0, isDefault: false,
    tags: ['change order', 'modification', 'authorization'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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

const categoryColor: Record<string, string> = {
  'Contracts': 'bg-purple-100 text-purple-700',
  'Estimates': 'bg-green-100 text-green-700',
  'Change Orders': 'bg-orange-100 text-orange-700',
  'Other': 'bg-gray-100 text-gray-600',
  'Proposals': 'bg-blue-100 text-blue-700',
};

// ─── Signature Pad Component ──────────────────────────────────────────────────

const SignaturePad: React.FC<{
  onSave: (sig: SignatureData) => void;
  onClose: () => void;
  signerName: string;
}> = ({ onSave, onClose, signerName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedSig, setTypedSig] = useState(signerName || '');
  const [typedFont, setTypedFont] = useState('Dancing Script');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const renderTypedToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `48px '${typedFont}', cursive`;
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedSig, canvas.width / 2, canvas.height / 2);
  }, [typedSig, typedFont]);

  useEffect(() => {
    if (mode === 'type') renderTypedToCanvas();
  }, [mode, typedSig, typedFont, renderTypedToCanvas]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        setHasDrawn(true);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (mode === 'draw' && !hasDrawn) { toast.error('Please draw your signature first'); return; }
    if (mode === 'type' && !typedSig.trim()) { toast.error('Please type your name'); return; }
    if (mode === 'type') renderTypedToCanvas();
    onSave({
      dataUrl: canvas.toDataURL('image/png'),
      signedAt: new Date().toISOString(),
      signerName: signerName,
      method: mode,
    });
  };

  const fontOptions = [
    { label: 'Signature 1', value: 'Dancing Script' },
    { label: 'Signature 2', value: 'Pacifico' },
    { label: 'Signature 3', value: 'Great Vibes' },
    { label: 'Printed', value: 'serif' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Sign Document</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b">
          {(['draw', 'type', 'upload'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); clearCanvas(); }}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                mode === m ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'draw' ? '✏️ Draw' : m === 'type' ? '⌨️ Type' : '📎 Upload'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Type mode controls */}
          {mode === 'type' && (
            <div className="mb-3 space-y-2">
              <input
                type="text"
                value={typedSig}
                onChange={e => setTypedSig(e.target.value)}
                placeholder="Type your name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="flex gap-2">
                {fontOptions.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setTypedFont(f.value)}
                    style={{ fontFamily: `'${f.value}', cursive` }}
                    className={`flex-1 py-1.5 text-sm border rounded-lg transition ${
                      typedFont === f.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload mode */}
          {mode === 'upload' && (
            <div className="mb-3">
              <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">Upload signature image (PNG/JPG)</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>
          )}

          {/* Canvas */}
          <div className={`relative border-2 rounded-xl overflow-hidden ${
            mode === 'draw' ? 'border-gray-300 cursor-crosshair' : 'border-gray-200 bg-gray-50'
          }`}>
            <canvas
              ref={canvasRef}
              width={480}
              height={160}
              className="w-full h-40 block"
              onMouseDown={mode === 'draw' ? startDraw : undefined}
              onMouseMove={mode === 'draw' ? draw : undefined}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={mode === 'draw' ? startDraw : undefined}
              onTouchMove={mode === 'draw' ? draw : undefined}
              onTouchEnd={stopDraw}
            />
            {mode === 'draw' && !hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm">Sign here using mouse or touch</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <RotateCcw className="w-4 h-4" /> Clear
            </button>
            <p className="text-xs text-gray-400">
              Signed by: <span className="font-medium text-gray-600">{signerName}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" /> Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DocumentManager: React.FC = () => {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const saved = localStorage.getItem(`crm_generated_docs_${companyId}`);
    if (saved) setDocuments(JSON.parse(saved));
  }, [companyId]);

  const saveDocuments = (docs: GeneratedDocument[]) => {
    setDocuments(docs);
    if (companyId) localStorage.setItem(`crm_generated_docs_${companyId}`, JSON.stringify(docs));
  };

  const handleGenerate = (data: Record<string, any>, lineItems: LineItem[], template: DocumentTemplate) => {
    const token = crypto.randomUUID();
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
      signingToken: token,
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Documents</h1>
        <p className="text-gray-500 text-sm">Create, fill out, and manage your contractor documents.</p>
      </div>

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
              <button
                onClick={() => setSelectedTemplate(template)}
                className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Create
              </button>
            </div>
          ))}
        </div>
      </div>

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
                <div className="flex items-center gap-2">
                  {doc.signatureData && <CheckCircle className="w-4 h-4 text-green-500" />}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    doc.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                    doc.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                    doc.status === 'signed' ? 'bg-green-100 text-green-600' :
                    doc.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {selectedTemplate && (
        <CreateDocumentModal
          template={selectedTemplate}
          onGenerate={(data, lineItems) => handleGenerate(data, lineItems, selectedTemplate)}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {selectedDocument && (
        <DocumentViewerModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={updatedDoc => {
            const updated = documents.map(d => d.id === updatedDoc.id ? updatedDoc : d);
            saveDocuments(updated);
            setSelectedDocument(updatedDoc);
          }}
          onDelete={id => {
            const updated = documents.filter(d => d.id !== id);
            saveDocuments(updated);
            setSelectedDocument(null);
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

  const handleChange = (name: string, value: any) => setFormData(prev => ({ ...prev, [name]: value }));

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

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const missing = template.fields.filter(f => f.required && !formData[f.name]);
    if (missing.length > 0) { toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`); return; }
    onGenerate(formData, template.hasLineItems ? lineItems : []);
  };

  const sections = Array.from(new Set(template.fields.map(f => f.section)));

  const renderField = (field: TemplateField) => {
    const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
    switch (field.type) {
      case 'date': return <input type="date" className={base} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'email': return <input type="email" className={base} placeholder={field.placeholder || 'email@example.com'} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'phone': return <input type="tel" className={base} placeholder={field.placeholder || '(555) 555-5555'} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'number': return <input type="number" className={base} placeholder={field.placeholder} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      case 'currency': return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input type="number" step="0.01" min="0" className={`${base} pl-7`} placeholder="0.00" value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />
        </div>
      );
      case 'textarea': return <textarea rows={3} className={`${base} resize-none`} placeholder={field.placeholder} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
      default: return <input type="text" className={base} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`} value={formData[field.name]} onChange={e => handleChange(field.name, e.target.value)} required={field.required} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{template.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
          </div>
          <button onClick={onClose} className="ml-4 p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

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
                        {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

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
                    {lineItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <input type="text" placeholder="Description..." value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" value={item.qty} onChange={e => updateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 text-sm text-center border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={item.unit} onChange={e => updateLineItem(item.id, 'unit', e.target.value)} className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded text-center">
                            {['EA','SQ','LF','SF','HR','LS','TON','GAL'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full pl-5 pr-2 py-1 text-sm text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded" />
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right text-sm font-medium text-gray-700">${item.total.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {lineItems.length > 1 && (
                            <button type="button" onClick={() => setLineItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600">
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
                <button type="button" onClick={() => setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', qty: 1, unit: 'EA', unitPrice: 0, total: 0 }])} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-4 h-4" /> Add Line
                </button>
                <div className="text-sm text-gray-500">Subtotal: <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
  onDelete: (id: string) => void;
}> = ({ document, onClose, onUpdate, onDelete }) => {
  const template = ACTIVE_TEMPLATES.find(t => t.id === document.templateId);
  const [showSignPad, setShowSignPad] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const subtotal = document.lineItems.reduce((sum, i) => sum + i.total, 0);
  const isSigned = document.status === 'signed' || document.status === 'completed';

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${document.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 13px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 8px; }
          .field-label { font-size: 10px; color: #888; }
          .field-value { font-size: 12px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 10px; border: 1px solid #e0e0e0; }
          td { padding: 5px 8px; border: 1px solid #e0e0e0; font-size: 11px; }
          tfoot td { font-weight: bold; background: #f9f9f9; }
          .sig-block { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 16px; }
          .sig-img { max-height: 60px; border-bottom: 1px solid #333; }
          .no-print { display: none !important; }
          @page { margin: 0.75in; }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleSign = (sig: SignatureData) => {
    const updated: GeneratedDocument = {
      ...document,
      signatureData: sig,
      status: 'signed',
    };
    onUpdate(updated);
    setShowSignPad(false);
    toast.success('Document signed successfully!');
  };

  const handleSendForSign = (email: string) => {
    const signingLink = `${window.location.origin}/sign/${document.signingToken}`;
    // In production this would send via email API. For now we copy to clipboard.
    navigator.clipboard.writeText(signingLink).then(() => {
      toast.success(`Signing link copied! Send to ${email}`);
    }).catch(() => {
      toast.info(`Signing link: ${signingLink}`);
    });
    onUpdate({ ...document, status: 'sent' });
    setShowSendModal(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{document.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-400">{new Date(document.createdAt).toLocaleDateString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  document.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                  document.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                  document.status === 'signed' ? 'bg-green-100 text-green-600' :
                  document.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                </span>
                {isSigned && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Printable content */}
          <div ref={printRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="print-header" style={{ display: 'none' }}>
              <h1>614 Restore LLC</h1>
              <p style={{ color: '#666', fontSize: '11px' }}>www.614restore.com · (614) 000-0000</p>
              <h1 style={{ marginTop: '12px' }}>{document.title}</h1>
              <p style={{ color: '#888', fontSize: '10px' }}>Created: {new Date(document.createdAt).toLocaleDateString()}</p>
            </div>

            {template && (
              <>
                {Array.from(new Set(template.fields.map(f => f.section))).map(section => (
                  <div key={section}>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{SECTION_LABELS[section]}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {template.fields.filter(f => f.section === section).map(field => (
                        <div key={field.id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                          <p className="text-xs text-gray-400 field-label">{field.label}</p>
                          <p className="text-sm font-medium text-gray-900 field-value">
                            {field.type === 'currency' && document.data[field.name]
                              ? `$${parseFloat(document.data[field.name]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : document.data[field.name] || '—'}
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

            {/* Signature display */}
            {document.signatureData && (
              <div className="sig-block border-t pt-4 mt-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">✍️ Signature</h3>
                <div className="flex items-end gap-6">
                  <div>
                    <img src={document.signatureData.dataUrl} alt="Signature" className="sig-img h-14 border-b border-gray-800" />
                    <p className="text-xs text-gray-500 mt-1">{document.signatureData.signerName}</p>
                    <p className="text-xs text-gray-400">{new Date(document.signatureData.signedAt).toLocaleString()}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="h-14 w-40 border-b border-gray-400" />
                    <p className="text-xs text-gray-500 mt-1">614 Restore LLC</p>
                    <p className="text-xs text-gray-400">Authorized Representative</p>
                  </div>
                </div>
              </div>
            )}

            {!document.signatureData && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-end gap-6">
                  <div>
                    <div className="h-12 w-48 border-b border-gray-400" />
                    <p className="text-xs text-gray-500 mt-1">Customer Signature</p>
                  </div>
                  <div>
                    <div className="h-12 w-32 border-b border-gray-400" />
                    <p className="text-xs text-gray-500 mt-1">Date</p>
                  </div>
                  <div className="ml-auto">
                    <div className="h-12 w-40 border-b border-gray-400" />
                    <p className="text-xs text-gray-500 mt-1">614 Restore LLC</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status (only if not signed) */}
              {!isSigned && (
                <select
                  value={document.status}
                  onChange={e => onUpdate({ ...document, status: e.target.value as GeneratedDocument['status'] })}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="viewed">Viewed</option>
                  <option value="signed">Signed</option>
                  <option value="completed">Completed</option>
                </select>
              )}

              <div className="flex-1" />

              {/* Delete */}
              <button
                onClick={() => { if (window.confirm('Delete this document?')) onDelete(document.id); }}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Print/PDF */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>

              {/* Sign Now */}
              {!isSigned && (
                <button
                  onClick={() => setShowSignPad(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                >
                  <PenLine className="w-4 h-4" /> Sign Now
                </button>
              )}

              {/* Send for Signature */}
              {!isSigned && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" /> Send for Signature
                </button>
              )}

              <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Pad */}
      {showSignPad && (
        <SignaturePad
          signerName={document.contactName || 'Customer'}
          onSave={handleSign}
          onClose={() => setShowSignPad(false)}
        />
      )}

      {/* Send for Signature Modal */}
      {showSendModal && (
        <SendForSignatureModal
          document={document}
          onSend={handleSendForSign}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </>
  );
};

// ─── Send for Signature Modal ─────────────────────────────────────────────────

const SendForSignatureModal: React.FC<{
  document: GeneratedDocument;
  onSend: (email: string) => void;
  onClose: () => void;
}> = ({ document, onSend, onClose }) => {
  const [email, setEmail] = useState(document.data?.customerEmail || '');
  const signingLink = `${window.location.origin}/sign/${document.signingToken}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Send for Signature</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Signing Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={signingLink}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-500"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(signingLink); toast.success('Link copied!'); }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Customer opens this link to review and sign. Once signed, status updates automatically.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-700 font-medium">📧 Email Integration</p>
            <p className="text-xs text-blue-600 mt-1">Connect your email in Settings to send directly. For now, copy the link and send manually or via SMS.</p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700">Cancel</button>
          <button
            onClick={() => onSend(email)}
            className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Mark as Sent
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
