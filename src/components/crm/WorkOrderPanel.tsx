// Copied from QuoteMGR (quotes-customize-manage/src/components/WorkOrderPanel.tsx)
// so a signed quote becomes a work order the same way in both apps.
import React, { useState, useEffect } from 'react';
import { X, ClipboardList, Building2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { foldDocumentText } from '@/lib/pdfGenerator';
import autoTable from 'jspdf-autotable';
import type { RoofrStructureSummary } from '@/lib/roofrReport';

interface Props {
    quoteId: string;
    quoteNumber: string;
    companyId: string;
    customerId?: string;
    customerName: string;
    customerAddress: string;
    projectDescription: string;
    signedTier?: 'good' | 'better' | 'best';
    company: {
        name: string;
        phone?: string;
        email?: string;
        license_number?: string;
    };
    onClose: () => void;
    onSaved: () => void;
}

const WorkOrderPanel: React.FC<Props> = ({
    quoteId, quoteNumber, companyId, customerId,
    customerName, customerAddress, projectDescription,
    signedTier, company, onClose, onSaved,
}) => {
    const [selectedTier, setSelectedTier] = useState<'good' | 'better' | 'best'>(signedTier ?? 'good');
    const [scheduledDate, setScheduledDate] = useState('');
    const [crewNotes, setCrewNotes] = useState('');
    const [workOrderNumber, setWorkOrderNumber] = useState('');
    const [lineItems, setLineItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [structures, setStructures] = useState<RoofrStructureSummary[]>([]);
    const [selectedStructureIdx, setSelectedStructureIdx] = useState<number | null>(null); // null = all

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [{ data: items }, { data: num }, { data: quoteRow }] = await Promise.all([
            supabase.from('quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order'),
            supabase.rpc('get_next_work_order_number', { p_company_id: companyId }),
            supabase.from('quotes').select('measurement_data, measurement_provider').eq('id', quoteId).single(),
        ]);
        if (items) setLineItems(items);
        if (num) {
            setWorkOrderNumber(num);
        } else {
            // The shared backend has no get_next_work_order_number(), so the RPC
            // returns nothing. Number it the way quotes are numbered instead.
            const { count } = await supabase
                .from('work_orders')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', companyId);
            setWorkOrderNumber(`WO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`);
        }
        if (quoteRow?.measurement_data) {
            const data = quoteRow.measurement_data as any;
            const structureList: RoofrStructureSummary[] = Array.isArray(data.structures)
                ? data.structures.filter((s: any) => s.totalRoofAreaSqft > 0)
                : [];
            setStructures(structureList);
            if (structureList.length > 1) setSelectedStructureIdx(0);
        }
        setLoading(false);
    };

    const tierLabel = { good: 'Good', better: 'Better', best: 'Best' };

    const isDividerItem = (item: any) =>
        item.quantity === 0 && item.unit === '' && item.description === '';

    const visibleItems = (() => {
        if (selectedStructureIdx === null || structures.length <= 1) return lineItems;

        const targetLabel = `Structure ${structures[selectedStructureIdx].structureNumber}`;
        const hasDividers = lineItems.some(isDividerItem);
        if (!hasDividers) return lineItems;

        const startIdx = lineItems.findIndex(
            (item) => isDividerItem(item) && item.item_name === targetLabel,
        );
        if (startIdx === -1) return lineItems;

        const endIdx = lineItems.findIndex(
            (item, i) => i > startIdx && isDividerItem(item),
        );
        return lineItems.slice(startIdx + 1, endIdx === -1 ? undefined : endIdx);
    })();

    const selectedStructure = selectedStructureIdx !== null ? structures[selectedStructureIdx] : null;

    const buildPDF = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        foldDocumentText(doc);
        const pageW = doc.internal.pageSize.getWidth();

        // Header bar
        doc.setFillColor(30, 58, 95);
        doc.rect(0, 0, pageW, 32, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('WORK ORDER', pageW - 15, 14, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(company.name, 15, 12);
        if (company.phone) doc.text(company.phone, 15, 18);
        if (company.license_number) doc.text('Lic: ' + company.license_number, 15, 24);

        // Meta
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(9);
        let y = 42;
        const leftX = 15;
        const rightX = pageW / 2 + 5;

        // Left column
        doc.setFont('helvetica', 'bold'); doc.text('Work Order #', leftX, y); doc.setFont('helvetica', 'normal'); doc.text(workOrderNumber, leftX + 28, y);
        y += 6; doc.setFont('helvetica', 'bold'); doc.text('Quote Ref', leftX, y); doc.setFont('helvetica', 'normal'); doc.text(quoteNumber, leftX + 28, y);
        y += 6; doc.setFont('helvetica', 'bold'); doc.text('Tier', leftX, y); doc.setFont('helvetica', 'normal'); doc.text(tierLabel[selectedTier], leftX + 28, y);

        // Right column
        y = 42;
        doc.setFont('helvetica', 'bold'); doc.text('Scheduled', rightX, y); doc.setFont('helvetica', 'normal'); doc.text(scheduledDate || 'TBD', rightX + 28, y);
        y += 6; doc.setFont('helvetica', 'bold'); doc.text('Customer', rightX, y); doc.setFont('helvetica', 'normal'); doc.text(customerName, rightX + 28, y);
        y += 6; doc.setFont('helvetica', 'bold'); doc.text('Address', rightX, y); doc.setFont('helvetica', 'normal'); doc.text(customerAddress || 'See quote', rightX + 28, y);
        if (selectedStructure) {
            y += 6;
            const buildingLabel = `Structure ${selectedStructure.structureNumber} — ${selectedStructure.totalRoofAreaSqft.toLocaleString()} sqft`;
            doc.setFont('helvetica', 'bold'); doc.text('Building', rightX, y); doc.setFont('helvetica', 'normal'); doc.text(buildingLabel, rightX + 28, y);
        }

        // Project description
        y = 72;
        if (projectDescription) {
            doc.setFontSize(8);
            const descLines = doc.splitTextToSize(projectDescription, pageW - 40);
            const boxH = 10 + descLines.length * 4.8 + 4;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(15, y, pageW - 30, boxH, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 95);
            doc.text('Project Scope:', 18, y + 6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(descLines, 18, y + 12);
            y += boxH + 4;
        }

        // Materials / scope table (NO prices shown)
        autoTable(doc, {
            startY: y + 4,
            head: [['#', 'Item / Material', 'Category', 'Qty', 'Unit', 'Done']],
            body: visibleItems.filter(item => !isDividerItem(item)).map((item, i) => [
                (i + 1).toString(),
                item.item_name + (item.description ? `\n${item.description}` : ''),
                item.category || '',
                item.quantity?.toString() || '1',
                item.unit || '',
                '',
            ]),
            headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 30 },
                3: { cellWidth: 14, halign: 'center' },
                4: { cellWidth: 14, halign: 'center' },
                5: { cellWidth: 12, halign: 'center' },
            },
            theme: 'striped',
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        const finalY = (doc as any).lastAutoTable.finalY + 8;

        // Crew notes
        if (crewNotes) {
            doc.setFillColor(255, 251, 235);
            doc.rect(15, finalY, pageW - 30, 20, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 58, 95);
            doc.text('Crew Notes:', 18, finalY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(crewNotes, 18, finalY + 10, { maxWidth: pageW - 36 });
        }

        // Signature lines at bottom
        const sigY = doc.internal.pageSize.getHeight() - 30;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, sigY, 80, sigY);
        doc.line(pageW / 2 + 10, sigY, pageW - 15, sigY);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text('Crew Lead Signature / Date', 15, sigY + 4);
        doc.text('Customer Signature / Date', pageW / 2 + 10, sigY + 4);

        return doc;
    };

    // jsPDF types output('bloburl') as URL here; String() handles that and a plain string alike.
    const previewPDF = () => {
        const doc = buildPDF();
        const fileName = `WorkOrder-${workOrderNumber}-${customerName.replace(/\s+/g, '-')}.pdf`;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
        if (isMobile) { doc.save(fileName); } else { window.open(String(doc.output('bloburl')), '_blank'); }
    };

    const downloadPDF = () => {
        buildPDF().save(`WorkOrder-${workOrderNumber}-${customerName.replace(/\s+/g, '-')}.pdf`);
    };

    const saveWorkOrder = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('work_orders').insert({
                company_id: companyId,
                quote_id: quoteId,
                customer_id: customerId || null,
                work_order_number: workOrderNumber,
                status: 'scheduled',
                selected_tier: selectedTier,
                scheduled_date: scheduledDate || null,
                crew_notes: crewNotes,
            });
            if (error) throw error;
            toast.success(`Work Order ${workOrderNumber} created!`);
            downloadPDF();
            onSaved();
        } catch (err: any) {
            toast.error('Failed to create work order: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1e3a5f] rounded-xl flex items-center justify-center">
                            <ClipboardList className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Generate Work Order</h2>
                            <p className="text-sm text-gray-500">Quote {quoteNumber} · {customerName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Work order number */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Work Order #</label>
                        <input value={workOrderNumber} onChange={e => setWorkOrderNumber(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                    </div>

                    {/* Tier selector */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-gray-500">Tier (line items to include)</label>
                            {signedTier && (
                                <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                    Customer selected: {tierLabel[signedTier]}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {(['good', 'better', 'best'] as const).map(t => (
                                <button key={t} onClick={() => setSelectedTier(t)}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${selectedTier === t
                                            ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f]/40'
                                        }`}>
                                    {tierLabel[t]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Building picker — only shown when measurement report has multiple structures */}
                    {structures.length > 1 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                <label className="block text-xs font-medium text-gray-500">Building Coverage</label>
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                                    {structures.length} buildings on report
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {structures.map((s, i) => (
                                    <button key={s.structureNumber} onClick={() => setSelectedStructureIdx(i)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${selectedStructureIdx === i
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                                        }`}>
                                        <Building2 className="w-4 h-4 shrink-0" />
                                        <div className="flex-1">
                                            <span className="font-medium">Structure {s.structureNumber}</span>
                                            <span className={`ml-2 text-xs ${selectedStructureIdx === i ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {s.totalRoofAreaSqft.toLocaleString()} sqft · {s.predominantPitch || 'N/A'} pitch
                                            </span>
                                        </div>
                                        {selectedStructureIdx === i && <Check className="w-4 h-4 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1.5">
                                Line items and PDF will reflect only the selected building.
                            </p>
                        </div>
                    )}

                    {/* Scheduled date */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
                        <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none" />
                    </div>

                    {/* Line items preview */}
                    {!loading && (
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                                {visibleItems.filter(i => !isDividerItem(i)).length} line items will be included (prices hidden)
                                {selectedStructure && (
                                    <span className="ml-1 text-blue-600">· Structure {selectedStructure.structureNumber}</span>
                                )}
                            </p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {visibleItems.filter(i => !isDividerItem(i)).map((item, i) => (
                                    <div key={item.id} className="flex items-center gap-2 text-xs text-gray-700">
                                        <span className="w-4 h-4 bg-[#1e3a5f]/10 rounded text-[#1e3a5f] flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                                        <span className="flex-1 truncate">{item.item_name}</span>
                                        <span className="text-gray-400">× {item.quantity || 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Crew notes */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Crew Notes</label>
                        <textarea value={crewNotes} onChange={e => setCrewNotes(e.target.value)}
                            rows={3} placeholder="Special instructions, access info, materials to bring…"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none resize-none" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200">
                        Cancel
                    </button>
                    <button onClick={previewPDF}
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <ClipboardList className="w-4 h-4" /> Preview
                    </button>
                    <button onClick={saveWorkOrder} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                        <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save & Download WO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkOrderPanel;
