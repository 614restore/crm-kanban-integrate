// Copied from QuoteMGR src/lib/templateLibrary.ts (read-only reference).
import type { QuoteProjectTemplate } from '@/data/quoteData';
import { quoteProjectTemplates } from '@/data/quoteData';
import { runWithTimeout, supabase } from '@/lib/supabase';

const LOCAL_TEMPLATE_KEY_PREFIX = 'quotemgr_custom_project_templates_v1';
const TEMPLATE_BUCKET = 'quote-photos';
const TEMPLATE_STORAGE_PREFIX = 'project-template-library';

export const TEMPLATE_LIBRARY_UPDATED_EVENT = 'quotemgr:template-library-updated';

export interface CustomQuoteProjectTemplate extends QuoteProjectTemplate {
  is_custom?: boolean;
  created_at?: string;
  updated_at?: string;
}

type SaveCustomTemplatesResult = {
  synced: boolean;
  error?: unknown;
};

const PROJECT_TYPES: QuoteProjectTemplate['projectType'][] = ['exterior', 'interior', 'both'];

const toStoragePath = (companyId: string) => `${TEMPLATE_STORAGE_PREFIX}/${companyId}.json`;
const toLocalStorageKey = (companyId: string) => `${LOCAL_TEMPLATE_KEY_PREFIX}:${companyId}`;

const safeString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback).trim();
const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeLineItem = (rawItem: any) => {
  if (!rawItem || typeof rawItem !== 'object') return null;

  const itemName = safeString(rawItem.item_name);
  if (!itemName) return null;

  return {
    category: safeString(rawItem.category, 'Other') || 'Other',
    item_name: itemName,
    description: safeString(rawItem.description),
    unit: safeString(rawItem.unit, 'each') || 'each',
    quantity: safeNumber(rawItem.quantity, 1),
    good_price: safeNumber(rawItem.good_price, 0),
    better_price: safeNumber(rawItem.better_price, 0),
    best_price: safeNumber(rawItem.best_price, 0),
  };
};

const sanitizeTemplate = (rawTemplate: any): CustomQuoteProjectTemplate | null => {
  if (!rawTemplate || typeof rawTemplate !== 'object') return null;

  const id = safeString(rawTemplate.id);
  const name = safeString(rawTemplate.name);
  if (!id || !name) return null;

  const projectType = PROJECT_TYPES.includes(rawTemplate.projectType)
    ? rawTemplate.projectType
    : 'exterior';

  const lineItemsRaw = Array.isArray(rawTemplate.lineItems) ? rawTemplate.lineItems : [];
  const lineItems = lineItemsRaw.map(sanitizeLineItem).filter(Boolean) as CustomQuoteProjectTemplate['lineItems'];
  if (lineItems.length === 0) return null;

  return {
    id,
    name,
    description: safeString(rawTemplate.description),
    projectType,
    coverPageTitle: safeString(rawTemplate.coverPageTitle, `${name} Proposal`) || `${name} Proposal`,
    projectDescription: safeString(rawTemplate.projectDescription),
    lineItems,
    is_custom: true,
    created_at: safeString(rawTemplate.created_at),
    updated_at: safeString(rawTemplate.updated_at),
  };
};

const sanitizeTemplateArray = (rawValue: unknown) => {
  if (!Array.isArray(rawValue)) return [];
  return rawValue.map(sanitizeTemplate).filter(Boolean) as CustomQuoteProjectTemplate[];
};

const readLocalTemplates = (companyId: string): CustomQuoteProjectTemplate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(toLocalStorageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeTemplateArray(parsed);
  } catch {
    return [];
  }
};

const writeLocalTemplates = (companyId: string, templates: CustomQuoteProjectTemplate[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(toLocalStorageKey(companyId), JSON.stringify(templates));
  } catch {
    // Ignore localStorage write failures and rely on storage upload below.
  }
};

const isMissingStorageObjectError = (error: unknown) => {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '').toLowerCase()
      : '';

  // Supabase Storage returns 400 for missing objects in some configurations;
  // also check the status / statusCode property on the error object directly.
  const statusNum =
    typeof error === 'object' && error
      ? ('status' in error ? Number((error as { status?: unknown }).status) : 0) ||
        ('statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : 0)
      : 0;

  return (
    message.includes('not found') ||
    message.includes('status code 400') ||
    message.includes('status code 404') ||
    message.includes('no such file') ||
    message.includes('does not exist') ||
    message.includes('invalid key') ||
    statusNum === 400 ||
    statusNum === 404
  );
};

const readRemoteTemplates = async (companyId: string) => {
  const { data, error } = await runWithTimeout(
    (_signal) =>
      supabase.storage
        .from(TEMPLATE_BUCKET)
        .download(toStoragePath(companyId)),
    20000
  );

  if (error) {
    if (isMissingStorageObjectError(error)) {
      // File doesn't exist yet — seed an empty one so future loads succeed (no 400).
      void supabase.storage
        .from(TEMPLATE_BUCKET)
        .upload(
          toStoragePath(companyId),
          new Blob([JSON.stringify({ templates: [], updatedAt: new Date().toISOString() })], {
            type: 'application/json',
          }),
          { upsert: false, cacheControl: '0', contentType: 'application/json' }
        );
      return null;
    }
    throw error;
  }

  const rawText = await data.text();
  if (!rawText.trim()) return [];

  const parsed = JSON.parse(rawText);
  const templatesPayload = Array.isArray(parsed) ? parsed : parsed?.templates;
  return sanitizeTemplateArray(templatesPayload);
};

const writeRemoteTemplates = async (companyId: string, templates: CustomQuoteProjectTemplate[]) => {
  const payload = JSON.stringify(
    {
      templates,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: 'application/json' });

  const { error } = await runWithTimeout(
    (_signal) =>
      supabase.storage
        .from(TEMPLATE_BUCKET)
        .upload(toStoragePath(companyId), blob, {
          upsert: true,
          cacheControl: '0',
          contentType: 'application/json',
        }),
    20000
  );

  if (error) throw error;
};

export const isOwnerOrManager = (role: string) =>
  role === 'owner' || role === 'admin' || role === 'manager';

export const createCustomTemplateId = () =>
  `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const emitTemplateLibraryUpdated = (companyId: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TEMPLATE_LIBRARY_UPDATED_EVENT, {
      detail: { companyId },
    })
  );
};

export const loadCompanyCustomTemplates = async (
  companyId: string
): Promise<CustomQuoteProjectTemplate[]> => {
  const localTemplates = readLocalTemplates(companyId);

  try {
    const remoteTemplates = await readRemoteTemplates(companyId);
    if (remoteTemplates === null) {
      return localTemplates;
    }

    writeLocalTemplates(companyId, remoteTemplates);
    return remoteTemplates;
  } catch {
    return localTemplates;
  }
};

export const saveCompanyCustomTemplates = async (
  companyId: string,
  templates: CustomQuoteProjectTemplate[]
): Promise<SaveCustomTemplatesResult> => {
  const sanitizedTemplates = sanitizeTemplateArray(templates);
  writeLocalTemplates(companyId, sanitizedTemplates);

  try {
    await writeRemoteTemplates(companyId, sanitizedTemplates);
    emitTemplateLibraryUpdated(companyId);
    return { synced: true };
  } catch (error) {
    emitTemplateLibraryUpdated(companyId);
    return { synced: false, error };
  }
};

export const loadAllProjectTemplatesForCompany = async (
  companyId: string
): Promise<QuoteProjectTemplate[]> => {
  const customTemplates = await loadCompanyCustomTemplates(companyId);
  const builtInTemplateIds = new Set(quoteProjectTemplates.map((template) => template.id));
  const filteredCustom = customTemplates.filter((template) => !builtInTemplateIds.has(template.id));
  return [...quoteProjectTemplates, ...filteredCustom];
};
