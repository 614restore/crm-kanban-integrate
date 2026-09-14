// Copied from QuoteMGR src/components/InvoiceBuilder.tsx (read-only reference).
// TrussCTR change: removes the "Also send Completion Certificate" option; the
// completion certificate function is not on the shared backend.
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, FileText, Send, Download, Check, Calendar, DollarSign, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { buildInvoicePDF, loadLogoAsBase64 as loadLogoBase64 } from '@/lib/buildInvoicePDF';

interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    sort_order: number;
    display_only?: boolean; // shows on invoice but excluded from total
}

interface InvoiceData {
    invoice_number: string;
    status: string;
    issued_date: string;
    due_date: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes: string;
    payment_instructions: string;
    deposit_required: number;
    deposit_paid: number;
    payment_terms: 'net30' | 'net60' | 'upon_receipt' | 'custom';
    project_start_date: string;
    project_completion_date: string;
    project_description: string;
}

interface PaymentRecord {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'received' | 'scheduled' | 'credit';
}

interface Props {
    quoteId: string;
    quoteNumber: string;
    selectedTier: 'good' | 'better' | 'best';
    includeBetter?: boolean;
    includeBest?: boolean;
    goodTotal?: number;
    betterTotal?: number;
    bestTotal?: number;
    useManualTotal?: boolean;
    goodTierName?: string;
    betterTierName?: string;
    bestTierName?: string;
    companyId: string;
    customerId?: string;
    customerName: string;
    customerEmail: string;
    customerAddress: string;
    company: {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        logo_url?: string;
    };
    onClose: () => void;
    onSaved: () => void;
    onTierChange?: (tier: 'good' | 'better' | 'best') => void;
}


const InvoiceBuilder: React.FC<Props> = ({
    quoteId, quoteNumber, selectedTier, includeBetter = true, includeBest = true,
    goodTotal, betterTotal, bestTotal, useManualTotal = false,
    goodTierName = 'Good', betterTierName = 'Better', bestTierName = 'Best',
    companyId, customerId,
    customerName, customerEmail, customerAddress, company, onClose, onSaved, onTierChange
}) => {

    const [currentTier, setCurrentTier] = useState<'good' | 'better' | 'best'>(selectedTier);
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);       // scope items from quote
    const [additionalItems, setAdditionalItems] = useState<InvoiceLineItem[]>([]); // manually added
    const [includeAddonsInTotal, setIncludeAddonsInTotal] = useState(false);
    const [showLineItems, setShowLineItems] = useState(true);
    const [invoice, setInvoice] = useState<InvoiceData>({
        invoice_number: '',
        status: 'draft',
        issued_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: 0,
        notes: '',
        payment_instructions: 'Make checks payable to ' + company.name + '. Payment due within 30 days.',
        deposit_required: 0,
        deposit_paid: 0,
        payment_terms: 'net30',
        project_start_date: '',
        project_completion_date: '',
        project_description: '',
    });
    const [hideItemPrices, setHideItemPrices] = useState(false);
    const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [logoData, setLogoData] = useState<string | null>(null);
    const [headerStyle, setHeaderStyle] = useState<'slim' | 'bold' | 'clean' | 'branded'>('slim');
    const [bannerColor, setBannerColor] = useState('#111111');
    const [headerCustomText, setHeaderCustomText] = useState('');

    useEffect(() => {
        loadQuoteLineItems();
        loadNextInvoiceNumber();
        if (company.logo_url) {
            loadLogoBase64(company.logo_url).then(setLogoData);
        }
    }, []);

    // Reload line items when tier changes
    useEffect(() => {
        loadQuoteLineItems();
    }, [currentTier]);

    const loadNextInvoiceNumber = async () => {
        const { data } = await supabase.rpc('get_next_invoice_number', { p_company_id: companyId });
        if (data) setInvoice(inv => ({ ...inv, invoice_number: data }));
    };

    const getTierKey = (tier: 'good' | 'better' | 'best'): 'good_price' | 'better_price' | 'best_price' => {
        return tier === 'good' ? 'good_price' : tier === 'better' ? 'better_price' : 'best_price';
    };

    const loadQuoteLineItems = async () => {
        setLoading(true);
        const tierKey = getTierKey(currentTier);
        const { data, error } = await supabase
            .from('quote_line_items')
            .select('*')
            .eq('quote_id', quoteId)
            .order('sort_order');

        if (!error && data) {
            // Filter to only items that apply to the selected tier — same logic as the PDF/quote renderer.
            // Items with no tiers_applicable (empty or null) are shared across all tiers.
            const tierItems = data.filter((item: any) => {
                const ta = item.tiers_applicable;
                return !ta || ta.length === 0 || ta.includes(currentTier);
            });

            const items: InvoiceLineItem[] = tierItems.map((item: any, i: number) => ({
                id: `new-${i}`,
                description: item.item_name + (item.description ? ` — ${item.description}` : ''),
                quantity: item.quantity || 1,
                unit_price: Number(item[tierKey]) || 0,
                total: Number(item[tierKey]) * (item.quantity || 1),
                sort_order: i,
            }));
            setLineItems(items);

            // Always use the tier total as the authoritative contract amount.
            // Line item prices are descriptive — they may not sum to the tier total
            // due to manual overrides, rounding, or tier-specific pricing.
            // recalcTotals already handles this correctly via the tierTotal lock.
            recalcTotals(items, invoice.tax_rate);
        }
        setLoading(false);
    };

    // Stores the BASE tier subtotal only (no addons). Display totals are computed below in the render.
    const recalcTotals = (items: InvoiceLineItem[], taxRate: number) => {
        const tierTotal = currentTier === 'good' ? goodTotal
                        : currentTier === 'better' ? betterTotal
                        : bestTotal;
        const subtotal = tierTotal != null
            ? tierTotal
            : items.filter(i => !i.display_only).reduce((sum, item) => sum + item.total, 0);
        const tax_amount = subtotal * (taxRate / 100);
        const total = subtotal + tax_amount;
        setInvoice(inv => ({ ...inv, subtotal, tax_amount, total }));
    };

    const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
        const updated = [...lineItems];
        (updated[index] as any)[field] = value;
        if (field === 'quantity' || field === 'unit_price') {
            updated[index].total = updated[index].quantity * updated[index].unit_price;
        }
        setLineItems(updated);
        recalcTotals(updated, invoice.tax_rate);
    };

    // Scope items (from quote) — kept for completeness but Add Item now goes to additionalItems
    const removeLineItem = (index: number) => {
        const updated = lineItems.filter((_, i) => i !== index);
        setLineItems(updated);
        recalcTotals(updated, invoice.tax_rate);
    };

    const addAdditionalItem = () => {
        setAdditionalItems(prev => [...prev, {
            id: `add-${Date.now()}`,
            description: '',
            quantity: 1,
            unit_price: 0,
            total: 0,
            sort_order: prev.length,
            display_only: true,
        }]);
    };

    const updateAdditionalItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
        setAdditionalItems(prev => {
            const updated = [...prev];
            (updated[index] as any)[field] = value;
            if (field === 'quantity' || field === 'unit_price') {
                updated[index].total = updated[index].quantity * updated[index].unit_price;
            }
            return updated;
        });
    };

    const removeAdditionalItem = (index: number) => {
        setAdditionalItems(prev => prev.filter((_, i) => i !== index));
    };

    // Display-only toggles for scope items
    const toggleDisplayOnly = (index: number) => {
        const updated = lineItems.map((item, i) =>
            i === index ? { ...item, display_only: !item.display_only } : item
        );
        setLineItems(updated);
        recalcTotals(updated, invoice.tax_rate);
    };

    const toggleAllDisplayOnly = () => {
        const allOn = lineItems.every(i => i.display_only);
        const updated = lineItems.map(i => ({ ...i, display_only: !allOn }));
        setLineItems(updated);
        recalcTotals(updated, invoice.tax_rate);
    };



    // Payment records helpers
    const addPaymentRecord = () => {
        setPaymentRecords(prev => [...prev, {
            id: `pr-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            description: '',
            amount: 0,
            type: 'received',
        }]);
    };

    const updatePaymentRecord = (id: string, field: keyof PaymentRecord, value: string | number) => {
        setPaymentRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const removePaymentRecord = (id: string) => {
        setPaymentRecords(prev => prev.filter(r => r.id !== id));
    };

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const buildPDF = () => {
        return buildInvoicePDF({
            invoice,
            company,
            customerName,
            customerEmail,
            customerAddress,
            lineItems,
            additionalItems,
            includeAddonsInTotal,
            showLineItems,
            hideItemPrices,
            headerStyle,
            bannerColor,
            headerCustomText,
            logoData,
            currentTier,
            goodTierName,
            betterTierName,
            bestTierName,
            displaySubtotal,
            displayTaxAmount,
            displayTotal,
            paymentRecords,
        });
    };

    const previewPDF = () => {
        const doc = buildPDF();
        const url = String(doc.output('bloburl'));
        window.open(url, '_blank');
    };

    const downloadPDF = () => {
        const doc = buildPDF();
        doc.save(`Invoice-${invoice.invoice_number}-${customerName.replace(/\s+/g, '-')}.pdf`);
    };

    const saveInvoice = async (sendToCustomer = false) => {
        setSaving(true);
        try {
            const { data: inv, error: invErr } = await supabase
                .from('invoices')
                .insert({
                    company_id: companyId,
                    quote_id: quoteId,
                    customer_id: customerId || null,
                    invoice_number: invoice.invoice_number,
                    status: sendToCustomer ? 'sent' : 'draft',
                    issued_date: invoice.issued_date,
                    due_date: invoice.due_date || null,
                    subtotal: displaySubtotal,
                    tax_rate: invoice.tax_rate,
                    tax_amount: displayTaxAmount,
                    total: displayTotal,
                    notes: invoice.notes,
                    payment_instructions: invoice.payment_instructions,
                    deposit_required: invoice.deposit_required,
                    deposit_paid: invoice.deposit_paid,
                    selected_tier: currentTier,
                    project_description: invoice.project_description || null,
                    project_start_date: invoice.project_start_date || null,
                    project_completion_date: invoice.project_completion_date || null,
                    payment_records: paymentRecords.length > 0 ? paymentRecords : null,
                })
                .select('id')
                .single();

            if (invErr) throw invErr;

            const allItems = [
                ...lineItems.map((item, i) => ({ ...item, sort_order: i, display_only: false, is_additional: false })),
                ...additionalItems.map((item, i) => ({ ...item, sort_order: lineItems.length + i, display_only: !includeAddonsInTotal, is_additional: true })),
            ];
            if (allItems.length > 0) {
                const { error: itemErr } = await supabase.from('invoice_line_items').insert(
                    allItems.map(item => ({
                        invoice_id: inv.id,
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.total,
                        sort_order: item.sort_order,
                        display_only: item.display_only,
                        is_additional: item.is_additional,
                    }))
                );
                if (itemErr) throw itemErr;
            }

            toast.success(`Invoice ${invoice.invoice_number} saved!`);
            if (sendToCustomer && customerEmail) {
              const { error: emailErr } = await supabase.functions.invoke('send-invoice-email', {
                body: {
                  company_id: companyId,
                  to_email: customerEmail,
                  to_name: customerName,
                  from_company: company.name,
                  invoice_number: invoice.invoice_number,
                  invoice_total: displayTotal,
                  due_date: invoice.due_date,
                  payment_instructions: invoice.payment_instructions,
                  line_items: [
                    ...lineItems.map(li => ({ description: li.description, quantity: li.quantity, unit_price: li.unit_price, total: li.total })),
                    ...additionalItems.map(li => ({ description: li.description, quantity: li.quantity, unit_price: li.unit_price, total: li.total })),
                  ],
                },
              });
              if (emailErr) {
                toast.error('Invoice saved but email failed: ' + emailErr.message);
              } else {
                toast.success('Invoice emailed to ' + customerEmail);
              }

            }
            onSaved();
        } catch (err: any) {
            toast.error('Failed to save invoice: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Computed display totals — always reflect current state, no manual sync needed ──
    const _addonsSum = includeAddonsInTotal ? additionalItems.reduce((s, i) => s + i.total, 0) : 0;
    const displaySubtotal = invoice.subtotal + _addonsSum;
    const displayTaxAmount = displaySubtotal * (invoice.tax_rate / 100);
    const displayTotal = displaySubtotal + displayTaxAmount;

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-0 sm:p-4">
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-4xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1e3a5f] rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Create Invoice</h2>
                            <p className="text-sm text-gray-500">From Quote {quoteNumber} · {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} tier</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
                    {/* Tier Selection — always visible, shows price for each active tier */}
                    {(() => {
                        const tierColors: Record<string, string> = { good: 'emerald', better: 'blue', best: 'amber' };
                        const activeTierList = ([
                            { key: 'good' as const,   label: goodTierName,   total: goodTotal,   color: 'border-emerald-300 bg-emerald-50', selectedBg: 'bg-emerald-600 border-emerald-600', badge: null },
                            { key: 'better' as const, label: betterTierName, total: betterTotal, color: 'border-blue-300 bg-blue-50',       selectedBg: 'bg-blue-600 border-blue-600',       badge: 'RECOMMENDED' },
                            { key: 'best' as const,   label: bestTierName,   total: bestTotal,   color: 'border-amber-300 bg-amber-50',     selectedBg: 'bg-amber-600 border-amber-600',     badge: 'BEST VALUE' },
                        ] as const).filter(t =>
                            t.key === 'good' || (t.key === 'better' && includeBetter) || (t.key === 'best' && includeBest)
                        );
                        const isSelected = (key: string) => currentTier === key;
                        const fmtTotal = (n?: number) => n != null ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : null;
                        return (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Option to Invoice</span>
                                    {activeTierList.length === 1 && (
                                        <span className="text-xs text-gray-400">Single-option quote</span>
                                    )}
                                </div>
                                <div className={`grid gap-3 p-4 ${activeTierList.length === 1 ? 'grid-cols-1' : activeTierList.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                    {activeTierList.map(tier => (
                                        <button
                                            key={tier.key}
                                            onClick={() => { setCurrentTier(tier.key); onTierChange?.(tier.key); }}
                                            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                                                isSelected(tier.key)
                                                    ? tier.selectedBg + ' text-white shadow-lg scale-[1.02]'
                                                    : tier.color + ' hover:scale-[1.01]'
                                            }`}
                                        >
                                            {tier.badge && (
                                                <span className={`absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    isSelected(tier.key) ? 'bg-white/20 text-white' : 'bg-white text-gray-500 border border-gray-200'
                                                }`}>{tier.badge}</span>
                                            )}
                                            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isSelected(tier.key) ? 'text-white/80' : 'text-gray-500'}`}>
                                                {tier.label}
                                            </p>
                                            {fmtTotal(tier.total) ? (
                                                <p className={`text-xl font-bold ${isSelected(tier.key) ? 'text-white' : 'text-gray-900'}`}>
                                                    {fmtTotal(tier.total)}
                                                </p>
                                            ) : (
                                                <p className={`text-sm font-medium ${isSelected(tier.key) ? 'text-white/70' : 'text-gray-400'}`}>
                                                    Calculated from items
                                                </p>
                                            )}
                                            {isSelected(tier.key) && (
                                                <div className="absolute top-3 right-3 w-5 h-5 bg-white/30 rounded-full flex items-center justify-center">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Invoice Meta */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice #</label>
                            <input value={invoice.invoice_number} onChange={e => setInvoice(i => ({ ...i, invoice_number: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Issued Date</label>
                            <input type="date" value={invoice.issued_date} onChange={e => setInvoice(i => ({ ...i, issued_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                            <input type="date" value={invoice.due_date} onChange={e => setInvoice(i => ({ ...i, due_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Tax Rate (%)</label>
                            <input type="number" min="0" max="30" step="0.1"
                                value={invoice.tax_rate}
                                onChange={e => {
                                    const rate = parseFloat(e.target.value) || 0;
                                    setInvoice(i => ({ ...i, tax_rate: rate }));
                                    recalcTotals(lineItems, rate);
                                }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                    </div>

                    {/* Project Label */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                            Project Label <span className="font-normal text-gray-400">(appears as the first line item on the invoice)</span>
                        </label>
                        <input
                            value={invoice.project_description}
                            onChange={e => setInvoice(i => ({ ...i, project_description: e.target.value }))}
                            placeholder="e.g. Roofing Project, Gutter Installation, Siding Replacement…"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none"
                        />
                    </div>

                    {/* Bill To */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Bill To</h3>
                        <p className="text-sm text-gray-900 font-medium">{customerName}</p>
                        {customerEmail && <p className="text-sm text-gray-500">{customerEmail}</p>}
                        {customerAddress && <p className="text-sm text-gray-500">{customerAddress}</p>}
                    </div>

                    {/* Invoice Header Style Picker */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Header Style</span>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Style cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {([
                                    { key: 'slim',    label: 'Slim',    desc: 'Compact dark band'    },
                                    { key: 'bold',    label: 'Bold',    desc: 'Full-height banner'   },
                                    { key: 'clean',   label: 'Clean',   desc: 'Minimal & professional' },
                                    { key: 'branded', label: 'Branded', desc: 'Large logo hero'      },
                                ] as { key: 'slim'|'bold'|'clean'|'branded'; label: string; desc: string }[]).map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => setHeaderStyle(s.key)}
                                        className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                                            headerStyle === s.key
                                                ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        {/* Mini visual preview */}
                                        <div className="rounded overflow-hidden mb-2 h-10 bg-gray-100 relative">
                                            {s.key === 'slim' && (
                                                <>
                                                    <div className="absolute top-0 left-0 right-0" style={{ height: '68%', backgroundColor: bannerColor }} />
                                                    <div className="absolute left-0 right-0 h-0.5" style={{ top: '68%', backgroundColor: '#dc2626' }} />
                                                </>
                                            )}
                                            {s.key === 'bold' && (
                                                <div className="absolute inset-0" style={{ backgroundColor: bannerColor }}>
                                                    <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: '#dc2626' }} />
                                                </div>
                                            )}
                                            {s.key === 'clean' && (
                                                <>
                                                    <div className="absolute inset-0 bg-white" />
                                                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: bannerColor }} />
                                                    <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: bannerColor }} />
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-3 rounded-sm opacity-30" style={{ backgroundColor: bannerColor }} />
                                                </>
                                            )}
                                            {s.key === 'branded' && (
                                                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: bannerColor }}>
                                                    <div className="w-10 h-6 bg-white/25 rounded" />
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-xs font-semibold ${headerStyle === s.key ? 'text-[#1e3a5f]' : 'text-gray-700'}`}>{s.label}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
                                    </button>
                                ))}
                            </div>

                            {/* Color swatches */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-500 mr-1">Color</span>
                                {['#111111', '#1e3a5f', '#dc2626', '#16a34a', '#7c3aed', '#0284c7', '#b45309', '#374151'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBannerColor(c)}
                                        title={c}
                                        style={{ backgroundColor: c }}
                                        className={`w-6 h-6 rounded-full transition-all ${bannerColor === c ? 'ring-2 ring-offset-2 ring-gray-700 scale-110' : 'opacity-75 hover:opacity-100 hover:scale-105'}`}
                                    />
                                ))}
                                {/* Custom color picker */}
                                <label className="w-6 h-6 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center" title="Pick custom color">
                                    <input type="color" value={bannerColor} onChange={e => setBannerColor(e.target.value)} className="opacity-0 absolute w-px h-px" />
                                    <span className="text-[9px] text-gray-400 font-bold leading-none pointer-events-none">+</span>
                                </label>
                                <span className="text-xs text-gray-400 font-mono">{bannerColor}</span>
                            </div>

                            {/* Custom header text */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Custom Header Text{' '}
                                    <span className="font-normal text-gray-400">(optional — defaults to your company name)</span>
                                </label>
                                <input
                                    value={headerCustomText}
                                    onChange={e => setHeaderCustomText(e.target.value)}
                                    placeholder={company.name}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Manual total notice */}
                    {useManualTotal && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                            <span className="mt-0.5">⚠️</span>
                            <span>This quote uses a <strong>manually set total</strong>. The invoice total matches the agreed price — individual line item prices may differ.</span>
                        </div>
                    )}

                    {/* Scope of Work — line items pulled from the quote, total is always the tier contract price */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-gray-700">Scope of Work</h3>
                                {/* Itemized / Total Only toggle */}
                                <button
                                    onClick={() => setShowLineItems(v => !v)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                        showLineItems
                                            ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                                            : 'bg-gray-100 text-gray-500 border-gray-200'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${showLineItems ? 'bg-white' : 'bg-gray-400'}`} />
                                    {showLineItems ? 'Itemized' : 'Total Only'}
                                </button>
                                {/* Hide Prices toggle — only relevant when itemized */}
                                {showLineItems && (
                                    <button
                                        onClick={() => setHideItemPrices(v => !v)}
                                        title={hideItemPrices ? 'Prices hidden from invoice PDF' : 'Prices shown on invoice PDF'}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                            hideItemPrices
                                                ? 'bg-rose-50 text-rose-600 border-rose-200'
                                                : 'bg-gray-100 text-gray-500 border-gray-200'
                                        }`}
                                    >
                                        {hideItemPrices ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        {hideItemPrices ? 'Prices Hidden' : 'Show Prices'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-gray-400 text-sm">Loading quote items…</div>
                        ) : showLineItems ? (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                {/* Desktop column headers — hidden on mobile */}
                                <div className="hidden sm:grid grid-cols-12 gap-0 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-200">
                                    <div className="col-span-5">Description</div>
                                    <div className="col-span-2 text-center">Qty</div>
                                    <div className="col-span-2 text-right">Unit Price</div>
                                    <div className="col-span-1 text-right">Total</div>
                                    <div className="col-span-2 text-center">Display Only</div>
                                </div>
                                {/* Mobile column headers */}
                                <div className="sm:hidden grid grid-cols-2 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-200">
                                    <div>Description</div>
                                    <div className="text-right">Total</div>
                                </div>

                                {lineItems.map((item, index) => (
                                    <div key={item.id} className={`border-b border-gray-100 ${item.display_only ? 'bg-amber-50/40' : ''}`}>
                                        {/* ── Mobile layout ── */}
                                        <div className="sm:hidden px-3 py-1.5 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <input value={item.description} onChange={e => updateLineItem(index, 'description', e.target.value)}
                                                    placeholder="Item description…"
                                                    className={`flex-1 text-sm border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5 min-w-0 ${item.display_only ? 'text-gray-400 italic' : ''}`} />
                                                <span className={`text-sm font-semibold shrink-0 ${item.display_only ? 'text-gray-400' : 'text-gray-900'}`}>
                                                    ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <span>Qty</span>
                                                <input type="number" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-12 text-xs text-center border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-[#1e3a5f]" />
                                                <span>@ $</span>
                                                <input type="number" value={item.unit_price} onChange={e => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="w-20 text-xs text-right border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-[#1e3a5f]" />
                                                <div className="flex items-center gap-2 ml-auto">
                                                    <button
                                                        title={item.display_only ? 'Mark as included' : 'Mark as display-only'}
                                                        onClick={() => toggleDisplayOnly(index)}
                                                        className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${item.display_only ? 'bg-amber-400' : 'bg-gray-200'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${item.display_only ? 'left-4' : 'left-0.5'}`} />
                                                    </button>
                                                    <button onClick={() => removeLineItem(index)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Desktop layout ── */}
                                        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 items-center">
                                            <div className="col-span-5">
                                                <input value={item.description} onChange={e => updateLineItem(index, 'description', e.target.value)}
                                                    placeholder="Item description…"
                                                    className={`w-full text-sm border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5 ${item.display_only ? 'text-gray-400 italic' : ''}`} />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full text-sm text-center border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5" />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" value={item.unit_price} onChange={e => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="w-full text-sm text-right border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5" />
                                            </div>
                                            <div className={`col-span-1 text-right text-sm font-medium ${item.display_only ? 'text-gray-400' : 'text-gray-900'}`}>
                                                ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="col-span-2 flex items-center justify-center gap-2">
                                                <button
                                                    title={item.display_only ? 'Mark as included in total' : 'Mark as display-only (informational)'}
                                                    onClick={() => toggleDisplayOnly(index)}
                                                    className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${item.display_only ? 'bg-amber-400' : 'bg-gray-200'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${item.display_only ? 'left-4' : 'left-0.5'}`} />
                                                </button>
                                                <button onClick={() => removeLineItem(index)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Select All / Clear All for Display Only */}
                                {lineItems.length > 1 && (
                                    <div className="flex items-center justify-end gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                                        <span className="text-xs text-gray-400">Display Only:</span>
                                        <button
                                            onClick={toggleAllDisplayOnly}
                                            className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full transition-colors"
                                        >
                                            {lineItems.every(i => i.display_only) ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>
                                )}

                                {/* Totals */}
                                <div className="px-4 py-3 bg-gray-50 space-y-1">
                                    {includeAddonsInTotal && additionalItems.length > 0 && (() => {
                                        const addonsSum = additionalItems.reduce((s, i) => s + i.total, 0);
                                        return (
                                            <>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Base Project</span>
                                                    <span>{fmt(displaySubtotal)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm text-emerald-600">
                                                    <span>Additional Items</span>
                                                    <span>+ {fmt(addonsSum)}</span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal</span>
                                        <span>{fmt(displaySubtotal)}</span>
                                    </div>
                                    {invoice.tax_rate > 0 && (
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Tax ({invoice.tax_rate}%)</span>
                                            <span>{fmt(displayTaxAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
                                        <span>Total Due</span>
                                        <span className="text-[#1e3a5f]">{fmt(displayTotal)}</span>
                                    </div>
                                    {invoice.deposit_required > 0 && (
                                        <>
                                            <div className="flex justify-between text-sm font-semibold text-blue-700 pt-1">
                                                <span>Down Payment Required</span>
                                                <span>{fmt(invoice.deposit_required)}</span>
                                            </div>
                                            {invoice.deposit_paid > 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm text-emerald-600">
                                                        <span>Deposit Paid</span>
                                                        <span>− {fmt(invoice.deposit_paid)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                                                        <span>Balance Due</span>
                                                        <span className="text-[#1e3a5f]">{fmt(displayTotal - invoice.deposit_paid)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Summary-only view */
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                    <p className="text-xs text-gray-400">Line items hidden — customer sees total amount only</p>
                                </div>
                                <div className="px-4 py-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Project Total</span>
                                        <span className="text-sm text-gray-900">{fmt(displaySubtotal)}</span>
                                    </div>
                                    {invoice.tax_rate > 0 && (
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Tax ({invoice.tax_rate}%)</span>
                                            <span>{fmt(displayTaxAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                        <span className="text-base font-bold text-gray-900">Total Due</span>
                                        <span className="text-base font-bold text-[#1e3a5f]">{fmt(displayTotal)}</span>
                                    </div>
                                    {invoice.deposit_required > 0 && (
                                        <>
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="text-sm font-semibold text-blue-700">Down Payment Required</span>
                                                <span className="text-sm font-semibold text-blue-700">{fmt(invoice.deposit_required)}</span>
                                            </div>
                                            {invoice.deposit_paid > 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm text-emerald-600">
                                                        <span>Deposit Paid</span>
                                                        <span>− {fmt(invoice.deposit_paid)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                                                        <span>Balance Due</span>
                                                        <span className="text-[#1e3a5f]">{fmt(displayTotal - invoice.deposit_paid)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Additional Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-700">Additional Items</h3>
                            <button onClick={addAdditionalItem}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Add Item
                            </button>
                        </div>

                        {/* Prominent include-in-total checkbox */}
                        <button
                            onClick={() => setIncludeAddonsInTotal(v => !v)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 mb-3 transition-all text-left ${
                                includeAddonsInTotal
                                    ? 'border-emerald-400 bg-emerald-50'
                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                            <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all ${
                                includeAddonsInTotal
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-gray-400 bg-white'
                            }`}>
                                {includeAddonsInTotal && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <div>
                                <p className={`text-sm font-semibold ${includeAddonsInTotal ? 'text-emerald-800' : 'text-gray-700'}`}>
                                    {includeAddonsInTotal ? 'Additional items ARE included in the project total' : 'Add additional items to the project total'}
                                </p>
                                <p className={`text-xs mt-0.5 ${includeAddonsInTotal ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {includeAddonsInTotal
                                        ? `+${fmt(_addonsSum)} added — Invoice total is now ${fmt(displayTotal)}`
                                        : 'Check this box to include these charges in the invoice total (e.g. upgrades, change orders)'}
                                </p>
                            </div>
                        </button>

                        {additionalItems.length === 0 ? (
                            <div className="border-2 border-dashed border-amber-200 rounded-xl py-6 text-center">
                                <p className="text-sm text-amber-500 font-medium">No additional items yet — click Add Item above.</p>
                                <p className="text-xs text-gray-400 mt-1 px-6">Use this for upgrades, change orders, deductibles, or any extra charges.</p>
                            </div>
                        ) : (
                            <div className="border border-amber-200 rounded-xl overflow-hidden">
                                <div className="grid grid-cols-12 gap-0 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 border-b border-amber-200">
                                    <div className="col-span-6">Description</div>
                                    <div className="col-span-2 text-center">Qty</div>
                                    <div className="col-span-2 text-right">Unit Price</div>
                                    <div className="col-span-1 text-right">Amount</div>
                                    <div className="col-span-1" />
                                </div>
                                {additionalItems.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-amber-100 items-center bg-amber-50/30">
                                        <div className="col-span-6">
                                            <input value={item.description} onChange={e => updateAdditionalItem(index, 'description', e.target.value)}
                                                placeholder="e.g. Deductible, Recoverable Depreciation…"
                                                className="w-full text-sm border-0 outline-none bg-transparent focus:bg-amber-50 rounded px-1 py-0.5 text-gray-700" />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="number" value={item.quantity} onChange={e => updateAdditionalItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-full text-sm text-center border-0 outline-none bg-transparent focus:bg-amber-50 rounded px-1 py-0.5" />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="number" value={item.unit_price} onChange={e => updateAdditionalItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="w-full text-sm text-right border-0 outline-none bg-transparent focus:bg-amber-50 rounded px-1 py-0.5" />
                                        </div>
                                        <div className="col-span-1 text-right text-sm font-medium text-amber-700">
                                            ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button onClick={() => removeAdditionalItem(index)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className={`px-4 py-2.5 border-t ${includeAddonsInTotal ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <p className={`text-xs italic ${includeAddonsInTotal ? 'text-emerald-700' : 'text-amber-600'}`}>
                                        {includeAddonsInTotal
                                            ? `These amounts are included in the project total (+${fmt(additionalItems.reduce((s, i) => s + i.total, 0))}).`
                                            : 'These amounts are shown for reference only. The project total above is not affected.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment Tracking */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Terms</label>
                            <select value={invoice.payment_terms}
                                onChange={e => setInvoice(i => ({ ...i, payment_terms: e.target.value as any }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none">
                                <option value="net30">Net 30</option>
                                <option value="net60">Net 60</option>
                                <option value="upon_receipt">Upon Receipt</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Deposit Required ($)</label>
                            <input type="number" min="0" step="0.01"
                                value={invoice.deposit_required}
                                onChange={e => setInvoice(i => ({ ...i, deposit_required: parseFloat(e.target.value) || 0 }))}
                                placeholder="0.00"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Deposit Paid ($)</label>
                            <input type="number" min="0" step="0.01"
                                value={invoice.deposit_paid}
                                onChange={e => setInvoice(i => ({ ...i, deposit_paid: parseFloat(e.target.value) || 0 }))}
                                placeholder="0.00"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                    </div>

                    {/* Project Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Project Start Date</span>
                            </label>
                            <input type="date" value={invoice.project_start_date}
                                onChange={e => setInvoice(i => ({ ...i, project_start_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Est. Completion Date</span>
                            </label>
                            <input type="date" value={invoice.project_completion_date}
                                onChange={e => setInvoice(i => ({ ...i, project_completion_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                        </div>
                    </div>

                    {/* Payment History */}
                    {(() => {
                        // Total is always the tier-based contract amount — payment records
                        // are informational only and never modify the invoice total.
                        const totalReceived = paymentRecords
                            .filter(r => r.type === 'received' || r.type === 'credit')
                            .reduce((s, r) => s + r.amount, 0);
                        const balanceDue = displayTotal - totalReceived;

                        const typeStyles: Record<string, string> = {
                            received:  'bg-emerald-50 text-emerald-700 border-emerald-200',
                            scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
                            credit:    'bg-purple-50 text-purple-700 border-purple-200',
                        };

                        return (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-gray-500" />
                                        <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
                                        <span className="text-xs text-gray-400">dates, amounts received, upcoming payments</span>
                                    </div>
                                    <button onClick={addPaymentRecord}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1e3a5f] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Add Entry
                                    </button>
                                </div>

                                {paymentRecords.length === 0 ? (
                                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-6 text-center">
                                        <p className="text-sm text-gray-400">No payment entries yet.</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Track deposits received, progress payments, balance due dates, and more.</p>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        {/* Header */}
                                        <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                                            <div className="col-span-2">Date</div>
                                            <div className="col-span-4">Description</div>
                                            <div className="col-span-3">Type</div>
                                            <div className="col-span-2 text-right">Amount</div>
                                            <div className="col-span-1" />
                                        </div>

                                        {/* Rows */}
                                        {paymentRecords.map(record => (
                                            <div key={record.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-gray-100 items-center">
                                                <div className="col-span-2">
                                                    <input type="date" value={record.date}
                                                        onChange={e => updatePaymentRecord(record.id, 'date', e.target.value)}
                                                        className="w-full text-xs border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5" />
                                                </div>
                                                <div className="col-span-4">
                                                    <input value={record.description}
                                                        onChange={e => updatePaymentRecord(record.id, 'description', e.target.value)}
                                                        placeholder="e.g. Deposit received…"
                                                        className="w-full text-sm border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5" />
                                                </div>
                                                <div className="col-span-3">
                                                    <div className="relative">
                                                        <select value={record.type}
                                                            onChange={e => updatePaymentRecord(record.id, 'type', e.target.value)}
                                                            className={`w-full appearance-none text-xs border rounded-full px-2 py-1 pr-5 font-medium outline-none ${typeStyles[record.type]}`}>
                                                            <option value="received">Received</option>
                                                            <option value="scheduled">Scheduled</option>
                                                            <option value="credit">Credit</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <input type="number" min={0} step={0.01} value={record.amount}
                                                        onChange={e => updatePaymentRecord(record.id, 'amount', parseFloat(e.target.value) || 0)}
                                                        className="w-full text-sm text-right border-0 outline-none bg-transparent focus:bg-blue-50 rounded px-1 py-0.5" />
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button onClick={() => removePaymentRecord(record.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Balance summary */}
                                        <div className="px-4 py-3 bg-gray-50 space-y-1.5">
                                            <div className="flex justify-between text-sm text-gray-600">
                                                <span>Contract Total</span>
                                                <span className="font-medium">{fmt(displayTotal)}</span>
                                            </div>
                                            {totalReceived > 0 && (
                                                <div className="flex justify-between text-sm text-emerald-600">
                                                    <span>Total Received</span>
                                                    <span className="font-medium">− {fmt(totalReceived)}</span>
                                                </div>
                                            )}
                                            <div className={`flex justify-between text-base font-bold pt-1.5 border-t border-gray-200 ${balanceDue <= 0 ? 'text-emerald-600' : 'text-[#1e3a5f]'}`}>
                                                <span>{balanceDue <= 0 ? 'Paid in Full ✓' : 'Balance Due'}</span>
                                                <span>{balanceDue <= 0 ? fmt(0) : fmt(balanceDue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Notes & Payment Instructions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Instructions</label>
                            <textarea value={invoice.payment_instructions}
                                onChange={e => setInvoice(i => ({ ...i, payment_instructions: e.target.value }))}
                                rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none resize-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                            <textarea value={invoice.notes}
                                onChange={e => setInvoice(i => ({ ...i, notes: e.target.value }))}
                                rows={3} placeholder="Thank you for your business…"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none resize-none" />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row gap-3 px-6 py-4">
                    <button onClick={previewPDF}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <FileText className="w-4 h-4" /> Preview
                    </button>
                    <button onClick={() => { saveInvoice(false); downloadPDF(); }} disabled={saving}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                        <Download className="w-4 h-4" /> Save & Download
                    </button>
                    <button onClick={() => saveInvoice(true)} disabled={saving || !customerEmail}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ff6b35] hover:bg-[#e55a2b] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-orange-200">
                        <Send className="w-4 h-4" />{saving ? 'Saving…' : 'Save & Email to Customer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceBuilder;
