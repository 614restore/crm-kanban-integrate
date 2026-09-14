// Copied from QuoteMGR src/lib/fileLibrary.ts (read-only reference).
import { runWithTimeout, supabase } from '@/lib/supabase';

const FILE_LIBRARY_LOCAL_KEY_PREFIX = 'quotemgr_company_files_v1';
const FILE_LIBRARY_BUCKET = 'quote-photos';
const FILE_LIBRARY_DATA_PREFIX = 'company-file-library';
const FILE_UPLOAD_PREFIX = 'company-files';

export const FILE_LIBRARY_UPDATED_EVENT = 'quotemgr:file-library-updated';

export type FileTier = 'all' | 'good' | 'better' | 'best';

export interface CompanyFileRecord {
  id: string;
  companyId: string;
  title: string;
  description: string;
  tier: FileTier;
  colorOptions: string;
  tierBreakdown: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileUrl: string;
  storagePath: string;
  uploadedAt: string;
  uploadedByName: string;
}

const toLocalStorageKey = (companyId: string) => `${FILE_LIBRARY_LOCAL_KEY_PREFIX}:${companyId}`;
const toDataStoragePath = (companyId: string) => `${FILE_LIBRARY_DATA_PREFIX}/${companyId}.json`;

const safeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeTier = (value: unknown): FileTier =>
  value === 'good' || value === 'better' || value === 'best' || value === 'all'
    ? value
    : 'all';

const sanitizeFileRecord = (rawRecord: any): CompanyFileRecord | null => {
  if (!rawRecord || typeof rawRecord !== 'object') return null;

  const id = safeString(rawRecord.id);
  const companyId = safeString(rawRecord.companyId);
  const fileUrl = safeString(rawRecord.fileUrl);
  const fileName = safeString(rawRecord.fileName);
  if (!id || !companyId || !fileUrl || !fileName) return null;

  return {
    id,
    companyId,
    title: safeString(rawRecord.title) || fileName,
    description: safeString(rawRecord.description),
    tier: safeTier(rawRecord.tier),
    colorOptions: safeString(rawRecord.colorOptions),
    tierBreakdown: safeString(rawRecord.tierBreakdown),
    fileName,
    fileType: safeString(rawRecord.fileType),
    fileSizeBytes: safeNumber(rawRecord.fileSizeBytes),
    fileUrl,
    storagePath: safeString(rawRecord.storagePath),
    uploadedAt: safeString(rawRecord.uploadedAt) || new Date().toISOString(),
    uploadedByName: safeString(rawRecord.uploadedByName),
  };
};

const sanitizeFileArray = (rawValue: unknown): CompanyFileRecord[] => {
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map(sanitizeFileRecord)
    .filter(Boolean)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()) as CompanyFileRecord[];
};

const emitFileLibraryUpdated = (companyId: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(FILE_LIBRARY_UPDATED_EVENT, {
      detail: { companyId },
    })
  );
};

const readLocalFileRecords = (companyId: string): CompanyFileRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(toLocalStorageKey(companyId));
    if (!raw) return [];
    return sanitizeFileArray(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeLocalFileRecords = (companyId: string, records: CompanyFileRecord[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(toLocalStorageKey(companyId), JSON.stringify(records));
  } catch {
    // Ignore localStorage failures; remote storage is attempted below.
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

const readRemoteFileRecords = async (companyId: string): Promise<CompanyFileRecord[] | null> => {
  const { data, error } = await runWithTimeout(
    (_signal) =>
      supabase.storage
        .from(FILE_LIBRARY_BUCKET)
        .download(toDataStoragePath(companyId)),
    20000
  );

  if (error) {
    if (isMissingStorageObjectError(error)) {
      // File doesn't exist yet — seed an empty one so future loads succeed (no 400).
      void supabase.storage
        .from(FILE_LIBRARY_BUCKET)
        .upload(
          toDataStoragePath(companyId),
          new Blob([JSON.stringify({ files: [], updatedAt: new Date().toISOString() })], {
            type: 'application/json',
          }),
          { upsert: false, cacheControl: '0', contentType: 'application/json' }
        );
      return null;
    }
    throw error;
  }

  const raw = await data.text();
  if (!raw.trim()) return [];

  const parsed = JSON.parse(raw);
  const filePayload = Array.isArray(parsed) ? parsed : parsed?.files;
  return sanitizeFileArray(filePayload);
};

const writeRemoteFileRecords = async (companyId: string, records: CompanyFileRecord[]) => {
  const payload = JSON.stringify(
    {
      files: records,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );

  const blob = new Blob([payload], { type: 'application/json' });
  const { error } = await runWithTimeout(
    (_signal) =>
      supabase.storage
        .from(FILE_LIBRARY_BUCKET)
        .upload(toDataStoragePath(companyId), blob, {
          upsert: true,
          cacheControl: '0',
          contentType: 'application/json',
        }),
    20000
  );

  if (error) throw error;
};

export const loadCompanyFiles = async (companyId: string): Promise<CompanyFileRecord[]> => {
  const localRecords = readLocalFileRecords(companyId);
  try {
    const remoteRecords = await readRemoteFileRecords(companyId);
    if (remoteRecords === null) return localRecords;
    writeLocalFileRecords(companyId, remoteRecords);
    return remoteRecords;
  } catch {
    return localRecords;
  }
};

export const saveCompanyFiles = async (companyId: string, records: CompanyFileRecord[]) => {
  const sanitized = sanitizeFileArray(records);
  writeLocalFileRecords(companyId, sanitized);
  try {
    await writeRemoteFileRecords(companyId, sanitized);
    emitFileLibraryUpdated(companyId);
    return { synced: true as const };
  } catch (error) {
    emitFileLibraryUpdated(companyId);
    return { synced: false as const, error };
  }
};

const sanitizeFileNameForStorage = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const uploadCompanyFile = async (companyId: string, file: File) => {
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileNameForStorage(file.name);
  const storagePath = `${FILE_UPLOAD_PREFIX}/${companyId}/${timestamp}-${sanitizedFileName}`;

  const { error } = await runWithTimeout(
    (_signal) =>
      supabase.storage
        .from(FILE_LIBRARY_BUCKET)
        .upload(storagePath, file, {
          upsert: false,
          cacheControl: '3600',
          contentType: file.type || 'application/octet-stream',
        }),
    30000
  );

  if (error) throw error;

  const { data } = supabase.storage.from(FILE_LIBRARY_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
};

export const deleteCompanyFileBinary = async (storagePath: string) => {
  if (!storagePath) return;
  await runWithTimeout(
    (_signal) =>
      supabase.storage
        .from(FILE_LIBRARY_BUCKET)
        .remove([storagePath]),
    20000
  ).catch(() => undefined);
};

export const createCompanyFileRecordId = () =>
  `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
