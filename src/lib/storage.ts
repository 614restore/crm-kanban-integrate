import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
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
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      const status = (error as any).statusCode || (error as any).status || '';
      const details = (error as any).error || (error as any).name || '';
      const parts = [error.message, status ? `status ${status}` : '', details].filter(Boolean);
      return { url: '', path: '', error: parts.join(' | ') };
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Upload exception:', error);
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
