import React, { useState } from 'react';
import { CustomerStatus, Contact, Job, statusLabels } from '@/lib/crmData';
import {
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  DollarSign,
  MapPin,
  Wrench,
  Package,
  AlertCircle,
  Eye,
  Mail,
  Shield,
  ArrowLeft,
  Circle,
  X,
  Hammer,
  CreditCard,
  Trophy,
} from 'lucide-react';

interface JobStatusTimelineProps {
  contact: Contact;
  jobs?: Job[];
  onStatusChange?: (newStatus: CustomerStatus) => void;
  onScheduleInspection?: () => void;
  onCreateQuote?: () => void;
}

interface PowerStep {
  id: string;
  label: string;
  description: string;
  statuses: CustomerStatus[];
  icon: React.ComponentType<any>;
  color: string;
  primaryStatus: CustomerStatus;
}

// 9-stage Power Pipeline — each step groups related statuses.
const POWER_STEPS: PowerStep[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'New prospect or lead identified',
    statuses: ['prospect', 'lead'],
    icon: Eye,
    color: 'slate',
    primaryStatus: 'lead',
  },
  {
    id: 'inspection',
    label: 'Inspection',
    description: 'Appointment set — rep on site',
    statuses: ['appt_set', 'inspection_completed', 'inspected' as CustomerStatus],
    icon: Calendar,
    color: 'violet',
    primaryStatus: 'appt_set',
  },
  {
    id: 'adjuster_pending',
    label: 'Adjuster / Carrier Pending',
    description: 'Claim filed, adjuster meeting, waiting on the carrier',
    statuses: ['claim_filed', 'adjuster_scheduled', 'supplement_filed'],
    icon: Clock,
    color: 'sky',
    primaryStatus: 'claim_filed',
  },
  {
    id: 'pending_scope',
    label: 'Pending Scope',
    description: 'Estimating or awaiting homeowner commitment',
    statuses: ['estimating', 'estimate_sent', 'contingency', 'retail'],
    icon: FileText,
    color: 'amber',
    primaryStatus: 'contingency',
  },
  {
    id: 'approval_sold',
    label: 'Approval / Sold',
    description: 'Scope approved or contract signed — Closed Won',
    statuses: ['approved', 'signed'],
    icon: Shield,
    color: 'emerald',
    primaryStatus: 'signed',
  },
  {
    id: 'pre_production',
    label: 'Pre-Production',
    description: 'Permits, materials, scheduling and crew',
    statuses: ['ordering_material', 'scheduled'],
    icon: Package,
    color: 'cyan',
    primaryStatus: 'ordering_material',
  },
  {
    id: 'active_build',
    label: 'Active Build',
    description: 'Crews on site',
    statuses: ['in_progress', 'build_phase'],
    icon: Hammer,
    color: 'blue',
    primaryStatus: 'in_progress',
  },
  {
    id: 'qc_walkthrough',
    label: 'QC & Walkthrough',
    description: 'Cleanup check, photos, punch list and final walkthrough',
    statuses: ['cleanup'],
    icon: CheckCircle,
    color: 'teal',
    primaryStatus: 'cleanup',
  },
  {
    id: 'final_billing',
    label: 'Final Billing & Closed',
    description: 'Invoice sent, awaiting payment — closed once paid',
    statuses: ['invoicing', 'pending_payment', 'completed'],
    icon: CreditCard,
    color: 'rose',
    primaryStatus: 'invoicing',
  },
];

const COLOR_MAP: Record<string, string> = {
  slate:   'text-slate-600 border-slate-400 bg-slate-50',
  sky:     'text-sky-600 border-sky-500 bg-sky-50',
  teal:    'text-teal-600 border-teal-500 bg-teal-50',
  violet:  'text-violet-600 border-violet-500 bg-violet-50',
  amber:   'text-amber-600 border-amber-500 bg-amber-50',
  emerald: 'text-emerald-600 border-emerald-500 bg-emerald-50',
  cyan:    'text-cyan-600 border-cyan-500 bg-cyan-50',
  blue:    'text-blue-600 border-blue-500 bg-blue-50',
  rose:    'text-rose-600 border-rose-500 bg-rose-50',
  green:   'text-green-700 border-green-500 bg-green-50',
};

// Sub-status labels for within-column granularity
const SUB_STATUS_LABELS: Partial<Record<string, string>> = {
  prospect:             'New Prospect',
  lead:                 'Contacted',
  appt_set:            'Appt Set',
  claim_filed:          'Claim Filed',
  adjuster_scheduled:   'Adjuster Sched.',
  inspection_completed: 'Inspected',
  inspected:            'Inspected',
  estimating:           'Estimating',
  estimate_sent:        'Est. Sent',
  contingency:          'Pending Commit.',
  supplement_filed:     'Supplement',
  retail:               'Retail',
  approved:             'Approved',
  signed:               'Signed',
  ordering_material:    'Ordering',
  scheduled:            'Scheduled',
  in_progress:          'In Progress',
  build_phase:          'Build Phase',
  cleanup:              'Cleanup',
  invoicing:            'Invoicing',
  pending_payment:      'Pending Pmt.',
  completed:            'Complete',
};

const LEGACY_ALIASES: Record<string, CustomerStatus> = {
  new_lead:             'prospect',
  contacted:            'lead',
  appointment_set:      'appt_set',
  inspection_scheduled: 'appt_set',
  inspection_complete:  'inspection_completed',
  signed_won:           'signed',
  paid:                 'completed',
  follow_up:            'contingency',
};

function resolveStatus(raw: string | undefined | null): CustomerStatus {
  if (!raw) return 'prospect';
  const s = raw.trim().toLowerCase();
  return (LEGACY_ALIASES[s] ?? s) as CustomerStatus;
}

function findStepIndex(status: CustomerStatus): number {
  for (let i = 0; i < POWER_STEPS.length; i++) {
    if ((POWER_STEPS[i].statuses as string[]).includes(status)) return i;
  }
  return 0;
}

const JobStatusTimeline: React.FC<JobStatusTimelineProps> = ({
  contact,
  jobs = [],
  onStatusChange,
  onScheduleInspection,
  onCreateQuote,
}) => {
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertTargetStep, setRevertTargetStep] = useState<PowerStep | null>(null);

  const normalizedStatus = resolveStatus(contact.status);
  const currentStepIndex = findStepIndex(normalizedStatus);

  const getStepColor = (index: number) => {
    if (index < currentStepIndex) return 'text-green-600 border-green-600 bg-green-50';
    if (index === currentStepIndex) return `${COLOR_MAP[POWER_STEPS[index].color]}`;
    return 'text-gray-400 border-gray-300 bg-gray-50';
  };

  const getLineColor = (index: number) =>
    index < currentStepIndex ? 'bg-green-600' : 'bg-gray-300';

  const handleStepClick = (step: PowerStep, index: number) => {
    if (index < currentStepIndex) {
      setRevertTargetStep(step);
      setShowRevertModal(true);
    } else if (index > currentStepIndex && onStatusChange) {
      onStatusChange(step.primaryStatus);
    }
  };

  const handleRevertConfirm = () => {
    if (revertTargetStep && onStatusChange) {
      onStatusChange(revertTargetStep.primaryStatus);
    }
    setShowRevertModal(false);
    setRevertTargetStep(null);
  };

  const handleRevertCancel = () => {
    setShowRevertModal(false);
    setRevertTargetStep(null);
  };

  const subLabel = SUB_STATUS_LABELS[contact.status] ?? SUB_STATUS_LABELS[normalizedStatus];

  return (
    <div className="space-y-6">
      {/* Current Status Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Current Status</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-900">Current Column</div>
            <div className="text-lg font-semibold text-blue-700">
              {POWER_STEPS[currentStepIndex]?.label}
            </div>
            {subLabel && (
              <div className="text-xs text-blue-600 mt-0.5 font-medium">{subLabel}</div>
            )}
            <div className="text-sm text-blue-600 mt-1">
              {POWER_STEPS[currentStepIndex]?.description}
            </div>
          </div>

          {contact.inspectionScheduled && (
            <div className="bg-violet-50 rounded-lg p-4">
              <div className="text-sm font-medium text-violet-900">Inspection</div>
              <div className="text-lg font-semibold text-violet-700">
                {contact.inspectionCompleted ? 'Completed' : 'Scheduled'}
              </div>
              <div className="text-sm text-violet-600">
                {contact.inspectionDate
                  ? new Date(contact.inspectionDate).toLocaleDateString()
                  : 'Date TBD'}
              </div>
            </div>
          )}

          {contact.projectValue && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm font-medium text-green-900">Project Value</div>
              <div className="text-lg font-semibold text-green-700">
                ${contact.projectValue.toLocaleString()}
              </div>
              <div className="text-sm text-green-600">
                {contact.depositPaid ? 'Deposit collected' : 'Deposit pending'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Pipeline Stages</h3>
        </div>

        <div className="relative">
          {POWER_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent   = index === currentStepIndex;

            return (
              <div key={step.id} className="relative">
                {index < POWER_STEPS.length - 1 && (
                  <div className={`absolute left-6 top-12 w-0.5 h-14 ${getLineColor(index)}`} />
                )}

                <div
                  className={`flex items-start gap-4 pb-8 ${index !== currentStepIndex && onStatusChange ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={() => handleStepClick(step, index)}
                >
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${getStepColor(index)}`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </div>
                    <div className={`text-sm ${isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'}`}>
                      {step.description}
                    </div>

                    {step.id === 'approval_sold' && contact.projectValue && (
                      <div className="text-xs text-blue-600 mt-1">
                        Value: ${contact.projectValue.toLocaleString()}
                      </div>
                    )}
                    {step.id === 'approval_sold' && contact.depositPaid && (
                      <div className="text-xs text-green-600 mt-1">
                        Deposit: {contact.depositDate ? new Date(contact.depositDate).toLocaleDateString() : 'Collected'}
                      </div>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full flex-shrink-0">
                      Current
                    </div>
                  )}
                  {isCompleted && (
                    <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex-shrink-0">
                      Done
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <Wrench className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Active Jobs</h3>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{job.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{job.description}</div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === 'complete'    ? 'bg-green-100 text-green-800' :
                        job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'scheduled'   ? 'bg-violet-100 text-violet-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>
                      {job.scheduledDate && (
                        <span className="text-xs text-gray-500">
                          Scheduled: {new Date(job.scheduledDate).toLocaleDateString()}
                        </span>
                      )}
                      {job.estimatedValue > 0 && (
                        <span className="text-xs text-gray-500">
                          Value: ${job.estimatedValue.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {job.status === 'complete' && (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile-friendly interactive stage list */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-safe">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Pipeline Stages</h3>
        <p className="text-sm text-gray-500 mb-4">
          {currentStepIndex > 0
            ? 'Tap a future stage to advance · Tap a past stage to revert'
            : 'Tap any stage below to advance this contact'}
        </p>

        <div className="space-y-2">
          {POWER_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent   = index === currentStepIndex;
            const isPending   = index > currentStepIndex;

            return (
              <div
                key={step.id}
                onClick={() => handleStepClick(step, index)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer active:scale-95 ${
                  isCurrent   ? 'border-blue-500 bg-blue-50 hover:bg-blue-100' :
                  isCompleted ? 'border-green-200 bg-green-50 hover:bg-green-100' :
                  'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  isCurrent   ? 'border-blue-500 bg-blue-500' :
                  isCompleted ? 'border-green-500 bg-green-500' :
                  'border-gray-300 bg-white'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <Circle className="w-3 h-3 text-white fill-current" />
                  ) : (
                    <Circle className="w-3 h-3 text-gray-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className={`font-medium text-sm ${
                    isCurrent   ? 'text-blue-900' :
                    isCompleted ? 'text-green-900' : 'text-gray-600'
                  }`}>
                    {step.label}
                  </div>
                  <div className={`text-xs ${
                    isCurrent   ? 'text-blue-600 font-medium' :
                    isCompleted ? 'text-green-600 font-medium' :
                    isPending   ? 'text-blue-500 font-medium' : 'text-gray-400'
                  }`}>
                    {isCurrent   ? 'Current stage' :
                     isCompleted ? 'Tap to revert' :
                     'Tap to advance'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(normalizedStatus === 'lead' || normalizedStatus === 'prospect') && (
            <button
              onClick={onScheduleInspection}
              className="p-3 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onScheduleInspection}
            >
              Schedule Inspection
            </button>
          )}

          {normalizedStatus === 'inspection_completed' && (
            <button
              onClick={onCreateQuote}
              className="p-3 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onCreateQuote}
            >
              Create Quote
            </button>
          )}

          {(normalizedStatus === 'estimating' || normalizedStatus === 'estimate_sent') && (
            <button
              onClick={() => onStatusChange?.('contingency')}
              className="p-3 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Mark Pending Commitment
            </button>
          )}

          {normalizedStatus === 'contingency' && (
            <button
              onClick={() => onStatusChange?.('signed')}
              className="p-3 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Mark Signed / Won
            </button>
          )}

          {(normalizedStatus === 'approved' || normalizedStatus === 'signed') && (
            <button
              onClick={() => onStatusChange?.('ordering_material')}
              className="p-3 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Start Pre-Production
            </button>
          )}

          {(normalizedStatus === 'ordering_material' || normalizedStatus === 'scheduled') && (
            <button
              onClick={() => onStatusChange?.('in_progress')}
              className="p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Start Build
            </button>
          )}

          {(normalizedStatus === 'in_progress' || normalizedStatus === 'build_phase') && (
            <button
              onClick={() => onStatusChange?.('cleanup')}
              className="p-3 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Send to QC &amp; Walkthrough
            </button>
          )}

          {normalizedStatus === 'inspection_completed' && (
            <button
              onClick={() => onStatusChange?.('claim_filed')}
              className="p-3 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Move to Adjuster / Carrier Pending
            </button>
          )}

          {(normalizedStatus === 'claim_filed' || normalizedStatus === 'adjuster_scheduled' || normalizedStatus === 'supplement_filed') && (
            <button
              onClick={onCreateQuote}
              className="p-3 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onCreateQuote}
            >
              Create Quote from Carrier Scope
            </button>
          )}

          {normalizedStatus === 'cleanup' && (
            <button
              onClick={() => onStatusChange?.('invoicing')}
              className="p-3 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Move to Billing
            </button>
          )}

          {(normalizedStatus === 'invoicing' || normalizedStatus === 'pending_payment') && (
            <button
              onClick={() => onStatusChange?.('completed')}
              className="p-3 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Mark Closed / Paid
            </button>
          )}

          {normalizedStatus === 'completed' && (
            <button className="p-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium">
              Request Review
            </button>
          )}
        </div>
      </div>

      {/* Revert Confirmation Modal */}
      {showRevertModal && revertTargetStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-16" style={{ paddingBottom: '120px' }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Revert Job Stage?</h3>
              <button onClick={handleRevertCancel} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to revert this contact back to:
            </p>
            <div className="bg-gray-50 rounded-lg p-3 border mb-4">
              <div className="font-medium text-gray-900">{revertTargetStep.label}</div>
              <div className="text-sm text-gray-600">{revertTargetStep.description}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRevertCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRevertConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Revert Stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobStatusTimeline;
