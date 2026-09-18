import React, { useEffect, useRef, useState } from 'react';
import { CopyPlus, DollarSign, Edit2, Layers, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import LineItemEditor from '@/components/LineItemEditor';
import type { LineItem, QuoteProjectTemplate, TeamMember } from '@/data/quoteData';
import { quoteProjectTemplates } from '@/data/quoteData';
import {
  createCustomTemplateId,
  isOwnerOrManager,
  loadCompanyCustomTemplates,
  saveCompanyCustomTemplates,
  type CustomQuoteProjectTemplate,
} from '@/lib/templateLibrary';
import { supabase } from '@/lib/supabase';

interface TemplateManagerPanelProps {
  companyId: string;
  userRole: TeamMember['role'];
}

type TemplateDraft = {
  id: string | null;
  name: string;
  description: string;
  projectType: QuoteProjectTemplate['projectType'];
  coverPageTitle: string;
  projectDescription: string;
  lineItems: LineItem[];
};

const createBlankDraft = (): TemplateDraft => ({
  id: null,
  name: '',
  description: '',
  projectType: 'exterior',
  coverPageTitle: 'Project Proposal',
  projectDescription: '',
  lineItems: [],
});

const templateToLineItems = (template: QuoteProjectTemplate): LineItem[] => {
  const seed = Date.now();
  return template.lineItems.map((item, index) => ({
    id: `tpl-${seed}-${index}`,
    quote_id: '',
    category: item.category || 'Other',
    item_name: item.item_name || '',
    description: item.description || '',
    unit: item.unit || 'each',
    quantity: item.quantity ?? 1,
    good_price: Number(item.good_price) || 0,
    better_price: Number(item.better_price) || 0,
    best_price: Number(item.best_price) || 0,
    sort_order: index,
  }));
};

const lineItemsToTemplateItems = (items: LineItem[]) => {
  return items
    .filter((item) => item.item_name.trim().length > 0)
    .map((item) => ({
      category: item.category || 'Other',
      item_name: item.item_name.trim(),
      description: item.description?.trim() || '',
      unit: item.unit || 'each',
      quantity: Number(item.quantity) || 1,
      good_price: Number(item.good_price) || 0,
      better_price: Number(item.better_price) || 0,
      best_price: Number(item.best_price) || 0,
    }));
};

// ── Price row for the inline price editor ─────────────────────────────────────
type PriceRow = {
  category: string;
  item_name: string;
  unit: string;
  good_price: number;
  better_price: number;
  best_price: number;
};

type PricingDraft = {
  templateName: string;
  rows: PriceRow[];
};

const TemplateManagerPanel: React.FC<TemplateManagerPanelProps> = ({ companyId, userRole }) => {
  const [customTemplates, setCustomTemplates] = useState<CustomQuoteProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft>(createBlankDraft());

  // ── Template price editor state ──────────────────────────────────────────────
  const [pricingDraft, setPricingDraft] = useState<PricingDraft | null>(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  const canManageTemplates = isOwnerOrManager(userRole);
  const editorRef = useRef<HTMLDivElement>(null);

  const scrollToEditor = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const scrollToPricing = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  // Open the focused price editor for a built-in or custom template.
  // Pre-fills from company_pricing if rows exist, else falls back to template defaults.
  const handleSetPrices = async (template: QuoteProjectTemplate | CustomQuoteProjectTemplate) => {
    // Close the line-item editor if open so only one panel shows at a time
    setEditorOpen(false);

    // Fetch any existing company_pricing rows for this company
    const itemNames = template.lineItems.map(li => li.item_name);
    const { data: existing } = await supabase
      .from('company_pricing')
      .select('category, item_name, unit, good_price, better_price, best_price')
      .eq('company_id', companyId)
      .in('item_name', itemNames);

    const existingMap = new Map<string, PriceRow>(
      (existing || []).map(r => [r.item_name, r as PriceRow])
    );

    const rows: PriceRow[] = template.lineItems
      .filter(li => li.item_name?.trim())
      .map(li => existingMap.get(li.item_name) ?? {
        category: li.category || 'Other',
        item_name: li.item_name,
        unit: li.unit || 'each',
        good_price: Number(li.good_price) || 0,
        better_price: Number(li.better_price) || 0,
        best_price: Number(li.best_price) || 0,
      });

    setPricingDraft({ templateName: template.name, rows });
    scrollToPricing();
  };

  const handleSavePrices = async () => {
    if (!pricingDraft || pricingSaving) return;
    setPricingSaving(true);
    try {
      // Upsert each row into company_pricing keyed by (company_id, category, item_name).
      // ON CONFLICT: update prices only — never touch other companies' rows.
      const payload = pricingDraft.rows.map(row => ({
        company_id: companyId,
        category: row.category,
        item_name: row.item_name,
        unit: row.unit,
        good_price: row.good_price,
        better_price: row.better_price,
        best_price: row.best_price,
        price_list_name: 'My Prices',
        list_enabled: true,
      }));

      const { error } = await supabase
        .from('company_pricing')
        .upsert(payload, { onConflict: 'company_id,category,item_name' });

      if (error) throw error;
      toast.success(`Prices saved for "${pricingDraft.templateName}" — your team's price list has been updated.`);
      setPricingDraft(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save prices.');
    } finally {
      setPricingSaving(false);
    }
  };

  const refreshTemplates = async () => {
    setLoading(true);
    try {
      const templates = await loadCompanyCustomTemplates(companyId);
      setCustomTemplates(templates);
    } catch {
      toast.error('Unable to load custom templates right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshTemplates();
  }, [companyId]);

  const handleStartNewTemplate = () => {
    setDraft(createBlankDraft());
    setEditorOpen(true);
    scrollToEditor();
  };

  const handleUseTemplateAsBase = (template: QuoteProjectTemplate) => {
    setDraft({
      id: null,
      name: `${template.name} Copy`,
      description: template.description || '',
      projectType: template.projectType,
      coverPageTitle: template.coverPageTitle || `${template.name} Proposal`,
      projectDescription: template.projectDescription || '',
      lineItems: templateToLineItems(template),
    });
    setEditorOpen(true);
    scrollToEditor();
  };

  const handleEditTemplate = (template: CustomQuoteProjectTemplate) => {
    setDraft({
      id: template.id,
      name: template.name,
      description: template.description || '',
      projectType: template.projectType,
      coverPageTitle: template.coverPageTitle || `${template.name} Proposal`,
      projectDescription: template.projectDescription || '',
      lineItems: templateToLineItems(template),
    });
    setEditorOpen(true);
    scrollToEditor();
  };

  const handleDuplicateTemplate = (template: CustomQuoteProjectTemplate) => {
    setDraft({
      id: null,
      name: `${template.name} Copy`,
      description: template.description || '',
      projectType: template.projectType,
      coverPageTitle: template.coverPageTitle || `${template.name} Proposal`,
      projectDescription: template.projectDescription || '',
      lineItems: templateToLineItems(template),
    });
    setEditorOpen(true);
    scrollToEditor();
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!canManageTemplates) return;
    if (!window.confirm('Delete this custom template?')) return;

    const nextTemplates = customTemplates.filter((template) => template.id !== templateId);
    setSaving(true);
    try {
      const result = await saveCompanyCustomTemplates(companyId, nextTemplates);
      setCustomTemplates(nextTemplates);

      if (!result.synced) {
        toast.warning('Template removed locally, but cloud sync failed. Try again later.');
      } else {
        toast.success('Template removed.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Unable to remove template.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!canManageTemplates || saving) return;

    const normalizedName = draft.name.trim();
    const normalizedDescription = draft.description.trim();
    const normalizedCoverTitle = draft.coverPageTitle.trim();
    const normalizedProjectDescription = draft.projectDescription.trim();
    const templateLineItems = lineItemsToTemplateItems(draft.lineItems);

    if (!normalizedName) {
      toast.error('Template name is required.');
      return;
    }

    if (templateLineItems.length === 0) {
      toast.error('Add at least one line item before saving.');
      return;
    }

    const now = new Date().toISOString();
    const templateToSave: CustomQuoteProjectTemplate = {
      id: draft.id || createCustomTemplateId(),
      name: normalizedName,
      description: normalizedDescription,
      projectType: draft.projectType,
      coverPageTitle: normalizedCoverTitle || `${normalizedName} Proposal`,
      projectDescription: normalizedProjectDescription,
      lineItems: templateLineItems,
      is_custom: true,
      created_at: draft.id
        ? customTemplates.find((template) => template.id === draft.id)?.created_at || now
        : now,
      updated_at: now,
    };

    const nextTemplates = draft.id
      ? customTemplates.map((template) => (template.id === draft.id ? templateToSave : template))
      : [templateToSave, ...customTemplates];

    setSaving(true);
    try {
      const result = await saveCompanyCustomTemplates(companyId, nextTemplates);
      setCustomTemplates(nextTemplates);
      setEditorOpen(false);
      setDraft(createBlankDraft());

      if (!result.synced) {
        toast.warning('Template saved locally, but cloud sync failed. Try again later.');
      } else {
        toast.success('Template saved.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Unable to save template right now.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManageTemplates) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900">Template Creator</h2>
          <p className="text-gray-600 mt-2">
            Only owners/admins and managers can create or edit project templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Template Creator & Editor</h2>
          <p className="text-gray-500 mt-1">
            Build reusable project templates (metal roofing, siding, repair scopes, and more).
          </p>
        </div>
        <button
          type="button"
          onClick={handleStartNewTemplate}
          className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white px-5 py-2.5 rounded-xl font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Custom Template
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-[#1e3a5f]" />
          <h3 className="text-lg font-semibold text-gray-900">Built-In Templates</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Use any built-in template as a starting point.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quoteProjectTemplates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">{template.name}</p>
              <p className="text-xs text-gray-600 mt-1">{template.description}</p>
              <p className="text-xs text-gray-500 mt-2">{template.lineItems.length} default line items</p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSetPrices(template)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Set Prices
                </button>
                <button
                  type="button"
                  onClick={() => handleUseTemplateAsBase(template)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1e3a5f] hover:underline"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  Use as Base
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Custom Templates</h3>
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : customTemplates.length === 0 ? (
          <p className="text-sm text-gray-500">No custom templates yet. Create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {customTemplates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{template.description || 'No description'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {template.projectType} · {template.lineItems.length} line items
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetPrices(template)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-sm text-emerald-700 transition-colors"
                    title="Set company prices for items in this template"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Set Prices
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateTemplate(template)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
                    title="Use as a starting point for a new template"
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTemplate(template)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(template.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-sm text-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Template Price Editor ────────────────────────────────────────────── */}
      {pricingDraft && (
        <div ref={pricingRef} className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Set Prices — {pricingDraft.templateName}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Prices are saved to your company's price list only. Other companies are never affected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPricingDraft(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-1/3">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Good Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Better Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Best Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingDraft.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.item_name}</p>
                      <p className="text-xs text-gray-400">{row.category}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{row.unit}</td>
                    {(['good_price', 'better_price', 'best_price'] as const).map(field => (
                      <td key={field} className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <span className="text-gray-400 mr-1 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row[field] || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setPricingDraft(prev => {
                                if (!prev) return prev;
                                const rows = [...prev.rows];
                                rows[idx] = { ...rows[idx], [field]: val };
                                return { ...prev, rows };
                              });
                            }}
                            className="w-24 text-right px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSavePrices}
              disabled={pricingSaving}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              {pricingSaving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-4 h-4" />}
              Save to My Price List
            </button>
            <p className="text-xs text-gray-400">
              Only your company sees these prices. Changes take effect on new quotes immediately.
            </p>
          </div>
        </div>
      )}

      {editorOpen && (
        <div ref={editorRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {draft.id ? 'Edit Custom Template' : 'Create Custom Template'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditorOpen(false);
                setDraft(createBlankDraft());
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                placeholder="Metal Roofing Upgrade"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
              <select
                value={draft.projectType}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    projectType: e.target.value as QuoteProjectTemplate['projectType'],
                  }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white"
              >
                <option value="exterior">Exterior</option>
                <option value="interior">Interior</option>
                <option value="both">Interior & Exterior</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
              placeholder="High-durability metal roof replacement package"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Page Title</label>
            <input
              type="text"
              value={draft.coverPageTitle}
              onChange={(e) => setDraft((prev) => ({ ...prev, coverPageTitle: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
              placeholder="Metal Roofing Proposal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
            <textarea
              rows={3}
              value={draft.projectDescription}
              onChange={(e) => setDraft((prev) => ({ ...prev, projectDescription: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
              placeholder="Describe the full scope loaded by this template..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
            <LineItemEditor
              items={draft.lineItems}
              onChange={(items) =>
                setDraft((prev) => ({
                  ...prev,
                  lineItems: items.map((item, index) => ({ ...item, sort_order: index })),
                }))
              }
            />
          </div>

          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Template
          </button>
        </div>
      )}
    </div>
  );
};

export default TemplateManagerPanel;
