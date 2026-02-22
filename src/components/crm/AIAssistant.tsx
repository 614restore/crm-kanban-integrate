import React, { useState, useRef, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { supabase } from '@/lib/supabase';
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm your StormCraft CRM AI Assistant. I can help you with:\n\n• Navigating the CRM and its features\n• Sales pipeline optimization\n• Insurance claim management\n• Payment and invoicing best practices\n• Team management tips\n• Workflow automation suggestions\n\nHow can I assist you today?",
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context from current state
      const context = {
        totalContacts: state.contacts.length,
        pipelineStages: state.boards[0]?.columns.map((c) => c.title) || [],
        teamSize: state.teamMembers.length,
        activeAutomations: state.automations.filter((a) => a.isActive).length,
        currentView: state.currentView,
      };

      const { data, error } = await supabase.functions.invoke('crm-ai-assistant', {
        body: { message: input, context },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or feel free to explore the CRM features directly. The Dashboard and Pipeline views are great places to start!",
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
