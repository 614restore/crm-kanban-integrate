// How a quote's progress reads in lists: the status pill plus what happened and when.
// Mirrors QuoteMGR's dashboard: sent -> viewed (an inspection report reads "opened") ->
// signed, with the contingency agreement, completion certificate and the executed
// copy each shown as their own line.

export interface QuoteStatusFields {
  status: string;
  project_type?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  signed_at?: string | null;
  contingency_enabled?: boolean | null;
  contingency_signed_at?: string | null;
  inspection_report_sent_at?: string | null;
  inspection_report_viewed_at?: string | null;
  completion_certificate_sent_at?: string | null;
  completion_certificate_viewed_at?: string | null;
  certificate_customer_signed_at?: string | null;
  contractor_signed_at?: string | null;
  countersigned_copy_sent_at?: string | null;
}

export interface QuoteStatusView {
  label: string;
  /** Tailwind classes for the pill. */
  pill: string;
  /** One short line per thing that has happened, newest concerns first. */
  details: { text: string; tone: string }[];
}

/** "5 min ago", "3 h ago", "2 d ago", or a date once it is over a month old. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

const PILLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  signed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

export function describeQuoteStatus(q: QuoteStatusFields, now: number = Date.now()): QuoteStatusView {
  const isReport = q.project_type === 'inspection_report';
  const status = q.status || 'draft';

  // A customer opening an inspection report is "opened"; a proposal is "viewed".
  const label = status === 'viewed' && isReport ? 'Opened' : status.charAt(0).toUpperCase() + status.slice(1);

  const details: QuoteStatusView['details'] = [];
  const sentAt = (isReport && q.inspection_report_sent_at) || q.sent_at;
  const viewedAt = (isReport && q.inspection_report_viewed_at) || q.viewed_at;

  if (status === 'signed') {
    // A signed report's contingency line below already says when it was signed.
    if (q.signed_at && !(isReport && q.contingency_signed_at)) {
      details.push({ text: `Signed ${timeAgo(q.signed_at, now)}`, tone: 'text-green-600' });
    }
  } else if (status === 'viewed') {
    if (viewedAt) details.push({ text: `${isReport ? 'Opened' : 'Viewed'} ${timeAgo(viewedAt, now)}`, tone: 'text-purple-600' });
    else if (sentAt) details.push({ text: `Sent ${timeAgo(sentAt, now)}`, tone: 'text-blue-600' });
  } else if (status === 'sent') {
    if (sentAt) details.push({ text: `Sent ${timeAgo(sentAt, now)}, not opened yet`, tone: 'text-blue-600' });
  }

  if (isReport) {
    if (q.contingency_signed_at) {
      details.push({ text: `Contingency signed ${timeAgo(q.contingency_signed_at, now)}`, tone: 'text-teal-600' });
    } else if (q.contingency_enabled && (status === 'sent' || status === 'viewed')) {
      details.push({ text: 'Contingency awaiting signature', tone: 'text-teal-500' });
    }
  }

  if (q.completion_certificate_sent_at || q.completion_certificate_viewed_at || q.certificate_customer_signed_at) {
    const cert = q.certificate_customer_signed_at
      ? `Signed ${timeAgo(q.certificate_customer_signed_at, now)}`
      : q.completion_certificate_viewed_at
        ? `Opened ${timeAgo(q.completion_certificate_viewed_at, now)}`
        : `Sent ${timeAgo(q.completion_certificate_sent_at, now)}`;
    details.push({ text: `Certificate: ${cert}`, tone: 'text-emerald-600' });
  }

  if (status === 'signed' && q.contractor_signed_at) {
    details.push(
      q.countersigned_copy_sent_at
        ? { text: `Executed copy sent ${timeAgo(q.countersigned_copy_sent_at, now)}`, tone: 'text-emerald-700' }
        : { text: 'Countersigned, executed copy not sent', tone: 'text-amber-600' },
    );
  }

  return { label, pill: PILLS[status] || PILLS.draft, details };
}
