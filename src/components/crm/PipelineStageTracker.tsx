import React from 'react';
import { Check, Circle, Clock } from 'lucide-react';
import { CustomerStatus, statusLabels } from '@/lib/crmData';

interface PipelineStage {
  status: CustomerStatus;
  label: string;
  order: number;
}

// Define the standard pipeline stages in order
const PIPELINE_STAGES: PipelineStage[] = [
  { status: 'prospect', label: 'New Lead', order: 0 },
  { status: 'lead', label: 'Contacted', order: 1 },
  { status: 'appt_set', label: 'Appointment Set', order: 2 },
  { status: 'inspection_completed', label: 'Inspection Done', order: 3 },
  { status: 'estimating', label: 'Creating Estimate', order: 4 },
  { status: 'estimate_sent', label: 'Estimate Sent', order: 5 },
  { status: 'contingency', label: 'Follow-up', order: 6 },
  { status: 'signed', label: 'Signed', order: 7 },
  { status: 'approved', label: 'Approved', order: 8 },
  { status: 'ordering_material', label: 'Ordering Materials', order: 9 },
  { status: 'scheduled', label: 'Scheduled', order: 10 },
  { status: 'in_progress', label: 'In Progress', order: 11 },
  { status: 'build_phase', label: 'Build Phase', order: 12 },
  { status: 'cleanup', label: 'Cleanup/Punch List', order: 13 },
  { status: 'invoicing', label: 'Invoicing', order: 14 },
  { status: 'pending_payment', label: 'Pending Payment', order: 15 },
  { status: 'completed', label: 'Completed', order: 16 },
];

// Map insurance-specific statuses to equivalent pipeline stages
const STATUS_MAPPING: Record<string, CustomerStatus> = {
  'retail': 'contingency',  // Retail lead maps to follow-up stage
  'claim_filed': 'appt_set', // Insurance claim filed ~ appointment stage
  'adjuster_scheduled': 'inspection_completed', // Adjuster visit ~ inspection done
  'supplement_filed': 'estimating', // Supplement ~ creating estimate
};

interface PipelineStageTrackerProps {
  currentStatus: CustomerStatus;
  statusChangedAt?: string;
  inspectionCompleted?: boolean;
}

export function PipelineStageTracker({ currentStatus, statusChangedAt, inspectionCompleted }: PipelineStageTrackerProps) {
  // Map status to pipeline equivalent
  const mappedStatus = STATUS_MAPPING[currentStatus] || currentStatus;
  
  // If inspection is done but status hasn't advanced past appt_set yet, show inspection_completed
  const effectiveStatus: CustomerStatus =
    inspectionCompleted && (mappedStatus === 'appt_set' || mappedStatus === 'lead' || mappedStatus === 'prospect')
      ? 'inspection_completed' 
      : mappedStatus;

  // Find current stage index
  let currentStageIndex = PIPELINE_STAGES.findIndex(stage => stage.status === effectiveStatus);
  
  // CRITICAL FIX: If status not found in pipeline, default to first stage instead of -1
  if (currentStageIndex === -1) {
    console.warn(`[PipelineStageTracker] Status "${currentStatus}" (effective: "${effectiveStatus}") not found in pipeline stages. Defaulting to first stage.`);
    currentStageIndex = 0; // Default to "New Lead" instead of breaking the UI
  }
  
  // Handle special statuses
  if (currentStatus === 'lost') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <Circle size={20} className="fill-red-700" />
          <span className="font-semibold">Lead Lost</span>
        </div>
        <p className="text-sm text-red-600 mt-1">This lead did not convert to a customer.</p>
      </div>
    );
  }

  // Get next stage
  const nextStage = currentStageIndex < PIPELINE_STAGES.length - 1 
    ? PIPELINE_STAGES[currentStageIndex + 1] 
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Pipeline Progress</h3>
        {statusChangedAt && (
          <span className="text-xs text-gray-500">
            Updated {new Date(statusChangedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Stage {currentStageIndex + 1} of {PIPELINE_STAGES.length}
          </span>
          <span className="text-sm font-medium text-blue-600">
            {Math.round(((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Stage List */}
      <div className="space-y-3">
        {PIPELINE_STAGES.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isUpcoming = index > currentStageIndex;

          return (
            <div
              key={stage.status}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                isCurrent ? 'bg-blue-50 border border-blue-200' : 
                isCompleted ? 'bg-gray-50' : 
                'bg-white'
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                    <Clock size={14} className="text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    isCurrent ? 'text-blue-900' : 
                    isCompleted ? 'text-gray-700' : 
                    'text-gray-400'
                  }`}>
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-xs text-green-600">
                      ✓ Done
                    </span>
                  )}
                </div>
                {isCurrent && (
                  <p className="text-xs text-gray-600 mt-1">
                    Customer is currently at this stage
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Step */}
      {nextStage && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">→</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Next Stage</h4>
              <p className="text-sm text-blue-700">
                <strong>{nextStage.label}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Move this customer forward by completing the current stage requirements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {effectiveStatus === 'completed' && (
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <Check size={18} className="text-white" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-green-900">Project Complete!</h4>
              <p className="text-xs text-green-700 mt-1">
                This customer has completed the entire pipeline. Great work!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
