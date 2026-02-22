import React, { useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { Automation } from '@/lib/crmData';
import {
  Zap,
  Plus,
  Search,
  Play,
  Pause,
  Edit2,
  Trash2,
  Clock,
  Mail,
  MessageSquare,
  Bell,
  FileText,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
  CheckCircle,
  XCircle,
  Settings,
} from 'lucide-react';

export default function AutomationsView() {
  const { state, dispatch } = useCRM();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Filter automations
  const filteredAutomations = state.automations.filter((auto) => {
    const matchesSearch =
      searchQuery === '' ||
      auto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auto.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auto.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && auto.isActive) ||
      (filterActive === 'inactive' && !auto.isActive);
    return matchesSearch && matchesFilter;
  });

  const handleToggleAutomation = (id: string) => {
    dispatch({ type: 'TOGGLE_AUTOMATION', payload: id });
  };

  const getActionIcon = (action: string) => {
    if (action.toLowerCase().includes('email')) return <Mail size={16} className="text-blue-500" />;
    if (action.toLowerCase().includes('sms')) return <MessageSquare size={16} className="text-green-500" />;
    if (action.toLowerCase().includes('task')) return <CheckCircle size={16} className="text-purple-500" />;
    if (action.toLowerCase().includes('notify') || action.toLowerCase().includes('alert'))
      return <Bell size={16} className="text-amber-500" />;
    if (action.toLowerCase().includes('invoice') || action.toLowerCase().includes('payment'))
      return <DollarSign size={16} className="text-green-500" />;
    return <Zap size={16} className="text-gray-500" />;
  };

  const getTriggerIcon = (trigger: string) => {
    if (trigger.toLowerCase().includes('status')) return <Settings size={16} className="text-indigo-500" />;
    if (trigger.toLowerCase().includes('time') || trigger.toLowerCase().includes('days') || trigger.toLowerCase().includes('hours'))
      return <Clock size={16} className="text-orange-500" />;
    if (trigger.toLowerCase().includes('invoice') || trigger.toLowerCase().includes('payment'))
      return <DollarSign size={16} className="text-green-500" />;
    if (trigger.toLowerCase().includes('job')) return <FileText size={16} className="text-blue-500" />;
    if (trigger.toLowerCase().includes('lead') || trigger.toLowerCase().includes('canvas'))
      return <Users size={16} className="text-purple-500" />;
    return <Zap size={16} className="text-gray-500" />;
  };

  const activeCount = state.automations.filter((a) => a.isActive).length;
  const inactiveCount = state.automations.filter((a) => !a.isActive).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Automations</h2>
          <p className="text-gray-500 mt-1">
            {activeCount} active, {inactiveCount} inactive automations
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} />
          <span className="font-medium">Create Automation</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Play className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-gray-500 text-sm">Active Automations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Pause className="text-gray-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
              <p className="text-gray-500 text-sm">Paused Automations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Zap className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">1,247</p>
              <p className="text-gray-500 text-sm">Actions This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterActive(filter.id as 'all' | 'active' | 'inactive')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterActive === filter.id
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {filteredAutomations.map((automation) => (
          <div
            key={automation.id}
            className={`bg-white rounded-xl border p-6 transition-all ${
              automation.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    automation.isActive ? 'bg-green-100' : 'bg-gray-100'
                  }`}
                >
                  <Zap
                    size={24}
                    className={automation.isActive ? 'text-green-600' : 'text-gray-400'}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        automation.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {automation.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    {/* Trigger */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                      {getTriggerIcon(automation.trigger)}
                      <span className="text-sm text-gray-700">{automation.trigger}</span>
                    </div>

                    <ArrowRight size={20} className="text-gray-400" />

                    {/* Action */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                      {getActionIcon(automation.action)}
                      <span className="text-sm text-blue-700">{automation.action}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle Switch */}
                <button
                  onClick={() => handleToggleAutomation(automation.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    automation.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      automation.isActive ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>

                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Edit2 size={16} className="text-gray-500" />
                </button>
                <button className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredAutomations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Zap size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No automations found</h3>
            <p className="text-gray-500">Try adjusting your search or filter</p>
          </div>
        )}
      </div>

      {/* Suggested Automations */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Automations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              name: 'Welcome Series',
              description: 'Send a series of welcome emails to new leads',
              icon: <Mail className="text-blue-500" size={20} />,
            },
            {
              name: 'Stale Lead Alert',
              description: 'Notify sales when a lead has been inactive for 7 days',
              icon: <Bell className="text-amber-500" size={20} />,
            },
            {
              name: 'Job Completion Survey',
              description: 'Automatically send satisfaction survey after job completion',
              icon: <FileText className="text-green-500" size={20} />,
            },
            {
              name: 'Payment Reminder',
              description: 'Send reminder 3 days before invoice due date',
              icon: <DollarSign className="text-purple-500" size={20} />,
            },
          ].map((suggestion, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {suggestion.icon}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{suggestion.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{suggestion.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
