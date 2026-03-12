// ContactTemplateModal — Inline document editor with click-to-edit placeholders
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, FileText, ChevronLeft, Search, DollarSign, Save, Loader2, Plus, Trash2 } from 'lucide-react';
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
  safety: 'Safety',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  estimate: 'bg-green-100 text-green-800',
  invoice: 'bg-blue-100 text-blue-800',
  contract: 'bg-purple-100 text-purple-800',
  'work-order': 'bg-orange-100 text-orange-800',
  proposal: 'bg-indigo-100 text-indigo-800',
  'change-order': 'bg-yellow-100 text-yellow-800',
  safety: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function ContactTemplateModal({ contact, onClose, onDocumentSaved }: Props) {
  const { profile } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [templates] = useState<DocumentTemplate[]>(getContractorEstimateTemplates());
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Load company profile
  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id)
      .then(c => { if (c) setCompanyProfile(c); })
      .catch(() => {});
  }, [profile?.company_id]);

  // Build preview content with live values
  const previewContent = useMemo(() => {
    if (!selected) return '';
    const base = buildContactOverrides(
      contact,
      companyProfile,
      profile
    );
    const merged = { ...base, ...fieldValues };
    return fillTemplateVars(selected.content, merged);
  }, [selected, companyProfile, profile, fieldValues, contact]);

  const handleSelect = (t: DocumentTemplate) => {
    setSelected(t);
    setFieldValues({});
  };

  const handleBack = () => {
    setSelected(null);
    setFieldValues({});
  };

  const handleSave = async () => {
    if (!selected || !profile?.company_id) {
      toast.error('Unable to save — missing company context.');
      return;
    }

    // Check for unfilled required fields
    const base = buildContactOverrides(
      contact,
      companyProfile,
      profile
    );
    const merged = { ...base, ...fieldValues };
    const finalHtml = fillTemplateVars(selected.content, merged);
    const stillUnfilled = getUnfilledVars(finalHtml);
    
    if (stillUnfilled.length > 0) {
      toast.error(`Please fill in: ${stillUnfilled.slice(0, 3).join(', ')}${stillUnfilled.length > 3 ? '...' : ''}`);
      return;
    }

    setIsSaving(true);
    try {
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const contactName = getContactFullName(contact).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${selected.name.replace(/\s+/g, '_')}_${contactName}_${timestamp}.html`;
      const file = new File([blob], fileName, { type: 'text/html' });

      const uploadResult = await uploadDocument(file, profile.company_id, contact.id);
      if (uploadResult.error || !uploadResult.path) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

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

  const editableFields = useMemo(() => {
    if (!selected) return [];
    // Show ALL fields defined in the template, not just unfilled ones
    if (selected.fields && selected.fields.length > 0) {
      return selected.fields.map(f => f.key);
    }
    // Fallback: show all variables found in template
    const base = buildContactOverrides(
      contact,
      companyProfile,
      profile
    );
    const merged = { ...base, ...fieldValues };
    const html = fillTemplateVars(selected.content, merged);
    return getUnfilledVars(html);
  }, [selected, contact, companyProfile, profile]);

  const unfilledCount = useMemo(() => {
    return editableFields.filter(field => !fieldValues[field]).length;
  }, [editableFields, fieldValues]);

  // Template list view
  const renderList = () => (
    <div className="flex flex-col h-full">
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

  // Document editor view
  const renderEditor = () => (
    <div className="flex h-full">
      {/* Left sidebar: Form fields */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto p-4 space-y-4 bg-gray-50">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ChevronLeft size={16} />
          Back to templates
        </button>
        
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">{selected!.name}</h3>
          <p className="text-xs text-gray-500">Filling in data for {getContactFullName(contact)}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-900 mb-1">📝 Fill In Values</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Customer and company info is auto-filled. Enter project-specific values below to complete the document.
          </p>
        </div>

        {editableFields.length > 0 && (
          <div className="space-y-3">
            {editableFields.map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {field.replace(/_/g, ' ')}
                  {fieldValues[field] && <span className="ml-1 text-green-600">✓</span>}
                </label>
                <input
                  type="text"
                  value={fieldValues[field] || ''}
                  onChange={e => setFieldValues(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={`Enter ${field.replace(/_/g, ' ').toLowerCase()}...`}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        )}

        {unfilledCount === 0 && editableFields.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-medium text-green-900 mb-1">✓ All fields filled</p>
            <p className="text-xs text-green-700">Document is ready to save.</p>
          </div>
        )}
      </div>

      {/* Right: Document preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600">Live Document Preview</p>
          {unfilledCount > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
              {unfilledCount} field(s) still blank
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            <iframe
              srcDoc={previewContent}
              className="w-full h-full min-h-[800px] border-0"
              title="Document Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-7xl" style={{ height: '90vh' }}>
        {/* Header */}
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
          {selected ? renderEditor() : renderList()}
        </div>

        {/* Footer (only show when editing) */}
        {selected && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-gray-500">
              {unfilledCount > 0
                ? `${unfilledCount} field(s) still blank — please fill them in before saving.`
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
        )}
      </div>
    </div>
  );
}
