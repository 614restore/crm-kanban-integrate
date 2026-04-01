import React, { useRef, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { useCRM, useFilteredContacts } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { toast } from 'sonner';
import { exportContactsToExcel } from '@/lib/exportUtils';
import {
  Contact,
  statusLabels,
  statusColors,
  formatCurrency,
  formatDate,
  getContactFullName,
} from '@/lib/crmData';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Grid,
  List,
  ChevronDown,
  Trash2,
  Edit2,
  Eye,
  Download,
  Upload,
  CheckSquare,
  Square,
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  Users,
} from 'lucide-react';

type SortField = 'name' | 'status' | 'createdAt' | 'projectValue';
type SortDirection = 'asc' | 'desc';

export default function ContactList() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const filteredContacts = useFilteredContacts();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedContacts, setArchivedContacts] = useState<Contact[]>([]);

  // Sort contacts
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = getContactFullName(a).localeCompare(getContactFullName(b));
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'projectValue':
        comparison = (a.projectValue || 0) - (b.projectValue || 0);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Load archived contacts from Supabase
  const loadArchivedContacts = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });
    if (data) setArchivedContacts(data as unknown as Contact[]);
  }, [profile?.company_id]);

  useEffect(() => { if (showArchived) loadArchivedContacts(); }, [showArchived, loadArchivedContacts]);

  const handleArchiveContact = async (contactId: string) => {
    if (!confirm('Archive this contact? They will be hidden from the active list but can be restored.')) return;
    const { error } = await supabase
      .from('contacts')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', contactId);
    if (error) { toast.error('Failed to archive contact'); return; }
    dispatch({ type: 'DELETE_CONTACT', payload: contactId });
    toast.success('Contact archived');
  };

  const handleRestoreContact = async (contactId: string) => {
    const { error } = await supabase
      .from('contacts')
      .update({ is_archived: false, archived_at: null })
      .eq('id', contactId);
    if (error) { toast.error('Failed to restore contact'); return; }
    setArchivedContacts(prev => prev.filter(c => c.id !== contactId));
    toast.success('Contact restored — refresh Contacts to see them');
  };

  const handleExportArchived = () => {
    if (archivedContacts.length === 0) { toast.error('No archived contacts to export'); return; }
    exportContactsToExcel(archivedContacts, `archived-contacts-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${archivedContacts.length} archived contacts`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === sortedContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(sortedContacts.map((c) => c.id)));
    }
  };

  const handleViewContact = (contactId: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: contactId });
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contacts?`)) return;

    if (!state.companyId) {
      toast.error('No company selected. Please refresh and sign in again.');
      return;
    }

    try {
      const selectedIds = Array.from(selectedContacts);
      const results = await Promise.all(selectedIds.map((id) => db.deleteContact(id)));
      const failed = results.filter((ok) => !ok).length;

      if (failed > 0) {
        toast.error(`Failed to delete ${failed} contact${failed === 1 ? '' : 's'}.`);
      }

      selectedIds
        .filter((_, index) => results[index])
        .forEach((id) => dispatch({ type: 'DELETE_CONTACT', payload: id }));

      setSelectedContacts(new Set());
    } catch (error) {
      console.error('Error deleting selected contacts:', error);
      toast.error('Failed to delete selected contacts');
    }
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide ${
        sortField === field ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      <ArrowUpDown size={12} />
    </button>
  );

  const handleImportContacts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error('CSV is empty');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const index = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

    const firstNameIdx = index('first_name');
    const lastNameIdx = index('last_name');
    if (firstNameIdx === -1 || lastNameIdx === -1) {
      toast.error('CSV must include first_name and last_name columns');
      return;
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const firstName = cols[firstNameIdx] || '';
      const lastName = cols[lastNameIdx] || '';
      if (!firstName || !lastName) continue;

      const newContact: Contact = {
        id: `c-import-${Date.now()}-${i}`,
        firstName,
        lastName,
        email: cols[index('email')] || '',
        phone1: cols[index('phone')] || '',
        address: '',
        city: cols[index('city')] || '',
        state: cols[index('state')] || '',
        zip: '',
        status: (cols[index('status')] as any) || 'lead',
        leadSource: 'Import',
        assignedTo: state.currentUser?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      };

      if (!state.companyId) {
        toast.error('No company selected. Import requires an active company workspace.');
        break;
      }

      try {
        await db.createContact({
          company_id: state.companyId,
          first_name: newContact.firstName,
          last_name: newContact.lastName,
          email: newContact.email || undefined,
          phone1: newContact.phone1 || undefined,
          city: newContact.city || undefined,
          state: newContact.state || undefined,
          status: newContact.status,
          lead_source: newContact.leadSource,
          assigned_to: newContact.assignedTo || undefined,
          tags: [],
        });
        imported += 1;
      } catch (err) {
        console.error('Failed to import contact:', err);
        toast.error(`Failed to import contact: ${newContact.firstName} ${newContact.lastName}`);
        continue;
      }
    }

    toast.success(`Imported ${imported} contacts`);
    e.target.value = '';
  };

  const handleExportContacts = () => {
    try {
      const contactsToExport = selectedContacts.size > 0
        ? sortedContacts.filter(c => selectedContacts.has(c.id))
        : sortedContacts;
      
      if (contactsToExport.length === 0) {
        toast.error('No contacts to export');
        return;
      }
      
      exportContactsToExcel(contactsToExport);
      toast.success(`Exported ${contactsToExport.length} contacts to Excel`);
    } catch (error) {
      console.error('Error exporting contacts:', error);
      toast.error('Failed to export contacts');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportContacts}
      />

      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Contacts</h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredContacts.length} contacts found
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowArchived(a => !a)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${showArchived ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Archive size={18} />
              {showArchived ? 'Active Contacts' : 'Archived'}
            </button>
            <button
              onClick={handleExportContacts}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download size={18} />
              <span className="text-sm font-medium">Export</span>
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Upload size={18} />
              <span className="text-sm font-medium">Import</span>
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              <span className="font-medium">Add Contact</span>
            </button>
          </div>
        </div>

        {/* View Toggle & Bulk Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedContacts.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-blue-700">
                  {selectedContacts.size} selected
                </span>
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedContacts(new Set())}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <List size={18} className={viewMode === 'list' ? 'text-blue-600' : 'text-gray-500'} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Grid size={18} className={viewMode === 'grid' ? 'text-blue-600' : 'text-gray-500'} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {viewMode === 'list' ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="col-span-1 flex items-center">
                <button onClick={handleSelectAll} className="text-gray-400 hover:text-gray-600">
                  {selectedContacts.size === sortedContacts.length && sortedContacts.length > 0 ? (
                    <CheckSquare size={18} className="text-blue-600" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </div>
              <div className="col-span-3">
                <SortButton field="name" label="Contact" />
              </div>
              <div className="col-span-2">
                <SortButton field="status" label="Status" />
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Location
                </span>
              </div>
              <div className="col-span-2">
                <SortButton field="projectValue" label="Value" />
              </div>
              <div className="col-span-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Assigned
                </span>
              </div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {sortedContacts.map((contact) => {
                const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
                const isSelected = selectedContacts.has(contact.id);

                return (
                  <div
                    key={contact.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="col-span-1 flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectContact(contact.id);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </div>
                    <div
                      className="col-span-3 flex items-center gap-3 cursor-pointer"
                      onClick={() => handleViewContact(contact.id)}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {contact.firstName[0]}
                        {contact.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {getContactFullName(contact)}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusColors[contact.status]
                        }`}
                      >
                        {statusLabels[contact.status]}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-gray-600">
                      {contact.city}, {contact.state}
                    </div>
                    <div className="col-span-2 flex items-center">
                      {contact.projectValue ? (
                        <span className="font-medium text-gray-900">
                          {formatCurrency(contact.projectValue)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div className="col-span-1 flex items-center">
                      {assignee && (
                        <img
                          src={assignee.avatar}
                          alt={assignee.name}
                          className="w-8 h-8 rounded-full object-cover"
                          title={assignee.name}
                        />
                      )}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleViewContact(contact.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleViewContact(contact.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchiveContact(contact.id); }}
                        className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                        title="Archive"
                      >
                        <Archive size={16} className="text-gray-400 hover:text-amber-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {sortedContacts.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {state.contacts.length === 0
                    ? <Users size={24} className="text-gray-400" />
                    : <Search size={24} className="text-gray-400" />}
                </div>
                {state.contacts.length === 0 ? (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No contacts yet</h3>
                    <p className="text-gray-500 mb-4">Add your first contact to get started.</p>
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Plus size={16} />
                      Add First Contact
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No contacts found</h3>
                    <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedContacts.map((contact) => {
              const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
              const isSelected = selectedContacts.has(contact.id);

              return (
                <div
                  key={contact.id}
                  className={`bg-white rounded-xl border p-5 hover:shadow-md transition-all cursor-pointer ${
                    isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200'
                  }`}
                  onClick={() => handleViewContact(contact.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {contact.firstName[0]}
                        {contact.lastName[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {getContactFullName(contact)}
                        </h3>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                            statusColors[contact.status]
                          }`}
                        >
                          {statusLabels[contact.status]}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectContact(contact.id);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-blue-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail size={14} className="text-gray-400" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={14} className="text-gray-400" />
                      <span>{contact.phone1}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={14} className="text-gray-400" />
                      <span>
                        {contact.city}, {contact.state}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      {contact.projectValue ? (
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(contact.projectValue)}
                        </p>
                      ) : (
                        <p className="text-gray-400 text-sm">No value set</p>
                      )}
                    </div>
                    {assignee && (
                      <img
                        src={assignee.avatar}
                        alt={assignee.name}
                        className="w-8 h-8 rounded-full object-cover"
                        title={assignee.name}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Archived Contacts Panel */}
      {showArchived && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Archive size={20} className="text-amber-600" />
              <h3 className="text-lg font-semibold text-amber-900">Archived Contacts ({archivedContacts.length})</h3>
            </div>
            <button
              onClick={handleExportArchived}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
            >
              <Download size={16} /> Export to Excel
            </button>
          </div>
          {archivedContacts.length === 0 ? (
            <p className="text-amber-700 text-sm">No archived contacts.</p>
          ) : (
            <div className="space-y-2">
              {archivedContacts.map(contact => (
                <div key={contact.id} className="bg-white border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{getContactFullName(contact)}</p>
                    <p className="text-sm text-gray-500">{contact.email} · {contact.phone1}</p>
                  </div>
                  <button
                    onClick={() => handleRestoreContact(contact.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg"
                  >
                    <ArchiveRestore size={14} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
