import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';


// The verified platform sender every TrussCTR email goes out from (same one the quote emails use).
const platformFromEmail = (() => {
  const v = (Deno.env.get('ALERT_FROM_EMAIL') || '').trim();
  return v.match(/<([^>]+)>/)?.[1] || v || 'scopemgr@614restore.com';
})();
const APP_URL = (Deno.env.get('APP_URL') || 'https://trussctr.614restore.com').replace(/\/$/, '');

// ─── Color helpers ────────────────────────────────────────────────────────
const NAVY  = rgb(0x1e / 255, 0x3a / 255, 0x5f / 255); // #1e3a5f
const ORANGE = rgb(0xff / 255, 0x6b / 255, 0x35 / 255); // #ff6b35
const WHITE  = rgb(1, 1, 1);
const DARK   = rgb(0.15, 0.15, 0.15);
const GRAY   = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);

// ─── Plan helpers ──────────────────────────────────────────────────────
type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | string;

function getPlanLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'trialing': return 'Trial';
    case 'active':   return 'Professional';
    case 'canceled': return 'Canceled';
    default:         return 'Starter';
  }
}

function getPlanBullets(status: SubscriptionStatus): string[] {
  switch (status) {
    case 'trialing':
      return [
        'Up to 5 quotes',
        'Basic templates',
        'PDF proposals',
        'Email support',
      ];
    case 'active':
      return [
        'Everything in Starter',
        'AI assistant',
        'Advanced integrations',
        'Up to 10 team members',
        'Priority support',
      ];
    case 'canceled':
      return ['Account inactive — reactivate to restore access'];
    default:
      return [
        'Unlimited quotes',
        'Custom templates',
        'Price lists',
        'PDF proposals',
        'Email support',
      ];
  }
}

// ─── PDF generation ───────────────────────────────────────────────────
// pdf-lib's StandardFonts are WinAnsi only, and it *throws* on anything it
// cannot encode rather than substituting — one emoji in one line aborted the
// whole PDF, so the welcome email went out with no guide attached and only a
// log line to show for it. Fold the few symbols this document uses down to
// characters WinAnsi can represent, and drop anything left over.
const WINANSI_SAFE_ABOVE_LATIN1 = new Set([
  '—', '–', '•', '…', '™', '†', '‡',
  '‘', '’', '“', '”', '€',
]);

const PDF_SYMBOL_FALLBACKS: Record<string, string> = {
  '⚡': '*',      // high voltage
  '✓': '•', // check mark -> bullet
  '✔': '•',
  '−': '-',
  '≈': '~',
  '→': '->',
  ' ': ' ',
};

const winAnsi = (value: string): string => {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff || WINANSI_SAFE_ABOVE_LATIN1.has(ch)) { out += ch; continue; }
    out += PDF_SYMBOL_FALLBACKS[ch] ?? '';
  }
  return out;
};

async function generateWelcomePdf(
  companyName: string,
  subscriptionStatus: SubscriptionStatus,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter

  const boldFont   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612;
  const H = 792;

  // ── Navy header bar ──────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 160, width: W, height: 160, color: NAVY });

  // TrussCTR title
  page.drawText(winAnsi('TrussCTR'), {
    x: 36, y: H - 52,
    size: 32, font: boldFont, color: WHITE,
  });

  // Tagline
  page.drawText(winAnsi('Professional Quoting & Estimating'), {
    x: 36, y: H - 76,
    size: 11, font: regularFont, color: rgb(0.75, 0.82, 0.93),
  });

  // Welcome message
  page.drawText(winAnsi('Welcome!'), {
    x: 36, y: H - 108,
    size: 20, font: boldFont, color: WHITE,
  });

  // Company name in header
  const companyLabel = `Your account for ${companyName} is ready.`;
  page.drawText(winAnsi(companyLabel), {
    x: 36, y: H - 130,
    size: 11, font: regularFont, color: rgb(0.85, 0.90, 0.97),
    maxWidth: W - 72,
  });

  // ── Orange accent stripe ─────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 168, width: W, height: 8, color: ORANGE });

  // ── Plan badge ─────────────────────────────────────────────────────
  const planLabel = getPlanLabel(subscriptionStatus);
  const badgeX = W - 36 - 110;
  const badgeY = H - 155;

  page.drawRectangle({
    x: badgeX, y: badgeY,
    width: 110, height: 28,
    color: ORANGE,
    borderRadius: 4,
  });
  const badgeText = `Plan: ${planLabel}`;
  const badgeTextWidth = boldFont.widthOfTextAtSize(badgeText, 11);
  page.drawText(winAnsi(badgeText), {
    x: badgeX + (110 - badgeTextWidth) / 2,
    y: badgeY + 8,
    size: 11, font: boldFont, color: WHITE,
  });

  // ── What's Included section ──────────────────────────────────────────
  let cursorY = H - 200;

  page.drawText(winAnsi("What's Included"), {
    x: 36, y: cursorY,
    size: 16, font: boldFont, color: NAVY,
  });
  cursorY -= 8;

  // Underline accent
  page.drawLine({
    start: { x: 36, y: cursorY },
    end:   { x: 36 + 130, y: cursorY },
    thickness: 2, color: ORANGE,
  });
  cursorY -= 10;

  const bullets = getPlanBullets(subscriptionStatus);
  for (const bullet of bullets) {
    // Bullet circle
    page.drawCircle({ x: 46, y: cursorY + 4, size: 3, color: ORANGE });
    page.drawText(winAnsi(bullet), {
      x: 58, y: cursorY,
      size: 11, font: regularFont, color: DARK,
    });
    cursorY -= 20;
  }

  // Trial-specific note
  if (subscriptionStatus === 'trialing') {
    cursorY -= 4;
    page.drawRectangle({
      x: 36, y: cursorY - 22,
      width: W - 72, height: 22,
      color: rgb(1.0, 0.95, 0.90),
      borderRadius: 3,
    });
    page.drawText(winAnsi('⚡ Your free trial is active — upgrade anytime to unlock all features and remove limits.'), {
      x: 46, y: cursorY - 15,
      size: 9, font: regularFont, color: rgb(0.7, 0.35, 0.1),
      maxWidth: W - 92,
    });
    cursorY -= 30;
  }

  cursorY -= 14;

  // ── Getting Started section ──────────────────────────────────────────
  page.drawText(winAnsi('Getting Started'), {
    x: 36, y: cursorY,
    size: 16, font: boldFont, color: NAVY,
  });
  cursorY -= 8;

  page.drawLine({
    start: { x: 36, y: cursorY },
    end:   { x: 36 + 120, y: cursorY },
    thickness: 2, color: ORANGE,
  });
  cursorY -= 26;

  const steps = [
    ['Open the app', 'Use TrussCTR in any web browser at trussctr.614restore.com. Ask your administrator for the iPhone app.'],
    ['Sign in to your account', 'Use the same email address you registered with. Your account is already set up.'],
    ['Create your first quote', 'Tap the + button to start a new quote. Add line items, photos, and notes.'],
    ['Invite your team', 'Go to Settings > Team to add estimators and crew members.'],
  ];

  for (let i = 0; i < steps.length; i++) {
    const [stepTitle, stepDesc] = steps[i];
    const circleX = 50;
    const circleY = cursorY + 5;

    // Step number circle
    page.drawCircle({ x: circleX, y: circleY, size: 11, color: NAVY });
    const numText = `${i + 1}`;
    const numWidth = boldFont.widthOfTextAtSize(numText, 9);
    page.drawText(numText, {
      x: circleX - numWidth / 2,
      y: circleY - 3.5,
      size: 9, font: boldFont, color: WHITE,
    });

    // Step title
    page.drawText(stepTitle, {
      x: 68, y: cursorY + 3,
      size: 12, font: boldFont, color: DARK,
    });
    cursorY -= 18;

    // Step description
    page.drawText(stepDesc, {
      x: 68, y: cursorY,
      size: 10, font: regularFont, color: GRAY,
      maxWidth: W - 68 - 36,
    });
    cursorY -= 28;
  }

  cursorY -= 8;

  // ── Contact box ────────────────────────────────────────────────────
  const boxHeight = 82;
  page.drawRectangle({
    x: 36, y: cursorY - boxHeight,
    width: W - 72, height: boxHeight,
    color: LIGHT_GRAY,
    borderRadius: 4,
  });

  page.drawText(winAnsi('Need Help?'), {
    x: 52, y: cursorY - 18,
    size: 12, font: boldFont, color: NAVY,
  });
  page.drawText(winAnsi('Support:   614restorellc@gmail.com'), {
    x: 52, y: cursorY - 36,
    size: 10, font: regularFont, color: DARK,
  });
  page.drawText(winAnsi('Billing:     614restorellc@gmail.com'), {
    x: 52, y: cursorY - 50,
    size: 10, font: regularFont, color: DARK,
  });
  page.drawText(winAnsi('Website:  trussctr.614restore.com'), {
    x: 52, y: cursorY - 64,
    size: 10, font: regularFont, color: DARK,
  });

  // ── Footer ───────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: 36, color: NAVY });
  const footerText = 'TrussCTR is a product of 614 Restore';
  const footerWidth = regularFont.widthOfTextAtSize(footerText, 9);
  page.drawText(footerText, {
    x: (W - footerWidth) / 2, y: 13,
    size: 9, font: regularFont, color: rgb(0.7, 0.78, 0.9),
  });

  return pdfDoc.save();
}

// ─── HTML email builder ───────────────────────────────────────────────
function buildWelcomeEmail(
  companyName: string,
  ownerEmail: string,
  subscriptionStatus: SubscriptionStatus,
): { subject: string; html: string } {
  const planLabel = getPlanLabel(subscriptionStatus);
  const bullets = getPlanBullets(subscriptionStatus);
  const bulletItems = bullets.map(b => `<li style="margin:6px 0;">${b}</li>`).join('');

  const subject = `Welcome to TrussCTR, ${companyName}!`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:36px 40px 28px;">
              <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">TrussCTR</p>
              <p style="margin:0 0 20px;font-size:11px;color:#b0c4de;">Professional Quoting &amp; Estimating</p>
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">Welcome, ${companyName}!</p>
              <p style="margin:0;font-size:13px;color:#d0dff0;">Your account is set up and ready to go.</p>
            </td>
          </tr>

          <!-- Orange stripe -->
          <tr><td style="height:6px;background:#ff6b35;"></td></tr>

          <!-- Plan badge -->
          <tr>
            <td style="padding:24px 40px 0;">
              <span style="display:inline-block;background:#ff6b35;color:#fff;font-weight:700;font-size:12px;padding:6px 16px;border-radius:20px;">
                Current Plan: ${planLabel}
              </span>
            </td>
          </tr>

          <!-- What's included -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1e3a5f;">What's Included</p>
              <ul style="margin:0;padding-left:20px;color:#333333;font-size:14px;line-height:1.6;">
                ${bulletItems}
              </ul>
            </td>
          </tr>

          <!-- Getting Started -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1e3a5f;">Getting Started</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:top;width:32px;">
                    <div style="width:26px;height:26px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:26px;color:#fff;font-weight:700;font-size:12px;">1</div>
                  </td>
                  <td style="padding-left:12px;padding-bottom:16px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#222;">Download the app</p>
                    <p style="margin:0;font-size:13px;color:#555;">Open TrussCTR in any web browser, or ask your administrator for the iPhone app.</p>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;width:32px;">
                    <div style="width:26px;height:26px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:26px;color:#fff;font-weight:700;font-size:12px;">2</div>
                  </td>
                  <td style="padding-left:12px;padding-bottom:16px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#222;">Create your first quote</p>
                    <p style="margin:0;font-size:13px;color:#555;">Tap the + button to start a new quote. Add line items, photos, and notes.</p>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;width:32px;">
                    <div style="width:26px;height:26px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:26px;color:#fff;font-weight:700;font-size:12px;">3</div>
                  </td>
                  <td style="padding-left:12px;padding-bottom:16px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#222;">Customize your templates</p>
                    <p style="margin:0;font-size:13px;color:#555;">Go to Settings &gt; Templates to build reusable quote structures.</p>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;width:32px;">
                    <div style="width:26px;height:26px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:26px;color:#fff;font-weight:700;font-size:12px;">4</div>
                  </td>
                  <td style="padding-left:12px;padding-bottom:16px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#222;">Invite your team</p>
                    <p style="margin:0;font-size:13px;color:#555;">Go to Settings &gt; Team to add estimators and crew members.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:28px 40px 0;text-align:center;">
              <a href="https://trussctr.614restore.com"
                 style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 40px;border-radius:6px;">
                Open TrussCTR
              </a>
            </td>
          </tr>

          <!-- Support box -->
          <tr>
            <td style="padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0f4f8;border-radius:6px;padding:20px 24px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e3a5f;">Need Help?</p>
                    <p style="margin:0 0 4px;font-size:13px;color:#333;">
                      Support: <a href="mailto:614restorellc@gmail.com" style="color:#ff6b35;">614restorellc@gmail.com</a>
                    </p>
                    <p style="margin:0;font-size:13px;color:#333;">
                      Website: <a href="https://trussctr.614restore.com" style="color:#ff6b35;">trussctr.614restore.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1e3a5f;padding:16px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#8ba8cc;">TrussCTR is a product of 614 Restore</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ─── Main handler ─────────────────────────────────────────────────────
serve(async (req) => {
  try {
    const payload = await req.json();

    // Two shapes reach this function.
    //
    //   { record: {...} }                      a database webhook carrying a
    //                                          companies row
    //   { email, firstName, companyName }      what both apps actually send,
    //                                          from the signup screen, before
    //                                          the caller has a company id
    //
    // The webhook shape came first and this function used to require it,
    // rejecting the signup payload with "Invalid payload" — which would have
    // stopped welcome emails entirely. The signup company is resolved from the
    // address instead.
    const record = payload.record ?? payload;

    const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendKey      = Deno.env.get('RESEND_API_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let companyId: string | null   = record.id ?? null;
    let companyName: string        = record.name ?? payload.companyName ?? 'Your Company';
    let subscriptionStatus: string = record.subscription_status ?? 'trialing';
    let ownerEmail: string | null  = record.email ?? payload.email ?? null;

    if (!companyId && ownerEmail) {
      // Not filtered to role = 'owner'. A real signup creates an owner row, but
      // an address can also sit on a non-owner row — a test account, or someone
      // added to a team under the same address — and filtering it out left the
      // guide unfiled with no explanation. Any membership is enough to know
      // which company the guide belongs to.
      const { data: ownerMember, error: lookupError } = await adminClient
        .from('team_members')
        .select('company_id, role, companies(name, subscription_status)')
        .ilike('email', ownerEmail)
        .order('role', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        console.warn('[send-welcome-email] Company lookup failed:', lookupError.message);
      } else if (ownerMember?.company_id) {
        companyId = ownerMember.company_id as string;
        const co = (ownerMember as Record<string, any>).companies;
        if (co?.name) companyName = co.name;
        if (co?.subscription_status) subscriptionStatus = co.subscription_status;
      }
    }

    if (!ownerEmail && companyId) {
      const { data: ownerRow } = await adminClient
        .from('team_members')
        .select('email')
        .eq('company_id', companyId)
        .eq('role', 'owner')
        .maybeSingle();
      if (ownerRow?.email) ownerEmail = ownerRow.email;
    }

    if (!ownerEmail) {
      console.error('[send-welcome-email] No address to send to');
      return new Response(JSON.stringify({ error: 'email or record.id required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-welcome-email] Processing "${companyName}" (${companyId ?? 'no company id'})`);

    const results: Record<string, unknown> = {
      companyId,
      companyName,
      ownerEmail,
      pdf: 'pending',
      email: 'pending',
    };

    // ── Generate + upload PDF ───────────────────────────────────────
    let pdfPublicUrl: string | null = null;
    let pdfBytes: Uint8Array | null = null;

    try {
      pdfBytes = await generateWelcomePdf(companyName, subscriptionStatus);
      console.log(`[send-welcome-email] PDF generated (${pdfBytes.byteLength} bytes)`);

      // Filing it in the company's library needs a company id. Without one the
      // guide is still attached to the email below — the customer gets it
      // either way, it just does not land in Brochures & Files.
      if (!companyId) {
        results.pdf = 'generated (not filed: company not resolved)';
      } else {
        const storagePath = `company-files/${companyId}/Welcome/TrussCTR_Welcome.pdf`;

        const { error: uploadError } = await adminClient.storage
          .from('company-files')
          .upload(storagePath, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Build public URL
        const { data: urlData } = adminClient.storage
          .from('company-files')
          .getPublicUrl(storagePath);

        pdfPublicUrl = urlData?.publicUrl ?? null;
        console.log(`[send-welcome-email] PDF uploaded → ${pdfPublicUrl}`);

        // ── Insert company_files record ─────────────────────────────
        const { error: dbError } = await adminClient
          .from('company_files')
          .insert({
            id:          crypto.randomUUID(),
            company_id:  companyId,
            name:        'TrussCTR Welcome Guide',
            file_url:    pdfPublicUrl,
            file_type:   'application/pdf',
            file_size:   pdfBytes.byteLength,
            folder:      'Welcome',
            description: 'Your TrussCTR getting started guide',
            uploaded_by: null,
          });

        if (dbError) {
          console.warn('[send-welcome-email] company_files insert failed:', dbError.message);
          results.dbRecord = `failed: ${dbError.message}`;
        } else {
          results.dbRecord = 'inserted';
        }

        results.pdf = `uploaded: ${pdfPublicUrl}`;
      }
    } catch (pdfErr: any) {
      console.error('[send-welcome-email] PDF pipeline error:', pdfErr.message);
      results.pdf = `failed: ${pdfErr.message}`;
    }

    // ── Send welcome email ─────────────────────────────────────────
    if (!ownerEmail) {
      console.warn('[send-welcome-email] No owner email found — skipping email send');
      results.email = 'skipped: no owner email';
    } else if (!resendKey) {
      console.warn('[send-welcome-email] RESEND_API_KEY not set — skipping email send');
      results.email = 'skipped: no RESEND_API_KEY';
    } else {
      try {
        const { subject, html } = buildWelcomeEmail(companyName, ownerEmail, subscriptionStatus);

        const emailPayload: Record<string, unknown> = {
          from:    `TrussCTR <${platformFromEmail}>`,
          to:      [ownerEmail],
          subject,
          html,
        };

        // Attach PDF as an attachment if generation succeeded
        if (pdfBytes) {
          // Chunked: spreading the whole array into fromCharCode passes one
          // argument per byte, which overflows the call stack on any PDF big
          // enough to matter.
          let binary = '';
          const CHUNK = 0x8000;
          for (let i = 0; i < pdfBytes.length; i += CHUNK) {
            binary += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK));
          }
          const base64Pdf = btoa(binary);
          emailPayload.attachments = [
            {
              filename:    'TrussCTR_Welcome.pdf',
              content:     base64Pdf,
              content_type: 'application/pdf',
            },
          ];
        }

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify(emailPayload),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          throw new Error(`Resend ${emailRes.status}: ${errText}`);
        }

        const emailData = await emailRes.json();
        console.log('[send-welcome-email] Email sent:', emailData.id);
        results.email = `sent: ${emailData.id}`;
      } catch (emailErr: any) {
        console.error('[send-welcome-email] Email send error:', emailErr.message);
        results.email = `failed: ${emailErr.message}`;
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[send-welcome-email] Unhandled error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
