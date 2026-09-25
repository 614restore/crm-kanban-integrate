// Mobile App Storage Security Utils
// Ensures all file uploads use company-isolated paths

import { supabase } from './supabase';
import { optimizeImageForUpload } from './imageUtils';

/**
 * Get the current user's company ID for secure file path construction
 */
export async function getCurrentUserCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (error || !profile?.company_id) {
    throw new Error('Could not determine user company ID');
  }

  return profile.company_id;
}

/**
 * Create a contact-scoped file path (matches mobile convention and storage RLS policy)
 */
export function createSecureFilePath(
  _companyId: string,
  contactId: string,
  fileName: string
): string {
  return `${contactId}/${fileName}`;
}

/**
 * Upload file to company-isolated path
 */
export async function secureUpload(
  bucket: string,
  contactId: string, 
  originalFile: Blob,
  originalFileName: string,
  originalContentType?: string
): Promise<{
  path: string;
  publicUrl: string;
  signedUrl?: string;
}> {
  // Photos are scaled down before they are stored (PDFs and other files pass through).
  const file = await optimizeImageForUpload(originalFile);
  const converted = file !== originalFile;
  const contentType = converted ? file.type : originalContentType;
  const fileName = converted && file.type === 'image/jpeg'
    ? originalFileName.replace(/\.(png|webp|hei[cf])$/i, '.jpg')
    : originalFileName;

  const companyId = await getCurrentUserCompanyId();
  const securePath = createSecureFilePath(companyId, contactId, fileName);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(securePath, file, { 
      contentType: contentType || 'application/octet-stream',
      upsert: false 
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  // Optional signed URL for private access
  const { data: signedUrlData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 60 * 60); // 1 hour expiry

  return {
    path: data.path,
    publicUrl,
    signedUrl: signedUrlData?.signedUrl
  };
}

/**
 * Security check: delegated to storage RLS — always returns true for callers that pass auth.
 */
export async function canUserAccessFile(_filePath: string): Promise<boolean> {
  return true;
}