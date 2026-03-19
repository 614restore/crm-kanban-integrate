# Bug Audit — TrussCTR CRM (2026-03-19)

## Summary
5 critical · 8 high · 11 medium · 7 low — 31 total

---

## CRITICAL (5)

SEVERITY: critical
FILE: src/components/crm/InvoiceModal.tsx:174
FINDING: sendEmail() uses .catch(() => {}) — invoices are marked "sent" in Supabase even when the email never reaches the customer. No user feedback.
FIX: Replace with .catch((err) => { console.error('Invoice email failed:', err); toast.warning('Invoice saved, but email delivery failed.'); })

SEVERITY: critical
FILE: src/components/crm/InvoiceModal.tsx:183
FINDING: fireAutomationEvent(...).catch(() => {}) — automation failures are completely invisible.
FIX: Log the error at minimum.

SEVERITY: critical
FILE: src/lib/pdfService.ts:106
FINDING: generateAndUploadPdf returns url: URL.createObjectURL(pdfBlob) but never revokes it. Every PDF generation leaks a blob URL, exhausting memory over long sessions.
FIX: Callers must revoke the URL after use, or remove the raw blob URL from the return value.

SEVERITY: critical
FILE: src/components/crm/ImageUpload.tsx:19
FINDING: URL.createObjectURL(f) in handleFile is never revoked. Each file selection leaks a blob URL.
FIX: if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview); before assigning new URL.

SEVERITY: critical
FILE: src/components/crm/ContactDetail.tsx:443 (declaration) vs lines 231, 266 (used in effects)
FINDING: effectiveCompanyId is computed after the early-return null-check at line 434. The useEffect hooks at lines 231 and 266 close over undefined, so documents and related data silently fail to load on initial renders.
FIX: Move const effectiveCompanyId = profile?.company_id || state.companyId || null; to the top of the component, above all hooks.

---

## HIGH (8)

SEVERITY: high
FILE: src/lib/syncEngine.ts:326-338
FINDING: Stale syncErrors closure in startSync; users may see false "Sync completed successfully" messages.

SEVERITY: high
FILE: src/lib/syncEngine.ts:304-323
FINDING: Race condition: handleOnline calls stale startSync before setIsOnline(true) propagates; sync is silently skipped on reconnect.

SEVERITY: high
FILE: src/components/crm/CalendarView.tsx:65
FINDING: dispatch missing from useEffect dependency array (eslint-disable suppresses the warning).

SEVERITY: high
FILE: src/components/crm/ContactDetail.tsx:253
FINDING: Supabase change_orders query error is silently discarded ({ data: changeOrders } destructure drops the error).

SEVERITY: high
FILE: src/components/crm/PipelineBoard.tsx:82-112
FINDING: No optimistic update rollback on drag-and-drop; card appears to move during async gap but reverts on failure with no user feedback.

SEVERITY: high
FILE: src/components/crm/ContactList.tsx:187
FINDING: CSV import uses file.text() with no file size limit; large files block the main thread.

SEVERITY: high
FILE: src/pages/SignDocument.tsx:25-42
FINDING: Missing token validation before displaying estimate details; information disclosure (number, title, total, contact ID) to anyone with a valid estimateId and no token.

SEVERITY: high
FILE: src/components/crm/InvoiceModal.tsx:74 + src/lib/workOrderHelpers.ts:37
FINDING: Hardcoded 8.25% tax rate applied globally regardless of company location or tax-exempt status.

---

## MEDIUM (11)

SEVERITY: medium — src/components/crm/ContactTemplateModal.tsx:60 — .catch(() => {}) silently drops template load errors.
SEVERITY: medium — src/components/crm/ChangeOrderModal.tsx:257 — .catch(() => {}) silent failure.
SEVERITY: medium — src/pages/SignEstimate.tsx:69 — .catch(() => {}) labeled "Silent fail" on background call during sign flow.
SEVERITY: medium — src/lib/syncEngine.ts:62 — item.id! non-null assertion on optional field; processed items may stay stuck in queue if id is undefined.
SEVERITY: medium — src/components/mobile/PhotoCapture.tsx:222-228 — FileReader has no onerror handler; hangs uploading=true permanently on read failure.
SEVERITY: medium — src/components/mobile/PhotoCapture.tsx:125-149 — No unmount guard after getUserMedia resolves; camera tracks never stopped if component unmounts during async gap.
SEVERITY: medium — src/components/crm/CustomerSurvey.tsx:54 — wouldRecommend defaults to false, indistinguishable from a deliberate "No" in persisted data.
SEVERITY: medium — src/components/crm/ContactDetail.tsx:266-296 — No abort flag on document load; rapid contact switching may render stale documents.
SEVERITY: medium — src/lib/authContext.tsx:129-144 — Async side-effect called inside setProfile updater (anti-pattern; may double-fetch in Strict Mode).
SEVERITY: medium — src/pages/Photos.tsx:96-99 — [toast] in useEffect deps; toast reference is unstable, can cause infinite reload loop when photo errors appear.
SEVERITY: medium — src/lib/syncEngine.ts:192-193 — Conflict resolution defaults local time to Date.now() when updated_at missing, always making local records win over server data.

---

## LOW (7)

SEVERITY: low — src/lib/pdfService.ts:36-47 — Rejected loadPromise cached permanently; html2pdf CDN failures cannot be retried.
SEVERITY: low — src/components/crm/SupabaseHealth.tsx:85-88 — Health check fires every 60s regardless of tab visibility; wastes Supabase quota.
SEVERITY: low — src/components/crm/Dashboard.tsx:60-62 — recentActivity sort not memoized; runs on every render.
SEVERITY: low — src/components/crm/CalendarView.tsx:66 — getMentionTargets not memoized; recomputes on every render.
SEVERITY: low — src/lib/authContext.tsx:247-255 — Demo user ID hash is collision-prone for short emails; different users can collide to same ID.
SEVERITY: low — src/components/crm/EstimatesView.tsx:81-84 — loadEstimates not wrapped in useCallback; eslint-disable comment hides fragile pattern.
SEVERITY: low — src/components/AppLayout.tsx:63-65 — Error log says "sessionStorage" but code reads from localStorage.
