// SMSDialog — modal for composing and sending a Twilio SMS to a contact.
//
// Usage:
//   <SMSDialog
//     open={showSMS}
//     onOpenChange={setShowSMS}
//     contactName="John Doe"
//     contactPhone="+15551234567"
//     contactId="uuid"
//     companyId="uuid"
//   />

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { useTwilio } from '@/hooks/useTwilio';

const SMS_LIMIT = 160;

interface SMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName?: string;
  contactPhone?: string | null;
  contactId?: string;
  companyId?: string;
}

export function SMSDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  contactId,
  companyId,
}: SMSDialogProps) {
  const { sendSMS, isSending } = useTwilio();
  const [to, setTo] = useState(contactPhone || '');
  const [message, setMessage] = useState('');

  // Sync phone when prop changes (e.g. dialog reused for different contacts)
  useEffect(() => {
    if (open) {
      setTo(contactPhone || '');
      setMessage('');
    }
  }, [open, contactPhone]);

  const charCount = message.length;
  const overLimit = charCount > SMS_LIMIT;
  const segments = charCount > 0 ? Math.ceil(charCount / SMS_LIMIT) : 1;

  const handleSend = async () => {
    if (!to.trim() || !message.trim()) return;
    try {
      await sendSMS({
        to: to.trim(),
        message: message.trim(),
        contactId,
        companyId,
      });
      onOpenChange(false);
    } catch {
      // Error toast is handled inside useTwilio
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Send SMS
            {contactName && (
              <span className="text-sm font-normal text-gray-500">
                to {contactName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sms-to">Phone number</Label>
            <Input
              id="sms-to"
              type="tel"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+15551234567"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sms-message">Message</Label>
            <Textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message…"
              rows={4}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="hidden sm:block">
                Press Cmd+Enter to send
              </span>
              <span className={overLimit ? 'text-red-500 font-semibold' : ''}>
                {charCount}/{SMS_LIMIT}
                {segments > 1 && (
                  <span className="ml-2 text-amber-600">
                    ({segments} segments)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !to.trim() || !message.trim()}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SMSDialog;
