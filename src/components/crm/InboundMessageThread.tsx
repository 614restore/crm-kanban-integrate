/**
 * InboundMessageThread — Two-Way SMS & Email Communication Hub
 *
 * This component renders a unified inbox showing BOTH outbound AND inbound
 * messages in a threaded conversation view (iMessage-style).
 *
 * Inbound messages are ingested via:
 * - Twilio SMS webhook → Supabase Edge Function → `communications` table
 * - Gmail/Outlook webhook → (future) → `communications` table
 *
 * The component subscribes to Supabase Realtime so new inbound messages
 * appear instantly without polling.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { Contact, getContactFullName } from '@/lib/crmData';
import { toast } from 'sonner';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  Paperclip,
  Mic,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'sms' | 'email' | 'call' | 'note';

interface Message {
  id: string;
  contact_id: string;
  direction: 'outbound' | 'inbound';
  channel: Channel;
  body: string;
  from_address?: string;   // phone or email of sender
  to_address?: string;
  status: 'sent' | 'delivered' | 'failed' | 'received' | 'read';
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  attachments?: { url: string; name: string; type: string }[];
  // For email threads
  subject?: string;
  thread_id?: string;
}

interface InboundMessageThreadProps {
  contact: Contact;
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function MessageStatus({ status, direction }: { status: Message['status']; direction: Message['direction'] }) {
  if (direction === 'inbound') return null;
  return (
    <span className="text-[10px] flex items-center gap-0.5 mt-0.5">
      {status === 'sent' && <Check className="w-3 h-3 opacity-60" />}
      {status === 'delivered' && <CheckCheck className="w-3 h-3 opacity-60" />}
      {status === 'read' && <CheckCheck className="w-3 h-3 text-blue-400" />}
      {status === 'failed' && <AlertCircle className="w-3 h-3 text-red-400" />}
    </span>
  );
}

// ─── Channel badge ────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: Channel }) {
  const map = {
    sms: { label: 'SMS', color: 'bg-green-100 text-green-700' },
    email: { label: 'Email', color: 'bg-blue-100 text-blue-700' },
    call: { label: 'Call', color: 'bg-purple-100 text-purple-700' },
    note: { label: 'Note', color: 'bg-gray-100 text-gray-600' },
  };
  const { label, color } = map[channel] || map.note;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InboundMessageThread({ contact }: InboundMessageThreadProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealtime, setIsRealtime] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel>('sms');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const msgs = (data || []) as Message[];
      setMessages(msgs);
      setUnreadCount(msgs.filter((m) => m.direction === 'inbound' && m.status === 'received').length);
    } catch {
      // Table may not exist — use demo data
      setMessages(getDemoMessages(contact));
    } finally {
      setLoading(false);
    }
  }, [contact.id, profile?.company_id]);

  // Subscribe to realtime new messages
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`comms:${contact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communications',
          filter: `contact_id=eq.${contact.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (newMsg.direction === 'inbound') {
            setUnreadCount((n) => n + 1);
            toast.info(`New message from ${getContactFullName(contact)}`);
          }
          scrollToBottom();
        }
      )
      .subscribe((status) => {
        setIsRealtime(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [contact.id, fetchMessages]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Mark inbound messages as read when viewing
  useEffect(() => {
    if (unreadCount === 0) return;
    supabase
      .from('communications')
      .update({ status: 'read' })
      .eq('contact_id', contact.id)
      .eq('direction', 'inbound')
      .eq('status', 'received')
      .then(() => setUnreadCount(0));
  }, [contact.id, unreadCount]);

  const sendReply = async () => {
    if (!replyText.trim() || !profile) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');

    // Optimistic insert
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      contact_id: contact.id,
      direction: 'outbound',
      channel: activeChannel,
      body: text,
      status: 'sent',
      created_at: new Date().toISOString(),
      created_by_name: `${profile.first_name} ${profile.last_name}`.trim(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const toAddress =
        activeChannel === 'sms'
          ? (contact as any).phone1 || (contact as any).phone
          : (contact as any).email;

      if (!toAddress) {
        throw new Error(`No ${activeChannel === 'sms' ? 'phone number' : 'email'} on file`);
      }

      // Insert into DB
      const { data, error } = await supabase
        .from('communications')
        .insert({
          contact_id: contact.id,
          company_id: profile.company_id,
          direction: 'outbound',
          channel: activeChannel,
          body: text,
          to_address: toAddress,
          status: 'sent',
          created_by: profile.id,
          created_by_name: `${profile.first_name} ${profile.last_name}`.trim(),
        })
        .select()
        .single();

      // Call send function
      if (activeChannel === 'sms') {
        await supabase.functions.invoke('send-sms', {
          body: { to: toAddress, message: text, contactId: contact.id },
        });
      } else if (activeChannel === 'email') {
        await supabase.functions.invoke('send-email', {
          body: { to: toAddress, subject: `Re: ${(contact as any).fullName || getContactFullName(contact)}`, body: text, contactId: contact.id },
        });
      }

      // Replace optimistic with real
      if (data) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as Message) : m)));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const filteredMessages =
    activeChannel === 'sms' || activeChannel === 'email'
      ? messages.filter((m) => m.channel === activeChannel)
      : messages;

  const channelTabs: { key: Channel; label: string; icon: React.ReactNode }[] = [
    { key: 'sms', label: 'SMS', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: 'email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
    { key: 'call', label: 'Calls', icon: <Phone className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-[520px] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex gap-1">
          {channelTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveChannel(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeChannel === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'sms' && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime indicator */}
          <div className={`flex items-center gap-1 text-[10px] ${isRealtime ? 'text-green-600' : 'text-gray-400'}`}>
            {isRealtime ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isRealtime ? 'Live' : 'Offline'}
          </div>
          <button onClick={fetchMessages} className="text-gray-400 hover:text-gray-600 transition p-1">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inbound notice banner */}
      {activeChannel === 'sms' && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Inbound SMS requires Twilio webhook → Supabase Edge Function setup.{' '}
            <a href="#" className="underline font-medium">Setup guide</a>
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading messages...
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 text-sm">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
            <p>No {activeChannel} messages yet</p>
            <p className="text-xs mt-1">Send the first message below</p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isOut = msg.direction === 'outbound';
            const showDate =
              idx === 0 ||
              new Date(msg.created_at).toDateString() !==
                new Date(filteredMessages[idx - 1].created_at).toDateString();

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="text-center text-[10px] text-gray-400 py-1">
                    {new Date(msg.created_at).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                )}

                <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] ${isOut ? 'items-end' : 'items-start'} flex flex-col`}
                  >
                    {/* Sender name for inbound */}
                    {!isOut && (
                      <p className="text-[10px] text-gray-400 mb-1 ml-1">
                        {getContactFullName(contact)}
                      </p>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isOut
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-white text-gray-900 border border-gray-100 shadow-sm rounded-tl-sm'
                      }`}
                    >
                      {msg.subject && (
                        <p className="text-[11px] font-semibold mb-1 opacity-80">{msg.subject}</p>
                      )}
                      {msg.body}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.attachments.map((att, i) => (
                            <a
                              key={i}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-1 text-[11px] underline ${
                                isOut ? 'text-blue-200' : 'text-blue-600'
                              }`}
                            >
                              <Paperclip className="w-3 h-3" />
                              {att.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 mt-0.5 ${isOut ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isOut && <MessageStatus status={msg.status} direction={msg.direction} />}
                      {msg.channel !== activeChannel && <ChannelBadge channel={msg.channel} />}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="bg-white border-t border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendReply();
                }
              }}
              placeholder={`Reply via ${activeChannel}...`}
              rows={1}
              className="w-full bg-transparent text-sm resize-none focus:outline-none text-gray-900 placeholder-gray-400 max-h-24 overflow-y-auto"
              style={{ minHeight: '20px' }}
            />
          </div>
          <button
            onClick={sendReply}
            disabled={!replyText.trim() || sending}
            className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm disabled:opacity-40 transition active:scale-95"
          >
            {sending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Demo data (renders when comms table doesn't exist yet) ───────────────────

function getDemoMessages(contact: Contact): Message[] {
  const name = getContactFullName(contact);
  const now = Date.now();
  return [
    {
      id: '1',
      contact_id: contact.id,
      direction: 'outbound',
      channel: 'sms',
      body: `Hi ${contact.firstName || name}, this is TrussCTR! We're reaching out about your roof inspection scheduled for tomorrow. Does 10 AM still work?`,
      status: 'delivered',
      created_at: new Date(now - 86400000 * 2).toISOString(),
      created_by_name: 'Sales Team',
    },
    {
      id: '2',
      contact_id: contact.id,
      direction: 'inbound',
      channel: 'sms',
      body: "Yes that works! Can you also check the gutters while you're there?",
      status: 'received',
      created_at: new Date(now - 86400000 * 2 + 3600000).toISOString(),
    },
    {
      id: '3',
      contact_id: contact.id,
      direction: 'outbound',
      channel: 'sms',
      body: 'Absolutely! Our inspector will check the gutters and downspouts as well. See you tomorrow at 10.',
      status: 'read',
      created_at: new Date(now - 86400000 * 2 + 3700000).toISOString(),
      created_by_name: 'Sales Team',
    },
    {
      id: '4',
      contact_id: contact.id,
      direction: 'outbound',
      channel: 'email',
      body: `Hi ${contact.firstName || name},\n\nPlease find attached your roofing estimate for $12,450. Let me know if you have any questions or would like to schedule the work.\n\nBest,\nTrussCTR Team`,
      subject: 'Your Roofing Estimate',
      status: 'sent',
      created_at: new Date(now - 86400000).toISOString(),
      created_by_name: 'Sales Team',
    },
    {
      id: '5',
      contact_id: contact.id,
      direction: 'inbound',
      channel: 'email',
      body: 'Thank you! Can you include gutters in the estimate? Also, do you offer any financing options?',
      subject: 'Re: Your Roofing Estimate',
      status: 'received',
      created_at: new Date(now - 3600000 * 3).toISOString(),
    },
  ];
}
