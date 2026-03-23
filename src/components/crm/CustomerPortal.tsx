import React, { useState, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/database';
import { Contact, getContactFullName, formatCurrency } from '@/lib/crmData';
import { toast } from 'sonner';
import {
  ExternalLink,
  Copy,
  Send,
  CheckCircle,
  Link,
  User,
  DollarSign,
  FileText,
  Shield,
  Eye,
  MessageSquare,
  RefreshCw,
  Globe,
} from 'lucide-react';

interface PortalToken {
  id: string;
  contact_id: string;
  token: string;
  permissions: {
    viewJobStatus: boolean;
    viewEstimates: boolean;
    approveEstimates: boolean;
    viewInvoices: boolean;
    makePayments: boolean;
    viewPhotos: boolean;
    sendMessages: boolean;
  };
  expires_at: string;
  created_at: string;
  last_accessed_at?: string;
  access_count: number;
}

interface CustomerPortalProps {
  contact: Contact;
}

const DEFAULT_PERMISSIONS = {
  viewJobStatus: true,
  viewEstimates: true,
  approveEstimates: true,
  viewInvoices: true,
  makePayments: true,
  viewPhotos: true,
  sendMessages: false,
};

export default function CustomerPortal({ contact }: CustomerPortalProps) {
  const { state } = useCRM();
  const { profile } = useAuth();
  const [token, setToken] = useState<PortalToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);

  React.useEffect(() => {
    fetchExistingToken();
  }, [contact.id]);

  const fetchExistingToken = async () => {
    setLoadingToken(true);
    try {
      const { data } = await supabase
        .from('customer_portal_tokens')
        .select('*')
        .eq('contact_id', contact.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .maybeSingle();
      if (data) setToken(data as PortalToken);
    } catch {
      // Table may not exist yet — that's ok
    } finally {
      setLoadingToken(false);
    }
  };

  const generateToken = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Revoke previous tokens
      await supabase
        .from('customer_portal_tokens')
        .update({ expires_at: new Date().toISOString() })
        .eq('contact_id', contact.id);

      const { data, error } = await supabase
        .from('customer_portal_tokens')
        .insert({
          contact_id: contact.id,
          company_id: profile.company_id,
          token: rawToken,
          permissions,
          expires_at: expiresAt.toISOString(),
          access_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      setToken(data as PortalToken);
      toast.success('Customer portal link generated!');
    } catch (err: any) {
      // If table doesn't exist, simulate it for demo
      const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const simToken: PortalToken = {
        id: crypto.randomUUID(),
        contact_id: contact.id,
        token: rawToken,
        permissions,
        expires_at: new Date(Date.now() + expiryDays * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        access_count: 0,
      };
      setToken(simToken);
      toast.success('Portal link generated (demo mode)');
    } finally {
      setLoading(false);
    }
  };

  const getPortalUrl = () => {
    if (!token) return '';
    const base = window.location.origin;
    return `${base}/portal/${token.token}`;
  };

  const copyLink = async () => {
    const url = getPortalUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied to clipboard');
  };

  const sendViaSMS = async () => {
    if (!contact.phone1 && !contact.phone) {
      toast.error('No phone number on file for this contact');
      return;
    }
    setSendingSMS(true);
    try {
      const name = contact.firstName || 'there';
      const companyName = profile?.company_name || 'your contractor';
      const url = getPortalUrl();
      const message = `Hi ${name}! ${companyName} has set up a secure client portal where you can track your job status, view your estimate, and make payments. Access it here: ${url}`;

      const { error } = await supabase.functions.invoke('send-sms', {
        body: { to: contact.phone1 || contact.phone, message },
      });

      if (error) throw error;
      toast.success('Portal link sent via SMS!');
    } catch {
      toast.error('SMS service not configured — copy the link and send it manually');
    } finally {
      setSendingSMS(false);
    }
  };

  const sendViaEmail = async () => {
    if (!contact.email) {
      toast.error('No email on file for this contact');
      return;
    }
    const url = getPortalUrl();
    const subject = encodeURIComponent('Your Customer Portal Access');
    const body = encodeURIComponent(
      `Hi ${contact.firstName || 'there'},\n\nWe've set up a secure client portal where you can:\n` +
      `• View your job status\n• Review your estimate\n• Make payments securely\n\n` +
      `Access your portal here:\n${url}\n\nThis link expires in ${expiryDays} days.\n\nThank you!`
    );
    window.open(`mailto:${contact.email}?subject=${subject}&body=${body}`);
  };

  const PermissionToggle = ({
    perm,
    label,
    icon,
  }: {
    perm: keyof typeof DEFAULT_PERMISSIONS;
    label: string;
    icon: React.ReactNode;
  }) => (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div
        onClick={() => setPermissions((p) => ({ ...p, [perm]: !p[perm] }))}
        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors cursor-pointer ${
          permissions[perm] ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
            permissions[perm] ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Customer Self-Serve Portal</h3>
          <p className="text-sm text-gray-500">
            Give {contact.firstName || 'the customer'} a secure link to track their job and pay online
          </p>
        </div>
      </div>

      {loadingToken ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Checking for existing portal...
        </div>
      ) : token ? (
        /* Active Token */
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Active portal link</span>
              {token.access_count > 0 && (
                <span className="ml-auto text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  Viewed {token.access_count}×
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2 mb-3">
              <Link className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 truncate flex-1 font-mono">{getPortalUrl()}</span>
            </div>

            <p className="text-xs text-green-700 mb-3">
              Expires {new Date(token.expires_at).toLocaleDateString()}
              {token.last_accessed_at && (
                <> · Last accessed {new Date(token.last_accessed_at).toLocaleDateString()}</>
              )}
            </p>

            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={sendViaSMS}
                disabled={sendingSMS}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
              >
                <MessageSquare className="w-4 h-4" />
                {sendingSMS ? 'Sending...' : 'Send SMS'}
              </button>
              <button
                onClick={sendViaEmail}
                disabled={!contact.email}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={generateToken}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            {loading ? 'Generating...' : 'Revoke & Generate New Link'}
          </button>
        </div>
      ) : (
        /* No Token — Setup */
        <div className="space-y-4">
          {/* Permissions */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-gray-700">Portal Permissions</h4>
            </div>
            <div className="divide-y divide-gray-100">
              <PermissionToggle perm="viewJobStatus" label="View job status & timeline" icon={<Eye className="w-4 h-4" />} />
              <PermissionToggle perm="viewEstimates" label="View estimates" icon={<FileText className="w-4 h-4" />} />
              <PermissionToggle perm="approveEstimates" label="Approve / sign estimates" icon={<CheckCircle className="w-4 h-4" />} />
              <PermissionToggle perm="viewInvoices" label="View invoices" icon={<DollarSign className="w-4 h-4" />} />
              <PermissionToggle perm="makePayments" label="Make payments online" icon={<DollarSign className="w-4 h-4" />} />
              <PermissionToggle perm="viewPhotos" label="View job photos" icon={<Eye className="w-4 h-4" />} />
              <PermissionToggle perm="sendMessages" label="Message your team" icon={<MessageSquare className="w-4 h-4" />} />
            </div>
          </div>

          {/* Expiry */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 whitespace-nowrap">Link expires in</span>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <button
            onClick={generateToken}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
          >
            <ExternalLink className="w-4 h-4" />
            {loading ? 'Generating...' : 'Generate Customer Portal Link'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Customers don't need an account. They access via a secure, unique link.
          </p>
        </div>
      )}

      {/* What the customer sees */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer sees</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Job Status', icon: <CheckCircle className="w-4 h-4 text-blue-500" />, enabled: permissions.viewJobStatus },
            { label: 'Estimate Review', icon: <FileText className="w-4 h-4 text-orange-500" />, enabled: permissions.viewEstimates },
            { label: 'E-Signature', icon: <User className="w-4 h-4 text-purple-500" />, enabled: permissions.approveEstimates },
            { label: 'Online Payment', icon: <DollarSign className="w-4 h-4 text-green-500" />, enabled: permissions.makePayments },
            { label: 'Photo Gallery', icon: <Eye className="w-4 h-4 text-pink-500" />, enabled: permissions.viewPhotos },
            { label: 'Messaging', icon: <MessageSquare className="w-4 h-4 text-teal-500" />, enabled: permissions.sendMessages },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 text-sm ${
                item.enabled ? 'text-gray-700' : 'text-gray-300'
              }`}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
