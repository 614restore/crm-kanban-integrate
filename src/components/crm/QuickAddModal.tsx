import React, { useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { Contact, defaultLeadSources, mockTeamMembers, CustomerStatus } from '@/lib/crmData';
import { X, User, Phone, Mail, MapPin, DollarSign, Tag, Shield, Building, Loader2 } from 'lucide-react';

type FormStep = 'basic' | 'project' | 'insurance';

export default function QuickAddModal() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<FormStep>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    assignedTo: state.currentUser?.id || mockTeamMembers[0].id,
    status: 'lead' as CustomerStatus,
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
      assignedTo: state.currentUser?.id || mockTeamMembers[0].id,
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
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // If user has a company, save to database
      if (profile?.company_id) {
        const dbContact = await db.createContact({
          company_id: profile.company_id,
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
          assigned_to: formData.assignedTo || undefined,
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
        });

        if (dbContact) {
          // Convert to app contact format
          const newContact: Contact = {
            id: dbContact.id,
            firstName: dbContact.first_name,
            lastName: dbContact.last_name,
            email: dbContact.email || '',
            phone1: dbContact.phone1 || '',
            phone2: dbContact.phone2,
            address: dbContact.address || '',
            city: dbContact.city || '',
            state: dbContact.state || '',
            zip: dbContact.zip || '',
            status: dbContact.status as CustomerStatus,
            leadSource: dbContact.lead_source || '',
            assignedTo: dbContact.assigned_to || '',
            createdAt: dbContact.created_at,
            updatedAt: dbContact.updated_at,
            tags: dbContact.tags || [],
            projectType: dbContact.project_type,
            projectValue: dbContact.project_value,
            isRetail: dbContact.is_retail,
            retailNotes: dbContact.retail_notes,
            insuranceCompany: dbContact.insurance_company,
            policyNumber: dbContact.policy_number,
            claimNumber: dbContact.claim_number,
            adjusterName: dbContact.adjuster_name,
            adjusterPhone: dbContact.adjuster_phone,
            deductible: dbContact.deductible,
            notes: dbContact.notes,
          };

          dispatch({ type: 'ADD_CONTACT', payload: newContact });
        }
      } else {
        // No company - use local state only
        const newContact: Contact = {
          id: `c-${Date.now()}`,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone1: formData.phone1,
          phone2: formData.phone2 || undefined,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          status: formData.status,
          leadSource: formData.leadSource,
          assignedTo: formData.assignedTo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          projectType: formData.projectType || undefined,
          projectValue: formData.projectValue ? parseFloat(formData.projectValue) : undefined,
          isRetail: formData.isRetail,
          retailNotes: formData.retailNotes || undefined,
          insuranceCompany: formData.insuranceCompany || undefined,
          policyNumber: formData.policyNumber || undefined,
          claimNumber: formData.claimNumber || undefined,
          adjusterName: formData.adjusterName || undefined,
          adjusterPhone: formData.adjusterPhone || undefined,
          deductible: formData.deductible ? parseFloat(formData.deductible) : undefined,
          notes: formData.notes || undefined,
        };

        dispatch({ type: 'ADD_CONTACT', payload: newContact });
      }

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
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `notif-${Date.now()}`,
          type: 'error',
          title: 'Error',
          message: 'Failed to create contact. Please try again.',
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
                {index < 2 && <div className="flex-1 h-px bg-gray-300" />}
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
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                    onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                    onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, adjusterPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="(555) 999-8888"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            {currentStep !== 'basic' && (
              <button
                onClick={() =>
                  setCurrentStep(currentStep === 'insurance' ? 'project' : 'basic')
                }
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
            {currentStep !== 'insurance' ? (
              <button
                onClick={() =>
                  setCurrentStep(currentStep === 'basic' ? 'project' : 'insurance')
                }
                disabled={currentStep === 'basic' && !isBasicValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!isBasicValid || isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                Create Contact
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
