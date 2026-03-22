// ContactTemplateModal — Fillable document editor: click fields directly on the document
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, FileText, ChevronLeft, Search, DollarSign, Save, Loader2, Eye, EyeOff, Percent } from 'lucide-react';
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
  var includeTax = false;

  function parseMoney(s) {
    return parseFloat(String(s || '').replace(/[^0-9.]/g, '')) || 0;
  }
  function fmt(n) {
    return '$' + n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  }

  function updateTotals(tbl) {
    var sub = 0;
    tbl.querySelectorAll('.line-total').forEach(function(sp) { sub += parseMoney(sp.textContent); });
    var taxRateInp = document.querySelector('input[name="TAX_RATE"]');
    var rate = (includeTax && taxRateInp) ? parseMoney(taxRateInp.value) : 0;
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

  // Expose tax toggle for React toolbar
  window.toggleTax = function(include) {
    includeTax = include;
    var taxRateInp = document.querySelector('input[name="TAX_RATE"]');
    var taxAmtInp = document.querySelector('input[name="TAX_AMOUNT"]');
    if (taxRateInp) { var r = taxRateInp.closest('.t-row'); if (r) r.style.display = include ? '' : 'none'; }
    if (taxAmtInp) { var r2 = taxAmtInp.closest('.t-row'); if (r2) r2.style.display = include ? '' : 'none'; }
    document.querySelectorAll('table').forEach(function(t) { updateTotals(t); });
  };

  // Expose pricing visibility toggle for React toolbar
  window.toggleAllPricing = function(hide) {
    document.querySelectorAll('tbody tr[data-hide-price]').forEach(function(row) {
      row.dataset.hidePrice = hide ? 'true' : 'false';
    });
    document.querySelectorAll('tbody tr').forEach(function(row) {
      row.dataset.hidePrice = hide ? 'true' : 'false';
      applyPriceVisual(row, hide);
    });
  };

  function applyPriceVisual(row, hidden) {
    var cells = row.querySelectorAll('td');
    // price col = 2, total col = 3 (0-indexed)
    if (cells[2]) cells[2].style.opacity = hidden ? '0.35' : '1';
    if (cells[3]) cells[3].style.opacity = hidden ? '0.35' : '1';
    var eyeBtn = row.querySelector('.eye-btn');
    if (eyeBtn) {
      eyeBtn.textContent = hidden ? '\\uD83D\\uDEAB' : '\\uD83D\\uDC41';
      eyeBtn.title = hidden ? 'Pricing hidden from customer — click to show' : 'Pricing visible to customer — click to hide';
      eyeBtn.style.background = hidden ? '#fff7ed' : '#f0fdf4';
      eyeBtn.style.color = hidden ? '#d97706' : '#16a34a';
      eyeBtn.style.borderColor = hidden ? '#fed7aa' : '#bbf7d0';
    }
  }

  function makeRowActions(row, tbl) {
    var dTd = document.createElement('td');
    dTd.style.cssText = 'text-align:center;vertical-align:middle;width:52px;padding:4px 2px';
    dTd.style.whiteSpace = 'nowrap';

    // Eye toggle button
    var eyeBtn = document.createElement('button');
    eyeBtn.className = 'eye-btn';
    eyeBtn.textContent = '\\uD83D\\uDC41';
    eyeBtn.title = 'Pricing visible to customer — click to hide';
    eyeBtn.style.cssText = 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:11px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center;margin-right:3px;vertical-align:middle';
    eyeBtn.addEventListener('click', function() {
      var hidden = row.dataset.hidePrice !== 'true';
      row.dataset.hidePrice = hidden ? 'true' : 'false';
      applyPriceVisual(row, hidden);
    });
    dTd.appendChild(eyeBtn);

    // Delete button
    var dBtn = document.createElement('button');
    dBtn.innerHTML = '&times;'; dBtn.title = 'Remove line item';
    dBtn.style.cssText = 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle';
    dBtn.onmouseenter = function() { dBtn.style.background='#fecaca'; };
    dBtn.onmouseleave = function() { dBtn.style.background='#fee2e2'; };
    dBtn.addEventListener('click', function() { row.remove(); updateTotals(tbl); });
    dTd.appendChild(dBtn);

    row.appendChild(dTd);
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
    // Use value only (not placeholder) — and preserve any unit suffix from text nodes (e.g. " sq", " LF")
    var qUnitSuffix = '';
    if (existQ) {
      qtyCell.childNodes.forEach(function(n) { if (n.nodeType === 3) qUnitSuffix += n.textContent; });
      qUnitSuffix = qUnitSuffix.trim();
    }
    var qtyRaw = (existQ ? existQ.value : qtyCell.textContent).trim();
    var isLot = /^lot$/i.test(qtyRaw);
    var qm = qtyRaw.match(/^([\\d.]+)\\s*(.*)/);
    var qNum = qm ? qm[1] : (isLot ? '' : qtyRaw);
    var qUnit = qm ? qm[2].trim() : qUnitSuffix;
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
    var prRaw = (existP ? existP.value : prCell.textContent).trim();
    var isDash = (prRaw === '\\u2014' || prRaw === '-' || prRaw === '');
    prCell.innerHTML = '';
    var pInp = document.createElement('input');
    pInp.type = 'text'; pInp.value = isDash ? '\\u2014' : prRaw; pInp.placeholder = '$0.00';
    pInp.style.cssText = INP + ';width:80px';
    prCell.appendChild(pInp);

    // ── Total (auto-calc; directly editable for Lot/dash rows) ──
    var totCell = cells[totalIdx];
    var existT = totCell.querySelector('input');
    var totRaw = (existT ? existT.value : totCell.textContent).trim();
    totCell.innerHTML = '';
    var totSpan = document.createElement('span');
    totSpan.className = 'line-total';
    totSpan.setAttribute('contenteditable', 'true');
    totSpan.style.cssText = 'font-weight:600;outline:none;display:inline-block;min-width:60px;cursor:text;border-bottom:1px dashed #94a3b8;border-radius:2px;padding:0 2px';
    totSpan.title = 'Auto-calculated from Qty \u00d7 Price. Click to edit manually for Lot items.';
    totSpan.textContent = totRaw || '\\u2014';
    totCell.style.cssText += ';background:#f8fafc';
    totCell.appendChild(totSpan);
    totSpan.addEventListener('input', function() { updateTotals(tbl); });

    function recalc() {
      var q = parseFloat(qInp.value.replace(/[^0-9.]/g, '')) || 0;
      var p = parseMoney(pInp.value);
      if (q > 0 && p > 0) totSpan.textContent = fmt(q * p);
      updateTotals(tbl);
    }
    qInp.addEventListener('input', recalc);
    pInp.addEventListener('input', recalc);
    var iq = parseFloat(qNum) || 0, ip = parseMoney(prRaw);
    if (iq > 0 && ip > 0) totSpan.textContent = fmt(iq * ip);

    makeRowActions(row, tbl);
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

    var hRow = tbl.querySelector('thead tr');
    var dTh = document.createElement('th'); dTh.style.width = '52px'; dTh.style.textAlign = 'center';
    dTh.title = 'Eye = customer visibility | × = delete row';
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
      nr.dataset.hidePrice = 'false';

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
      ttSp.className='line-total';
      ttSp.setAttribute('contenteditable','true');
      ttSp.style.cssText='font-weight:600;outline:none;display:inline-block;min-width:60px;cursor:text;border-bottom:1px dashed #94a3b8;border-radius:2px;padding:0 2px';
      ttSp.title='Auto-calculated. Click to edit manually for Lot items.';
      ttSp.textContent='\\u2014';
      ttTd.appendChild(ttSp); nr.appendChild(ttTd);
      ttSp.addEventListener('input', function() { updateTotals(tbl); });

      function nr_recalc() {
        var q=parseFloat(nqInp.value.replace(/[^0-9.]/g,''))||0, p=parseMoney(npInp.value);
        ttSp.textContent = (q>0&&p>0) ? fmt(q*p) : '\\u2014';
        updateTotals(tbl);
      }
      nqInp.addEventListener('input', nr_recalc);
      npInp.addEventListener('input', nr_recalc);

      makeRowActions(nr, tbl);
      tbody.appendChild(nr);
      nqInp.focus();
    });
    tbl.parentNode.insertBefore(addBtn, tbl.nextSibling);
    updateTotals(tbl);
  });

  // Apply initial tax visibility/calculation state
  window.toggleTax(includeTax);

  // ── Enhanced signature section (3 lines each party) ──
  var sigsDiv = document.querySelector('.sigs');
  if (sigsDiv) {
    sigsDiv.style.cssText = 'display:flex;gap:40px;margin-top:36px;align-items:flex-start';
    sigsDiv.innerHTML = [
      { label: 'Customer / Property Owner' },
      { label: 'Authorized Contractor / Company' }
    ].map(function(party) {
      return '<div style="flex:1">'
        + '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">' + party.label + '</div>'
        + '<div style="margin-bottom:18px"><div style="border-bottom:2px solid #374151;height:28px;margin-bottom:5px"></div><div style="font-size:11px;color:#6b7280">Printed Name</div></div>'
        + '<div style="margin-bottom:18px"><div style="border-bottom:2px solid #374151;height:28px;margin-bottom:5px"></div><div style="font-size:11px;color:#6b7280">Signature</div></div>'
        + '<div style="display:flex;gap:20px"><div style="width:55%"><div style="border-bottom:2px solid #374151;height:28px;margin-bottom:5px"></div><div style="font-size:11px;color:#6b7280">Date</div></div></div>'
        + '</div>';
    }).join('');
  }
})();
</script>
`;

function buildFillableContent(
  template: DocumentTemplate,
  contact: Contact,
  companyProfile: DbCompany | null,
  profile: any,
): string {
  let content = template.content;

  // ── 1. Company-saved fields (highest priority — applied before contact auto-fill) ──
  // These are values the company has previously customised (rates, terms, specs).
  // By applying them first the subsequent buildContactOverrides pass has nothing left
  // to override for those keys, so company-saved values always win.
  const companyFieldsKey = `crm_company_fields_${(profile as any)?.company_id || companyProfile?.id || 'default'}`;
  let savedCompanyFields: Record<string, string> = {};
  try {
    // Also migrate legacy crm_terms_* key if present
    const legacyKey = `crm_terms_${(profile as any)?.company_id || companyProfile?.id || 'default'}`;
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || '{}');
    savedCompanyFields = { ...legacy, ...JSON.parse(localStorage.getItem(companyFieldsKey) || '{}') };
  } catch { /* ignore */ }
  Object.entries(savedCompanyFields).forEach(([key, val]) => {
    if (val) content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  });

  // ── 2. Contact / company auto-fill (fills any keys not already replaced above) ──
  const autoFilled = buildContactOverrides(contact, companyProfile, profile);
  Object.entries(autoFilled).forEach(([key, val]) => {
    if (val) content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
  });

  // ── 3. Template field defaults for any remaining {{VARIABLE}} ──
  const fieldDefaults: Record<string, string> = {};
  if (template.fields) {
    template.fields.forEach(f => {
      if (f.defaultValue !== undefined && f.defaultValue !== null) {
        fieldDefaults[f.key] = String(f.defaultValue);
      }
    });
  }

  // ── 4. Convert remaining {{VARIABLE}} into styled inline inputs with defaults ──
  content = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, varName: string) => {
    const label = varName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const defaultVal = (fieldDefaults[varName] || '').replace(/"/g, '&quot;');
    return `<input type="text" name="${varName}" value="${defaultVal}" placeholder="${label}" style="display:inline-block;border:none;border-bottom:2px solid #3b82f6;background:#eff6ff;color:#1e3a8a;padding:2px 8px;min-width:120px;max-width:260px;border-radius:3px 3px 0 0;font-size:inherit;font-family:inherit;vertical-align:baseline;outline:none;" onfocus="this.style.background='#dbeafe';this.style.borderBottomColor='#1d4ed8'" onblur="this.style.background='#eff6ff';this.style.borderBottomColor='#3b82f6'" />`;
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
  const [hidePricing, setHidePricing] = useState(false);
  const [includeTax, setIncludeTax] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Communicate toggle changes to the live iframe
  useEffect(() => {
    (iframeRef.current?.contentWindow as any)?.toggleAllPricing?.(hidePricing);
  }, [hidePricing]);

  useEffect(() => {
    (iframeRef.current?.contentWindow as any)?.toggleTax?.(includeTax);
  }, [includeTax]);

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
    setHidePricing(false);
    setIncludeTax(false);
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

    // Persist ALL edited field values per company so they reload on any future template open.
    // Skip contact/company auto-fill keys (change per contact) and calculated totals.
    try {
      const SKIP_SAVE = new Set([
        'CUSTOMER_NAME','CLIENT_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL',
        'PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','PROJECT_ADDRESS',
        'INSURANCE_COMPANY','POLICY_NUMBER','CLAIM_NUMBER',
        'COMPANY_NAME','COMPANY_TAGLINE','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE',
        'COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','REP_NAME',
        'ESTIMATE_DATE','CURRENT_DATE','ESTIMATE_EXPIRY','ESTIMATE_NUMBER','START_DATE',
        'SUBTOTAL','TAX_AMOUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE',
      ]);
      const fieldsToSave: Record<string, string> = {};
      iframe.contentDocument!.querySelectorAll<HTMLInputElement>('input[name]').forEach(inp => {
        if (!SKIP_SAVE.has(inp.name) && inp.value.trim()) {
          fieldsToSave[inp.name] = inp.value.trim();
        }
      });
      if (Object.keys(fieldsToSave).length > 0) {
        const storageKey = `crm_company_fields_${profile.company_id}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
        localStorage.setItem(storageKey, JSON.stringify({ ...existing, ...fieldsToSave }));
      }
    } catch { /* ignore */ }

    // Clone the iframe document so we can clean it up for saving without affecting the live view
    const cloneDoc = iframe.contentDocument.cloneNode(true) as Document;

    // Remove interactive buttons, add-line buttons, and scripts from the saved copy
    cloneDoc.querySelectorAll('button, script').forEach(el => el.remove());

    // Apply pricing visibility: rows marked data-hide-price="true" get price/total cleared
    cloneDoc.querySelectorAll<HTMLElement>('tbody tr[data-hide-price="true"]').forEach(row => {
      const cells = row.querySelectorAll('td');
      // Price column (index 2) and Total column (index 3)
      if (cells[2]) cells[2].innerHTML = '<span>—</span>';
      if (cells[3]) cells[3].innerHTML = '<span>—</span>';
      row.removeAttribute('data-hide-price');
    });
    // Also clear data-hide-price attribute from visible rows
    cloneDoc.querySelectorAll<HTMLElement>('tbody tr[data-hide-price]').forEach(row => {
      row.removeAttribute('data-hide-price');
    });

    // If tax is excluded, remove the tax rows from the totals section
    if (!includeTax) {
      const taxRateInp = cloneDoc.querySelector('input[name="TAX_RATE"]');
      const taxAmtInp = cloneDoc.querySelector('input[name="TAX_AMOUNT"]');
      taxRateInp?.closest('.t-row')?.remove();
      taxAmtInp?.closest('.t-row')?.remove();
    }

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
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex-shrink-0 flex-wrap">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">{selected!.name}</span>
        <span className="text-xs text-gray-400 hidden sm:inline">— {getContactFullName(contact)}</span>

        {/* Customer pricing visibility toggle */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setHidePricing(h => !h)}
            title={hidePricing ? 'Pricing hidden from customer on save — click to show' : 'Click to hide pricing from customer when saved'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              hidePricing
                ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {hidePricing ? <EyeOff size={13} /> : <Eye size={13} />}
            {hidePricing ? 'Pricing hidden from customer' : 'Hide pricing from customer'}
          </button>

          {/* Tax toggle */}
          <button
            onClick={() => setIncludeTax(t => !t)}
            title={includeTax ? 'Tax included — click to remove tax from document' : 'Tax excluded — click to add tax back'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !includeTax
                ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Percent size={13} />
            {includeTax ? 'Tax: on' : 'Tax: off'}
          </button>
        </div>
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
