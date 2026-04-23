import React, { useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { db, type DbContact } from '@/lib/database';
import { ensureUserHasCompany } from '@/lib/setupCompany';
import { Contact, defaultLeadSources, CustomerStatus } from '@/lib/crmData';
import { formatPhoneNumber } from '@/lib/utils';
import { X, User, Phone, Mail, MapPin, DollarSign, Tag, Shield, Building, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { fireAutomationEvent } from '@/lib/automationEngine';
import DuplicateContactDialog from './DuplicateContactDialog';

type FormStep = 'basic' | 'project' | 'insurance' | 'appointment';

export default function QuickAddModal() {
  const { state, dispatch } = useCRM();
  const { profile, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FormStep>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DbContact[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone1: '',
    phone2: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    leadSource: 'Door Knock',
    assignedTo: state.currentUser?.id || state.teamMembers[0]?.id || '',
    status: 'prospect' as CustomerStatus,
    projectType: '',
    projectValue: '',
    isRetail: false,
    retailNotes: '',
    insuranceCompany: '',
    policyNumber: '',
    claimNumber: '',
    adjusterName: '',
    adjusterPhone: '',
    deductible: '',
    notes: '',
  });

  // Appointment scheduling state
  const [scheduleAppt, setScheduleAppt] = useState(false);
  // Timeout helper for database operations
  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const resolveCompanyId = async (): Promise<string | null> => {
    // ensureUserHasCompany runs up to 6 sequential Supabase calls (check → create →
    // update×3 → verify). 30 s gives ample room even on slow connections.
    // withTimeout properly clears the timer on success to avoid leaks.
    const resolveLogic = async (): Promise<string | null> => {
      const currentCompanyId = profile?.company_id || state.companyId || null;
      if (currentCompanyId) return currentCompanyId;

      const userId = profile?.id || user?.id;
      const userEmail = profile?.email || user?.email || '';
      if (!userId || !userEmail) return null;

      const profileResult = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

      if (!profileResult.error && profileResult.data?.company_id) {
        dispatch({ type: 'SET_COMPANY_ID', payload: profileResult.data.company_id });
        return profileResult.data.company_id;
      }

      const ensured = await ensureUserHasCompany(userId, userEmail);
      if (ensured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', userId)
          .single();

        if (!error && data?.company_id) {
          dispatch({ type: 'SET_COMPANY_ID', payload: data.company_id });
          return data.company_id;
        }
      }

      // Final fallback: create and link a company in case previous steps could not repair context.
      const companyName = userEmail.split('@')[0] || 'My Company';
      const createdCompany = await db.createCompany({
        name: companyName + "'s Company",
        email: userEmail,
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        website: '',
      });

      if (!createdCompany?.id) return null;

      const { error: linkError } = await supabase
        .from('profiles')
        .update({ company_id: createdCompany.id })
        .eq('id', userId);

      if (linkError) {
        console.error('Failed to link fallback company for Quick Add:', linkError);
        return null;
      }

      dispatch({ type: 'SET_COMPANY_ID', payload: createdCompany.id });
      return createdCompany.id;
    };

    return withTimeout(resolveLogic(), 30000, 'Company resolution');
  };

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_QUICK_ADD' });
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone1: '',
      phone2: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      leadSource: 'Door Knock',
      assignedTo: state.currentUser?.id || state.teamMembers[0]?.id || '',
      status: 'lead',
      projectType: '',
      projectValue: '',
      isRetail: false,
      retailNotes: '',
      insuranceCompany: '',
      policyNumber: '',
      claimNumber: '',
      adjusterName: '',
      adjusterPhone: '',
      deductible: '',
      notes: '',
    });
    setCurrentStep('basic');
    setScheduleAppt(false);
  };

  const handleViewContact = (contactId: string) => {
    // Close dialogs and navigate to contact
    setShowDuplicateDialog(false);
    handleClose();
    dispatch({ type: 'SET_SELECTED_CONTACT', payload: contactId });
  };

  const handleCreateAnyway = async () => {
    setShowDuplicateDialog(false);
    await saveContact(true); // Force create despite duplicates
  };

  const checkForDuplicates = async (companyId: string): Promise<boolean> => {
    try {
      const foundDuplicates = await db.findDuplicateContacts(
        companyId,
        formData.firstName.trim(),
        formData.lastName.trim(),
        formData.email.trim(),
        formData.phone1.trim()
      );

      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        setShowDuplicateDialog(true);
        return true; // Found duplicates
      }
      return false; // No duplicates
    } catch (err) {
      console.error('Error checking for duplicates:', err);
      return false; // On error, allow creation
    }
  };

  const saveContact = async (skipDuplicateCheck = false) => {
    setIsSubmitting(true);
    try {
      // Use company_id from auth profile (preferred) or CRM state (populated by AppLayout).
      const finalCompanyId = profile?.company_id || state.companyId;

      if (!finalCompanyId) {
        throw new Error('Your account is still loading. Please wait a moment and try again, or refresh the page.');
      }

      // Check for duplicates unless explicitly skipped
      if (!skipDuplicateCheck) {
        const hasDuplicates = await checkForDuplicates(finalCompanyId);
        if (hasDuplicates) {
          return; // Stop here, user will choose action from dialog
        }
      }

      // Ensure contact is always assigned - default to current user if not specified
      const assignedTo = formData.assignedTo || profile?.id || user?.id;
      
      const dbContact = await withTimeout(
        db.createContact({
          company_id: finalCompanyId,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email || undefined,
          phone1: formData.phone1 || undefined,
          phone2: formData.phone2 || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zip: formData.zip || undefined,
          status: formData.status,
          lead_source: formData.leadSource,
          assigned_to: assignedTo,
          tags: [],
          project_type: formData.projectType || undefined,
          project_value: formData.projectValue ? parseFloat(formData.projectValue) : undefined,
          is_retail: formData.isRetail,
          retail_notes: formData.retailNotes || undefined,
          insurance_company: formData.insuranceCompany || undefined,
          policy_number: formData.policyNumber || undefined,
          claim_number: formData.claimNumber || undefined,
          adjuster_name: formData.adjusterName || undefined,
          adjuster_phone: formData.adjusterPhone || undefined,
          deductible: formData.deductible ? parseFloat(formData.deductible) : undefined,
          notes: formData.notes || undefined,
        }),
        45000,
        'Create contact'
      );

      if (!dbContact) {
        throw new Error('Contact was not saved. Please try again.');
      }

      const createdContact: Contact = {
          id: dbContact.id,
          firstName: dbContact.first_name,
          lastName: dbContact.last_name,
          email: dbContact.email || '',
          phone1: dbContact.phone1 || '',
          phone2: dbContact.phone2 || undefined,
          address: dbContact.address || '',
          city: dbContact.city || '',
          state: dbContact.state || '',
          zip: dbContact.zip || '',
          status: dbContact.status as CustomerStatus,
          leadSource: dbContact.lead_source || formData.leadSource,
          assignedTo: dbContact.assigned_to || formData.assignedTo,
          createdAt: dbContact.created_at,
          updatedAt: dbContact.updated_at,
          tags: dbContact.tags || [],
          projectType: dbContact.project_type || undefined,
          projectValue: dbContact.project_value || undefined,
          isRetail: dbContact.is_retail,
          retailNotes: dbContact.retail_notes || undefined,
          insuranceCompany: dbContact.insurance_company || undefined,
          policyNumber: dbContact.policy_number || undefined,
          claimNumber: dbContact.claim_number || undefined,
          adjusterName: dbContact.adjuster_name || undefined,
          adjusterPhone: dbContact.adjuster_phone || undefined,
          deductible: dbContact.deductible || undefined,
          notes: dbContact.notes || undefined,
        };

        dispatch({ type: 'ADD_CONTACT', payload: createdContact });

        // Fire automation rules for new contact creation
        if (finalCompanyId) {
          fireAutomationEvent('new_contact_created', finalCompanyId, {
            contactId: createdContact.id,
            contactName: `${createdContact.firstName} ${createdContact.lastName}`.trim(),
            contactEmail: createdContact.email,
            assignedTo: createdContact.assignedTo,
            newStatus: createdContact.status,
          }).catch(() => {});
        }

      // If the user wants to schedule an appointment, navigate to the calendar
      // with the new contact pre-filled in the appointment modal
      if (scheduleAppt) {
        toast.success(`${formData.firstName} ${formData.lastName} added — opening Calendar to schedule.`);
        dispatch({ type: 'SET_PENDING_APPOINTMENT_CONTACT', payload: dbContact.id });
        dispatch({ type: 'SET_VIEW', payload: 'calendar' });
        dispatch({ type: 'TOGGLE_QUICK_ADD' });
        return;
      }

      toast.success(`${formData.firstName} ${formData.lastName} has been added to the CRM.`);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `notif-${Date.now()}`,
          type: 'success',
          title: 'Contact Created',
          message: `${formData.firstName} ${formData.lastName} has been added to the CRM.`,
          timestamp: new Date().toISOString(),
          read: false,
        },
      });

      handleClose();
    } catch (error) {
      console.error('Error creating contact:', error);
      let message = 'Failed to create contact. Please try again.';

      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      }

      toast.error(message);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `notif-${Date.now()}`,
          type: 'error',
          title: 'Contact Creation Error',
          message,
          timestamp: new Date().toISOString(),
          read: false,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBasicValid = formData.firstName && formData.lastName && formData.phone1;

  if (!state.showQuickAdd) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add New Contact</h2>
            <p className="text-sm text-gray-500 mt-1">
              Quickly add a new prospect or lead to the system
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {[
              { id: 'basic', label: 'Basic Info', icon: <User size={16} /> },
              { id: 'project', label: 'Project Details', icon: <Building size={16} /> },
              { id: 'insurance', label: 'Insurance', icon: <Shield size={16} /> },
              { id: 'appointment', label: 'Schedule', icon: <Calendar size={16} /> },
            ].map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id as FormStep)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentStep === step.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {step.icon}
                  <span className="font-medium">{step.label}</span>
                </button>
                {index < 3 && <div className="flex-1 h-px bg-gray-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {currentStep === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                      !formData.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                      !formData.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone1}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone1: formatPhoneNumber(e.target.value) }))}
                    onBlur={(e) => setFormData(prev => ({ ...prev, phone1: formatPhoneNumber(e.target.value) }))}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                      !formData.phone1 ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone2}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone2: formatPhoneNumber(e.target.value) }))}
                    onBlur={(e) => setFormData(prev => ({ ...prev, phone2: formatPhoneNumber(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="(555) 987-6543"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="john.doe@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Dallas"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="TX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="75201"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
                  <select
                    value={formData.leadSource}
                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {[...defaultLeadSources, ...state.leadSources.filter((ls) => ls.isCustom)].map(
                      (ls) => (
                        <option key={ls.id} value={ls.name}>
                          {ls.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {state.teamMembers.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'project' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                <select
                  value={formData.projectType}
                  onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="">Select project type...</option>
                  <option value="Roof Inspection">Roof Inspection</option>
                  <option value="Roof Repair">Roof Repair</option>
                  <option value="Full Roof Replacement">Full Roof Replacement</option>
                  <option value="Gutter Installation">Gutter Installation</option>
                  <option value="Siding">Siding</option>
                  <option value="Windows">Windows</option>
                  <option value="Full Exterior">Full Exterior</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Project Value
                </label>
                <div className="relative">
                  <DollarSign
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="number"
                    value={formData.projectValue}
                    onChange={(e) => setFormData({ ...formData, projectValue: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as CustomerStatus })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="prospect">Prospect</option>
                  <option value="lead">Lead</option>
                  <option value="appt_set">Appointment Set</option>
                  <option value="contingency">Contingency</option>
                  <option value="retail">Retail Customer</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isRetail"
                  checked={formData.isRetail}
                  onChange={(e) => setFormData({ ...formData, isRetail: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isRetail" className="text-sm font-medium text-gray-700">
                  This is a retail (cash) customer - no insurance claim
                </label>
              </div>

              {formData.isRetail && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retail Notes
                  </label>
                  <textarea
                    value={formData.retailNotes}
                    onChange={(e) => setFormData({ ...formData, retailNotes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                    placeholder="Payment terms, special requirements, etc."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  placeholder="Additional notes about this contact..."
                />
              </div>
            </div>
          )}

          {currentStep === 'insurance' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  Fill in insurance details if this is an insurance claim. Skip this step for retail
                  customers.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Company
                  </label>
                  <input
                    type="text"
                    value={formData.insuranceCompany}
                    onChange={(e) =>
                      setFormData({ ...formData, insuranceCompany: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="State Farm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    value={formData.policyNumber}
                    onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="SF-12345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Claim Number
                  </label>
                  <input
                    type="text"
                    value={formData.claimNumber}
                    onChange={(e) => setFormData({ ...formData, claimNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="CLM-2026-001234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deductible</label>
                  <div className="relative">
                    <DollarSign
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="number"
                      value={formData.deductible}
                      onChange={(e) => setFormData({ ...formData, deductible: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="2500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjuster Name
                  </label>
                  <input
                    type="text"
                    value={formData.adjusterName}
                    onChange={(e) => setFormData({ ...formData, adjusterName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjuster Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.adjusterPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, adjusterPhone: formatPhoneNumber(e.target.value) }))}
                    onBlur={(e) => setFormData(prev => ({ ...prev, adjusterPhone: formatPhoneNumber(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="(555) 999-8888"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'appointment' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <Calendar size={48} className="mx-auto mb-4 text-blue-500 opacity-80" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Schedule an Appointment</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  After saving this contact, open the full Calendar so you can see existing appointments and pick a time that works.
                </p>
              </div>

              <div
                onClick={() => setScheduleAppt(!scheduleAppt)}
                className={`flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  scheduleAppt
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  scheduleAppt ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                }`}>
                  {scheduleAppt && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${scheduleAppt ? 'text-blue-900' : 'text-gray-700'}`}>
                    Yes, open Calendar to schedule
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Saves this contact then takes you to the Calendar — contact will be pre-filled in the appointment form
                  </p>
                </div>
              </div>

              {!scheduleAppt && (
                <p className="text-center text-xs text-gray-400">
                  Leave unchecked to save the contact without scheduling — you can always schedule later from Calendar or the contact's profile.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            {currentStep !== 'basic' && (
              <button
                onClick={() => {
                  if (currentStep === 'appointment') setCurrentStep('insurance');
                  else if (currentStep === 'insurance') setCurrentStep('project');
                  else setCurrentStep('basic');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            {currentStep !== 'appointment' ? (
              <button
                onClick={() => {
                  if (currentStep === 'basic') setCurrentStep('project');
                  else if (currentStep === 'project') setCurrentStep('insurance');
                  else setCurrentStep('appointment');
                }}
                disabled={currentStep === 'basic' && !isBasicValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <>
                <button
                  onClick={() => saveContact()}
                  disabled={!isBasicValid || isSubmitting}
                  className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip & Save
                </button>
                <button
                  onClick={() => saveContact()}
                  disabled={!isBasicValid || isSubmitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                  {scheduleAppt ? 'Save & Open Calendar' : 'Create Contact'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Contact Dialog */}
      <DuplicateContactDialog
        isOpen={showDuplicateDialog}
        duplicates={duplicates}
        onClose={() => setShowDuplicateDialog(false)}
        onCreateAnyway={handleCreateAnyway}
        onViewContact={handleViewContact}
      />
    </div>
  );
}
