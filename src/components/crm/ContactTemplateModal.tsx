// ContactTemplateModal — pick a template, preview with customer data filled in, save to customer
import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Eye, Save, ChevronLeft, Search, DollarSign, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { uploadDocument } from '@/lib/storage';
import {
  DocumentTemplate,
  getContractorEstimateTemplates,
  buildContactOverrides,
  fillTemplateVars,
  getUnfilledVars,
} from '@/lib/contractorTemplates';
import { Contact, Document, getContactFullName } from '@/lib/crmData';

interface Props {
  contact: Contact;
  onClose: () => void;
  onDocumentSaved: (doc: Document) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  estimate: 'Estimates',
  invoice: 'Invoices',
  contract: 'Contracts',
  'work-order': 'Work Orders',
  proposal: 'Proposals',
  'change-order': 'Change Orders',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  estimate: 'bg-green-100 text-green-800',
  invoice: 'bg-blue-100 text-blue-800',
  contract: 'bg-purple-100 text-purple-800',
  'work-order': 'bg-orange-100 text-orange-800',
  proposal: 'bg-indigo-100 text-indigo-800',
  'change-order': 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function ContactTemplateModal({ contact, onClose, onDocumentSaved }: Props) {
  const { profile } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [templates] = useState<DocumentTemplate[]>(getContractorEstimateTemplates());
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [unfilledVars, setUnfilledVars] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Push preview HTML to iframe without remounting it (avoids losing input focus)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !selected) return;
    // Use srcdoc attribute update rather than remounting
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(previewContent);
        doc.close();
      }
    } catch {
      // Cross-origin fallback — just set srcDoc
      iframe.srcdoc = previewContent;
    }
  }, [previewContent, selected]);

  // Load company profile once
  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id)
      .then(c => { if (c) setCompanyProfile(c); })
      .catch(() => {});
  }, [profile?.company_id]);

  // Build preview whenever selected template, company, or user-supplied overrides change
  useEffect(() => {
    if (!selected) return;
    const base = buildContactOverrides(contact as any, companyProfile as any, profile as any);
    const merged = { ...base, ...overrideInputs };
    const filled = fillTemplateVars(selected.content, merged);
    setPreviewContent(filled);
    setUnfilledVars(getUnfilledVars(filled));
  }, [selected, companyProfile, profile, overrideInputs, contact]);

  // When a new template is selected, initialise overrideInputs with empty strings for its vars
  const handleSelect = (t: DocumentTemplate) => {
    setSelected(t);
    setOverrideInputs({});
  };

  const handleBack = () => {
    setSelected(null);
    setOverrideInputs({});
    setUnfilledVars([]);
    setPreviewContent('');
  };

  const handleOverrideChange = (varName: string, value: string) => {
    setOverrideInputs(prev => ({ ...prev, [varName]: value }));
  };

  const handleSave = async () => {
    if (!selected || !profile?.company_id) {
      toast.error('Unable to save — missing company context.');
      return;
    }
    setIsSaving(true);
    try {
      // Use the most up-to-date preview content
      const base = buildContactOverrides(contact as any, companyProfile as any, profile as any);
      const merged = { ...base, ...overrideInputs };
      const finalHtml = fillTemplateVars(selected.content, merged);

      // Create an HTML file blob
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const contactName = getContactFullName(contact).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${selected.name.replace(/\s+/g, '_')}_${contactName}_${timestamp}.html`;
      const file = new File([blob], fileName, { type: 'text/html' });

      // Upload to Supabase storage under this contact's folder
      const uploadResult = await uploadDocument(file, profile.company_id, contact.id);
      if (uploadResult.error || !uploadResult.path) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Create the document DB record linked to this contact
      const repName = profile
        ? `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim()
        : 'Unknown';

      const newDbDoc = await db.createDocument({
        company_id: profile.company_id,
        contact_id: contact.id,
        name: `${selected.name} — ${getContactFullName(contact)}`,
        type: selected.category === 'estimate' ? 'estimate' : 'other',
        url: uploadResult.path,
        size: `${Math.round(blob.size / 1024)} KB`,
        uploaded_by: repName,
      });

      if (!newDbDoc) throw new Error('Failed to create document record');

      // Map to frontend Document type for immediate UI update
      const frontendDoc: Document = {
        id: newDbDoc.id,
        contactId: contact.id,
        name: newDbDoc.name,
        type: (newDbDoc.type || 'other') as Document['type'],
        url: newDbDoc.url,
        uploadedAt: newDbDoc.created_at || new Date().toISOString(),
        uploadedBy: newDbDoc.uploaded_by || repName,
        size: newDbDoc.size || '',
      };

      onDocumentSaved(frontendDoc);
      toast.success(`"${selected.name}" saved to ${getContactFullName(contact)}'s documents`);
      onClose();
    } catch (err: any) {
      console.error('[ContactTemplateModal] Save error:', err);
      toast.error(err?.message || 'Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Filtered template list ─────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  // ── Render: template list view ─────────────────────────────────────────
  const renderList = () => (
    <div className="flex flex-col h-full">
      {/* Search + category filter */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'All Templates' : CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p>No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign size={18} className="text-green-700" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-700'}`}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-700">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Render: preview + variable fill view ──────────────────────────────
  const renderPreview = () => (
    <div className="flex flex-col h-full">
      {/* Back + header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to templates"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{selected!.name}</p>
          <p className="text-xs text-gray-500">Filling in data for <strong>{getContactFullName(contact)}</strong></p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: variable inputs if any are unfilled */}
        {unfilledVars.length > 0 && (
          <div className="w-64 flex-shrink-0 border-r border-gray-200 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Edit size={14} className="text-blue-600" />
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Fill In Values</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Customer and company info is auto-filled. Enter project-specific values below to complete the document.
            </p>
            {unfilledVars.map(varName => (
              <div key={varName}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {varName.replace(/_/g, ' ')}
                </label>
                <input
                  type="text"
                  className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={`Enter ${varName.replace(/_/g, ' ').toLowerCase()}…`}
                  value={overrideInputs[varName] || ''}
                  onChange={e => handleOverrideChange(varName, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Right: HTML preview */}
        <div className="flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Document Preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {unfilledVars.length > 0
            ? `${unfilledVars.length} field(s) still blank — document will save with placeholders if left empty.`
            : '✓ All fields filled. Ready to save.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <><Loader2 size={16} className="animate-spin" /> Saving…</>
            ) : (
              <><Save size={16} /> Save to {getContactFullName(contact)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl" style={{ height: '85vh' }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Use Document Template
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select a template — customer and company details will be auto-filled.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {selected ? renderPreview() : renderList()}
        </div>
      </div>
    </div>
  );
}
