import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { fireAutomationEvent } from '@/lib/automationEngine';
import { Invoice, InvoiceItem, Contact, formatCurrency, getContactFullName } from '@/lib/crmData';
import { toast } from 'sonner';
import { X, Plus, Trash2, Save, Send, DollarSign, Search } from 'lucide-react';

export default function InvoiceModal() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const prefill = state.invoiceModalPrefill;
  const [selectedContactId, setSelectedContactId] = useState(prefill?.contactId || '');
  const [contactSearch, setContactSearch] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<InvoiceItem[]>(
    prefill?.items?.length
      ? prefill.items.map((i: any) => ({
          description: i.description || '',
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice || i.unit_price || 0),
          total: Number(i.total || 0),
        }))
      : [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]
  );
  const [notes, setNotes] = useState(prefill?.notes || '');

  // Re-initialize if prefill changes (new conversion)
  useEffect(() => {
    if (prefill) {
      if (prefill.contactId) setSelectedContactId(prefill.contactId);
      if (prefill.items?.length) {
        setItems(prefill.items.map((i: any) => ({
          description: i.description || '',
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice || i.unit_price || 0),
          total: Number(i.total || 0),
        })));
      }
      if (prefill.notes) setNotes(prefill.notes);
    }
  }, [state.invoiceModalPrefill]);

  if (!state.showInvoiceModal) return null;

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return state.contacts;

    return state.contacts.filter((contact) => {
      const fullName = getContactFullName(contact).toLowerCase();
      return (
        fullName.includes(query) ||
        contact.phone1.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query)
      );
    });
  }, [contactSearch, state.contacts]);

  const selectedContact = state.contacts.find((c) => c.id === selectedContactId);

  const handleCreateCustomer = async () => {
    if (!newCustomerFirstName.trim() || !newCustomerLastName.trim() || !newCustomerPhone.trim()) {
      toast.error('First name, last name, and phone are required');
      return;
    }

    const effectiveCompanyId = profile?.company_id || state.companyId;
    if (!effectiveCompanyId) {
      toast.error('No company selected. Please refresh and sign in again.');
      return;
    }

    if (newCustomerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newCustomerEmail.trim())) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    setIsCreatingCustomer(true);
    try {
      // Validate required fields
      if (!newCustomerFirstName.trim() || !newCustomerLastName.trim() || !newCustomerPhone.trim()) {
        toast.error('First name, last name, and phone are required.');
        setIsCreatingCustomer(false);
        return;
      }
      // Save with timeout
      let created = null;
      try {
        created = await withTimeout(
          db.createContact({
            company_id: effectiveCompanyId,
            first_name: newCustomerFirstName.trim(),
            last_name: newCustomerLastName.trim(),
            phone1: newCustomerPhone.trim(),
            email: newCustomerEmail.trim() || undefined,
            address: newCustomerAddress.trim() || undefined,
            status: 'lead',
            lead_source: 'Invoice',
            tags: [],
          }),
          15000,
          'Create contact from invoice'
        );
      } catch (error) {
        toast.error(`Failed to create customer: ${error?.message || error}`);
        setIsCreatingCustomer(false);
        return;
      }
      if (!created) {
        toast.error('Failed to create customer');
        setIsCreatingCustomer(false);
        return;
      }
      const newContact: Contact = {
        id: created.id,
        firstName: created.first_name,
        lastName: created.last_name,
        email: created.email || '',
        phone1: created.phone1 || '',
        phone2: created.phone2 || undefined,
        address: created.address || '',
        city: created.city || '',
        state: created.state || '',
        zip: created.zip || '',
        status: (created.status as Contact['status']) || 'lead',
        leadSource: created.lead_source || 'Invoice',
        assignedTo: created.assigned_to || '',
        createdAt: created.created_at,
        updatedAt: created.updated_at,
        tags: created.tags || [],
        insuranceCompany: created.insurance_company || undefined,
        policyNumber: created.policy_number || undefined,
        claimNumber: created.claim_number || undefined,
        adjusterName: created.adjuster_name || undefined,
        adjusterPhone: created.adjuster_phone || undefined,
        adjusterEmail: created.adjuster_email || undefined,
        deductible: created.deductible || undefined,
        projectType: created.project_type || undefined,
        projectValue: created.project_value || undefined,
        isRetail: created.is_retail,
        retailNotes: created.retail_notes || undefined,
        notes: created.notes || undefined,
      };

      dispatch({ type: 'ADD_CONTACT', payload: newContact });
      setSelectedContactId(created.id);
      setContactSearch(`${created.first_name} ${created.last_name}`);
      setShowAddCustomer(false);
      setNewCustomerFirstName('');
      setNewCustomerLastName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
      toast.success('Customer added and selected');
    } catch (err) {
      console.error('Error creating customer from invoice modal:', err);
      toast.error('Failed to create customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    if (field === 'description') {
      newItems[index].description = value as string;
    } else if (field === 'quantity') {
      newItems[index].quantity = Number(value) || 0;
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    } else if (field === 'unitPrice') {
      newItems[index].unitPrice = Number(value) || 0;
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.0825; // 8.25% tax
  const total = subtotal + tax;

  const handleSave = async (status: 'draft' | 'sent') => {
    const validItems = items.filter((item) => item.description && item.total > 0);
    if (!selectedContactId || !dueDate || validItems.length === 0) {
      toast.error('Please select a customer, due date, and at least one line item');
      return;
    }

    const effectiveCompanyId = profile?.company_id || state.companyId;
    if (!effectiveCompanyId) {
      toast.error('No company selected. Please refresh and sign in again.');
      return;
    }

    const createdInvoice = await db.createInvoice(
      {
        company_id: effectiveCompanyId,
        contact_id: selectedContactId,
        amount: total,
        tax_amount: tax,
        status,
        due_date: dueDate,
        notes: notes || undefined,
      },
      validItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
      }))
    );

    if (!createdInvoice) {
      toast.error('Failed to save invoice');
      return;
    }

    const newInvoice: Invoice = {
      id: createdInvoice.id,
      contactId: selectedContactId,
      contactName: selectedContact ? getContactFullName(selectedContact) : '',
      jobId: createdInvoice.job_id || '',
      amount: createdInvoice.amount,
      status: createdInvoice.status as Invoice['status'],
      dueDate: createdInvoice.due_date || dueDate,
      createdAt: createdInvoice.created_at,
      items: validItems,
    };

    dispatch({ type: 'ADD_INVOICE', payload: newInvoice });

    fireAutomationEvent('invoice_created', effectiveCompanyId, {
      contactId: selectedContactId,
      contactName: newInvoice.contactName,
      amount: newInvoice.amount,
    }).catch(() => {});

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: `notif-${Date.now()}`,
        type: 'success',
        title: status === 'sent' ? 'Invoice Sent' : 'Invoice Saved',
        message: `Invoice has been ${status === 'sent' ? 'sent to' : 'saved for'} ${newInvoice.contactName}`,
        timestamp: new Date().toISOString(),
        read: false,
      },
    });
    dispatch({ type: 'TOGGLE_INVOICE_MODAL' });
  };

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_INVOICE_MODAL' });
    setSelectedContactId('');
    setContactSearch('');
    setShowAddCustomer(false);
    setNewCustomerFirstName('');
    setNewCustomerLastName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
    setDueDate('');
    setItems([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setNotes('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Invoice</h2>
            <p className="text-sm text-gray-500 mt-1">Generate a new invoice for a customer</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Customer & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search customer by name, phone, or email"
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select a customer...</option>
                    {filteredContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {getContactFullName(contact)}
                        {contact.phone1 ? ` — ${contact.phone1}` : ''}
                      </option>
                    ))}
                  </select>

                  {filteredContacts.length === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                      No customers match your search.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAddCustomer((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-medium"
                  >
                    <Plus size={14} />
                    {showAddCustomer ? 'Cancel new customer' : 'Add new customer'}
                  </button>

                  {showAddCustomer && (
                    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newCustomerFirstName}
                          onChange={(e) => setNewCustomerFirstName(e.target.value)}
                          placeholder="First name *"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <input
                          type="text"
                          value={newCustomerLastName}
                          onChange={(e) => setNewCustomerLastName(e.target.value)}
                          placeholder="Last name *"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <input
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Phone *"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="Email (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={newCustomerAddress}
                        onChange={(e) => setNewCustomerAddress(e.target.value)}
                        placeholder="Address (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleCreateCustomer}
                          disabled={isCreatingCustomer}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {isCreatingCustomer ? 'Adding...' : 'Add & Select Customer'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Customer Info Preview */}
            {selectedContact && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{getContactFullName(selectedContact)}</p>
                <p className="text-sm text-gray-500">{selectedContact.email}</p>
                <p className="text-sm text-gray-500">
                  {selectedContact.address}, {selectedContact.city}, {selectedContact.state}{' '}
                  {selectedContact.zip}
                </p>
              </div>
            )}

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Line Items</label>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-center"
                    />
                    <div className="relative w-32">
                      <DollarSign
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="number"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        placeholder="Price"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="w-28 text-right font-medium text-gray-900">
                      {formatCurrency(item.total)}
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddItem}
                className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                <Plus size={16} />
                Add Line Item
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes or terms..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax (8.25%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={!selectedContactId}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            Save Draft
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={!selectedContactId}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
            Send Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
