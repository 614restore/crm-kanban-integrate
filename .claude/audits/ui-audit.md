# UI/UX Accessibility & Responsive Design Audit — TrussCTR CRM (2026-03-19)

## Summary
4 critical · 8 high · 10 medium · 8 low — 30 total

---

## CRITICAL (4)

SEVERITY: critical
FILE: src/components/crm/AuthPage.tsx, PipelineBoard.tsx, WorkOrdersView.tsx, EstimatesView.tsx, QuickAddModal.tsx + 31 more form files
FINDING: Form inputs have visual label text but only 3 of 39 label-bearing files use htmlFor to associate labels with inputs programmatically. 36 files have floating labels disconnected from their inputs. Screen readers cannot associate label text with the correct form control.
FIX: Add matching htmlFor="field-id" on every <label> and id="field-id" on every <input>, <select>, <textarea>.

SEVERITY: critical
FILE: src/components/crm/AuthPage.tsx (lines 390-404)
FINDING: The email input has no <label> at all — only a decorative icon. Completely unlabelled for screen readers.
FIX: Add <label htmlFor="auth-email" className="sr-only">Email address</label> and id="auth-email" on the input.

SEVERITY: critical
FILE: src/components/crm/PipelineBoard.tsx (lines 362-380, 430-470)
FINDING: Kanban cards are <div> elements with draggable and onClick but no tabIndex, role="button", or onKeyDown. Keyboard-only users cannot reach or operate cards.
FIX: Add tabIndex={0}, role="button", and onKeyDown (Enter/Space activates, arrow keys move between columns) to every card div. Add aria-label describing the card and its current column.

SEVERITY: critical
FILE: src/components/crm/ContactList.tsx (lines 360-393), Sidebar.tsx (lines 167, 282), TopBar.tsx (lines 137-140)
FINDING: Icon-only buttons throughout most-used components (list/grid toggle, select-all, sidebar collapse, search clear, sign-out) have no accessible names. The title attribute used is not reliably announced by all screen reader + browser pairs.
FIX: Replace title with aria-label on all icon-only buttons.

SEVERITY: critical
FILE: src/components/crm/TopBar.tsx (lines 241-302), Sidebar.tsx (lines 196-246)
FINDING: Notification dropdown panels are plain <div> elements with no role="dialog", no aria-modal. Bell button lacks aria-expanded and aria-haspopup. Individual notification items are <div onClick> — not keyboard-focusable.
FIX: Add role="dialog" + aria-label="Notifications" to panel divs; aria-expanded={showNotifications} + aria-haspopup="dialog" to Bell buttons; aria-live="polite" to unread count badge; convert notification <div> items to <button> elements.

---

## HIGH (8)

SEVERITY: high
FILE: 35 CRM component files
FINDING: outline-none removes browser focus ring; focus:ring-blue-500/20 (20% opacity) is below WCAG 2.1 SC 2.4.11 3:1 minimum against white.
FIX: Replace with focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2.

SEVERITY: high
FILE: src/components/crm/Sidebar.tsx
FINDING: No aria-current="page" on active nav items. Active state is color-only.
FIX: Add aria-current={currentView === item.id ? 'page' : undefined} to each nav button.

SEVERITY: high
FILE: 30 files with loading state
FINDING: Zero use of src/components/ui/skeleton.tsx. Data views flash from nothing to content with no loading placeholder and no aria-busy announcement.
FIX: Use <Skeleton> for loading rows/cards and aria-busy="true" on the container while loading.

SEVERITY: high
FILE: ~20 files with modal overlays
FINDING: Custom <div> overlay modals instead of using src/components/ui/dialog.tsx. Lack focus trapping, role="dialog", aria-labelledby, and Escape-key dismissal.
FIX: Migrate to the existing Radix Dialog / DialogContent components.

SEVERITY: high
FILE: src/components/crm/TopBar.tsx (line 129-135)
FINDING: Global search input has no <label> or aria-label; only a placeholder.
FIX: Add aria-label="Search contacts, jobs, and documents" to the input.

SEVERITY: high
FILE: src/components/crm/PipelineBoard.tsx board-selector + TopBar.tsx filters dropdown
FINDING: Trigger buttons lack aria-expanded/aria-haspopup; panels lack role="listbox"/role="menu"; no keyboard (arrow/Escape) navigation.
FIX: Add full ARIA dropdown pattern and keyboard navigation.

SEVERITY: high
FILE: src/components/crm/Sidebar.tsx (lines 251-259)
FINDING: Legal footer links use text-slate-500 on bg-slate-900. At text-xs (12px) this is ~3.4:1 contrast — below WCAG AA requirement of 4.5:1 for small text.
FIX: Change to text-slate-400 or increase to text-sm.

SEVERITY: high
FILE: src/components/crm/AuthPage.tsx (lines 423-430)
FINDING: Password visibility toggle has no aria-label or aria-pressed.
FIX: Add aria-label={showPassword ? 'Hide password' : 'Show password'} and aria-pressed={showPassword}.

---

## MEDIUM (10)

SEVERITY: medium — ContactList.tsx: Grid layout for list view instead of semantic <table>. Add aria-sort to sort buttons.
SEVERITY: medium — PipelineBoard.tsx (line 473): Empty column state is just <p>No contacts</p>. Add icon, explanation, and CTA.
SEVERITY: medium — MobileNav.tsx "More" overlay: lacks role="dialog", aria-label, Escape-key handler, and auto-focus on open.
SEVERITY: medium — Dashboard.tsx and financial views: Trend arrow icons convey direction only visually. Add <span className="sr-only">Increase</span> or Decrease next to each.
SEVERITY: medium — AIAssistant.tsx: Message list has no aria-live="polite" — new AI responses are invisible to screen readers.
SEVERITY: medium — ContactList.tsx, EquipmentView.tsx, PipelineBoard.tsx: window.confirm() used for destructive actions. Replace with existing AlertDialog component.
SEVERITY: medium — ContactList.tsx grid cards: Clickable <div> with no role, tabIndex, or onKeyDown — keyboard users cannot reach or activate.
SEVERITY: medium — mobile/PhotoCapture.tsx: <video> has no aria-label; capture/stop camera buttons are icon-only with no accessible names.
SEVERITY: medium — Sidebar.tsx: Active nav state is color-only. Add a non-color indicator (left border, bold weight) for color-blind users.
SEVERITY: medium — mobile/ResponsiveLayout.tsx: Binary mobile/desktop breakpoint with no intermediate tablet layout for 768px-1024px screens.

---

## LOW (8)

SEVERITY: low — Sidebar.tsx <nav>: No aria-label="Main navigation".
SEVERITY: low — src/pages/NotFound.tsx: No document.title update; uses <a href> instead of <Link>.
SEVERITY: low — ContactList.tsx (lines 449-450): contact.firstName[0] / contact.lastName[0] with no null guard — throws on empty names.
SEVERITY: low — MobileNav.tsx: No aria-current="page" on active mobile nav buttons.
SEVERITY: low — AuthPage.tsx form: No aria-labelledby linking form to its <h2> heading.
SEVERITY: low — Sidebar.tsx: Notification badge uses text-[10px] — below 12px WCAG minimum. Change to text-xs.
SEVERITY: low — ContactList.tsx: Hidden CSV import <input type="file"> has no aria-label.
SEVERITY: low — TopBar.tsx <header>: No aria-label="Application header".
