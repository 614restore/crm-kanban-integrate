// ContactTemplateModal — pick a template, then open TemplateBuilder with the contact pre-loaded
import React, { useState, useMemo } from 'react';
import { X, FileText, DollarSign, Search } from 'lucide-react';
import {
  DocumentTemplate,
  getContractorEstimateTemplates,
} from '@/lib/contractorTemplates';
import { Contact, Document, getContactFullName } from '@/lib/crmData';
import TemplateBuilder from './TemplateBuilder';

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
  const templates = useMemo(() => getContractorEstimateTemplates(), []);
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(templates.map(t => t.category)))],
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = activeCategory === 'all' || t.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [templates, searchQuery, activeCategory]);

  // If a template is selected, show the live builder
  if (selected) {
    return (
      <TemplateBuilder
        template={selected}
        contact={contact}
        onClose={onClose}
        onDocumentSaved={(doc) => {
          onDocumentSaved(doc);
        }}
      />
    );
  }

  // Otherwise show template picker
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ height: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Choose a Template
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              For <span className="font-semibold text-gray-700">{getContactFullName(contact)}</span> — customer info will be auto-filled
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search + Category filter */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-3 flex-shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText size={32} className="mx-auto mb-2 opacity-40" />
              <p>No templates match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <DollarSign size={18} className="text-blue-700" />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-700'}`}>
                      {CATEGORY_LABELS[t.category] || t.category}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-700">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
