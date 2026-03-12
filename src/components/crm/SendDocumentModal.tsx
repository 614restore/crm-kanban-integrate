// SendDocumentModal.tsx
// Modal that collects recipient email, previews the document, and fires the send.

import React, { useState } from 'react';
import { Send, Loader2, X, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/lib/emailApi';
import { createDocumentSend } from '@/lib/documentSends';
import { useAuth } from '@/lib/authContext';

interface SendDocumentModalProps {
  open: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
  documentHtml: string;   // fully rendered HTML (vars already replaced + line items)
  contactId?: string;
  defaultEmail?: string;
  defaultName?: string;
  companyId: string;
}

const SendDocumentModal: React.FC<SendDocumentModalProps> = ({
  open, onClose,
  templateId, templateName, documentHtml,
  contactId, defaultEmail = '', defaultName = '',
  companyId,
}) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    if (!email.trim()) { toast({ title: 'Email required', variant: 'destructive' }); return; }

    setSending(true);
    try {
      // 1. Create the document_sends record and get the token
      const record = await createDocumentSend({
        company_id: companyId,
        contact_id: contactId,
        template_id: templateId,
        template_name: templateName,
        sent_to_email: email.trim(),
        sent_to_name: name.trim() || undefined,
        sent_by: profile?.id,
        document_html: documentHtml,
      });

      // 2. Build the signing URL
      const signUrl = `${window.location.origin}/sign/${record.token}`;

      // 3. Send the email
      await sendEmail({
        to: email.trim(),
        subject: `Please sign: ${templateName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px">
            <div style="background:#16a34a;color:#fff;padding:24px;border-radius:8px 8px 0 0;text-align:center">
              <h2 style="margin:0;font-size:22px">Document Ready to Sign</h2>
            </div>
            <div style="background:#f9fafb;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:16px;color:#374151;margin-top:0">
                Hello${name ? ` ${name}` : ''},
              </p>
              <p style="color:#374151">
                Please review and sign the following document:
              </p>
              <div style="background:#fff;border:1px solid #d1fae5;border-left:4px solid #16a34a;padding:16px;border-radius:6px;margin:20px 0">
                <strong style="color:#065f46;font-size:16px">${templateName}</strong>
              </div>
              <div style="text-align:center;margin:28px 0">
                <a href="${signUrl}"
                   style="background:#16a34a;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                  Review &amp; Sign Document
                </a>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center">
                If you did not expect this document, please ignore this email.
              </p>
            </div>
          </div>
        `,
      });

      toast({
        title: '\u2705 Document sent!',
        description: `${name || email} will receive an email with a link to sign.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-gray-800">Send for Signature</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
              <User className="w-3.5 h-3.5 inline mr-1" />Customer Name
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name (optional)"
              className="focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
              <Mail className="w-3.5 h-3.5 inline mr-1" />Customer Email <span className="text-red-500">*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <strong>What happens next:</strong>
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 text-green-700">
              <li>Customer receives an email with a secure link</li>
              <li>They review and sign the document (no account needed)</li>
              <li>You get notified when it's signed</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={sending}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? 'Sending…' : 'Send Document'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SendDocumentModal;
