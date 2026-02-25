import React, { useState } from 'react';
import { useCRM, useCurrentContact } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import {
  Contact,
  Job,
  Communication,
  Document,
  statusLabels,
  statusColors,
  formatCurrency,
  formatDate,
  formatDateTime,
  getContactFullName,
  defaultLeadSources,
  CustomerStatus,
} from '@/lib/crmData';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Save,
  X,
  Plus,
  DollarSign,
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  Briefcase,
  Clock,
  Send,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  User,
  Building,
  Tag,
  Loader2,
} from 'lucide-react';

type TabType = 'overview' | 'timeline' | 'documents' | 'financial' | 'jobs';

export default function ContactDetail() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const contact = useCurrentContact();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [editedContact, setEditedContact] = useState<Contact | null>(null);
  const [newNote, setNewNote] = useState('');

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Select a contact to view details</p>
      </div>
    );
  }

  const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);

  const handleBack = () => {
    dispatch({ type: 'SELECT_CONTACT', payload: null });
    dispatch({ type: 'SET_VIEW', payload: 'contacts' });
  };

  const handleEdit = () => {
    setEditedContact({ ...contact });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editedContact) return;
    
    setIsSaving(true);
    try {
      // Update in database if user has company
      if (profile?.company_id) {
        await db.updateContact(editedContact.id, {
          first_name: editedContact.firstName,
          last_name: editedContact.lastName,
          email: editedContact.email,
          phone1: editedContact.phone1,
          phone2: editedContact.phone2,
          address: editedContact.address,
          city: editedContact.city,
          state: editedContact.state,
          zip: editedContact.zip,
          lead_source: editedContact.leadSource,
          assigned_to: editedContact.assignedTo,
          insurance_company: editedContact.insuranceCompany,
          policy_number: editedContact.policyNumber,
          claim_number: editedContact.claimNumber,
          adjuster_name: editedContact.adjusterName,
          adjuster_phone: editedContact.adjusterPhone,
          adjuster_email: editedContact.adjusterEmail,
          deductible: editedContact.deductible,
          is_retail: editedContact.isRetail,
          retail_notes: editedContact.retailNotes,
          notes: editedContact.notes,
        });
      }

      dispatch({ type: 'UPDATE_CONTACT', payload: { ...editedContact, updatedAt: new Date().toISOString() } });
      setIsEditing(false);
      setEditedContact(null);
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContact(null);
  };

  const handleStatusChange = async (newStatus: CustomerStatus) => {
    try {
      if (profile?.company_id) {
        await db.updateContact(contact.id, { status: newStatus });
      }
      dispatch({
        type: 'UPDATE_CONTACT_STATUS',
        payload: { contactId: contact.id, status: newStatus },
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      if (profile?.company_id) {
        await db.createCommunication({
          company_id: profile.company_id,
          contact_id: contact.id,
          type: 'note',
          direction: 'outbound',
          content: newNote,
          user_id: profile.id,
        });
      }

      const newComm: Communication = {
        id: `comm-${Date.now()}`,
        contactId: contact.id,
        type: 'note',
        direction: 'outbound',
        content: newNote,
        timestamp: new Date().toISOString(),
        userId: state.currentUser?.id || 'unknown',
        userName: state.currentUser?.name || 'Unknown User',
      };

      const updatedContact = {
        ...contact,
        communications: [...(contact.communications || []), newComm],
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_CONTACT', payload: updatedContact });
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleQuickCall = () => {
    if (!contact.phone1) {
      toast.error('No phone number available');
      return;
    }
    window.open(`tel:${contact.phone1}`, '_self');
  };

  const handleQuickEmail = () => {
    if (!contact.email) {
      toast.error('No email available');
      return;
    }
    window.open(`mailto:${contact.email}`, '_self');
  };

  const handleQuickSms = () => {
    if (!contact.phone1) {
      toast.error('No phone number available');
      return;
    }
    window.open(`sms:${contact.phone1}`, '_self');
  };

  const handleScheduleAppointment = () => {
    dispatch({ type: 'SET_VIEW', payload: 'calendar' });
    toast.info('Use New Appointment in Calendar to schedule this customer');
  };

  const handleReassignContact = async (newAssigneeId: string) => {
    if (newAssigneeId === contact.assignedTo) return;

    setIsReassigning(true);
    try {
      const updated = await db.updateContact(contact.id, {
        assigned_to: newAssigneeId || null,
      });

      if (!updated) {
        toast.error('Failed to reassign contact');
        return;
      }

      dispatch({
        type: 'UPDATE_CONTACT',
        payload: {
          ...contact,
          assignedTo: newAssigneeId,
          updatedAt: new Date().toISOString(),
        },
      });

      const newAssignee = state.teamMembers.find((tm) => tm.id === newAssigneeId);
      toast.success(`Reassigned to ${newAssignee?.name || 'team member'}`);
    } catch (error) {
      console.error('Error reassigning contact:', error);
      toast.error('Failed to reassign contact');
    } finally {
      setIsReassigning(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <User size={16} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign size={16} /> },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
  ];

  const currentData = isEditing && editedContact ? editedContact : contact;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {contact.firstName[0]}
                {contact.lastName[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {getContactFullName(contact)}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      statusColors[contact.status]
                    }`}
                  >
                    {statusLabels[contact.status]}
                  </span>
                  {contact.isRetail && (
                    <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-medium">
                      Retail
                    </span>
                  )}
                  {contact.insuranceCompany && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      Insurance
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <select
                  value={contact.status}
                  onChange={(e) => handleStatusChange(e.target.value as CustomerStatus)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Edit2 size={18} />
                  Edit
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={currentData.email}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, email: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.email || '-'}
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Primary Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={currentData.phone1}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, phone1: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        <a href={`tel:${contact.phone1}`} className="text-blue-600 hover:underline">
                          {contact.phone1 || '-'}
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Secondary Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={currentData.phone2 || ''}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, phone2: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-gray-900">{contact.phone2 || '-'}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Lead Source
                    </label>
                    {isEditing ? (
                      <select
                        value={currentData.leadSource}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, leadSource: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      >
                        {defaultLeadSources.map((ls) => (
                          <option key={ls.id} value={ls.name}>
                            {ls.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-gray-400" />
                        <span className="text-gray-900">{contact.leadSource || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                  {isEditing ? (
                    <div className="grid grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={currentData.address}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, address: e.target.value })
                        }
                        placeholder="Street Address"
                        className="col-span-4 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={currentData.city}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, city: e.target.value })
                        }
                        placeholder="City"
                        className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={currentData.state}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, state: e.target.value })
                        }
                        placeholder="State"
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={currentData.zip}
                        onChange={(e) =>
                          setEditedContact({ ...currentData, zip: e.target.value })
                        }
                        placeholder="ZIP"
                        className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-gray-400 mt-0.5" />
                      <span className="text-gray-900">
                        {contact.address ? `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}` : '-'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Insurance Info */}
              {(!currentData.isRetail || contact.insuranceCompany || contact.policyNumber || contact.claimNumber || isEditing) && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="text-blue-600" size={20} />
                    <h3 className="text-lg font-semibold text-gray-900">Insurance Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Customer Type</label>
                      {isEditing ? (
                        <select
                          value={currentData.isRetail ? 'retail' : 'insurance'}
                          onChange={(e) =>
                            setEditedContact({
                              ...currentData,
                              isRetail: e.target.value === 'retail',
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        >
                          <option value="insurance">Insurance</option>
                          <option value="retail">Retail</option>
                        </select>
                      ) : (
                        <p className="text-gray-900">{contact.isRetail ? 'Retail' : 'Insurance'}</p>
                      )}
                    </div>

                    {currentData.isRetail ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Retail Notes</label>
                        {isEditing ? (
                          <textarea
                            value={currentData.retailNotes || ''}
                            onChange={(e) =>
                              setEditedContact({ ...currentData, retailNotes: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                          />
                        ) : (
                          <p className="text-gray-900">{contact.retailNotes || '-'}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Insurance Company</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.insuranceCompany || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, insuranceCompany: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.insuranceCompany || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Policy Number</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.policyNumber || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, policyNumber: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.policyNumber || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Claim Number</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.claimNumber || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, claimNumber: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.claimNumber || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Deductible</label>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentData.deductible ?? ''}
                              onChange={(e) =>
                                setEditedContact({
                                  ...currentData,
                                  deductible: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">
                              {contact.deductible ? formatCurrency(contact.deductible) : '-'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Adjuster Name</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentData.adjusterName || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, adjusterName: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.adjusterName || '-'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Adjuster Phone</label>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={currentData.adjusterPhone || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, adjusterPhone: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : (
                            <p className="text-gray-900">{contact.adjusterPhone || '-'}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">Adjuster Email</label>
                          {isEditing ? (
                            <input
                              type="email"
                              value={currentData.adjusterEmail || ''}
                              onChange={(e) =>
                                setEditedContact({ ...currentData, adjusterEmail: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                          ) : contact.adjusterEmail ? (
                            <a href={`mailto:${contact.adjusterEmail}`} className="text-blue-600 hover:underline">{contact.adjusterEmail}</a>
                          ) : (
                            <p className="text-gray-900">-</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                {isEditing ? (
                  <textarea
                    value={currentData.notes || ''}
                    onChange={(e) =>
                      setEditedContact({ ...currentData, notes: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {contact.notes || 'No notes added yet.'}
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Project Pricing Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">Project Pricing</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-blue-200 text-sm">Project Value</p>
                    <p className="text-3xl font-bold">
                      {contact.projectValue ? formatCurrency(contact.projectValue) : '-'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-blue-200 text-sm">Deposit</p>
                      <p className="text-xl font-semibold">
                        {contact.depositAmount ? formatCurrency(contact.depositAmount) : '-'}
                      </p>
                      {contact.depositPaid ? (
                        <span className="inline-flex items-center gap-1 text-green-300 text-xs mt-1">
                          <CheckCircle size={12} /> Paid
                        </span>
                      ) : contact.depositAmount ? (
                        <span className="inline-flex items-center gap-1 text-yellow-300 text-xs mt-1">
                          <AlertCircle size={12} /> Pending
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-blue-200 text-sm">Final Payment</p>
                      <p className="text-xl font-semibold">
                        {contact.finalPaymentAmount
                          ? formatCurrency(contact.finalPaymentAmount)
                          : '-'}
                      </p>
                      {contact.finalPaymentPaid ? (
                        <span className="inline-flex items-center gap-1 text-green-300 text-xs mt-1">
                          <CheckCircle size={12} /> Paid
                        </span>
                      ) : contact.finalPaymentAmount ? (
                        <span className="inline-flex items-center gap-1 text-yellow-300 text-xs mt-1">
                          <AlertCircle size={12} /> Pending
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assigned To */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned To</h3>
                {assignee ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={assignee.avatar}
                      alt={assignee.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{assignee.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{assignee.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Not assigned</p>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Reassign Contact
                  </label>
                  <select
                    value={contact.assignedTo || ''}
                    onChange={(e) => {
                      void handleReassignContact(e.target.value);
                    }}
                    disabled={isReassigning}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {state.teamMembers.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button onClick={handleQuickCall} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Phone size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Call Customer</span>
                  </button>
                  <button onClick={handleQuickEmail} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Mail size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Send Email</span>
                  </button>
                  <button onClick={handleQuickSms} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <MessageSquare size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Send SMS</span>
                  </button>
                  <button onClick={handleScheduleAppointment} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left">
                    <Calendar size={18} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Schedule Appointment</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {(contact.communications || [])
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((comm) => (
                    <div key={comm.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          comm.type === 'email'
                            ? 'bg-blue-100 text-blue-600'
                            : comm.type === 'sms'
                            ? 'bg-green-100 text-green-600'
                            : comm.type === 'call'
                            ? 'bg-purple-100 text-purple-600'
                            : comm.type === 'insurance'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {comm.type === 'email' ? (
                          <Mail size={18} />
                        ) : comm.type === 'sms' ? (
                          <MessageSquare size={18} />
                        ) : comm.type === 'call' ? (
                          <Phone size={18} />
                        ) : comm.type === 'insurance' ? (
                          <Shield size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">{comm.userName}</span>
                          <span className="text-sm text-gray-500">
                            {formatDateTime(comm.timestamp)}
                          </span>
                        </div>
                        {comm.subject && (
                          <p className="text-sm font-medium text-gray-700 mb-1">{comm.subject}</p>
                        )}
                        <p className="text-gray-600">{comm.content}</p>
                      </div>
                    </div>
                  ))}
                {(!contact.communications || contact.communications.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
              <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'documents' })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Upload size={18} />
                Upload Document
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {(contact.documents || []).map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.size} • Uploaded {formatDate(doc.uploadedAt)} by {doc.uploadedBy}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => doc.url && window.open(doc.url, '_blank', 'noopener,noreferrer')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Download size={18} className="text-gray-500" />
                    </button>
                    <button onClick={() => doc.url && window.open(doc.url, '_blank', 'noopener,noreferrer')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <ExternalLink size={18} className="text-gray-500" />
                    </button>
                  </div>
                </div>
              ))}
              {(!contact.documents || contact.documents.length === 0) && (
                <div className="p-12 text-center text-gray-500">
                  <FileText size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No documents uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Project Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {contact.projectValue ? formatCurrency(contact.projectValue) : '-'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Deposit</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {contact.depositAmount ? formatCurrency(contact.depositAmount) : '-'}
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-sm mt-2 ${
                    contact.depositPaid ? 'text-green-600' : 'text-amber-600'
                  }`}
                >
                  {contact.depositPaid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {contact.depositPaid ? `Paid ${formatDate(contact.depositDate!)}` : 'Pending'}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Final Payment</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {contact.finalPaymentAmount ? formatCurrency(contact.finalPaymentAmount) : '-'}
                </p>
                {contact.finalPaymentAmount && (
                  <span
                    className={`inline-flex items-center gap-1 text-sm mt-2 ${
                      contact.finalPaymentPaid ? 'text-green-600' : 'text-amber-600'
                    }`}
                  >
                    {contact.finalPaymentPaid ? (
                      <CheckCircle size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    {contact.finalPaymentPaid
                      ? `Paid ${formatDate(contact.finalPaymentDate!)}`
                      : 'Pending'}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Actions</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_INVOICE_MODAL' })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Create Invoice
                </button>
                <button onClick={() => { dispatch({ type: 'SET_VIEW', payload: 'financial' }); dispatch({ type: 'TOGGLE_INVOICE_MODAL' }); }} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <DollarSign size={18} />
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Jobs</h3>
              <button onClick={() => { dispatch({ type: 'SET_VIEW', payload: 'calendar' }); toast.info('Create a new appointment for this customer in Calendar'); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={18} />
                Add Job
              </button>
            </div>

            {(contact.jobs || []).map((job) => (
              <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{job.title}</h4>
                    <p className="text-gray-500 mt-1">{job.description}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      job.status === 'complete'
                        ? 'bg-green-100 text-green-800'
                        : job.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : job.status === 'scheduled'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Estimated Value</p>
                    <p className="font-medium text-gray-900">{formatCurrency(job.estimatedValue)}</p>
                  </div>
                  {job.scheduledDate && (
                    <div>
                      <p className="text-gray-500">Scheduled</p>
                      <p className="font-medium text-gray-900">{formatDate(job.scheduledDate)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(!contact.jobs || contact.jobs.length === 0) && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Briefcase size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">No jobs created yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
