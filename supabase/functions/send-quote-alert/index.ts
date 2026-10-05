// Port of QuoteMGR's send-quote-alert (executed-copy flow included), with the joined quote
// query replaced by separate lookups and the signed alert logged here as well, because this
// database's signing RPC is not guaranteed to log it.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AlertPayload = {
  share_token: string;
  event_type: 'viewed' | 'signed' | 'countersigned';
  signed_pdf_base64?: string;
  signed_pdf_filename?: string;
  payment_method?: string;
  /** When true, only email the contractor — customer copy withheld until contractor countersigns */
  notify_contractor_only?: boolean;
  /** Base64 PNG data URL of the customer's signature image */
  signer_signature_data?: string;
  signer_name?: string;
  /**
   * Force the customer's executed copy even when one has already been sent.
   * The countersigned copy is otherwise sent at most once per quote, so the
   * several countersign paths (dashboard, preview, on-site kiosk, the mobile
   * builder's on-site sign) can all fire safely without the homeowner
   * receiving duplicates. Deliberate re-sends set this.
   */
  resend?: boolean;
};

// Keeps the executed copy where people can open it: a file in the public signed-quotes bucket, the
// quote's signed_pdf_url, and the customer's Documents entry (which until now only linked to the
// customer-facing signing page, so the signed agreement could not be opened as a document).
async function storeExecutedDocument(admin: any, quote: any, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `${quote.id}/${Date.now()}_executed.pdf`;
  const { error: upErr } = await admin.storage
    .from('signed-quotes')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw upErr;
  const { data: pub } = admin.storage.from('signed-quotes').getPublicUrl(path);
  const url: string = pub.publicUrl;
  await admin.from('quotes').update({ signed_pdf_url: url }).eq('id', quote.id);

  const customerId = quote.customer_id;
  if (!customerId) return;
  const label = quote.contingency_enabled ? 'Signed Contingency Agreement' : 'Signed Agreement';
  const name = `${label} – ${quote.quote_number ?? ''}`;
  const { data: existing } = await admin
    .from('documents')
    .select('id')
    .eq('contact_id', customerId)
    .eq('type', 'signed')
    .eq('name', name)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await admin.from('documents').update({ url, size: bytes.length }).eq('id', existing.id);
  } else {
    await admin.from('documents').insert({
      company_id: quote.company_id,
      contact_id: customerId,
      customer_id: customerId,
      name,
      type: 'signed',
      url,
      size: bytes.length,
    });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const payload = (await req.json()) as AlertPayload;
    const { share_token, event_type, signed_pdf_base64, signed_pdf_filename, payment_method, notify_contractor_only, signer_signature_data, signer_name, resend } = payload;

    if (!share_token || !event_type) {
      return new Response(JSON.stringify({ error: 'Missing share_token or event_type' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: corsHeaders });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('ALERT_FROM_EMAIL') || 'alerts@example.com';

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Separate lookups instead of one joined select: this function must keep working
    // whichever optional columns and relationships this database has.
    const { data: quoteRow, error } = await admin
      .from('quotes')
      .select('*')
      .eq('share_token', share_token)
      .maybeSingle();

    if (error || !quoteRow) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404, headers: corsHeaders });
    }

    const [custRes, creatorRes, companyRes] = await Promise.all([
      quoteRow.customer_id
        ? admin.from('customers').select('*').eq('id', quoteRow.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      quoteRow.created_by
        ? admin.from('team_members').select('email, full_name').eq('id', quoteRow.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from('companies').select('*').eq('id', quoteRow.company_id).maybeSingle(),
    ]);
    const customerRow: any = custRes.data;
    let assignedMember: any = null;
    if (customerRow?.assigned_to) {
      const { data: am } = await admin
        .from('team_members').select('email, full_name').eq('id', customerRow.assigned_to).maybeSingle();
      assignedMember = am;
    }
    const quote: any = {
      ...quoteRow,
      customer: {
        first_name: customerRow?.first_name ?? quoteRow.contact_first_name ?? null,
        last_name: customerRow?.last_name ?? quoteRow.contact_last_name ?? null,
        email: customerRow?.email ?? quoteRow.contact_email ?? null,
        assigned_member: assignedMember,
      },
      creator: creatorRes.data,
      company: companyRes.data,
    };

    // Always notify: quote creator + company email
    // For 'viewed' events: also notify the assigned salesperson (they need the heads-up most)
    const assignedEmail = (quote.customer as any)?.assigned_member?.email as string | undefined;
    const toEmails = Array.from(
      new Set([
        quote.creator?.email,
        quote.company?.email,
        // Include assigned salesperson on viewed/tier_selected — they're the one following up
        (event_type === 'viewed' || event_type === 'tier_selected') ? assignedEmail : undefined,
      ].filter(Boolean) as string[])
    );

    const customerName = [quote.customer?.first_name, quote.customer?.last_name].filter(Boolean).join(' ') || 'Customer';

    // A quote countersigned automatically (see sign_quote_customer) is already
    // fully executed by the time the customer's own signature is reported here,
    // and the client that called us has no way to know that — it fires 'signed'
    // as usual. Treat it as the countersignature it is, so the homeowner
    // receives the executed copy rather than a plain "thanks for signing".
    const autoExecuted =
      event_type === 'signed' &&
      !!(quote as any).contractor_signed_at &&
      !(quote as any).countersigned_copy_sent_at;
    // The customer's own browser reports 'countersigned' the moment the customer signs, before anyone on
    // the team has. That is not an executed agreement: it used to email the homeowner a "fully executed"
    // message with no contractor signature on it, and stamp the copy as sent, so the real executed copy
    // was then skipped as a duplicate when the salesperson countersigned. Until the contractor has
    // actually signed, treat it as the customer's signature and nothing more.
    const prematureCountersign =
      event_type === 'countersigned' && !(quote as any).contractor_signed_at;
    const effectiveEvent: 'viewed' | 'signed' | 'countersigned' =
      autoExecuted ? 'countersigned' : prematureCountersign ? 'signed' : event_type;
    const subject = effectiveEvent === 'countersigned'
      ? `Fully executed: Quote ${quote.quote_number}`
      : effectiveEvent === 'signed'
      ? `✅ ${customerName} signed Quote ${quote.quote_number}`
      : `👀 ${customerName} just opened Quote ${quote.quote_number}`;

    // Recover the document ourselves when the caller did not hand one over.
    //
    // Every signing path uploads the signed PDF to the signed-quotes bucket and
    // records signed_pdf_url before sending this alert, but several called in
    // without the base64 — and the email says "your signed copy is attached"
    // regardless. Customers were told to expect a document that was not there.
    let attachmentBase64: string | undefined = signed_pdf_base64;
    let attachmentName: string | undefined = signed_pdf_filename;

    // Nothing uploads an executed PDF when the countersignature is applied
    // inside the database, so build one rather than falling back to the
    // pre-countersignature copy at signed_pdf_url.
    // The customer's browser attaches the PDF it made before the countersignature existed,
    // so for an automatic countersign the executed copy replaces it (it stays as the
    // fallback if the executed copy cannot be built).
    if (autoExecuted) {
      try {
        const execResp = await fetch(`${supabaseUrl}/functions/v1/executed-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({ quote_id: quote.id }),
          signal: AbortSignal.timeout(25000),
        });
        if (execResp.ok) {
          const execJson = await execResp.json();
          if (execJson?.pdf_base64) {
            attachmentBase64 = execJson.pdf_base64;
            attachmentName = execJson.filename || `${quote.quote_number}-fully-executed.pdf`;
          }
        } else {
          console.warn('executed-document returned', execResp.status, await execResp.text());
        }
      } catch (execErr) {
        console.warn('Could not build the executed document:', execErr);
      }
    }

    if (!attachmentBase64 && (quote as any).signed_pdf_url) {
      try {
        const stored = await fetch((quote as any).signed_pdf_url, { signal: AbortSignal.timeout(15000) });
        if (stored.ok) {
          const bytes = new Uint8Array(await stored.arrayBuffer());
          let binary = '';
          // Chunked so a multi-megabyte document does not blow the argument limit.
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          attachmentBase64 = btoa(binary);
          attachmentName = attachmentName || `${quote.quote_number}-signed.pdf`;
        }
      } catch (fetchErr) {
        console.warn('Could not fetch the stored signed PDF:', fetchErr);
      }
    }

    const fundingLabel = payment_method === 'financing'
      ? 'Financing'
      : payment_method === 'cash'
      ? 'Cash / Check'
      : null;

    // Note: the in-app notification for 'signed' is inserted by the
    // sign_quote_customer RPC as part of the same transaction that marks the
    // quote signed — this function only handles email. Inserting one here
    // too would create a duplicate row in quote_notifications for every sign.

    if (event_type === 'signed' || prematureCountersign) {
      // The signing RPC may already have logged this signature; don't log it twice.
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: already } = await admin
        .from('quote_notifications')
        .select('id')
        .eq('quote_id', quote.id)
        .eq('event_type', 'signed')
        .gte('created_at', since)
        .limit(1)
        .maybeSingle();
      if (!already) {
        await admin.from('quote_notifications').insert({
          company_id: quote.company_id,
          quote_id: quote.id,
          event_type: 'signed',
          message: `${customerName} signed quote ${quote.quote_number}.`,
          actor_name: customerName,
          actor_email: quote.customer?.email || null,
        });
      }
    }

    // countersigned: notify contractor and send completed copy to customer
    if (event_type === 'countersigned' && !prematureCountersign) {
      // Only for an explicit countersign call — sign_quote_customer already
      // logs its own notification when it applies the signature itself.
      await admin.from('quote_notifications').insert({
        company_id: quote.company_id,
        quote_id: quote.id,
        event_type: 'countersigned',
        message: `Quote ${quote.quote_number} is fully executed — completed copy sent to ${customerName}.`,
      });
    }

    // Keep the executed copy openable from the customer's Documents and the quote.
    if (effectiveEvent === 'countersigned' && attachmentBase64 && (quote as any).contractor_signed_at) {
      try {
        await storeExecutedDocument(admin, quote, attachmentBase64);
      } catch (storeErr) {
        console.warn('Could not store the executed document:', storeErr);
      }
    }

    if (!resendKey || toEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: corsHeaders });
    }

    const nowStr = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:520px">
        <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;color:#fff;font-size:18px">${quote.company?.name || 'Your Company'}</h2>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          ${event_type === 'viewed' ? `
            <p style="margin:0 0 12px;font-size:16px">👀 <strong>${customerName}</strong> just opened their quote.</p>
            <p style="margin:0 0 12px;color:#374151">Quote <strong>${quote.quote_number}</strong> was viewed at <strong>${nowStr}</strong>.</p>
            <p style="margin:0 0 16px;color:#6b7280;font-size:13px">This is a great time to follow up — they're actively looking at your proposal right now.</p>
            ${(quote.customer as any)?.assigned_member?.full_name ? `<p style="margin:0 0 12px;color:#374151;font-size:13px">Assigned to: <strong>${(quote.customer as any).assigned_member.full_name}</strong></p>` : ''}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
            <p style="margin:0;font-size:12px;color:#9ca3af">${quote.company?.name || 'Your Company'} · Quote ${quote.quote_number}</p>
          ` : effectiveEvent === 'countersigned' ? `
            <p style="margin:0 0 12px;font-size:16px">✅ <strong>Quote ${quote.quote_number} is fully executed.</strong></p>
            <p style="margin:0 0 12px;color:#374151">Both parties have signed. A completed copy has been sent to <strong>${customerName}</strong>.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
            <p style="margin:0;font-size:12px;color:#9ca3af">${quote.company?.name || 'Your Company'} · Quote ${quote.quote_number}</p>
          ` : `
            <p style="margin:0 0 12px"><strong>${customerName}</strong> has ${effectiveEvent === 'signed' ? 'signed' : 'completed'} quote <strong>${quote.quote_number}</strong>.</p>
            ${effectiveEvent === 'signed' && !(quote as any).contractor_signed_at ? `<p style="margin:0 0 12px;color:#92400e"><strong>Your countersignature is needed.</strong> Add it in the app and the fully executed copy goes to the homeowner.</p>` : ''}
            ${effectiveEvent === 'signed' && quote.signed_at ? `<p style="margin:0 0 8px;color:#374151">Signed at: ${new Date(quote.signed_at).toLocaleString()}</p>` : ''}
            ${effectiveEvent === 'signed' && quote.signed_by ? `<p style="margin:0 0 8px;color:#374151">Signed by: ${quote.signed_by}</p>` : ''}
            ${fundingLabel ? `<p style="margin:0 0 8px;color:#374151">Funding preference: ${fundingLabel}</p>` : ''}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
            <p style="margin:0;font-size:12px;color:#9ca3af">${quote.company?.name || 'Your Company'} · Quote ${quote.quote_number}</p>
          `}
        </div>
      </div>
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmails,
        subject,
        html,
        attachments: attachmentBase64
          ? [
              {
                filename: attachmentName || signed_pdf_filename || `quote-${quote.quote_number}-signed.pdf`,
                content: attachmentBase64,
              },
            ]
          : undefined,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resendResp.ok) {
      const text = await resendResp.text();
      return new Response(JSON.stringify({ error: 'Failed to send', details: text }), { status: 500, headers: corsHeaders });
    }

    // Send completed copy to customer on 'countersigned' (fully executed).
    // For plain 'signed' with notify_contractor_only=true, skip this — customer gets their copy when contractor countersigns.
    // The executed copy goes out at most once per quote unless the caller
    // explicitly asks to re-send. Every countersign path calls this function,
    // and on-site signing both auto-sends and leaves a "Send to Customer"
    // button on screen, so without this the homeowner gets two copies.
    // A "sent" stamp that predates the contractor's signature came from the old premature event, not from an
    // executed copy, so it must not block the real one.
    const sentAtMs = (quote as any).countersigned_copy_sent_at ? Date.parse((quote as any).countersigned_copy_sent_at) : NaN;
    const contractorAtMs = (quote as any).contractor_signed_at ? Date.parse((quote as any).contractor_signed_at) : NaN;
    const alreadySent = Number.isFinite(sentAtMs) && Number.isFinite(contractorAtMs) && sentAtMs >= contractorAtMs;
    const suppressDuplicate = effectiveEvent === 'countersigned' && alreadySent && !resend;
    if (suppressDuplicate) {
      console.log(`Executed copy already sent for quote ${quote.id} — skipping duplicate.`);
    }

    const shouldEmailCustomer =
      !suppressDuplicate &&
      (effectiveEvent === 'countersigned' || (effectiveEvent === 'signed' && !notify_contractor_only));
    if (shouldEmailCustomer && quote.customer?.email) {
      try {
        const companyName = quote.company?.name || 'Your Contractor';
        const companyEmail = quote.company?.email || '';
        const companyPhone = (quote.company as any)?.phone || '';
        const contactLine = [companyEmail, companyPhone].filter(Boolean).join(' / ');
        const isFullyExecuted = effectiveEvent === 'countersigned';

        const co = quote.company as any;
        const showDeposit = !isFullyExecuted &&
          co?.signing_followup_enabled &&
          (quote as any).include_signing_followup !== false;

        const depositPct: number = co?.signing_followup_deposit_pct ?? 50;
        const rawMethods: string[] = co?.signing_followup_payment_methods ?? [];
        const methodLabels: Record<string, string> = {
          check: 'Check',
          money_order: 'Money Order',
          cashiers_check: "Cashier's Check",
          credit_card: 'Credit Card',
          cash: 'Cash',
          zelle: 'Zelle',
          venmo: 'Venmo',
          other: 'Other',
        };
        const methodsList = rawMethods.map(m => methodLabels[m] || m).join(', ');

        const depositSection = showDeposit ? `
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin:20px 0">
                <h3 style="margin:0 0 10px;color:#166534;font-size:16px">Getting Started — Next Steps</h3>
                <p style="margin:0 0 10px;color:#374151">To get your project on our schedule, we require a <strong>${depositPct}% deposit</strong> prior to beginning work.</p>
                ${methodsList ? `<p style="margin:0 0 6px;color:#374151"><strong>Accepted payment methods:</strong></p><p style="margin:0;color:#374151">${methodsList}</p>` : ''}
                <p style="margin:16px 0 0;color:#374151">Please contact us at${contactLine ? ` <strong>${contactLine}</strong>` : ' the number above'} to arrange your deposit and confirm your start date.</p>
              </div>` : '';

        const customerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" bgcolor="#f4f4f4" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:20px 0">
        <table width="100%" style="max-width:600px" bgcolor="#ffffff" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;color:white;font-size:20px">${companyName}</h2>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
              <p style="margin:0 0 16px">Hello ${quote.customer.first_name || 'there'},</p>
              ${isFullyExecuted
                ? `<p style="margin:0 0 12px">Your agreement with <strong>${companyName}</strong> is now <strong>fully executed</strong> — both parties have signed.${attachmentBase64 ? ' Your completed copy is attached for your records.' : ''}</p>`
                : `<p style="margin:0 0 12px">Thank you for signing your proposal with <strong>${companyName}</strong>.${attachmentBase64 ? ' Your signed copy is attached for your records.' : ''}</p>${!(quote as any).contractor_signed_at ? '<p style="margin:0 0 12px">We will add our countersignature shortly and email you the fully executed copy.</p>' : ''}`
              }
              ${signer_signature_data ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px">
                    <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Customer Signature</p>
                    <img src="${signer_signature_data}" alt="Customer signature" style="max-width:320px;max-height:120px;display:block;border-bottom:2px solid #94a3b8;padding-bottom:8px;margin-bottom:6px">
                    <p style="margin:0;font-size:13px;color:#374151">${signer_name || quote.signed_by || 'Customer'}</p>
                    ${quote.signed_at ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280">Signed: ${new Date(quote.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                  </td>
                </tr>
              </table>` : ''}
              ${fundingLabel ? `<p style="margin:0 0 12px">Funding preference: <strong>${fundingLabel}</strong></p>` : ''}
              ${depositSection}
              <p style="margin:0 0 12px">If you have any questions, please contact us${contactLine ? ` at <strong>${contactLine}</strong>` : ''}.</p>
              <p style="margin:0 0 12px">We look forward to working with you!</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
              <p style="margin:0;font-size:12px;color:#6b7280">${companyName} | Quote ${quote.quote_number}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const customerSubject = isFullyExecuted
          ? `Fully executed agreement — ${quote.quote_number}`
          : `Your signed proposal — ${quote.quote_number}`;

        const custResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [quote.customer.email],
            subject: customerSubject,
            html: customerHtml,
            attachments: attachmentBase64
              ? [
                  {
                    filename: attachmentName || `quote-${quote.quote_number}-signed.pdf`,
                    content: attachmentBase64,
                  },
                ]
              : undefined,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (custResp.ok && isFullyExecuted) {
          await admin.from('quotes').update({
            countersigned_copy_sent_at: new Date().toISOString(),
          }).eq('id', quote.id);
        }
      } catch (customerEmailErr) {
        console.error('Customer confirmation email failed (non-fatal):', customerEmailErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    // Returning a bare "Unexpected error" hid a crash in this function for a
    // full round of testing. Log it and hand the caller the reason.
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-quote-alert failed:', message);
    return new Response(JSON.stringify({ error: 'Unexpected error', details: message }), { status: 500, headers: corsHeaders });
  }
});
