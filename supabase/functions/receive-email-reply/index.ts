// Files a customer's email reply as a note on their customer record.
//
// Emails sent from the app carry a Reply-To of reply+<quote id>@<INBOUND_REPLY_DOMAIN>.
// Resend receives mail for that domain and posts an `email.received` webhook here. The
// webhook holds only metadata, so the body is fetched from Resend's receiving API. The
// reply is saved as a note on the customer (authored by the quote's rep and tagging
// them, which raises the existing mention notification, and shows in Notes on web and
// mobile) and a copy is forwarded to the rep's own inbox, so nothing changes for them.
//
// Environment (Supabase function secrets):
//   RESEND_WEBHOOK_SECRET  signing secret of the Resend webhook (whsec_...)
//   RESEND_API_KEY         fetches the received body, sends the rep's copy
//   INBOUND_REPLY_DOMAIN   the receiving domain, e.g. reply.614restore.com
//   ALERT_FROM_EMAIL       sender for the rep's forwarded copy
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const emailOf = (v?: string | null) => (v?.match(/<([^>]+)>/)?.[1] ?? v ?? '').trim().toLowerCase();
const nameOf = (v?: string | null) => (v?.includes('<') ? v.slice(0, v.indexOf('<')).replace(/["']/g, '').trim() : '');

// Svix signature, as Resend signs webhooks: HMAC-SHA256 over "<id>.<timestamp>.<raw body>"
// keyed with the base64 part of the whsec_ secret; the header lists "v1,<signature>" values.
async function verifySignature(secret: string, id: string, timestamp: string, signatureHeader: string, raw: string) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return signatureHeader.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig || sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Keeps what the customer wrote and drops the quoted thread mail clients append below it. */
function newContentOnly(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const twoLines = `${line} ${lines[i + 1] ?? ''}`;
    if (/^On .+ wrote:\s*$/i.test(line.trim()) || /^On .+/i.test(line.trim()) && /wrote:\s*$/i.test(twoLines.trim())) break;
    if (/^-{2,}\s*(original message|forwarded message)/i.test(line.trim())) break;
    if (/^_{5,}$/.test(line.trim())) break;
    if (/^from:\s.+/i.test(line.trim()) && kept.some((l) => l.trim())) break;
    if (line.trim().startsWith('>')) { if (kept.some((l) => l.trim())) break; else continue; }
    kept.push(line);
  }
  const out = kept.join('\n').trim();
  return (out || text.trim()).slice(0, 4000);
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const domain = (Deno.env.get('INBOUND_REPLY_DOMAIN') || '').trim().toLowerCase();
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!secret || !domain || !resendKey) return json({ error: 'Reply receiving is not configured' }, 500);

  const raw = await req.text();
  const ok = await verifySignature(
    secret,
    req.headers.get('svix-id') || '',
    req.headers.get('svix-timestamp') || '',
    req.headers.get('svix-signature') || '',
    raw,
  ).catch(() => false);
  if (!ok) return json({ error: 'Invalid signature' }, 401);

  const event = JSON.parse(raw);
  if (event.type !== 'email.received') return json({ ok: true, ignored: 'not an email.received event' });
  const data = event.data ?? {};

  // Which quote is this a reply to? reply+<quote id>@<domain>
  const addressPattern = new RegExp(`^reply\\+(${UUID})@${domain.replace(/\./g, '\\.')}$`, 'i');
  const recipients: string[] = [...(data.to ?? []), ...(data.received_for ?? [])];
  const quoteId = recipients.map((a) => emailOf(a).match(addressPattern)?.[1]).find(Boolean);
  if (!quoteId) return json({ ok: true, ignored: 'not addressed to a reply address' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server not configured' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: quote } = await admin
    .from('quotes')
    .select('id, company_id, customer_id, contact_id, quote_number, created_by')
    .eq('id', quoteId)
    .maybeSingle();
  // The reply belongs to the customer this one quote was sent to, and to nobody else.
  const customerId = quote?.customer_id ?? quote?.contact_id;
  if (!quote || !customerId) return json({ ok: true, ignored: 'quote or customer not found' });

  const { data: customer } = await admin.from('customers').select('*')
    .eq('id', customerId).eq('company_id', quote.company_id).maybeSingle();
  if (!customer) return json({ ok: true, ignored: 'customer not found' });

  // Only the customer's own addresses are filed, so a stray or forged message that
  // happens to name a quote id cannot write into their record.
  const sender = emailOf(data.from);
  const known = [customer.email, customer.second_email].map((e) => emailOf(e as string | null)).filter(Boolean);
  if (!sender || !known.includes(sender)) return json({ ok: true, ignored: 'sender is not the customer on file' });

  // The note is authored by the quote's rep, else the company owner.
  let author: { id: string; email: string | null; full_name: string | null } | null = null;
  if (quote.created_by) {
    const { data: rep } = await admin.from('team_members').select('id, email, full_name')
      .eq('id', quote.created_by).eq('company_id', quote.company_id).maybeSingle();
    author = rep ?? null;
  }
  if (!author) {
    const { data: owner } = await admin.from('team_members').select('id, email, full_name')
      .eq('company_id', quote.company_id).eq('is_active', true).in('role', ['owner', 'admin']).limit(1).maybeSingle();
    author = owner ?? null;
  }
  if (!author) return json({ ok: true, ignored: 'no team member to attribute the note to' });

  // Retries deliver the same message again; the message id in the note is the marker.
  const ref = String(data.email_id ?? event.data?.message_id ?? '');
  if (ref) {
    const { data: existing } = await admin.from('notes').select('id')
      .eq('entity_type', 'customer').eq('entity_id', customer.id).ilike('body', `%ref ${ref}%`).limit(1);
    if (existing?.length) return json({ ok: true, duplicate: true });
  }

  // The webhook carries no body: fetch it.
  let text = '';
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(String(data.email_id))}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (res.ok) {
      const full = await res.json();
      text = (full.text && String(full.text).trim()) || (full.html ? htmlToText(String(full.html)) : '');
    } else if (res.status >= 500 || res.status === 429) {
      return json({ error: 'Could not fetch the message yet' }, 502); // let Resend retry
    }
  } catch {
    return json({ error: 'Could not fetch the message' }, 502);
  }
  const reply = text ? newContentOnly(text) : '(The message body could not be read. Open your inbox for the full reply.)';

  const who = nameOf(data.from) || `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || sender;
  const subject = String(data.subject ?? '').trim();
  const body =
    `📧 Email reply from ${who} <${sender}>\n` +
    `${subject ? `Re: ${subject}\n` : ''}Quote ${quote.quote_number}\n\n${reply}` +
    `${ref ? `\n\n(ref ${ref})` : ''}`;

  // Tagging the rep raises the app's existing note-mention notification for them.
  const { error: noteError } = await admin.from('notes').insert({
    company_id: quote.company_id,
    entity_type: 'customer',
    entity_id: customer.id,
    author_id: author.id,
    body,
    tags: [author.id],
  });
  if (noteError) {
    console.error('receive-email-reply: could not save note', noteError.message);
    return json({ error: 'Could not save the note' }, 500);
  }

  // A copy to the rep's own inbox, from which they can reply straight to the customer.
  const fromAddress = Deno.env.get('ALERT_FROM_EMAIL');
  if (author.email && fromAddress) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddress,
          to: [author.email],
          reply_to: sender,
          subject: `Reply from ${who}${subject ? `: ${subject}` : ''}`,
          text: `${who} <${sender}> replied about quote ${quote.quote_number}. It is saved in their Notes.\n\n${reply}`,
        }),
      });
    } catch (err) {
      console.warn('receive-email-reply: copy to the rep failed', err);
    }
  }

  return json({ ok: true });
});
