import React, { useState, useRef, useEffect } from 'react';
import { useCRM, usePipelineStats, useFinancialStats } from '@/lib/crmStore';
import { formatCurrency } from '@/lib/crmData';
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  MessageSquare,
  Lightbulb,
  HelpCircle,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const suggestedPrompts = [
  {
    icon: <TrendingUp size={16} />,
    text: 'How can I improve my conversion rate?',
  },
  {
    icon: <Users size={16} />,
    text: 'Best practices for managing insurance claims',
  },
  {
    icon: <DollarSign size={16} />,
    text: 'How do I set up payment automations?',
  },
  {
    icon: <Calendar size={16} />,
    text: 'Tips for scheduling efficiency',
  },
];

export default function AIAssistant() {
  const { state } = useCRM();
  const pipelineStats = usePipelineStats();
  const financialStats = useFinancialStats();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm your TrussCTR AI Assistant. I can help you with:\n\n• Navigating the CRM and its features\n• Sales pipeline optimization\n• Insurance claim management\n• Payment and invoicing best practices\n• Team management tips\n• Workflow automation suggestions\n\nHow can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateLocalResponse = (userInput: string): string => {
    const q = userInput.toLowerCase();
    const contactCount = state.contacts.length;
    const teamSize = state.teamMembers.length;
    const activeAutomations = state.automations.filter((a) => a.isActive).length;
    const prospectCount = state.contacts.filter((c) => c.status === 'prospect' || c.status === 'lead').length;
    const inProgressCount = state.contacts.filter((c) => ['in_progress', 'build_phase', 'signed'].includes(c.status)).length;
    const completedCount = state.contacts.filter((c) => c.status === 'completed').length;
    const convRate = pipelineStats.conversionRate;

    // Conversion rate / pipeline
    if (q.includes('conversion') || q.includes('convert') || (q.includes('improve') && q.includes('rate'))) {
      return `Your current conversion rate is ${convRate.toFixed(1)}% (${completedCount} completed out of ${contactCount} total contacts).\n\nHere are some tips to improve it:\n\n• **Follow up quickly** — Respond to new leads within 1 hour. Use the Appointments feature to schedule inspections immediately.\n• **Nurture your pipeline** — You have ${prospectCount} prospects/leads right now. Move them through stages with consistent touchpoints.\n• **Use automations** — You have ${activeAutomations} active automations. Set up email sequences for each pipeline stage to maintain engagement.\n• **Track your sources** — Check Reports to see which lead sources have the highest conversion rates, then focus your marketing there.\n• **Streamline estimates** — Send professional estimates quickly using the Documents feature to reduce decision time.`;
    }

    // Insurance claims
    if (q.includes('insurance') || q.includes('claim') || q.includes('contingency')) {
      return `Managing insurance claims effectively is key for restoration work. Here's how to use TrussCTR for claims:\n\n• **Track claim status** — Use pipeline stages to move contacts from "Inspection Completed" → "Estimate Sent" → "Contingency" → "Signed".\n• **Store documents** — Upload insurance documents and photos in the Documents section linked to each contact.\n• **Log communications** — Record every call and email with the insurance company in the contact's communication history.\n• **Set reminders** — Use Appointments to set follow-up dates for claim approvals.\n• **Photo documentation** — Use the Photo Capture feature in the field to take and organize damage photos by contact.\n\nYou currently have ${state.contacts.filter((c) => c.status === 'contingency').length} contacts in contingency stage.`;
    }

    // Payment / invoicing
    if (q.includes('payment') || q.includes('invoice') || q.includes('invoicing') || q.includes('billing')) {
      const totalInvoiced = financialStats.totalInvoiced;
      const totalPaid = financialStats.totalPaid;
      const outstanding = financialStats.totalOutstanding;
      return `Here's your invoicing overview:\n\n• **Total Invoiced:** ${formatCurrency(totalInvoiced)}\n• **Total Paid:** ${formatCurrency(totalPaid)}\n• **Outstanding:** ${formatCurrency(outstanding)}\n\nBest practices for getting paid faster:\n\n• **Send invoices promptly** — Create and send invoices as soon as work is completed.\n• **Set clear terms** — Use NET 30 or shorter payment terms.\n• **Follow up** — Set up reminders for overdue invoices. Check the "Pending Payment" pipeline stage.\n• **Multiple payment options** — Offer various payment methods to make it easy for customers.\n• **Partial invoicing** — For large jobs, send progress invoices at milestones rather than one final bill.`;
    }

    // Scheduling / calendar
    if (q.includes('schedule') || q.includes('calendar') || q.includes('appointment') || q.includes('booking')) {
      const upcomingAppts = state.appointments.filter((a) => new Date(a.date) >= new Date()).length;
      return `You have ${upcomingAppts} upcoming appointments scheduled.\n\nScheduling best practices:\n\n• **Block inspection times** — Dedicate specific days/times for inspections to minimize drive time.\n• **Buffer time** — Leave 30-minute buffers between appointments for travel and unexpected delays.\n• **Send confirmations** — Use email notifications to confirm appointments with customers.\n• **Route planning** — Group appointments by geographic area when possible.\n• **Quick follow-up** — After each appointment, update the contact's status and log notes immediately while details are fresh.\n\nUse the Calendar view to manage your schedule. You can create appointments directly from a contact's detail page.`;
    }

    // Team management
    if (q.includes('team') || q.includes('manage') || q.includes('staff') || q.includes('member') || q.includes('permission')) {
      return `You currently have ${teamSize} team member${teamSize !== 1 ? 's' : ''} in your organization.\n\nTeam management tips:\n\n• **Set clear roles** — Assign roles (Admin, Manager, Sales Rep) to control access to sensitive data.\n• **Track performance** — Monitor each team member's deals closed, revenue generated, and leads handled in the Reports section.\n• **Use the Team view** — Navigate to Team to see all members, invite new ones, and manage permissions.\n• **Assign contacts** — Distribute leads evenly among your sales team for fair workload.\n• **Communication** — Log team activities and notes on shared contacts so everyone stays informed.\n\nGo to Team in the sidebar to manage your team.`;
    }

    // Automation
    if (q.includes('automat') || q.includes('workflow')) {
      return `You have ${activeAutomations} active automation${activeAutomations !== 1 ? 's' : ''} out of ${state.automations.length} total.\n\nAutomation ideas to save time:\n\n• **Welcome emails** — Automatically send a welcome email when a new contact is created.\n• **Stage notifications** — Get notified when a contact moves to a critical stage like "Signed" or "Pending Payment".\n• **Follow-up reminders** — Auto-create tasks when a contact has been idle for X days.\n• **Status updates** — Send automated status update emails to customers at key milestones.\n\nGo to **Automations** in the sidebar to create and manage your workflows.`;
    }

    // Reports / analytics
    if (q.includes('report') || q.includes('analytics') || q.includes('metrics') || q.includes('stats') || q.includes('performance')) {
      return `Here's a quick snapshot of your CRM:\n\n• **Total Contacts:** ${contactCount}\n• **Pipeline Value:** ${formatCurrency(pipelineStats.totalValue)}\n• **Conversion Rate:** ${convRate.toFixed(1)}%\n• **Avg Deal Size:** ${formatCurrency(pipelineStats.avgDealSize)}\n• **Active Projects:** ${inProgressCount}\n• **Completed:** ${completedCount}\n\nFor detailed reports, go to **Reports & Analytics** in the sidebar. You can view:\n\n• Revenue trends over time\n• Lead source effectiveness\n• Team performance comparisons\n• Project budget vs. actual costs\n\nYou can also export reports as CSV for further analysis.`;
    }

    // Documents / templates
    if (q.includes('document') || q.includes('template') || q.includes('estimate') || q.includes('proposal')) {
      return `The Documents section helps you manage all your business documents:\n\n• **Create templates** — Build reusable templates for estimates, invoices, proposals, and contracts.\n• **Company branding** — Your logo and company details are automatically applied to documents.\n• **Link to contacts** — Attach documents directly to specific contacts for easy reference.\n• **PDF generation** — Generate professional PDFs to send to customers.\n• **Document history** — Keep a record of all sent documents for compliance.\n\nGo to **Documents** or **Document Templates** in the sidebar to get started.`;
    }

    // Expenses
    if (q.includes('expense') || q.includes('receipt') || q.includes('cost') || q.includes('spending')) {
      return `Track your business expenses in the **Expenses** section:\n\n• **Log expenses** — Record materials, labor, mileage, and other costs.\n• **Attach receipts** — Upload receipt photos for record keeping.\n• **Link to jobs** — Associate expenses with specific contacts/jobs for project cost tracking.\n• **Categorize** — Organize expenses by category (materials, labor, travel, equipment, etc.).\n• **Approval workflow** — Submit expenses for approval and track their status.\n• **Export** — Export expense data as CSV for accounting.\n\nGo to **Expenses** in the sidebar to manage your expenses.`;
    }

    // Dashboard
    if (q.includes('dashboard') || q.includes('overview') || q.includes('home')) {
      return `The **Dashboard** is your command center:\n\n• **KPI Cards** — See total contacts, pipeline value, conversion rate, and avg deal size at a glance with period-over-period trends.\n• **Upcoming Appointments** — View your next scheduled appointments.\n• **Pipeline Overview** — See how contacts are distributed across stages.\n• **Recent Activity** — Track the latest activity in your CRM.\n\nThe Dashboard is the first screen you see when you open TrussCTR.`;
    }

    // General help / greetings
    if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('help') || q.includes('what can you')) {
      return `I'm here to help you get the most out of TrussCTR! Here's what I can help with:\n\n• **Pipeline & Conversions** — Tips to improve your sales process\n• **Insurance Claims** — Managing restoration claims effectively\n• **Invoicing & Payments** — Getting paid faster\n• **Scheduling** — Optimizing your appointments\n• **Team Management** — Organizing your team\n• **Automations** — Saving time with workflows\n• **Reports** — Understanding your business metrics\n• **Documents** — Creating professional templates\n• **Expenses** — Tracking costs and receipts\n\nJust ask about any topic and I'll provide CRM-specific guidance!`;
    }

    // Default intelligent response
    return `That's a great question! Based on your current CRM data (${contactCount} contacts, ${formatCurrency(pipelineStats.totalValue)} pipeline value, ${convRate.toFixed(1)}% conversion rate), here are some general recommendations:\n\n• **Review your pipeline** — Check the Pipeline view for contacts that may need follow-up.\n• **Stay on top of appointments** — Consistent scheduling drives results.\n• **Use automations** — Free up time by automating repetitive tasks.\n• **Track everything** — Log communications, expenses, and documents for a complete picture.\n\nCould you tell me more specifically what you'd like help with? I can provide detailed guidance on any CRM feature.`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Small delay for natural feel
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600));

      const response = generateLocalResponse(currentInput);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          "I apologize, but something went wrong. Please try again, or feel free to explore the CRM features directly. The Dashboard and Pipeline views are great places to start!",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bot className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-sm text-gray-500">Powered by advanced AI to help you succeed</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-blue-600'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}
            >
              {message.role === 'user' ? (
                <User className="text-white" size={20} />
              ) : (
                <Bot className="text-white" size={20} />
              )}
            </div>
            <div
              className={`max-w-2xl rounded-2xl px-5 py-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p
                className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="text-white" size={20} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={18} />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length === 1 && (
        <div className="px-6 pb-4">
          <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
            <Lightbulb size={16} />
            Suggested questions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {suggestedPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedPrompt(prompt.text)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left text-sm text-gray-700"
              >
                <span className="text-blue-500">{prompt.icon}</span>
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about the CRM..."
              rows={1}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI responses are generated to assist you. Always verify important information.
        </p>
      </div>
    </div>
  );
}
