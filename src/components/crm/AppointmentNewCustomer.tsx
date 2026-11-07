import React, { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useCRM } from '@/lib/crmStore';
import { db } from '@/lib/database';
import { Contact, CustomerStatus } from '@/lib/crmData';
import { formatPhoneNumber } from '@/lib/utils';
import { fireAutomationEvent } from '@/lib/automationEngine';

/**
 * Add a new customer without leaving the appointment form. It creates the customer the same way the Quick Add
 * form does (same duplicate check, same store update, same new-contact automation), then hands the customer
 * back so the appointment picks them. The full Quick Add form is still there for everything else (insurance
 * details, project type, rough estimate); this is the name, how to reach them, and where the job is.
 */

interface Props {
  companyId: string;
  /** The team member who will own the customer: the appointment's assignee, else the signed-in user. */
  assignedTo: string;
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}

const input =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none';

export default function AppointmentNewCustomer({ companyId, assignedTo, onCreated, onCancel }: Props) {
  const { state, dispatch } = useCRM();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone1: '', email: '', address: '', city: '', state: '', zip: '' });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const toContact = (row: any): Contact => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email || '',
    phone1: row.phone1 || '',
    phone2: row.phone2 || undefined,
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    status: row.status as CustomerStatus,
    leadSource: row.lead_source || '',
    assignedTo: row.assigned_to || assignedTo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags || [],
    projectType: row.project_type || undefined,
    projectValue: row.project_value || undefined,
    isRetail: row.is_retail,
  } as Contact);

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Enter the customer’s first and last name.');
      return;
    }
    setSaving(true);
    try {
      // An existing customer with the same name, email or phone: offer to use them rather than make a twin.
      const dupes = await db.findDuplicateContacts(
        companyId,
        form.firstName.trim(),
        form.lastName.trim(),
        form.email.trim(),
        form.phone1.trim(),
      );
      if (dupes.length > 0) {
        const d = dupes[0];
        const useExisting = window.confirm(
          `${d.first_name} ${d.last_name}${d.phone1 ? ` (${d.phone1})` : ''} already looks like a match.\n\nOK = use the existing customer.\nCancel = create a new customer anyway.`,
        );
        if (useExisting) {
          const existing = state.contacts.find((c) => c.id === d.id) ?? toContact(d);
          onCreated(existing);
          return;
        }
      }

      const row = await db.createContact({
        company_id: companyId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone1: form.phone1.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zip: form.zip.trim() || undefined,
        status: 'prospect',
        assigned_to: assignedTo || undefined,
        tags: [],
      } as any);
      if (!row) throw new Error('The customer was not saved. Please try again.');

      const contact = toContact(row);
      dispatch({ type: 'ADD_CONTACT', payload: contact });
      fireAutomationEvent('new_contact_created', companyId, {
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`.trim(),
        contactEmail: contact.email,
        assignedTo: contact.assignedTo,
        newStatus: contact.status,
      }).catch(() => {});
      toast.success(`${contact.firstName} ${contact.lastName} added`);
      onCreated(contact);
    } catch (err: any) {
      toast.error(err?.message || 'Could not add the customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <UserPlus size={15} /> New customer
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="First name *" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} autoFocus />
        <input className={input} placeholder="Last name *" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        <input className={input} placeholder="Phone" value={form.phone1} onChange={(e) => set({ phone1: formatPhoneNumber(e.target.value) })} />
        <input className={input} placeholder="Email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <input className={input} placeholder="Street address" value={form.address} onChange={(e) => set({ address: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <input className={input} placeholder="City" value={form.city} onChange={(e) => set({ city: e.target.value })} />
        <input className={input} placeholder="State" value={form.state} onChange={(e) => set({ state: e.target.value })} />
        <input className={input} placeholder="Zip" value={form.zip} onChange={(e) => set({ zip: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Add &amp; select
        </button>
      </div>
    </div>
  );
}
