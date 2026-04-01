import React, { useMemo, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CircleDollarSign,
  RotateCcw,
  Trophy,
} from 'lucide-react';

const capabilityGroups = [
  {
    title: 'Core CRM',
    items: ['Contacts and pipeline management', 'Status-based workflow tracking', 'Calendar and appointment scheduling'],
  },
  {
    title: 'Operations',
    items: ['Estimates, invoices, and financial reporting', 'Projects, work orders, and material orders', 'Document center and templates'],
  },
  {
    title: 'Growth',
    items: ['Automations and communication hub', 'Team performance tracking', 'AI assistant and integration framework'],
  },
];

interface QuizOption {
  id: string;
  label: string;
}

interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

const quizQuestions: QuizQuestion[] = [
  {
    id: 'team-size',
    prompt: 'How big is your current team?',
    options: [
      { id: 'solo', label: 'Just me' },
      { id: 'small', label: '2-5 users' },
      { id: 'growing', label: '6-15 users' },
      { id: 'large', label: '15+ users' },
    ],
  },
  {
    id: 'industry',
    prompt: 'What best describes your work?',
    options: [
      { id: 'roofing', label: 'Roofing' },
      { id: 'restoration', label: 'Restoration' },
      { id: 'general', label: 'General Contracting' },
      { id: 'mixed', label: 'Mixed Services' },
    ],
  },
  {
    id: 'priority',
    prompt: 'What is your top CRM priority?',
    options: [
      { id: 'pipeline', label: 'Pipeline Visibility' },
      { id: 'speed', label: 'Speed and Simplicity' },
      { id: 'documents', label: 'Docs and Signatures' },
      { id: 'financials', label: 'Estimates and Invoicing' },
    ],
  },
  {
    id: 'automation',
    prompt: 'How much automation do you want?',
    options: [
      { id: 'light', label: 'Just core automations' },
      { id: 'medium', label: 'Balanced automation' },
      { id: 'heavy', label: 'As much as possible' },
    ],
  },
  {
    id: 'budget',
    prompt: 'What is your budget mindset?',
    options: [
      { id: 'value', label: 'I want the best value' },
      { id: 'predictable', label: 'Flat predictable pricing' },
      { id: 'flex', label: 'Price matters less than workflow fit' },
      { id: 'spend-max', label: 'I want to spend as much money as possible' },
    ],
  },
];

export default function AboutView() {
  const { dispatch } = useCRM();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const isComplete = answeredCount === quizQuestions.length;
  const wantsToSpendMax = answers['budget'] === 'spend-max';

  const recommendation = useMemo(() => {
    if (!isComplete) return null;
    if (wantsToSpendMax) {
      return {
        crm: 'ServiceTitan',
        reason:
          'Based on your budget preference, a higher-cost enterprise platform is likely a fit for your selection style.',
        tone: 'amber' as const,
      };
    }
    return {
      crm: 'TrussCTR',
      reason:
        'Your answers align with contractor-first workflows, flat pricing structure, and all-in-one CRM operations.',
      tone: 'blue' as const,
    };
  }, [isComplete, wantsToSpendMax]);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 text-white">
        <div className="flex items-center gap-3 mb-3">
          <Building2 size={24} className="text-blue-300" />
          <h2 className="text-2xl font-bold">About TrussCTR</h2>
        </div>
        <p className="text-slate-200 max-w-4xl">
          TrussCTR is an all-in-one contractor CRM focused on helping roofing and restoration teams
          run their pipeline, scheduling, documents, and job operations from one system.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {capabilityGroups.map((group) => (
          <div key={group.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((item) => (
                <p key={item} className="text-sm text-gray-700 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <ShieldCheck size={18} className="text-blue-600" />
              Security and Reliability
            </div>
            <p className="text-sm text-gray-600">
              Data access uses company-level isolation, with role-aware features and centralized workflow logic
              to keep dashboards, pipeline, and contact pages aligned.
            </p>
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Sparkles size={18} className="text-indigo-600" />
              Product Direction
            </div>
            <p className="text-sm text-gray-600">
              Use the Pricing page to compare plans and the Settings area to configure company profile, billing,
              integrations, and permissions.
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'pricing' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            View Pricing
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Which CRM Is Best For Me?</h3>
            <p className="text-sm text-gray-600 mt-1">
              Answer the questionnaire below by tapping the bubble options.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            <CircleDollarSign size={14} />
            {answeredCount}/{quizQuestions.length} answered
          </div>
        </div>

        <div className="space-y-4">
          {quizQuestions.map((question) => (
            <div key={question.id} className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">{question.prompt}</p>
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                      className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {recommendation && (
          <div
            className={`rounded-xl border p-5 ${
              recommendation.tone === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-600">Recommendation</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 inline-flex items-center gap-2">
                  <Trophy size={20} className={recommendation.tone === 'blue' ? 'text-blue-600' : 'text-amber-600'} />
                  {recommendation.crm}
                </p>
                <p className="text-sm text-gray-700 mt-2 max-w-3xl">{recommendation.reason}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAnswers({})}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-white transition-colors text-sm font-medium"
                >
                  <RotateCcw size={14} />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_VIEW', payload: 'pricing' })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Pricing
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
