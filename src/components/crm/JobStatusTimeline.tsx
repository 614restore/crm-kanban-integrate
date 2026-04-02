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
  Phone,
  Shield,
  ArrowLeft,
  Circle,
  X
} from 'lucide-react';

interface JobStatusTimelineProps {
  contact: Contact;
  jobs?: Job[];
  onStatusChange?: (newStatus: CustomerStatus) => void;
  onScheduleInspection?: () => void;
  onSendEstimate?: () => void;
}

const statusSteps: { 
  status: CustomerStatus; 
  label: string; 
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}[] = [
  { status: 'prospect', label: statusLabels.prospect, description: 'Initial lead identified', icon: Eye, color: 'gray' },
  { status: 'lead', label: statusLabels.lead, description: 'Contact established', icon: Phone, color: 'blue' },
  { status: 'appt_set', label: statusLabels.appt_set, description: 'Inspection scheduled', icon: Calendar, color: 'purple' },
  { status: 'inspection_completed', label: statusLabels.inspection_completed, description: 'Property assessment done', icon: MapPin, color: 'indigo' },
  { status: 'estimating', label: statusLabels.estimating, description: 'Preparing quote for customer', icon: FileText, color: 'sky' },
  { status: 'estimate_sent', label: statusLabels.estimate_sent, description: 'Quote provided to customer', icon: Mail, color: 'cyan' },
  { status: 'contingency', label: statusLabels.contingency, description: 'Follow-up and negotiation phase', icon: AlertCircle, color: 'yellow' },
  { status: 'approved', label: statusLabels.approved, description: 'Insurance approval received', icon: Shield, color: 'teal' },
  { status: 'signed', label: statusLabels.signed, description: 'Work authorized by customer', icon: CheckCircle, color: 'green' },
  { status: 'ordering_material', label: statusLabels.ordering_material, description: 'Materials being ordered', icon: Package, color: 'amber' },
  { status: 'in_progress', label: statusLabels.in_progress, description: 'Project underway', icon: Wrench, color: 'orange' },
  { status: 'build_phase', label: statusLabels.build_phase, description: 'Construction/repairs active', icon: Package, color: 'red' },
  { status: 'cleanup', label: statusLabels.cleanup, description: 'Final site preparation', icon: CheckCircle, color: 'pink' },
  { status: 'invoicing', label: statusLabels.invoicing, description: 'Final billing prepared', icon: DollarSign, color: 'rose' },
  { status: 'pending_payment', label: statusLabels.pending_payment, description: 'Awaiting final payment', icon: DollarSign, color: 'amber' },
  { status: 'completed', label: statusLabels.completed, description: 'Project finished successfully', icon: CheckCircle, color: 'emerald' },
];

function normalizePipelineStatus(rawStatus: string | undefined | null): CustomerStatus | undefined {
  if (!rawStatus) return undefined;
  const status = rawStatus.trim().toLowerCase();
  const aliases: Record<string, CustomerStatus> = {
    new_lead: 'lead',
    appointment_set: 'appt_set',
    inspection_scheduled: 'appt_set',
    inspection_complete: 'inspection_completed',
    signed_won: 'signed',
    paid: 'completed',
  };

  return aliases[status] ?? (status as CustomerStatus);
}

const JobStatusTimeline: React.FC<JobStatusTimelineProps> = ({ contact, jobs = [], onStatusChange, onScheduleInspection, onSendEstimate }) => {
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertTargetStage, setRevertTargetStage] = useState<CustomerStatus | null>(null);
  
  const normalizedStatus = normalizePipelineStatus(contact.status);
  const currentStatusIndex = statusSteps.findIndex(step => step.status === normalizedStatus);
  
  const getStatusColor = (index: number) => {
    if (index < currentStatusIndex) return 'text-green-600 border-green-600 bg-green-50';
    if (index === currentStatusIndex) return `text-blue-600 border-blue-600 bg-blue-50`;
    return 'text-gray-400 border-gray-300 bg-gray-50';
  };

  const getLineColor = (index: number) => {
    if (index < currentStatusIndex) return 'bg-green-600';
    return 'bg-gray-300';
  };

  const handleStageClick = (status: CustomerStatus, index: number) => {
    // Only allow reverting to past stages
    if (index < currentStatusIndex) {
      setRevertTargetStage(status);
      setShowRevertModal(true);
    }
  };

  const handleRevertConfirm = () => {
    if (revertTargetStage && onStatusChange) {
      onStatusChange(revertTargetStage);
    }
    setShowRevertModal(false);
    setRevertTargetStage(null);
  };

  const handleRevertCancel = () => {
    setShowRevertModal(false);
    setRevertTargetStage(null);
  };

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
            <div className="text-sm font-medium text-blue-900">Current Stage</div>
            <div className="text-lg font-semibold text-blue-700">
              {statusSteps.find(step => step.status === normalizedStatus)?.label || contact.status}
            </div>
            <div className="text-sm text-blue-600">
              {statusSteps.find(step => step.status === normalizedStatus)?.description}
            </div>
          </div>
          
          {contact.inspectionScheduled && (
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm font-medium text-purple-900">Inspection</div>
              <div className="text-lg font-semibold text-purple-700">
                {contact.inspectionCompleted ? 'Completed' : 'Scheduled'}
              </div>
              <div className="text-sm text-purple-600">
                {contact.inspectionDate ? new Date(contact.inspectionDate).toLocaleDateString() : 'Date TBD'}
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
          <h3 className="text-lg font-semibold text-gray-900">Status Timeline</h3>
        </div>

        <div className="relative">
          {statusSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            const isUpcoming = index > currentStatusIndex;
            
            return (
              <div key={step.status} className="relative">
                {/* Connecting Line */}
                {index < statusSteps.length - 1 && (
                  <div 
                    className={`absolute left-6 top-12 w-0.5 h-16 ${getLineColor(index)}`}
                  />
                )}
                
                {/* Step Item */}
                <div className="flex items-start gap-4 pb-8">
                  {/* Icon */}
                  <div 
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${getStatusColor(index)}`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </div>
                    <div className={`text-sm ${isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'}`}>
                      {step.description}
                    </div>
                    
                    {/* Additional Info */}
                    {step.status === 'inspection_completed' && contact.inspectionCompletedDate && (
                      <div className="text-xs text-green-600 mt-1">
                        Completed: {new Date(contact.inspectionCompletedDate).toLocaleDateString()}
                      </div>
                    )}
                    
                    {step.status === 'estimate_sent' && contact.projectValue && (
                      <div className="text-xs text-blue-600 mt-1">
                        Estimated Value: ${contact.projectValue.toLocaleString()}
                      </div>
                    )}
                    
                    {step.status === 'signed' && contact.depositPaid && (
                      <div className="text-xs text-green-600 mt-1">
                        Deposit Collected: {contact.depositDate ? new Date(contact.depositDate).toLocaleDateString() : 'Yes'}
                      </div>
                    )}
                  </div>
                  
                  {/* Status Badge */}
                  {isCurrent && (
                    <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      Current
                    </div>
                  )}
                  
                  {isCompleted && (
                    <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
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
                        job.status === 'complete' ? 'bg-green-100 text-green-800' :
                        job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
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

      {/* Pipeline Stages - Interactive for mobile */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-safe">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Pipeline Stages</h3>
        <p className="text-sm text-gray-600 mb-4">TAP ANY PAST STAGE TO REVERT</p>
        
        <div className="space-y-2">
          {statusSteps.map((step, index) => {
            const isCompleted = index < currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            const isPending = index > currentStatusIndex;
            
            return (
              <div
                key={step.status}
                onClick={() => handleStageClick(step.status, index)}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                  ${isCurrent ? 
                    'border-blue-500 bg-blue-50' : 
                    isCompleted ? 
                      'border-green-200 bg-green-50 cursor-pointer hover:bg-green-100' : 
                      'border-gray-200 bg-gray-50'
                  }
                  ${isCompleted ? 'active:scale-95' : ''}
                `}
              >
                {/* Stage Icon */}
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center border-2
                  ${isCurrent ? 
                    'border-blue-500 bg-blue-500' : 
                    isCompleted ? 
                      'border-green-500 bg-green-500' : 
                      'border-gray-300 bg-white'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <Circle className="w-3 h-3 text-white fill-current" />
                  ) : (
                    <Circle className="w-3 h-3 text-gray-400" />
                  )}
                </div>
                
                {/* Stage Details */}
                <div className="flex-1">
                  <div className={`font-medium ${
                    isCurrent ? 'text-blue-900' : 
                    isCompleted ? 'text-green-900' : 
                    'text-gray-600'
                  }`}>
                    {step.label}
                  </div>
                  {isCompleted && (
                    <div className="text-xs text-green-600 font-medium">
                      Tap to revert
                    </div>
                  )}
                  {isCurrent && (
                    <div className="text-xs text-blue-600 font-medium">
                      Current stage
                    </div>
                  )}
                  {isPending && (
                    <div className="text-xs text-gray-500">
                      Pending
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showRevertModal && revertTargetStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-16" style={{ paddingBottom: '120px' }}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Revert Job Stage?</h3>
              <button
                onClick={handleRevertCancel}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to revert this contact back to:
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="font-medium text-gray-900">
                  {statusSteps.find(s => s.status === revertTargetStage)?.label}
                </div>
                <div className="text-sm text-gray-600">
                  {statusSteps.find(s => s.status === revertTargetStage)?.description}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
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
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {normalizedStatus === 'lead' && (
            <button
              onClick={onScheduleInspection}
              className="p-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onScheduleInspection}
            >
              Schedule Inspection
            </button>
          )}
          
          {normalizedStatus === 'inspection_completed' && (
            <button
              onClick={onSendEstimate}
              className="p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onSendEstimate}
            >
              Send Estimate
            </button>
          )}
          
          {normalizedStatus === 'estimate_sent' && (
            <button
              onClick={() => onStatusChange?.('contingency')}
              className="p-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Mark Contingency
            </button>
          )}

          {normalizedStatus === 'contingency' && (
            <button
              onClick={() => onStatusChange?.('signed')}
              className="p-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Mark Signed
            </button>
          )}

          {normalizedStatus === 'signed' && (
            <button
              onClick={() => onStatusChange?.('in_progress')}
              className="p-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Start Work
            </button>
          )}

          {normalizedStatus === 'in_progress' && (
            <button
              onClick={() => onStatusChange?.('invoicing')}
              className="p-3 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Move to Invoicing
            </button>
          )}

          {normalizedStatus === 'invoicing' && (
            <button
              onClick={() => onStatusChange?.('completed')}
              className="p-3 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium disabled:opacity-50"
              disabled={!onStatusChange}
            >
              Mark Completed
            </button>
          )}
          
          {(normalizedStatus === 'completed' || jobs.some(j => j.status === 'complete')) && (
            <button className="p-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium">
              Request Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobStatusTimeline;
