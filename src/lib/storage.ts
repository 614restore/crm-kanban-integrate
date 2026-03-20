import { supabase, supabaseKey, supabaseUrl, isDemoMode } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

function isFileReadErrorMessage(message: string): boolean {
  return /I\/O read operation failed|NotReadableError|WebKitBlobResource/i.test(message);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// Parse any Supabase storage URL (public or signed) into { bucket, path }.
// Returns null for non-storage URLs (e.g. external links).
export function extractStorageInfo(value: string): { bucket: string; path: string } | null {
  if (!value || !isHttpUrl(value)) return null;
  // public:  /storage/v1/object/public/{bucket}/{path}
  // signed:  /storage/v1/object/sign/{bucket}/{path}
  const m = value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?.*)?$/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

// Legacy helper kept for callers that only need the path string.
export function extractDocumentPath(value: string): string {
  if (!value) return '';
  if (!isHttpUrl(value)) return value;
  const info = extractStorageInfo(value);
  return info ? info.path : value;
}

export function isSupabaseStorageUrl(value: string): boolean {
  return isHttpUrl(value) && /\.supabase\.co\/storage\//.test(value);
}

export async function getDocumentSignedUrl(pathOrUrl: string, expiresInSeconds: number = 3600): Promise<string | null> {
  if (!pathOrUrl) return null;

  let bucket: string;
  let path: string;

  if (isHttpUrl(pathOrUrl)) {
    const info = extractStorageInfo(pathOrUrl);
    if (!info) {
      // Not a Supabase storage URL — open as-is (e.g. EagleView, external links)
      return pathOrUrl;
    }
    bucket = info.bucket;
    path = info.path;
  } else {
    // Raw relative path — default to projectceo-documents
    bucket = 'projectceo-documents';
    path = pathOrUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error(`[Storage] Signed URL creation failed for bucket "${bucket}" path "${path}":`, error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function uploadBinaryViaRest(
  bucket: string,
  path: string,
  payload: Blob | File,
  accessToken: string,
  timeoutMs: number = 20000
): Promise<{ ok: true } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  
  try {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          'x-upsert': 'false',
          'content-type': payload.type || 'application/octet-stream',
        },
        body: payload,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Storage] REST upload failed: HTTP ${response.status}`, text);
      return { ok: false, message: text || `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`[Storage] REST upload timeout`);
      return { ok: false, message: `Request timed out after ${Math.round(timeoutMs / 1000)}s` };
    }

    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: 'Unknown upload error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadViaSdk(
  bucket: string,
  path: string,
  file: File,
  timeoutMs = 20000
): Promise<{ ok: true } | { ok: false; message: string }> {
  const timeoutPromise = new Promise<{ ok: false; message: string }>((resolve) =>
    setTimeout(() => resolve({ ok: false, message: `SDK upload timed out after ${Math.round(timeoutMs / 1000)}s` }), timeoutMs)
  );

  const uploadPromise = supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type || undefined })
    .then(({ error }) => {
      if (error) {
        console.error(`[Storage] SDK upload failed:`, error);
        return { ok: false as const, message: error.message || 'Storage upload failed' };
      }
      return { ok: true as const };
    });

  return Promise.race([uploadPromise, timeoutPromise]);
}

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param bucket - The storage bucket name (e.g., 'avatars', 'company-logos', 'projectceo-documents')
 * @param folder - Optional folder within the bucket
 * @returns Upload result with URL and path
 */
export async function uploadFile(
  file: File,
  bucket: string,
  folder?: string
): Promise<UploadResult> {
  try {
    // In demo mode, return error to trigger fallback to data URL
    if (isDemoMode) {
      return {
        url: '',
        path: '',
        error: 'Demo mode - use local data URL',
      };
    }

    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData?.session?.access_token;
    if (!accessToken) {
      console.error('[Storage] No access token available');
      return {
        url: '',
        path: '',
        error: 'Session expired. Please sign in again and retry.',
      };
    }


    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const mimeType = file.type || 'application/octet-stream';
    let fileBytes: ArrayBuffer | null = null;
    try {
      fileBytes = await file.arrayBuffer();
    } catch (readError) {
      console.warn('Could not pre-read file bytes, falling back to slice payloads:', readError);
    }

    const makeBlobPayload = () =>
      fileBytes ? new Blob([fileBytes], { type: mimeType }) : file.slice(0, file.size, mimeType);
    const makeFilePayload = () =>
      fileBytes
        ? new File([fileBytes], file.name, { type: mimeType })
        : new File([file.slice(0, file.size, mimeType)], file.name, { type: mimeType });

    // First attempt: SDK upload with a fresh payload object (avoids exhausted body streams).
    let result = await uploadViaSdk(bucket, filePath, makeFilePayload());

    // Fallback path: direct REST upload with fresh blob payload.
    if (!result.ok) {
      console.warn('[Storage] SDK upload failed, trying REST fallback:', result.message);
      result = await uploadBinaryViaRest(bucket, filePath, makeBlobPayload(), accessToken, 20000);
    }

    // Retry once for transient network/auth failures.
    if (!result.ok && isFileReadErrorMessage(result.message)) {
      return {
        url: '',
        path: '',
        error: 'Browser could not read the selected file.',
      };
    }

    if (!result.ok) {
      console.warn('Upload transient failure, retrying once:', result.message);
      try {
        const { data: refreshData } = await supabase.auth.getSession();
        const refreshToken = refreshData?.session?.refresh_token;
        if (refreshToken) {
          await supabase.auth.refreshSession({ refresh_token: refreshToken });
        }
      } catch (refreshError) {
        console.warn('Session refresh before retry failed:', refreshError);
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      const { data: latestSession } = await supabase.auth.getSession();
      const retryToken = latestSession?.session?.access_token || accessToken;

      // Retry SDK first, then REST, both with fresh payloads.
      result = await uploadViaSdk(bucket, filePath, makeFilePayload());
      if (!result.ok) {
        result = await uploadBinaryViaRest(bucket, filePath, makeBlobPayload(), retryToken, 25000);
      }
    }

    if (!result.ok) {
      const message = isFileReadErrorMessage(result.message)
        ? 'Browser could not read the selected file.'
        : result.message;
      console.error(`[Storage] Upload failed for ${bucket}/${filePath}:`, message);
      return { url: '', path: '', error: message };
    }


    // Public URL is used for logos/avatars; documents store path and are later resolved to signed URLs.
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Upload exception:', error);
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
      if (error.name === 'NotReadableError' || /I\/O read operation failed/i.test(error.message)) {
        message = 'Browser could not read this file. Save it locally as JPG/PNG and try again.';
      }
    } else if (error && typeof error === 'object') {
      message = JSON.stringify(error);
    }

    return {
      url: '',
      path: '',
      error: message,
    };
  }
}

/**
 * Delete a file from Supabase Storage
 * @param bucket - The storage bucket name
 * @param path - The file path to delete
 */
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete exception:', error);
    return false;
  }
}

/**
 * Upload company logo
 * @param file - The logo image file
 * @param companyId - The company ID
 */
export async function uploadCompanyLogo(
  file: File,
  companyId: string
): Promise<UploadResult> {
  return uploadFile(file, 'company-logos', companyId);
}

/**
 * Upload user avatar
 * @param file - The avatar image file
 * @param userId - The user ID
 */
export async function uploadUserAvatar(
  file: File,
  userId: string
): Promise<UploadResult> {
  return uploadFile(file, 'avatars', userId);
}

/**
 * Upload document
 * @param file - The document file
 * @param companyId - The company ID
 * @param contactId - Optional contact ID for organizing documents
 */
export async function uploadDocument(
  file: File,
  companyId: string,
  contactId?: string
): Promise<UploadResult> {
  const folder = contactId ? `${companyId}/${contactId}` : companyId;
  return uploadFile(file, 'projectceo-documents', folder);
}

/**
 * Validate image file
 * @param file - The file to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns Error message if invalid, null if valid
 */
export function validateImageFile(file: File, maxSizeMB: number = 5): string | null {
  const lowerName = file.name.toLowerCase();

  // Catch HEIC/HEIF early — iPhone photos are saved as HEIC by default and
  // cannot be rendered by most desktop browsers (Chrome, Firefox, Edge).
  // The MIME type may be 'image/heic', 'image/heif', or even '' (empty).
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif');
  if (isHeic) {
    return 'iPhone HEIC photos are not supported. Please convert to JPG or PNG first (open in Photos → Export → Export as JPG).';
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    return 'Please upload an image file (JPG, PNG, GIF, WebP)';
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `File size must be less than ${maxSizeMB}MB`;
  }

  // Check specific image types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'Unsupported image format. Please use JPG, PNG, GIF, or WebP';
  }

  return null;
}

/**
 * Validate document file
 * @param file - The file to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns Error message if invalid, null if valid
 */
export function validateDocumentFile(file: File, maxSizeMB: number = 10): string | null {
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `File size must be less than ${maxSizeMB}MB`;
  }

  // Check file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
  ];

  if (!allowedTypes.includes(file.type)) {
    return 'Unsupported file format. Please use PDF, Word, Excel, text, or images';
  }

  return null;
}

/**
 * Create preview URL from File object
 * @param file - The file to preview
 * @returns Data URL for preview
 */
export function createPreviewUrl(file: File): Promise<string> {
  try {
    // Object URLs are more reliable than FileReader for client-side preview.
    return Promise.resolve(URL.createObjectURL(file));
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error('Failed to create preview URL'));
  }
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
