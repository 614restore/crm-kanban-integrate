import React, { useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import {
  formatDateTime,
  getContactFullName,
  getTeamMemberById,
} from '@/lib/crmData';
import {
  Mail,
  MessageSquare,
  Phone,
  Shield,
  FileText,
  Search,
  Filter,
  Plus,
  Send,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  User,
  ChevronRight,
} from 'lucide-react';

type CommFilter = 'all' | 'email' | 'sms' | 'call' | 'note' | 'insurance';

export default function CommunicationHub() {
  const { state, dispatch } = useCRM();
  const [filter, setFilter] = useState<CommFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComm, setSelectedComm] = useState<string | null>(null);

  // Gather all communications from all contacts
  const allCommunications = state.contacts.flatMap((contact) =>
    (contact.communications || []).map((comm) => ({
      ...comm,
      contact,
    }))
  );

  // Sort by timestamp (newest first)
  const sortedCommunications = [...allCommunications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Filter communications
  const filteredCommunications = sortedCommunications.filter((comm) => {
    const matchesFilter = filter === 'all' || comm.type === filter;
    const matchesSearch =
      searchQuery === '' ||
      comm.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getContactFullName(comm.contact).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.subject && comm.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail size={18} className="text-blue-600" />;
      case 'sms':
        return <MessageSquare size={18} className="text-green-600" />;
      case 'call':
        return <Phone size={18} className="text-purple-600" />;
      case 'insurance':
        return <Shield size={18} className="text-amber-600" />;
      default:
        return <FileText size={18} className="text-gray-600" />;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100';
      case 'sms':
        return 'bg-green-100';
      case 'call':
        return 'bg-purple-100';
      case 'insurance':
        return 'bg-amber-100';
      default:
        return 'bg-gray-100';
    }
  };

  const filterButtons = [
    { id: 'all', label: 'All', icon: <Inbox size={16} /> },
    { id: 'email', label: 'Email', icon: <Mail size={16} /> },
    { id: 'sms', label: 'SMS', icon: <MessageSquare size={16} /> },
    { id: 'call', label: 'Calls', icon: <Phone size={16} /> },
    { id: 'insurance', label: 'Insurance', icon: <Shield size={16} /> },
    { id: 'note', label: 'Notes', icon: <FileText size={16} /> },
  ];

  const selectedCommData = selectedComm
    ? filteredCommunications.find((c) => c.id === selectedComm)
    : null;

  return (
    <div className="h-full flex">
      {/* Left Panel - Communication List */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Communications</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={18} />
              <span className="font-medium">Compose</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search communications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id as CommFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === btn.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Communication List */}
        <div className="flex-1 overflow-y-auto">
          {filteredCommunications.map((comm) => (
            <div
              key={comm.id}
              onClick={() => setSelectedComm(comm.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                selectedComm === comm.id ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeBg(comm.type)}`}>
                  {getTypeIcon(comm.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 truncate">
                      {getContactFullName(comm.contact)}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {comm.direction === 'inbound' ? (
                        <ArrowDownLeft size={14} className="text-green-500" />
                      ) : (
                        <ArrowUpRight size={14} className="text-blue-500" />
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDateTime(comm.timestamp)}
                      </span>
                    </div>
                  </div>
                  {comm.subject && (
                    <p className="text-sm font-medium text-gray-700 truncate">{comm.subject}</p>
                  )}
                  <p className="text-sm text-gray-500 line-clamp-2">{comm.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">{comm.userName}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                      {comm.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredCommunications.length === 0 && (
            <div className="p-12 text-center">
              <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No communications found</h3>
              <p className="text-gray-500">Try adjusting your search or filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Communication Detail */}
      <div className="w-1/2 flex flex-col bg-gray-50">
        {selectedCommData ? (
          <>
            {/* Detail Header */}
            <div className="p-6 bg-white border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getTypeBg(selectedCommData.type)}`}>
                    {getTypeIcon(selectedCommData.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedCommData.subject || `${selectedCommData.type.charAt(0).toUpperCase() + selectedCommData.type.slice(1)} Communication`}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <span>{formatDateTime(selectedCommData.timestamp)}</span>
                      <span>•</span>
                      <span className="capitalize">{selectedCommData.type}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {selectedCommData.direction === 'inbound' ? (
                          <>
                            <ArrowDownLeft size={14} className="text-green-500" />
                            Inbound
                          </>
                        ) : (
                          <>
                            <ArrowUpRight size={14} className="text-blue-500" />
                            Outbound
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SELECT_CONTACT', payload: selectedCommData.contact.id })}
                  className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                >
                  View Contact
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-6 bg-white border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {selectedCommData.contact.firstName[0]}
                  {selectedCommData.contact.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {getContactFullName(selectedCommData.contact)}
                  </p>
                  <p className="text-sm text-gray-500">{selectedCommData.contact.email}</p>
                  <p className="text-sm text-gray-500">{selectedCommData.contact.phone1}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedCommData.content}</p>
              </div>

              {/* Sender Info */}
              <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <User size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedCommData.userName}</p>
                    <p className="text-sm text-gray-500">Team Member</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reply Actions */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Type a reply..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
                <button className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Select a communication</h3>
              <p className="text-gray-500">Choose a message from the list to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
