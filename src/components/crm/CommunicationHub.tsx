import React, { useRef, useState, useMemo } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';
import { toast } from 'sonner';
import { useTwilio } from '@/hooks/useTwilio';
import { SMSDialog } from '@/components/crm/SMSDialog';
import {
  formatDateTime,
  getContactFullName,
  Communication,
} from '@/lib/crmData';
import {
  getMentionTargets,
  findActiveMentionQuery,
  getMentionSuggestions,
  applyMention,
  extractMentionHandles,
  type MentionTarget,
} from '@/lib/mentions';
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

type CommFilter = 'all' | 'email' | 'sms' | 'call' | 'note' | 'insurance' | 'activity';

// Communication templates for quick responses
const communicationTemplates = [
  {
    id: 'initial-contact',
    title: 'Initial Contact',
    type: 'email',
    subject: 'Your Storm Damage Assessment - Next Steps',
    content: `Dear {{CUSTOMER_NAME}},

Thank you for contacting us regarding your storm damage assessment. We understand that dealing with property damage can be stressful, and we're committed to making this process as smooth as possible for you.

We would like to schedule a comprehensive inspection of your property at your earliest convenience. Our certified inspectors will:

• Conduct a thorough assessment of all affected areas
• Document damage with detailed photographs and measurements
• Provide a comprehensive estimate for insurance purposes
• Coordinate directly with your insurance adjuster to expedite your claim

Our next available inspection slots are:
• [Please provide 2-3 specific date/time options]

Please reply to this email or call us at {{PHONE}} to confirm which time works best for you. If none of these times are suitable, we'll be happy to arrange an alternative.

We look forward to helping restore your property to its original condition.

Best regards,
{{AGENT_NAME}}
{{PHONE}}`
  },
  {
    id: 'insurance-claim',
    title: 'Insurance Claim Update',
    type: 'email',
    subject: 'Update on Your Insurance Claim #{{CLAIM_NUMBER}}',
    content: `Dear {{CUSTOMER_NAME}},

I wanted to provide you with an update on the progress of your insurance claim (#{{CLAIM_NUMBER}}).

Current Status: [Please specify current status - e.g., "Under review by adjuster", "Approved", "Additional documentation requested"]

Recent Activity:
• [List recent developments]
• [Any communications with insurance company]
• [Documents submitted or pending]

Next Steps:
• [Clearly outline what happens next]
• [Any action items for the customer]
• [Expected timeline]

We are working closely with {{ADJUSTER_NAME}} at your insurance company to ensure your claim is processed efficiently and fairly. Our goal is to secure the full coverage you're entitled to under your policy.

If you have any questions or concerns about your claim, please don't hesitate to reach out. We're here to advocate for you throughout this entire process.

Best regards,
{{AGENT_NAME}}
{{PHONE}}`
  },
  {
    id: 'estimate-ready',
    title: 'Estimate Ready for Review',
    type: 'email',
    subject: 'Your Detailed Storm Damage Estimate is Ready',
    content: `Dear {{CUSTOMER_NAME}},

Great news! We have completed our comprehensive assessment, and your detailed storm damage estimate is now ready for your review.

Estimate Summary:
• Total Estimated Cost: {{ESTIMATE_AMOUNT}}
• Insurance Deductible: {{DEDUCTIBLE}}
• Estimated Out-of-Pocket: [Calculate if possible]

The complete estimate has been:
✓ Sent to your insurance adjuster for review
✓ Attached to this email for your records
✓ Uploaded to your customer portal (if applicable)

What Happens Next:

1. Review Period (1-2 days)
   Please review the estimate carefully. We're happy to answer any questions you may have.

2. Insurance Approval (3-5 business days)
   Your insurance company will review and approve the estimate. We'll follow up with them directly.

3. Work Scheduling (Upon approval)
   Once approved, we'll schedule your project at a time that's convenient for you.

Our estimate includes all necessary materials, labor, and permits required to restore your property to pre-loss condition. We use only high-quality materials and our work is backed by our comprehensive warranty.

Please feel free to call me directly at {{PHONE}} if you have any questions about the estimate or the next steps in the process.

Thank you for choosing us for your restoration needs. We're committed to delivering exceptional results.

Best regards,
{{AGENT_NAME}}
{{PHONE}}`
  },
  {
    id: 'work-scheduled',
    title: 'Work Scheduled Confirmation',
    type: 'email',
    subject: 'Your Project is Scheduled - Important Details Inside',
    content: `Dear {{CUSTOMER_NAME}},

Excellent news! Your restoration project has been scheduled and we're ready to begin work.

Project Details:
• Start Date: [SPECIFIC DATE]
• Estimated Duration: [NUMBER OF DAYS]
• Crew Arrival Time: [SPECIFIC TIME]
• Project Manager: {{AGENT_NAME}}
• Direct Contact: {{PHONE}}

Before We Begin:

Please ensure:
✓ Clear driveway access for our trucks and equipment
✓ Pets are secured indoors during work hours
✓ Vehicles are moved from the immediate work area
✓ Any valuable outdoor items are stored safely

What to Expect:

• Our crew will arrive promptly and introduce themselves
• We'll conduct a brief walk-through before starting
• Daily cleanup will be performed at the end of each workday
• We'll communicate any unexpected findings immediately
• A final inspection will be scheduled upon completion

Weather Contingency:
If weather conditions are unfavorable, we'll contact you by 7:00 AM on the scheduled day to reschedule.

Your project manager, {{AGENT_NAME}}, will be your primary point of contact throughout the project. Please don't hesitate to reach out with any questions or concerns.

We're excited to get started and look forward to delivering exceptional results!

Best regards,
{{AGENT_NAME}}
{{PHONE}}`
  },
  {
    id: 'work-complete',
    title: 'Project Completion',
    type: 'email',
    subject: 'Your Project is Complete - Final Details & Warranty',
    content: `Dear {{CUSTOMER_NAME}},

We're pleased to inform you that your restoration project has been successfully completed!

Project Summary:
• Start Date: [SPECIFIC DATE]
• Completion Date: [SPECIFIC DATE]
• Work Performed: [DETAILED DESCRIPTION]
• Final Inspection: Passed ✓

What's Included:

✓ Detailed completion photos (attached)
✓ Warranty documentation (attached)
✓ Maintenance recommendations (attached)
✓ Final invoice and insurance paperwork

Warranty Information:
Your work is covered by our comprehensive warranty, which includes:
• [Specify warranty terms - e.g., "10-year workmanship warranty"]
• [Material warranties from manufacturers]
• [Any additional coverage details]

Next Steps:

1. Final Walk-Through
   We encourage you to inspect the completed work. If you notice anything that needs attention, please contact us immediately.

2. Insurance Finalization
   We'll coordinate with your insurance company to finalize all paperwork and payment processing.

3. Payment
   Final payment will be processed according to your insurance settlement. We'll contact you once we receive confirmation from your insurer.

Maintenance Tips:
[Include 2-3 relevant maintenance recommendations]

Your satisfaction is our top priority. If you have any questions or concerns about the completed work, please don't hesitate to contact me directly at {{PHONE}}.

Thank you for choosing us for your restoration needs. We truly appreciate your business and trust.

If you're satisfied with our work, we would be grateful if you could leave us a review [include link if applicable]. Your feedback helps us serve future customers better.

Best regards,
{{AGENT_NAME}}
{{PHONE}}

P.S. We're always here if you need us. Please keep our contact information for any future needs or questions about your warranty.`
  },
  {
    id: 'follow-up',
    title: 'Post-Project Follow-Up',
    type: 'email',
    subject: 'How is Everything Looking? Quick Check-In',
    content: `Dear {{CUSTOMER_NAME}},

I hope this message finds you well! It's been [TIME PERIOD] since we completed your restoration project, and I wanted to reach out to see how everything is holding up.

Quick Check-In:
• Are you satisfied with the completed work?
• Have you noticed any issues or concerns?
• Do you have any questions about maintenance or your warranty?

Your feedback is incredibly valuable to us. If everything is looking great, we'd love to hear about it. If there's anything that needs attention, please let us know right away so we can address it promptly.

As a reminder, your work is covered by our warranty, and we stand behind every project we complete. Don't hesitate to reach out if you need anything.

Thank you again for choosing us for your restoration needs. It was a pleasure working with you!

Best regards,
{{AGENT_NAME}}
{{PHONE}}`
  },
  {
    id: 'appointment-reminder',
    title: 'Appointment Reminder',
    type: 'sms',
    subject: '',
    content: `Hi {{CUSTOMER_NAME}}! Reminder: We have your inspection scheduled for [DATE] at [TIME]. Our team will arrive promptly. Please call {{PHONE}} if you need to reschedule. Looking forward to seeing you! - {{AGENT_NAME}}`
  },
  {
    id: 'quick-update',
    title: 'Quick Status Update',
    type: 'sms',
    subject: '',
    content: `Hi {{CUSTOMER_NAME}}! Quick update on your project: [INSERT BRIEF UPDATE]. Everything is progressing well. Call {{PHONE}} with any questions. Thanks! - {{AGENT_NAME}}`
  }
];

export default function CommunicationHub() {
  const { state, dispatch } = useCRM();
  const { profile, session } = useAuth();
  const [filter, setFilter] = useState<CommFilter>('all');
  const [hideAuto, setHideAuto] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComm, setSelectedComm] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeContactId, setComposeContactId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeType, setComposeType] = useState<'note' | 'email' | 'sms' | 'call'>('note');
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);

  const { twilioEnabled, loadingCredentials } = useTwilio();
  const [composeMentionStart, setComposeMentionStart] = useState<number | null>(null);
  const composeInputRef = useRef<HTMLTextAreaElement>(null);

  const mentionTargets = useMemo(() => getMentionTargets(state.teamMembers), [state.teamMembers]);
  const composeMentionSuggestions = useMemo<MentionTarget[]>(() => {
    if (composeMentionStart === null) return [];
    const caret = composeInputRef.current?.selectionStart ?? composeText.length;
    const active = findActiveMentionQuery(composeText, caret);
    if (!active) return [];
    return getMentionSuggestions(mentionTargets, active.query);
  }, [composeMentionStart, composeText, mentionTargets]);

  const syncComposeMentionSuggestions = (text: string, caret: number) => {
    const active = findActiveMentionQuery(text, caret);
    if (!active) {
      setComposeMentionStart(null);
      return;
    }
    setComposeMentionStart(active.start);
  };

  const insertComposeMention = (handle: string) => {
    if (!composeInputRef.current || composeMentionStart === null) return;
    const caret = composeInputRef.current.selectionStart ?? composeText.length;
    const updated = applyMention(composeText, composeMentionStart, caret, handle);
    setComposeText(updated.text);
    setComposeMentionStart(null);
    requestAnimationFrame(() => {
      composeInputRef.current?.focus();
      composeInputRef.current?.setSelectionRange(updated.caret, updated.caret);
    });
  };

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
    // When hideAuto is on, exclude auto-logged activity notes (but keep if filter is explicitly 'activity')
    const matchesAutoFilter = filter === 'activity'
      ? comm.isAuto === true
      : !hideAuto || !comm.isAuto;
    const matchesSearch =
      searchQuery === '' ||
      comm.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getContactFullName(comm.contact).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.subject && comm.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesAutoFilter && matchesSearch;
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
    { id: 'activity', label: 'Activity', icon: <Zap size={16} /> },
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
      // No company ID - likely in demo mode or initialization
      appendCommunicationToContact(contactId, draft);
      return draft;
    }

    try {
      const created = await db.createCommunication({
        company_id: profile.company_id,
        contact_id: contactId,
        type: draft.type,
        direction: draft.direction,
        content: draft.content,
        user_id: fallbackUserId || undefined,
      });

      if (!created) {
        // DB save failed - do NOT optimistically update unless we can confirm it's a network issue
        toast.error('Failed to save communication log. Check your connection and try again.');
        return null;
      }

      const persisted: Communication = {
        ...draft,
        id: created.id,
        timestamp: created.created_at,
      };

      appendCommunicationToContact(contactId, persisted);
      return persisted;
    } catch (err: any) {
      // Only optimistically update if this is a network/timeout error
      const isNetworkError = err?.message?.includes('network') || 
                             err?.message?.includes('timeout') || 
                             err?.code === 'PGRST301'; // Supabase network error
      
      if (isNetworkError) {
        toast.warning('Offline - communication saved locally and will sync when online');
        appendCommunicationToContact(contactId, draft);
        return draft;
      } else {
        // Permission, validation, or other DB error - don't hide it
        toast.error(`Failed to log communication: ${err?.message || 'Unknown error'}`);
        return null;
      }
    }
  };

  const handleUseTemplate = (template: typeof communicationTemplates[0]) => {
    if (!selectedCommData?.contact) {
      toast.error('Select a contact thread before using a template');
      return;
    }
    const contact = selectedCommData.contact;

    // Replace template variables with actual data
    let content = template.content;
    let subject = template.subject;
    
    const replacements = {
      '{{CUSTOMER_NAME}}': getContactFullName(contact),
      '{{AGENT_NAME}}': state.currentUser?.name || 'Your Agent',
      '{{PHONE}}': state.currentUser?.phone || '(555) 123-4567',
      '{{CLAIM_NUMBER}}': contact.claimNumber || '[CLAIM_NUMBER]',
      '{{ADJUSTER_NAME}}': contact.adjusterName || '[ADJUSTER_NAME]',
      '{{DEDUCTIBLE}}': contact.deductible ? `$${contact.deductible.toLocaleString()}` : '[DEDUCTIBLE]',
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
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
    });

    // Format for reply field (include subject for emails)
    const formattedContent = template.type === 'email' && subject
      ? `Subject: ${subject}\n\n${content}`
      : content;

    setReplyText(formattedContent);
    setShowTemplates(false);
    toast.success(`Template "${template.title}" loaded - Review and customize before sending`);
  };

  const handleCompose = () => {
    setComposeContactId(selectedCommData?.contact?.id || '');
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
    const mentionedHandles = extractMentionHandles(composeText.trim());
    if (mentionedHandles.length > 0) {
      console.log('[CommunicationHub] mentioned handles:', mentionedHandles);
    }
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
            <p style="white-space:pre-wrap;">${body.replace(/\n/g, '<br>')}</p>
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

  const hasSelectedThread = !!selectedCommData?.contact;

  return (
    <div className="h-full flex flex-col">
      {/* Twilio SMS Bar */}
      {!loadingCredentials && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-b border-green-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              {twilioEnabled ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">Send SMS via Twilio</p>
                  <p className="text-xs text-gray-500">
                    {hasSelectedThread
                      ? `Click "Send SMS" to text ${getContactFullName(selectedCommData!.contact)}`
                      : 'Select a contact thread to send an SMS, or click "Send SMS" to compose.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Configure Twilio in{' '}
                  <span className="font-semibold text-gray-800">Settings → Integrations</span>
                  {' '}to enable SMS.
                </p>
              )}
            </div>
            {twilioEnabled && (
              <button
                onClick={() => setShowSMSDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Send SMS
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
      {/* Left Panel - Communication List */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Communications</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplates(true)}
                disabled={!hasSelectedThread}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                title={!hasSelectedThread ? 'Select a contact thread first' : 'Browse templates'}
              >
                <FileText size={18} />
                <span className="font-medium">Templates</span>
              </button>
              <button
                onClick={() => {
                  if (!hasSelectedThread) {
                    setShowComposeModal(true);
                  } else {
                    handleCompose();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Compose new message"
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
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Inbox size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No communications found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search or filter</p>
              {(searchQuery || filter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear filters
                </button>
              )}
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
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  <FileText size={14} />
                  Use Template
                </button>
                <span className="text-xs text-gray-400">or type your own message below</span>
              </div>
              <div className="flex items-center gap-3">
                <textarea
                  placeholder="Type a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) {
                      void handleSendReply();
                    }
                  }}
                  rows={3}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                />
                <button
                  onClick={() => void handleSendReply()}
                  disabled={!replyText.trim()}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
                  title="Send reply (⌘+Enter)"
                >
                  <Send size={20} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Press ⌘+Enter to send</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail size={40} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Communication Thread</h3>
              <p className="text-gray-500 mb-6">Choose a contact from the list to view their communication history and send messages</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-blue-900 mb-2">💡 Quick Tip</p>
                <p className="text-sm text-blue-700">Once you select a contact, you'll be able to use professional templates, compose custom messages, and track all communication history in one place.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplates && selectedCommData?.contact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Professional Templates</h3>
                    <p className="text-blue-100 text-sm">Pre-written messages for {getContactFullName(selectedCommData.contact)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Contact Context Bar */}
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {selectedCommData.contact.firstName[0]}{selectedCommData.contact.lastName[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Sending to: {getContactFullName(selectedCommData.contact)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {selectedCommData.contact.email} • {selectedCommData.contact.phone1}
                    {selectedCommData.contact.claimNumber && ` • Claim #${selectedCommData.contact.claimNumber}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Templates Grid */}
            <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {communicationTemplates.map((template) => {
                  // Preview the template with actual data
                  let previewContent = template.content;
                  const replacements = {
                    '{{CUSTOMER_NAME}}': getContactFullName(selectedCommData.contact),
                    '{{AGENT_NAME}}': state.currentUser?.name || 'Your Agent',
                    '{{PHONE}}': state.currentUser?.phone || '(555) 123-4467',
                    '{{CLAIM_NUMBER}}': selectedCommData.contact.claimNumber || '[CLAIM_NUMBER]',
                    '{{ADJUSTER_NAME}}': selectedCommData.contact.adjusterName || '[ADJUSTER_NAME]',
                    '{{DEDUCTIBLE}}': selectedCommData.contact.deductible ? `$${selectedCommData.contact.deductible}` : '[DEDUCTIBLE]',
                    '{{INSPECTION_DATE}}': '[INSPECTION_DATE]',
                    '{{ESTIMATE_AMOUNT}}': selectedCommData.contact.projectValue ? `$${selectedCommData.contact.projectValue.toLocaleString()}` : '[ESTIMATE_AMOUNT]',
                    '{{START_DATE}}': '[START_DATE]',
                    '{{START_TIME}}': '[START_TIME]',
                    '{{COMPLETION_DATE}}': '[COMPLETION_DATE]',
                    '{{WORK_DESCRIPTION}}': '[WORK_DESCRIPTION]',
                    '{{STATUS}}': '[STATUS]',
                    '{{NEXT_STEPS}}': '[NEXT_STEPS]',
                  };
                  Object.entries(replacements).forEach(([placeholder, value]) => {
                    previewContent = previewContent.replace(new RegExp(placeholder, 'g'), value);
                  });

                  return (
                    <div 
                      key={template.id} 
                      className="group border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all duration-200 bg-white"
                    >
                      {/* Template Header */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              template.type === 'email' ? 'bg-blue-100' : 'bg-green-100'
                            }`}>
                              {template.type === 'email' ? (
                                <Mail size={16} className="text-blue-600" />
                              ) : (
                                <MessageSquare size={16} className="text-green-600" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{template.title}</h4>
                              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${
                                template.type === 'email' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {template.type.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {template.subject && (
                          <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-gray-500 font-medium mb-0.5">Subject:</p>
                            <p className="text-sm font-medium text-gray-900">{template.subject}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Template Preview */}
                      <div className="p-4">
                        <div className="bg-gray-50 rounded-lg p-3 mb-3 max-h-48 overflow-y-auto">
                          <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                            {previewContent.substring(0, 300)}{previewContent.length > 300 ? '...' : ''}
                          </p>
                        </div>
                        
                        {/* Use Template Button */}
                        <button
                          onClick={() => handleUseTemplate(template)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-sm hover:shadow group-hover:scale-[1.02]"
                        >
                          <Zap size={16} />
                          Use This Template
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Sparkles size={16} className="text-blue-600" />
                  <span>Templates auto-fill with customer data • Review before sending</span>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
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
                <div className="relative">
                  <textarea
                    ref={composeInputRef}
                    value={composeText}
                    onChange={(e) => {
                      setComposeText(e.target.value);
                      syncComposeMentionSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
                    }}
                    onKeyUp={(e) => {
                      const el = e.currentTarget;
                      syncComposeMentionSuggestions(el.value, el.selectionStart ?? el.value.length);
                    }}
                    placeholder={composeType === 'email' ? 'Type your message or click ✨ AI Draft to generate one...' : 'Type your message or note... (use @ to mention team members)'}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                  {composeMentionSuggestions.length > 0 && (
                    <div className="absolute z-10 bottom-full mb-1 left-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {composeMentionSuggestions.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertComposeMention(target.handle);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                        >
                          <span className="font-medium text-gray-900">@{target.handle}</span>
                          <span className="text-gray-500 truncate">{target.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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

      {/* SMS Dialog — opens when Twilio is configured */}
      <SMSDialog
        open={showSMSDialog}
        onOpenChange={setShowSMSDialog}
        contactName={selectedCommData?.contact ? getContactFullName(selectedCommData.contact) : undefined}
        contactPhone={selectedCommData?.contact?.phone1 ?? undefined}
        contactId={selectedCommData?.contact?.id}
        companyId={profile?.company_id}
      />
    </div>
  );
}
