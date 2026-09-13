// Copied from QuoteMGR (quotes-customize-manage/src/components/FinancingOptionsPanel.tsx)
// so both apps manage financing options the same way against the same table.
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, DollarSign, Check, X, ExternalLink, ChevronDown } from 'lucide-react';

interface FinancingOption {
    id: string;
    lender_name: string;
    program_name: string | null;
    apr_low: number | null;
    apr_high: number | null;
    term_months: number | null;
    notes: string | null;
    application_url: string | null;
    is_active: boolean;
    sort_order: number;
}

interface Props {
    companyId: string;
}

// Pre-filled presets for common roofing/home improvement lenders
const LENDER_PRESETS = [
    { name: 'GreenSky', url: 'https://www.greenskyonline.com/apply', program: 'Home Improvement Loan', apr: '6.99–25.99', term: 84 },
    { name: 'Hearth', url: 'https://www.hearth.com', program: 'Personal Loan', apr: '8.99–35.99', term: 120 },
    { name: 'Service Finance', url: 'https://www.servicefinanceco.com', program: 'Home Improvement Loan', apr: '9.99–21.99', term: 120 },
    { name: 'Synchrony Home', url: 'https://www.synchronyhome.com', program: 'Deferred Interest', apr: '0–26.99', term: 18 },
    { name: 'Foundation Finance', url: 'https://www.foundationfinance.com', program: 'Home Improvement Loan', apr: '7.99–24.99', term: 120 },
    { name: 'Sunlight Financial', url: 'https://www.sunlightfinancial.com', program: 'Home Improvement Loan', apr: '5.99–19.99', term: 144 },
];

const empty = {
    lender_name: '',
    program_name: '',
    apr_low: null as number | null,
    apr_high: null as number | null,
    term_months: null as number | null,
    notes: '',
    application_url: '',
    is_active: true,
};

const FinancingOptionsPanel: React.FC<Props> = ({ companyId }) => {
    const [options, setOptions] = useState<FinancingOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...empty });
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadOptions(); }, [companyId]);

    const loadOptions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financing_options')
                .select('*')
                .eq('company_id', companyId)
                .order('sort_order');
            if (error) throw error;
            setOptions(data || []);
        } catch {
            toast.error('Failed to load financing options');
        } finally {
            setLoading(false);
        }
    };

    const openNew = () => { setEditId(null); setForm({ ...empty }); setShowForm(true); setShowPresets(false); };

    const openEdit = (opt: FinancingOption) => {
        setEditId(opt.id);
        setForm({
            lender_name: opt.lender_name,
            program_name: opt.program_name || '',
            apr_low: opt.apr_low,
            apr_high: opt.apr_high,
            term_months: opt.term_months,
            notes: opt.notes || '',
            application_url: opt.application_url || '',
            is_active: opt.is_active,
        });
        setShowForm(true);
        setShowPresets(false);
    };

    const applyPreset = (preset: typeof LENDER_PRESETS[0]) => {
        const [low, high] = preset.apr.split('–').map(n => parseFloat(n));
        setForm({
            lender_name: preset.name,
            program_name: preset.program,
            apr_low: low || null,
            apr_high: high || null,
            term_months: preset.term,
            notes: '',
            application_url: preset.url,
            is_active: true,
        });
        setEditId(null);
        setShowForm(true);
        setShowPresets(false);
    };

    const closeForm = () => { setShowForm(false); setEditId(null); };

    const handleSave = async () => {
        if (!form.lender_name.trim()) { toast.error('Lender name is required'); return; }
        setSaving(true);
        try {
            const payload = {
                company_id: companyId,
                lender_name: form.lender_name.trim(),
                program_name: form.program_name?.trim() || null,
                apr_low: form.apr_low,
                apr_high: form.apr_high,
                term_months: form.term_months,
                notes: form.notes?.trim() || null,
                application_url: form.application_url?.trim() || null,
                is_active: form.is_active,
            };
            if (editId) {
                const { error } = await supabase.from('financing_options').update(payload).eq('id', editId);
                if (error) throw error;
                toast.success('Financing option updated');
            } else {
                const { error } = await supabase.from('financing_options').insert({ ...payload, sort_order: options.length });
                if (error) throw error;
                toast.success('Financing option added');
            }
            closeForm();
            loadOptions();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this financing option?')) return;
        try {
            const { error } = await supabase.from('financing_options').delete().eq('id', id);
            if (error) throw error;
            setOptions(prev => prev.filter(o => o.id !== id));
            toast.success('Deleted');
        } catch { toast.error('Failed to delete'); }
    };

    const toggleActive = async (opt: FinancingOption) => {
        try {
            await supabase.from('financing_options').update({ is_active: !opt.is_active }).eq('id', opt.id);
            setOptions(prev => prev.map(o => o.id === opt.id ? { ...o, is_active: !o.is_active } : o));
        } catch { toast.error('Failed to update'); }
    };

    const formatAPR = (low: number | null, high: number | null) => {
        if (low === null && high === null) return null;
        if (low !== null && high !== null && low !== high) return `${low}%–${high}% APR`;
        return `${low ?? high}% APR`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Financing Options</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Add lender programs — customers will see an <strong>Apply Now</strong> button on their quote.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowPresets(p => !p)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                        >
                            Quick Add <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {showPresets && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowPresets(false)} />
                                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20">
                                    <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Common Lenders</p>
                                    {LENDER_PRESETS.map(preset => (
                                        <button
                                            key={preset.name}
                                            onClick={() => applyPreset(preset)}
                                            className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{preset.name}</p>
                                                <p className="text-xs text-gray-400">{preset.program} · {preset.apr}% APR</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={openNew}
                        className="flex items-center gap-2 px-4 py-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Custom
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                    <h4 className="font-semibold text-gray-900">{editId ? 'Edit' : 'Add'} Financing Program</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Lender Name *</label>
                            <input type="text" value={form.lender_name}
                                onChange={e => setForm({ ...form, lender_name: e.target.value })}
                                placeholder="e.g. GreenSky"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Program Name</label>
                            <input type="text" value={form.program_name || ''}
                                onChange={e => setForm({ ...form, program_name: e.target.value })}
                                placeholder="e.g. 18 months same-as-cash"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">APR Range (%)</label>
                            <div className="flex items-center gap-2">
                                <input type="number" value={form.apr_low ?? ''} onChange={e => setForm({ ...form, apr_low: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="Low" min="0" step="0.1"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white" />
                                <span className="text-gray-400">–</span>
                                <input type="number" value={form.apr_high ?? ''} onChange={e => setForm({ ...form, apr_high: e.target.value ? parseFloat(e.target.value) : null })}
                                    placeholder="High" min="0" step="0.1"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Term (months)</label>
                            <input type="number" value={form.term_months ?? ''}
                                onChange={e => setForm({ ...form, term_months: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="e.g. 60, 120, 180" min="1"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Application URL <span className="text-gray-400 font-normal">(customers click "Apply Now" → taken here)</span>
                            </label>
                            <input type="url" value={form.application_url || ''}
                                onChange={e => setForm({ ...form, application_url: e.target.value })}
                                placeholder="https://lender.com/apply"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                                rows={2} placeholder="e.g. 0% for 18 months then 9.99% APR on approved credit"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white resize-none" />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                            <Check className="w-4 h-4" /> {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Program'}
                        </button>
                        <button onClick={closeForm} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : options.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No financing options yet</p>
                    <p className="text-xs text-gray-400 mt-1">Use "Quick Add" to add popular lenders in one click</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {options.map(opt => (
                        <div key={opt.id} className={`flex items-start gap-3 p-4 bg-white border rounded-xl transition-all ${opt.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${opt.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-900 text-sm">{opt.lender_name}</span>
                                    {opt.program_name && (
                                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{opt.program_name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                                    {formatAPR(opt.apr_low, opt.apr_high) && <span>{formatAPR(opt.apr_low, opt.apr_high)}</span>}
                                    {opt.term_months && <span>{opt.term_months} months</span>}
                                    {opt.application_url && (
                                        <a href={opt.application_url} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1 text-blue-500 hover:text-blue-700 font-medium" onClick={e => e.stopPropagation()}>
                                            <ExternalLink className="w-3 h-3" /> Apply link
                                        </a>
                                    )}
                                </div>
                                {opt.notes && <p className="text-xs text-gray-400 mt-1">{opt.notes}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => toggleActive(opt)}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${opt.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                    {opt.is_active ? 'Active' : 'Inactive'}
                                </button>
                                <button onClick={() => openEdit(opt)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                    <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                                </button>
                                <button onClick={() => handleDelete(opt.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FinancingOptionsPanel;
