// Copied from QuoteMGR src/lib/appUrl.ts (read-only reference).
/**
 * Returns the canonical app origin for use in outbound emails and links.
 * Always uses the production URL (VITE_APP_URL) when set, so emails sent
 * from a local dev server still produce working customer-facing links.
 */
export function appOrigin(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

export function quoteUrl(shareToken: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${appOrigin()}${base}?token=${shareToken}`;
}

export function certUrl(shareToken: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${appOrigin()}${base}?token=${shareToken}&cert=1`;
}

// Standalone digital "3-Day Right to Cancel" link — only functional once an
// owner/admin has enabled standalone_cancel_share_enabled for the quote (see
// DocumentsWizard's "Share Digital Copy" action).
export function cancelNoticeUrl(shareToken: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${appOrigin()}${base}?token=${shareToken}&cancel_notice=1`;
}
