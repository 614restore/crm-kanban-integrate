import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';

// ── Persistent brand cache ────────────────────────────────────────────────────
// Stored separately from the main data cache (crm_app_data_v1) because branding
// never needs to expire — company name / logo almost never change and we always
// want them on the very first render, even before auth has resolved.
const BRAND_CACHE_KEY = 'crm_company_brand_v1';

export interface CompanyBrand {
  name: string;
  logoUrl: string | null;
}

// Shared normalizer — same logic Sidebar previously kept inline
export function normalizeCompanyName(rawName?: string | null, email?: string | null): string {
  const trimmed = (rawName || '').trim();
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (trimmed && !emailLike.test(trimmed)) return trimmed;
  const source = (email || trimmed || '').trim();
  if (source.includes('@')) {
    const local = source.split('@')[0].replace(/[._-]+/g, ' ').trim();
    if (local) {
      return local
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') + ' Company';
    }
  }
  return 'My Company';
}

function readBrandCache(companyId: string): CompanyBrand | null {
  try {
    const raw = localStorage.getItem(BRAND_CACHE_KEY);
    if (!raw) return null;
    const { cid, name, logoUrl } = JSON.parse(raw) as {
      cid: string;
      name: string;
      logoUrl: string | null;
    };
    if (cid !== companyId) return null;
    return { name: name || 'My Company', logoUrl: logoUrl ?? null };
  } catch {
    return null;
  }
}

function writeBrandCache(companyId: string, brand: CompanyBrand): void {
  try {
    localStorage.setItem(
      BRAND_CACHE_KEY,
      JSON.stringify({ cid: companyId, name: brand.name, logoUrl: brand.logoUrl }),
    );
  } catch { /* quota exceeded — skip */ }
}

// Reads the last-known brand synchronously on first render.
// Uses crm_last_company_id (written by AppLayout) so we can serve the right
// branding even before the auth session has fully resolved.
function getInitialBrand(): CompanyBrand {
  try {
    const companyId = localStorage.getItem('crm_last_company_id');
    if (!companyId) return { name: 'TrussCTR', logoUrl: null };
    const cached = readBrandCache(companyId);
    if (cached && cached.name) return cached;
  } catch { /* ignore */ }
  return { name: 'TrussCTR', logoUrl: null };
}

/**
 * useCompanyBrand — returns { name, logoUrl } with ZERO loading flash.
 *
 * Load order (fastest first):
 *   1. localStorage brand cache  → synchronous, available on frame 1
 *   2. profile.companies         → already fetched by authContext, used when ready
 *   3. db.getCompany()           → async fallback with its own 24 h cache
 *
 * Also listens for 'crm-company-updated' so settings saves propagate instantly.
 */
export function useCompanyBrand(): CompanyBrand {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  // Initialize from localStorage immediately — Sidebar / ResponsiveLayout never
  // show "Loading..." or a blank name again.
  const [brand, setBrand] = useState<CompanyBrand>(getInitialBrand);

  const apply = (name: string, logoUrl: string | null, cid: string) => {
    const b: CompanyBrand = { name, logoUrl };
    setBrand(b);
    writeBrandCache(cid, b);
  };

  // Re-derive brand whenever auth delivers company data or companyId changes
  useEffect(() => {
    if (!companyId) return;

    // Fast path: authContext already loaded profile.companies via get_my_company RPC
    if (profile?.companies) {
      const name = normalizeCompanyName(
        profile.companies.name as string | undefined,
        profile.companies.email as string | undefined,
      );
      apply(name, (profile.companies.logo_url as string | null) ?? null, companyId);
      return;
    }

    // Slow path: profile.companies not yet available — async fetch (uses db cache)
    db.getCompany(companyId)
      .then((company) => {
        if (!company) return;
        apply(normalizeCompanyName(company.name, company.email), company.logo_url ?? null, companyId);
      })
      .catch(() => { /* keep current brand */ });
  }, [companyId, profile?.companies]);

  // Settings page fires this event when company info is saved
  useEffect(() => {
    if (!companyId) return;
    const onUpdated = () => {
      db.getCompany(companyId)
        .then((company) => {
          if (!company) return;
          apply(normalizeCompanyName(company.name, company.email), company.logo_url ?? null, companyId);
        })
        .catch(() => {});
    };
    window.addEventListener('crm-company-updated', onUpdated);
    return () => window.removeEventListener('crm-company-updated', onUpdated);
  }, [companyId]);

  return brand;
}
