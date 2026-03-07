/**
 * v2 PM Feature Tests
 * Tests for change order math, permit date logic, and CRM store v2 actions.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Contact } from '../src/lib/crmData';
import { defaultBoards, defaultLeadSources } from '../src/lib/crmData';
import type { CRMState } from '../src/lib/crmStore';
import { crmReducer } from '../src/lib/crmStore';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeState(): CRMState {
  return {
    currentUser: null,
    companyId: 'co-test',
    currentView: 'dashboard',
    selectedContactId: null,
    selectedBoardId: 'board-sales',
    contacts: [],
    teamMembers: [],
    boards: defaultBoards,
    leadSources: defaultLeadSources,
    appointments: [],
    invoices: [],
    automations: [],
    sidebarCollapsed: false,
    searchQuery: '',
    filterStatus: 'all',
    filterAssignee: 'all',
    showQuickAdd: false,
    showInvoiceModal: false,
    selectedInvoiceId: null,
    isLoading: false,
    isInitialized: true,
    notifications: [],
  };
}

function makeContact(id: string): Contact {
  const iso = new Date().toISOString();
  return {
    id,
    firstName: 'Test',
    lastName: 'Contact',
    email: `${id}@example.com`,
    phone1: '555-0100',
    address: '1 Main St',
    city: 'Columbus',
    state: 'OH',
    zip: '43004',
    status: 'lead',
    leadSource: 'ls1',
    assignedTo: 'tm1',
    createdAt: iso,
    updatedAt: iso,
    tags: [],
  };
}

// ── Change Order Math ──────────────────────────────────────────────────────

function calcChangeOrder(items: Array<{ quantity: number; unitPrice: number }>, taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

test('Change order: subtotal sums line items correctly', () => {
  const result = calcChangeOrder(
    [
      { quantity: 2, unitPrice: 100 },
      { quantity: 3, unitPrice: 50 },
    ],
    0
  );
  assert.equal(result.subtotal, 350);
  assert.equal(result.total, 350);
});

test('Change order: tax is applied as percentage', () => {
  const result = calcChangeOrder([{ quantity: 1, unitPrice: 1000 }], 10);
  assert.equal(result.subtotal, 1000);
  assert.equal(result.taxAmount, 100);
  assert.equal(result.total, 1100);
});

test('Change order: zero items produces zero total', () => {
  const result = calcChangeOrder([], 8.5);
  assert.equal(result.total, 0);
});

test('Change order: floating point tax rounds correctly', () => {
  const result = calcChangeOrder([{ quantity: 1, unitPrice: 199.99 }], 8);
  // 199.99 * 0.08 = 15.9992, total = 215.9892
  assert.ok(result.taxAmount > 15 && result.taxAmount < 16);
  assert.ok(result.total > 215 && result.total < 216);
});

// ── Permit Date Logic ──────────────────────────────────────────────────────

function isDateWarning(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return d <= new Date(now.getTime() + thirtyDays);
}

function isDateExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

test('Permit: null date is not expired', () => {
  assert.equal(isDateExpired(null), false);
});

test('Permit: past date is expired', () => {
  assert.equal(isDateExpired('2020-01-01'), true);
});

test('Permit: future date more than 30 days away is not expired', () => {
  const future = new Date();
  future.setDate(future.getDate() + 60);
  assert.equal(isDateExpired(future.toISOString().slice(0, 10)), false);
});

test('Permit: null date has no warning', () => {
  assert.equal(isDateWarning(null), false);
});

test('Permit: date within 30 days triggers warning', () => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 15);
  assert.equal(isDateWarning(soon.toISOString().slice(0, 10)), true);
});

test('Permit: date more than 30 days away has no warning', () => {
  const far = new Date();
  far.setDate(far.getDate() + 60);
  assert.equal(isDateWarning(far.toISOString().slice(0, 10)), false);
});

test('Permit: past date triggers both warning and expiry', () => {
  assert.equal(isDateWarning('2020-01-01'), true);
  assert.equal(isDateExpired('2020-01-01'), true);
});

// ── CRM Reducer: Contact Lifecycle ─────────────────────────────────────────

test('CRM: adding a contact increases contacts array length', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  assert.equal(state.contacts.length, 1);
  assert.equal(state.contacts[0].id, 'c1');
});

test('CRM: deleting a contact removes it from state', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c2') });
  state = crmReducer(state, { type: 'DELETE_CONTACT', payload: 'c1' });
  assert.equal(state.contacts.length, 1);
  assert.equal(state.contacts[0].id, 'c2');
});

test('CRM: deleting selected contact clears selectedContactId', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  state = crmReducer(state, { type: 'SELECT_CONTACT', payload: 'c1' });
  assert.equal(state.selectedContactId, 'c1');
  state = crmReducer(state, { type: 'DELETE_CONTACT', payload: 'c1' });
  assert.equal(state.selectedContactId, null);
  assert.equal(state.contacts.length, 0);
});

test('CRM: deleting non-selected contact preserves selectedContactId', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c2') });
  state = crmReducer(state, { type: 'SELECT_CONTACT', payload: 'c2' });
  state = crmReducer(state, { type: 'DELETE_CONTACT', payload: 'c1' });
  assert.equal(state.selectedContactId, 'c2');
});

test('CRM: updating contact status changes status correctly', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  state = crmReducer(state, { type: 'UPDATE_CONTACT_STATUS', payload: { contactId: 'c1', status: 'signed' } });
  assert.equal(state.contacts[0].status, 'signed');
});

test('CRM: updating status of non-existent contact is a no-op', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  const before = state.contacts[0].status;
  state = crmReducer(state, { type: 'UPDATE_CONTACT_STATUS', payload: { contactId: 'NOPE', status: 'completed' } });
  assert.equal(state.contacts[0].status, before);
});

test('CRM: all 5 contact statuses can be set', () => {
  const statuses = ['lead', 'appt_set', 'estimate_sent', 'signed', 'completed'] as const;
  for (const status of statuses) {
    let state = makeState();
    state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('cx') });
    state = crmReducer(state, { type: 'UPDATE_CONTACT_STATUS', payload: { contactId: 'cx', status } });
    assert.equal(state.contacts[0].status, status);
  }
});

// ── CRM Reducer: Invoice ───────────────────────────────────────────────────

test('CRM: adding invoices accumulates correctly', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  for (let i = 0; i < 5; i++) {
    state = crmReducer(state, {
      type: 'ADD_INVOICE',
      payload: {
        id: `inv-${i}`,
        contactId: 'c1',
        contactName: 'Test Contact',
        jobId: `job-${i}`,
        amount: 100 * (i + 1),
        status: 'sent',
        dueDate: '2026-12-31',
        createdAt: new Date().toISOString(),
        items: [{ description: 'Work', quantity: 1, unitPrice: 100 * (i + 1), total: 100 * (i + 1) }],
      },
    });
  }
  assert.equal(state.invoices.length, 5);
  const total = state.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  assert.equal(total, 1500); // 100+200+300+400+500
});

test('CRM: invoice IDs are unique across multiple adds', () => {
  let state = makeState();
  state = crmReducer(state, { type: 'ADD_CONTACT', payload: makeContact('c1') });
  const ids = ['inv-a', 'inv-b', 'inv-c'];
  for (const id of ids) {
    state = crmReducer(state, {
      type: 'ADD_INVOICE',
      payload: {
        id,
        contactId: 'c1',
        contactName: 'Test',
        jobId: 'job-1',
        amount: 100,
        status: 'sent',
        dueDate: '2026-12-31',
        createdAt: new Date().toISOString(),
        items: [],
      },
    });
  }
  const uniqueIds = new Set(state.invoices.map((i) => i.id));
  assert.equal(uniqueIds.size, 3);
});

// ── Integration: Change order number format ────────────────────────────────

test('Change order number format matches CO-YYYY-NNN pattern', () => {
  const year = new Date().getFullYear();
  const regex = new RegExp(`^CO-${year}-\\d{3}$`);
  // Simulate number generation: CO-{year}-{count padded to 3}
  const formatNumber = (count: number) => `CO-${year}-${String(count).padStart(3, '0')}`;
  assert.match(formatNumber(1), regex);
  assert.match(formatNumber(42), regex);
  assert.match(formatNumber(100), regex);
});
