import React from 'react';
import { ArrowRight, Check, Circle, Clock } from 'lucide-react';
import type { NextStep } from '@/lib/nextStepActions';
import { NEXT_STEP_ICONS } from './nextStepIcons';
import { CustomerStatus } from '@/lib/crmData';

interface PowerStage {
  id: string;
  label: string;
  description: string;
  statuses: CustomerStatus[];
  color: string;
}

// 8-column Power Pipeline — each stage maps to one or more underlying statuses.
const POWER_STAGES: PowerStage[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'New prospect or lead identified',
    statuses: ['prospect', 'lead'],
    color: '#64748b',
  },
  {
    id: 'inspection',
    label: 'Inspection',
    description: 'Appointment set or inspection completed',
    statuses: ['appt_set', 'claim_filed', 'adjuster_scheduled', 'inspection_completed', 'inspected' as CustomerStatus],
    color: '#7c3aed',
  },
  {
    id: 'pending_scope',
    label: 'Pending Scope',
    description: 'Estimating or awaiting customer commitment',
    statuses: ['estimating', 'estimate_sent', 'contingency', 'supplement_filed', 'retail'],
    color: '#d97706',
  },
  {
    id: 'approval_sold',
    label: 'Approval / Sold',
    description: 'Scope approved or contract signed — Closed Won',
    statuses: ['approved', 'signed'],
    color: '#059669',
  },
  {
    id: 'pre_production',
    label: 'Pre-Production',
    description: 'Ordering materials and admin handoff',
    statuses: ['ordering_material', 'scheduled'],
    color: '#0891b2',
  },
  {
    id: 'active_build',
    label: 'Active Build',
    description: 'Crews on site — in progress through cleanup',
    statuses: ['in_progress', 'build_phase', 'cleanup'],
    color: '#2563eb',
  },
  {
    id: 'final_billing',
    label: 'Final Billing',
    description: 'Invoiced and awaiting final payment',
    statuses: ['invoicing', 'pending_payment'],
    color: '#e11d48',
  },
  {
    id: 'closed_paid',
    label: 'Closed / Paid',
    description: 'Project complete — fully closed',
    statuses: ['completed'],
    color: '#16a34a',
  },
];

// Map every known status variant (including legacy DB values) to a stage index.
const STATUS_TO_STAGE_INDEX: Record<string, number> = {};
POWER_STAGES.forEach((stage, i) => {
  stage.statuses.forEach((s) => { STATUS_TO_STAGE_INDEX[s] = i; });
});
// Legacy / alternate spellings
const LEGACY_ALIASES: Record<string, CustomerStatus> = {
  new_lead:             'prospect',
  contacted:            'lead',
  appointment_set:      'appt_set',
  inspection_scheduled: 'appt_set',
  inspection_complete:  'inspection_completed',
  inspection_done:      'inspection_completed',
  inspected:            'inspection_completed',
  signed_won:           'signed',
  paid:                 'completed',
  payment_received:     'completed',
  follow_up:            'contingency',
};

function resolveStageIndex(rawStatus: string | undefined | null): number {
  if (!rawStatus) return 0;
  const s = rawStatus.trim().toLowerCase() as CustomerStatus;
  const canonical = LEGACY_ALIASES[s] ?? s;
  return STATUS_TO_STAGE_INDEX[canonical] ?? 0;
}

interface PipelineStageTrackerProps {
  currentStatus: CustomerStatus;
  statusChangedAt?: string;
  inspectionCompleted?: boolean;
  /** The next thing to do to move this contact along. */
  nextStep?: NextStep | null;
  /** Takes you to that step (opens the quote, the calendar, a tab, …). */
  onNextStep?: () => void;
}

export function PipelineStageTracker({ currentStatus, statusChangedAt, inspectionCompleted, nextStep, onNextStep }: PipelineStageTrackerProps) {
  // Special case: lost
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

  // If inspection is done but status hasn't advanced past appt_set, push to inspection column
  let effectiveStatus: string = currentStatus;
  if (
    inspectionCompleted &&
    ['appt_set', 'lead', 'prospect'].includes(currentStatus)
  ) {
    effectiveStatus = 'inspection_completed';
  }

  const currentStageIndex = resolveStageIndex(effectiveStatus);
  const nextStage = currentStageIndex < POWER_STAGES.length - 1 ? POWER_STAGES[currentStageIndex + 1] : null;
  const progressPct = Math.round(((currentStageIndex + 1) / POWER_STAGES.length) * 100);
  const NextStepIcon = nextStep ? NEXT_STEP_ICONS[nextStep.iconName] ?? ArrowRight : ArrowRight;

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

      {/* Next step: takes you straight to what moves this contact along */}
      {nextStep && onNextStep && (
        <button
          type="button"
          onClick={onNextStep}
          className="group mb-5 flex w-full items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-left text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
            <NextStepIcon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Next step: {nextStep.label}</span>
            <span className="block text-xs text-blue-100">{nextStep.description}</span>
          </span>
          <ArrowRight size={18} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Stage {currentStageIndex + 1} of {POWER_STAGES.length}
          </span>
          <span className="text-sm font-medium text-blue-600">{progressPct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stage List */}
      <div className="space-y-2">
        {POWER_STAGES.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent   = index === currentStageIndex;

          return (
            <div
              key={stage.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                isCurrent   ? 'bg-blue-50 border border-blue-200' :
                isCompleted ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center animate-pulse" style={{ backgroundColor: stage.color }}>
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
                    isCurrent   ? 'text-blue-900' :
                    isCompleted ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-xs text-green-600">✓ Done</span>
                  )}
                </div>
                {isCurrent && (
                  <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Stage hint */}
      {nextStage && currentStatus !== 'completed' && (
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: nextStage.color }}
          >
            <span className="text-white font-bold text-sm">→</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-900">Next: {nextStage.label}</p>
            <p className="text-xs text-blue-600">{nextStage.description}</p>
          </div>
        </div>
      )}

      {/* Completion */}
      {currentStatus === 'completed' && (
        <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Check size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-green-900">Project Complete!</p>
            <p className="text-xs text-green-700">This customer has completed the entire pipeline.</p>
          </div>
        </div>
      )}
    </div>
  );
}
