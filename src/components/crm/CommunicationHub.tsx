import React, { useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';
import { toast } from 'sonner';
import {
  formatDateTime,
  getContactFullName,
  Communication,
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
  Star,
  Flag,
  Zap,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';

type CommFilter = 'all' | 'email' | 'sms' | 'call' | 'note' | 'insurance';

// Communication templates for quick responses
const communicationTemplates = [
  {
    id: 'initial-contact',
    title: 'Initial Contact',
    type: 'email',
    subject: 'Your Storm Damage Assessment Request',
    content: `Hi {{CUSTOMER_NAME}},

Thank you for reaching out about storm damage assessment. We understand how stressful property damage can be, and we're here to help.

Our next available inspection slot is {{INSPECTION_DATE}}. During this comprehensive assessment, we will:

- Thoroughly inspect all affected areas
- Document damage with detailed photos  
- Provide a detailed estimate for insurance
- Coordinate directly with your insurance adjuster

Please confirm this appointment time works for you. We look forward to helping restore your property.

Best regards,
{{AGENT_NAME}}`
  },
  {
    id: 'insurance-claim',
    title: 'Insurance Claim Update',
    type: 'email',
    subject: 'Insurance Claim Status Update - Claim #{{CLAIM_NUMBER}}',
    content: `Hi {{CUSTOMER_NAME}},

I wanted to update you on the progress of your insurance claim (#{{CLAIM_NUMBER}}).

Current Status: {{STATUS}}
Next Steps: {{NEXT_STEPS}}

We're working closely with {{ADJUSTER_NAME}} to ensure your claim is processed quickly and fairly. 

If you have any questions, please don't hesitate to reach out.

Best regards,
{{AGENT_NAME}}`
  },
  {
    id: 'estimate-ready',
    title: 'Estimate Ready for Review',
    type: 'email',
    subject: 'Your Storm Damage Estimate is Ready',
    content: `Hi {{CUSTOMER_NAME}},

Great news! We've completed our assessment and your storm damage estimate is ready for review.

Total Estimate: {{ESTIMATE_AMOUNT}}
Insurance Deductible: {{DEDUCTIBLE}}

The estimate has been sent to your insurance adjuster and is attached for your records. We recommend reviewing it carefully and let us know if you have any questions.

Next steps:
1. Review the estimate
2. Insurance approval process (typically 3-5 business days)
3. Schedule work commencement

Thank you for choosing us for your restoration needs.

Best regards,
{{AGENT_NAME}}`
  },
  {
    id: 'work-scheduled',
    title: 'Work Scheduled',
    type: 'sms',
    subject: '',
    content: `Hi {{CUSTOMER_NAME}}! Your roof work is scheduled to begin {{START_DATE}}. Our crew will arrive by {{START_TIME}}. Please ensure clear driveway access. Any questions? Call {{PHONE}}.`
  },
  {
    id: 'work-complete',
    title: 'Work Completion',
    type: 'email',
    subject: 'Your Roofing Project is Complete!',
    content: `Hi {{CUSTOMER_NAME}},

Excellent news! We've successfully completed your roofing project.

Project Summary:
- Start Date: {{START_DATE}}
- Completion Date: {{COMPLETION_DATE}}
- Work Performed: {{WORK_DESCRIPTION}}

Your warranty information and final photos are attached. We'll handle the final insurance paperwork and coordinate payment.

Thank you for choosing us. We're here if you need anything!

Best regards,
{{AGENT_NAME}}`
  }
];

export default function CommunicationHub() {
  const { state, dispatch } = useCRM();
  const { profile, session } = useAuth();
  const [filter, setFilter] = useState<CommFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComm, setSelectedComm] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeContactId, setComposeContactId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeType, setComposeType] = useState<'note' | 'email' | 'sms' | 'call'>('note');
  const [isAiDrafting, setIsAiDrafting] = useState(false);

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

  const appendCommunicationToContact = (contactId: string, communication: Communication) => {
    const target = state.contacts.find((contact) => contact.id === contactId);
    if (!target) return;

    dispatch({
      type: 'UPDATE_CONTACT',
      payload: {
        ...target,
        communications: [communication, ...(target.communications || [])],
      },
    });
  };

  const persistCommunication = async (contactId: string, content: string, type: Communication['type'] = 'note') => {
    const fallbackUserId = state.currentUser?.id || '';
    const fallbackUserName = state.currentUser?.name || 'Team Member';

    const draft: Communication = {
      id: `comm-${Date.now()}`,
      contactId,
      type,
      direction: 'outbound',
      content,
      timestamp: new Date().toISOString(),
      userId: fallbackUserId,
      userName: fallbackUserName,
    };

    if (!profile?.company_id) {
      appendCommunicationToContact(contactId, draft);
      return draft;
    }

    const created = await db.createCommunication({
      company_id: profile.company_id,
      contact_id: contactId,
      type: draft.type,
      direction: draft.direction,
      content: draft.content,
      user_id: fallbackUserId || undefined,
    });

    if (!created) {
      appendCommunicationToContact(contactId, draft);
      return draft;
    }

    const persisted: Communication = {
      ...draft,
      id: created.id,
      timestamp: created.created_at,
    };

    appendCommunicationToContact(contactId, persisted);
    return persisted;
  };

  const handleUseTemplate = (template: typeof communicationTemplates[0]) => {
    const contact = selectedCommData?.contact || state.contacts[0];
    if (!contact) {
      toast.error('No contact selected');
      return;
    }

    // Replace template variables with actual data
    let content = template.content;
    const replacements = {
      '{{CUSTOMER_NAME}}': getContactFullName(contact),
      '{{AGENT_NAME}}': state.currentUser?.name || 'Your Agent',
      '{{PHONE}}': state.currentUser?.phone || '(555) 123-4567',
      '{{CLAIM_NUMBER}}': contact.claimNumber || '[CLAIM_NUMBER]',
      '{{ADJUSTER_NAME}}': contact.adjusterName || '[ADJUSTER_NAME]',
      '{{DEDUCTIBLE}}': contact.deductible ? `$${contact.deductible}` : '[DEDUCTIBLE]',
      '{{INSPECTION_DATE}}': '[INSPECTION_DATE]',
      '{{ESTIMATE_AMOUNT}}': contact.projectValue ? `$${contact.projectValue.toLocaleString()}` : '[ESTIMATE_AMOUNT]',
      '{{START_DATE}}': '[START_DATE]',
      '{{START_TIME}}': '[START_TIME]',
      '{{COMPLETION_DATE}}': '[COMPLETION_DATE]',
      '{{WORK_DESCRIPTION}}': '[WORK_DESCRIPTION]',
      '{{STATUS}}': '[STATUS]',
      '{{NEXT_STEPS}}': '[NEXT_STEPS]',
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      content = content.replace(new RegExp(placeholder, 'g'), value);
    });

    setReplyText(content);
    setShowTemplates(false);
    toast.success(`Template "${template.title}" loaded`);
  };

  const handleCompose = () => {
    const defaultContact = selectedCommData?.contact || state.contacts[0];
    setComposeContactId(defaultContact?.id || '');
    setComposeText('');
    setComposeType('note');
    setShowComposeModal(true);
  };

  const handleAIDraft = async () => {
    const contact = state.contacts.find((c) => c.id === composeContactId);
    if (!contact) {
      toast.error('Select a contact first');
      return;
    }
    setIsAiDrafting(true);
    try {
      const res = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          contactName: `${contact.firstName} ${contact.lastName}`,
          projectType: contact.projectType || contact.source || 'roofing/restoration',
          context: composeText.trim() || undefined,
          tone: 'professional and helpful',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'AI draft failed');
        return;
      }
      const draft = data.body ? `Subject: ${data.subject}\n\n${data.body}` : data.body;
      setComposeText(draft || data.body || '');
      toast.success('AI draft ready — review and edit before sending');
    } catch {
      toast.error('AI draft failed — check your network connection');
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handleSaveCompose = async () => {
    if (!composeText.trim() || !composeContactId) return;
    await persistCommunication(composeContactId, composeText.trim(), composeType);

    // If type is email, actually send it to the contact
    if (composeType === 'email') {
      const contact = state.contacts.find((c) => c.id === composeContactId);
      if (contact?.email) {
        // Parse optional "Subject: ..." line from compose text
        const lines = composeText.trim().split('\n');
        let subject = `Message from ${state.companyName || 'TrussCTR'}`;
        let body = composeText.trim();
        if (lines[0].toLowerCase().startsWith('subject:')) {
          subject = lines[0].replace(/^subject:\s*/i, '').trim();
          body = lines.slice(2).join('\n').trim() || lines.slice(1).join('\n').trim();
        }
        sendEmail({
          to: contact.email,
          subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <p>${body.replace(/\n/g, '<br>')}</p>
            <p style="margin-top:24px;color:#64748b;font-size:13px">— ${state.currentUser?.name || 'TrussCTR Team'}</p>
          </div>`,
        }).then(() => {
          toast.success(`Email sent to ${contact.email}`);
        }).catch(() => {
          toast.error('Email failed to send — saved as draft');
        });
      } else {
        toast.warning('Communication saved — no email on file for this contact');
      }
    } else {
      toast.success('Communication saved');
    }

    setShowComposeModal(false);
    setComposeText('');
  };

  const handleSendReply = async () => {
    if (!selectedCommData?.contact?.id) {
      toast.error('Select a communication first');
      return;
    }

    if (!replyText.trim()) return;

    await persistCommunication(selectedCommData.contact.id, replyText.trim());
    setReplyText('');
    toast.success('Reply saved');
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Communication List */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Communications</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText size={18} />
                <span className="font-medium">Templates</span>
              </button>
              <button
                onClick={handleCompose}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                <span className="font-medium">Compose</span>
              </button>
            </div>
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
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSendReply();
                    }
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => void handleSendReply()}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
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

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Communication Templates</h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <p className="text-gray-500 mt-1">Choose a template to get started with professional communications</p>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {communicationTemplates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {template.type === 'email' ? (
                          <Mail size={20} className="text-blue-600" />
                        ) : (
                          <MessageSquare size={20} className="text-green-600" />
                        )}
                        <h4 className="font-medium text-gray-900">{template.title}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        template.type === 'email' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {template.type.toUpperCase()}
                      </span>
                    </div>
                    
                    {template.subject && (
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Subject: {template.subject}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {template.content.substring(0, 150)}...
                    </p>
                    
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Zap size={16} />
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">New Communication</h3>
              <button onClick={() => setShowComposeModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <select
                  value={composeContactId}
                  onChange={(e) => setComposeContactId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="">Select a contact...</option>
                  {state.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-2">
                  {(['note', 'email', 'sms', 'call'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setComposeType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        composeType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  {composeType === 'email' && (
                    <button
                      onClick={() => { void handleAIDraft(); }}
                      disabled={isAiDrafting || !composeContactId}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAiDrafting ? (
                        <><Loader2 size={13} className="animate-spin" /> Drafting...</>
                      ) : (
                        <><Sparkles size={13} /> AI Draft</>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder={composeType === 'email' ? 'Type your message or click ✨ AI Draft to generate one...' : 'Type your message or note...'}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowComposeModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => { void handleSaveCompose(); }}
                disabled={!composeText.trim() || !composeContactId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
