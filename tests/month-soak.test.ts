import assert from 'node:assert/strict';
import test from 'node:test';
import type { Contact } from '../src/lib/crmData';
import { defaultBoards, defaultLeadSources } from '../src/lib/crmData';
import type { CRMState } from '../src/lib/crmStore';
import { canAssignRole, canModifyMember, crmReducer } from '../src/lib/crmStore';

function makeInitialState(): CRMState {
  return {
    currentUser: null,
    companyId: 'company-soak',
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

function makeContact(id: string, index: number): Contact {
  const iso = new Date(Date.UTC(2026, 0, 1 + index)).toISOString();
  return {
    id,
    firstName: `First${index}`,
    lastName: `Last${index}`,
    email: `contact-${index}@example.com`,
    phone1: `555-01${String(index).padStart(2, '0')}`,
    address: `${index} Main St`,
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

test('30-day reducer soak keeps CRM state coherent', () => {
  let state = makeInitialState();
  let contactCounter = 0;
  let appointmentCounter = 0;
  let invoiceCounter = 0;

  for (let day = 0; day < 30; day += 1) {
    for (let i = 0; i < 8; i += 1) {
      const contactId = `c-${contactCounter}`;
      const contact = makeContact(contactId, contactCounter);
      state = crmReducer(state, { type: 'ADD_CONTACT', payload: contact });
      contactCounter += 1;
    }

    const statusCycle: Contact['status'][] = ['lead', 'appt_set', 'estimate_sent', 'signed', 'completed'];
    state.contacts.forEach((contact, idx) => {
      if (idx % 5 === day % 5) {
        state = crmReducer(state, {
          type: 'UPDATE_CONTACT_STATUS',
          payload: { contactId: contact.id, status: statusCycle[(day + idx) % statusCycle.length] },
        });
      }
    });

    const activeContactIds = state.contacts.map((c) => c.id);
    for (let i = 0; i < Math.min(6, activeContactIds.length); i += 1) {
      const contactId = activeContactIds[(day * 7 + i) % activeContactIds.length];
      const aptId = `apt-${appointmentCounter}`;
      appointmentCounter += 1;
      state = crmReducer(state, {
        type: 'ADD_APPOINTMENT',
        payload: {
          id: aptId,
          contactId,
          contactName: `Contact ${contactId}`,
          title: 'Follow-up',
          type: 'follow_up',
          date: `2026-02-${String((day % 28) + 1).padStart(2, '0')}`,
          time: '10:00',
          duration: 30,
          assignedTo: 'tm1',
          location: 'Phone',
          status: 'scheduled',
        },
      });
    }

    if (state.contacts.length > 0) {
      const contactId = state.contacts[day % state.contacts.length].id;
      const invoiceId = `inv-${invoiceCounter}`;
      invoiceCounter += 1;
      state = crmReducer(state, {
        type: 'ADD_INVOICE',
        payload: {
          id: invoiceId,
          contactId,
          contactName: `Contact ${contactId}`,
          jobId: `job-${invoiceId}`,
          amount: 500 + day,
          status: day % 3 === 0 ? 'paid' : 'sent',
          dueDate: '2026-03-15',
          createdAt: '2026-02-01T00:00:00.000Z',
          items: [{ description: 'Work', quantity: 1, unitPrice: 500 + day, total: 500 + day }],
        },
      });
    }

    if (state.contacts.length > 60) {
      const deleteId = state.contacts[0].id;
      state = crmReducer(state, { type: 'SELECT_CONTACT', payload: deleteId });
      state = crmReducer(state, { type: 'DELETE_CONTACT', payload: deleteId });
      assert.equal(state.selectedContactId, null);
    }

    const uniqueContactIds = new Set(state.contacts.map((c) => c.id));
    const uniqueAppointmentIds = new Set(state.appointments.map((a) => a.id));
    const uniqueInvoiceIds = new Set(state.invoices.map((i) => i.id));

    assert.equal(uniqueContactIds.size, state.contacts.length);
    assert.equal(uniqueAppointmentIds.size, state.appointments.length);
    assert.equal(uniqueInvoiceIds.size, state.invoices.length);
  }

  assert.equal(canAssignRole('manager', 'owner'), false);
  assert.equal(canAssignRole('owner', 'owner'), true);
  assert.equal(canModifyMember('admin', 'manager'), false);
  assert.equal(canModifyMember('admin', 'sales'), true);
});
