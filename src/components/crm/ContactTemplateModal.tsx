// ContactTemplateModal — Fillable document editor: click fields directly on the document
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, FileText, ChevronLeft, Search, DollarSign, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { uploadDocument } from '@/lib/storage';
import {
  DocumentTemplate,
  getContractorEstimateTemplates,
  buildContactOverrides,
} from '@/lib/contractorTemplates';
import { Contact, Document, getContactFullName } from '@/lib/crmData';

interface Props {
  contact: Contact;
  onClose: () => void;
  onDocumentSaved: (doc: Document) => void;
}

// ─── Category / color maps ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  estimate: 'Estimates', invoice: 'Invoices', contract: 'Contracts',
  'work-order': 'Work Orders', proposal: 'Proposals', 'change-order': 'Change Orders',
  safety: 'Safety', other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  estimate: 'bg-green-100 text-green-800', invoice: 'bg-blue-100 text-blue-800',
  contract: 'bg-purple-100 text-purple-800', 'work-order': 'bg-orange-100 text-orange-800',
  proposal: 'bg-indigo-100 text-indigo-800', 'change-order': 'bg-yellow-100 text-yellow-800',
  safety: 'bg-red-100 text-red-800', other: 'bg-gray-100 text-gray-800',
};

// ─── Fillable document builder ────────────────────────────────────────────────
// Renders the template with auto-filled contact/company values, converts
// remaining {{VARIABLE}} placeholders into inline inputs, and injects an
// interactive cost-table script that enables editable Qty/Price, auto-calc
// totals, row deletion, and adding new line items.

const COST_TABLE_SCRIPT = `
<script>
(function() {
  var INP = 'border:none;border-bottom:2px solid #3b82f6;background:#eff6ff;color:#1e3a8a;padding:2px 6px;border-radius:3px 3px 0 0;font-size:inherit;font-family:inherit;outline:none';

  function parseMoney(s) {
    return parseFloat(String(s || '').replace(/[^0-9.]/g, '')) || 0;
  }
  function fmt(n) {
    return '$' + n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  }

  function updateTotals(tbl) {
    var sub = 0;
    tbl.querySelectorAll('.line-total').forEach(function(sp) { sub += parseMoney(sp.textContent); });
    var taxInp = document.querySelector('input[name="TAX_RATE"]');
    var rate = taxInp ? parseMoney(taxInp.value) : 0;
    var tax = sub * rate / 100;
    var total = sub + tax;
    function setV(nm, v) {
      var el = document.querySelector('input[name="' + nm + '"]');
      if (el) el.value = fmt(v);
    }
    setV('SUBTOTAL', sub);
    setV('TAX_AMOUNT', tax);
    setV('TOTAL_AMOUNT', total);
    setV('DEPOSIT_AMOUNT', total / 2);
    setV('BALANCE_DUE', total / 2);
  }

  function addRowBehavior(row, tbl, qtyIdx, priceIdx, totalIdx) {
    var cells = row.querySelectorAll('td');
    if (cells.length <= totalIdx) return;

    // ── Description ──
    var desc = cells[0];
    Array.from(desc.querySelectorAll('input')).forEach(function(inp) {
      desc.replaceChild(document.createTextNode(inp.value || inp.placeholder || inp.name || ''), inp);
    });
    desc.setAttribute('contenteditable', 'true');
    desc.style.cssText += ';background:#eff6ff;outline:none;border-bottom:2px solid #3b82f6;border-radius:3px 3px 0 0;cursor:text';

    // ── Qty ──
    var qtyCell = cells[qtyIdx];
    var existQ = qtyCell.querySelector('input');
    var qtyRaw = (existQ ? existQ.value || existQ.placeholder : qtyCell.textContent).trim();
    var isLot = /^lot$/i.test(qtyRaw);
    var qm = qtyRaw.match(/^([\\d.]+)\\s*(.*)/);
    var qNum = qm ? qm[1] : (isLot ? '' : qtyRaw);
    var qUnit = qm ? qm[2].trim() : '';
    qtyCell.innerHTML = '';
    var qInp = document.createElement('input');
    qInp.type = 'text'; qInp.value = isLot ? 'Lot' : qNum; qInp.placeholder = 'Qty';
    qInp.style.cssText = INP + ';width:55px';
    qtyCell.appendChild(qInp);
    if (qUnit) {
      var us = document.createElement('span');
      us.textContent = '\\u00a0' + qUnit; us.style.cssText = 'color:#6b7280;font-size:12px';
      qtyCell.appendChild(us);
    }

    // ── Unit Price ──
    var prCell = cells[priceIdx];
    var existP = prCell.querySelector('input');
    var prRaw = (existP ? existP.value || existP.placeholder : prCell.textContent).trim();
    var isDash = (prRaw === '\\u2014' || prRaw === '-' || prRaw === '');
    prCell.innerHTML = '';
    var pInp = document.createElement('input');
    pInp.type = 'text'; pInp.value = isDash ? '\\u2014' : prRaw; pInp.placeholder = '$0.00';
    pInp.style.cssText = INP + ';width:80px';
    prCell.appendChild(pInp);

    // ── Total (read-only, calculated) ──
    var totCell = cells[totalIdx];
    var existT = totCell.querySelector('input');
    var totRaw = (existT ? existT.value || existT.placeholder : totCell.textContent).trim();
    totCell.innerHTML = '';
    var totSpan = document.createElement('span');
    totSpan.className = 'line-total'; totSpan.style.cssText = 'font-weight:600';
    totSpan.textContent = totRaw || '\\u2014';
    totCell.style.cssText += ';background:#f8fafc';
    totCell.appendChild(totSpan);

    function recalc() {
      var q = parseFloat(qInp.value.replace(/[^0-9.]/g, '')) || 0;
      var p = parseMoney(pInp.value);
      if (q > 0 && p > 0) totSpan.textContent = fmt(q * p);
      updateTotals(tbl);
    }
    qInp.addEventListener('input', recalc);
    pInp.addEventListener('input', recalc);
    // Initial calc from pre-filled values
    var iq = parseFloat(qNum) || 0, ip = parseMoney(prRaw);
    if (iq > 0 && ip > 0) totSpan.textContent = fmt(iq * ip);

    // ── Delete button ──
    var dTd = document.createElement('td');
    dTd.style.cssText = 'text-align:center;vertical-align:middle;width:36px;padding:4px';
    var dBtn = document.createElement('button');
    dBtn.innerHTML = '&times;'; dBtn.title = 'Remove line item';
    dBtn.style.cssText = 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center';
    dBtn.onmouseenter = function() { dBtn.style.background='#fecaca'; };
    dBtn.onmouseleave = function() { dBtn.style.background='#fee2e2'; };
    dBtn.addEventListener('click', function() { row.remove(); updateTotals(tbl); });
    dTd.appendChild(dBtn);
    row.appendChild(dTd);
  }

  document.querySelectorAll('table').forEach(function(tbl) {
    var ths = Array.from(tbl.querySelectorAll('thead th'));
    var qIdx = -1, pIdx = -1, tIdx = -1;
    ths.forEach(function(th, i) {
      var t = th.textContent.trim();
      if (t.indexOf('Qty') >= 0) qIdx = i;
      if (t.indexOf('Unit Price') >= 0) pIdx = i;
      if (t === 'Total') tIdx = i;
    });
    if (qIdx < 0 || pIdx < 0 || tIdx < 0) return;

    // Add delete column header
    var hRow = tbl.querySelector('thead tr');
    var dTh = document.createElement('th'); dTh.style.width = '36px';
    hRow.appendChild(dTh);

    tbl.querySelectorAll('tbody tr').forEach(function(row) {
      addRowBehavior(row, tbl, qIdx, pIdx, tIdx);
    });

    // Add row button
    var addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Line Item';
    addBtn.style.cssText = 'margin-top:8px;padding:4px 14px;background:#eff6ff;color:#2563eb;border:1px dashed #93c5fd;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600';
    addBtn.onmouseenter = function() { addBtn.style.background = '#dbeafe'; };
    addBtn.onmouseleave = function() { addBtn.style.background = '#eff6ff'; };
    addBtn.addEventListener('click', function() {
      var tbody = tbl.querySelector('tbody');
      var nr = document.createElement('tr');

      var descTd = document.createElement('td');
      descTd.setAttribute('contenteditable','true'); descTd.textContent = 'New item';
      descTd.style.cssText = 'background:#eff6ff;outline:none;border-bottom:2px solid #3b82f6;border-radius:3px 3px 0 0;cursor:text';
      nr.appendChild(descTd);

      var qTd = document.createElement('td');
      var nqInp = document.createElement('input');
      nqInp.type='text'; nqInp.placeholder='Qty'; nqInp.style.cssText = INP+';width:55px';
      qTd.appendChild(nqInp); nr.appendChild(qTd);

      var pTd = document.createElement('td');
      var npInp = document.createElement('input');
      npInp.type='text'; npInp.placeholder='$0.00'; npInp.style.cssText = INP+';width:80px';
      pTd.appendChild(npInp); nr.appendChild(pTd);

      var ttTd = document.createElement('td'); ttTd.style.background='#f8fafc';
      var ttSp = document.createElement('span');
      ttSp.className='line-total'; ttSp.style.cssText='font-weight:600'; ttSp.textContent='\\u2014';
      ttTd.appendChild(ttSp); nr.appendChild(ttTd);

      function nr_recalc() {
        var q=parseFloat(nqInp.value.replace(/[^0-9.]/g,''))||0;
        var p=parseMoney(npInp.value);
        ttSp.textContent = (q>0&&p>0) ? fmt(q*p) : '\\u2014';
        updateTotals(tbl);
      }
      nqInp.addEventListener('input', nr_recalc);
      npInp.addEventListener('input', nr_recalc);

      var dTd2=document.createElement('td'); dTd2.style.cssText='text-align:center;vertical-align:middle;width:36px;padding:4px';
      var dBtn2=document.createElement('button'); dBtn2.innerHTML='&times;'; dBtn2.title='Remove';
      dBtn2.style.cssText='background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;padding:0';
      dBtn2.addEventListener('click',function(){nr.remove();updateTotals(tbl);});
      dTd2.appendChild(dBtn2); nr.appendChild(dTd2);

      tbody.appendChild(nr);
      nqInp.focus();
    });
    tbl.parentNode.insertBefore(addBtn, tbl.nextSibling);

    updateTotals(tbl);
  });
})();
</script>
`;

function buildFillableContent(
  template: DocumentTemplate,
  contact: Contact,
  companyProfile: DbCompany | null,
  profile: any,
): string {
  const autoFilled = buildContactOverrides(contact, companyProfile, profile);
  let content = template.content;

  // Apply auto-filled values first
  Object.entries(autoFilled).forEach(([key, val]) => {
    if (val) content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
  });

  // Convert remaining {{VARIABLE}} into styled inline inputs
  content = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, varName: string) => {
    const label = varName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    return `<input type="text" name="${varName}" placeholder="${label}" style="display:inline-block;border:none;border-bottom:2px solid #3b82f6;background:#eff6ff;color:#1e3a8a;padding:2px 8px;min-width:120px;max-width:260px;border-radius:3px 3px 0 0;font-size:inherit;font-family:inherit;vertical-align:baseline;outline:none;" onfocus="this.style.background='#dbeafe';this.style.borderBottomColor='#1d4ed8'" onblur="this.style.background='#eff6ff';this.style.borderBottomColor='#3b82f6'" />`;
  });

  // Inject the cost-table interaction script before </body>
  content = content.replace('</body>', COST_TABLE_SCRIPT + '</body>');

  return content;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactTemplateModal({ contact, onClose, onDocumentSaved }: Props) {
  const { profile } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [templates] = useState<DocumentTemplate[]>(getContractorEstimateTemplates());
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id)
      .then(c => { if (c) setCompanyProfile(c); })
      .catch(() => {});
  }, [profile?.company_id]);

  const handleSelect = (t: DocumentTemplate) => {
    setSelected(t);
  };

  const handleBack = () => {
    setSelected(null);
  };

  // Capture the live iframe DOM state (with all edits, deletions, and additions applied) and save
  const handleSave = async () => {
    if (!selected || !profile?.company_id) {
      toast.error('Unable to save — missing company context.');
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) {
      toast.error('Document not ready. Please try again.');
      return;
    }

    // Clone the iframe document so we can clean it up for saving without affecting the live view
    const cloneDoc = iframe.contentDocument.cloneNode(true) as Document;

    // Remove interactive buttons and scripts from the saved copy
    cloneDoc.querySelectorAll('button, script').forEach(el => el.remove());

    // Replace all remaining inputs with plain text spans showing their current values
    cloneDoc.querySelectorAll<HTMLInputElement>('input').forEach(inp => {
      const span = cloneDoc.createElement('span');
      span.textContent = inp.value || inp.placeholder || '';
      inp.parentNode?.replaceChild(span, inp);
    });

    // Strip contenteditable and inline editing styles from cost table cells
    cloneDoc.querySelectorAll<HTMLElement>('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.background = '';
      el.style.borderBottom = '';
      el.style.borderRadius = '';
      el.style.cursor = '';
      el.style.outline = '';
    });

    const finalHtml = '<!DOCTYPE html>' + cloneDoc.documentElement.outerHTML;

    setIsSaving(true);
    try {
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const contactName = getContactFullName(contact).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${selected.name.replace(/\s+/g, '_')}_${contactName}_${timestamp}.html`;
      const file = new File([blob], fileName, { type: 'text/html' });

      const uploadResult = await uploadDocument(file, profile.company_id, contact.id);
      if (uploadResult.error || !uploadResult.path) throw new Error(uploadResult.error || 'Upload failed');

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

  // ── Filtered template list ──
  const filteredTemplates = useMemo(() =>
    templates.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q));
      return matchesSearch && (activeCategory === 'all' || t.category === activeCategory);
    }),
    [templates, searchQuery, activeCategory]
  );

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  // ── Template list view ──
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
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Fillable document content ──
  const fillableContent = useMemo(() => {
    if (!selected) return '';
    return buildFillableContent(selected, contact, companyProfile, profile);
  }, [selected, contact, companyProfile, profile]);

  // ── Document editor view: full-width fillable document ──
  const renderEditor = () => (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft size={16} />
          Back to templates
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 text-sm">{selected!.name}</span>
        <span className="text-xs text-gray-500">— {getContactFullName(contact)}</span>
        <span className="ml-auto text-xs text-blue-600 font-medium">
          Blue underlined fields are editable — click any field to type
        </span>
      </div>

      {/* Full-width fillable document */}
      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
          <iframe
            ref={iframeRef}
            srcDoc={fillableContent}
            className="w-full border-0"
            style={{ minHeight: '900px' }}
            title="Fillable Document"
            sandbox="allow-scripts allow-same-origin"
          />
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

        {/* Footer */}
        {selected && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-gray-500">
              Fill in the blue fields directly on the document, then save.
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
