import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCRM, canManageLeadSources } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { defaultLeadSources } from '@/lib/crmData';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { uploadCompanyLogo, uploadUserAvatar, validateImageFile } from '@/lib/storage';
import {
  Settings,
  Building2,
  Users,
  Bell,
  Shield,
  CreditCard,
  Link,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Check,
  ExternalLink,
  Key,
  Database,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  User,
  Upload,
  Loader2,
  LogOut,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ensureDefaultLeadSources } from '@/lib/setupCompany';

type SettingsTab = 'company' | 'profile' | 'integrations' | 'notifications' | 'security' | 'billing' | 'api';

interface CompanyFormData {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

export default function SettingsView() {
  const { state, dispatch } = useCRM();
  const { profile, user, updateProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [newLeadSource, setNewLeadSource] = useState('');
  const [showAddLeadSource, setShowAddLeadSource] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  
  // Company form state
  const [companyForm, setCompanyForm] = useState<CompanyFormData>({
    name: 'StormCraft Roofing',
    phone: '(555) 123-4567',
    email: 'info@stormcraft.com',
    website: 'https://stormcraft.com',
    address: '123 Business Park Drive, Dallas, TX 75201',
  });
  
  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
  });
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(profile?.avatar_url || null);
  const [companyLogoUrlInput, setCompanyLogoUrlInput] = useState('');
  const [profileAvatarUrlInput, setProfileAvatarUrlInput] = useState(profile?.avatar_url || '');

  useEffect(() => {
    setProfileForm({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
    });
    setProfileAvatar(profile?.avatar_url || null);
    setProfileAvatarUrlInput(profile?.avatar_url || '');
  }, [profile?.first_name, profile?.last_name, profile?.avatar_url]);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingLogoUrl, setIsSavingLogoUrl] = useState(false);
  const [isSavingAvatarUrl, setIsSavingAvatarUrl] = useState(false);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [isStartingFresh, setIsStartingFresh] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Refs for file inputs
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const userRole = (state.currentUser?.role || profile?.role || 'sales') as any;
  const canManageSources = canManageLeadSources(userRole);
  const effectiveCompanyId = profile?.company_id || state.companyId || null;

  const resolveCompanyId = useCallback(async (): Promise<string | null> => {
    const currentCompanyId = profile?.company_id || state.companyId || null;
    if (currentCompanyId) return currentCompanyId;

    const userId = profile?.id || user?.id;
    if (!userId) {
      return null;
    }

    try {
      const profileResult = await withTimeout(
        supabase
          .from('profiles')
          .select('company_id')
          .eq('id', userId)
          .single(),
        15000,
        'Lookup user company'
      );

      if (!profileResult.error && profileResult.data?.company_id) {
        dispatch({ type: 'SET_COMPANY_ID', payload: profileResult.data.company_id });
        return profileResult.data.company_id;
      }

      return null;
    } catch (error) {
      console.warn('resolveCompanyId fallback to cached company_id:', error);
      return state.companyId || null;
    }
  }, [dispatch, profile?.company_id, profile?.id, state.companyId, user?.id]);

  // Combine default and custom lead sources
  const allLeadSources = [...defaultLeadSources, ...state.leadSources.filter((ls) => ls.isCustom)];

  // Load company data on mount and recover missing company context if needed.
  useEffect(() => {
    let cancelled = false;

    const loadCompanyData = async () => {
      setIsLoadingCompany(true);
      try {
        const companyId = effectiveCompanyId || await withTimeout(resolveCompanyId(), 7000, 'Resolve company context');
        if (!companyId) return;

        const company = await withTimeout(db.getCompany(companyId), 10000, 'Load company profile');
        if (company && !cancelled) {
          setCompanyForm({
            name: company.name || 'StormCraft Roofing',
            phone: company.phone || '',
            email: company.email || '',
            website: company.website || '',
            address: company.address || '',
          });
          if (company.logo_url && !company.logo_url.startsWith('blob:')) {
            setCompanyLogo(company.logo_url);
            setCompanyLogoUrlInput(company.logo_url);
          } else {
            setCompanyLogo(null);
            setCompanyLogoUrlInput('');
          }
        }
      } catch (error) {
        console.error('Error loading company data:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingCompany(false);
        }
      }
    };

    loadCompanyData();

    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId, resolveCompanyId]);

  const handleAddLeadSource = async () => {
    const sourceName = newLeadSource.trim();
    if (!sourceName) return;

    try {
      const companyId = effectiveCompanyId || await resolveCompanyId();
      if (!companyId) {
        toast.error('No company context available. Please refresh and sign in again.');
        return;
      }

      const created = await db.createLeadSource({
        company_id: companyId,
        name: sourceName,
        is_custom: true,
        created_by: profile?.id,
      });

      if (!created) {
        toast.error('Failed to add lead source');
        return;
      }

      dispatch({
        type: 'ADD_LEAD_SOURCE',
        payload: {
          id: created.id,
          name: created.name,
          isCustom: created.is_custom,
          createdBy: created.created_by,
        },
      });

      setNewLeadSource('');
      setShowAddLeadSource(false);
      toast.success('Lead source added successfully');
    } catch (error) {
      console.error('Error adding lead source:', error);
      toast.error('Failed to add lead source');
    }
  };

  const handleSaveCompany = async () => {
    const companyId = effectiveCompanyId || await resolveCompanyId();

    if (!companyId) {
      toast.error('No company associated with your account. Please sign out and sign back in if this continues.')
      return;
    }

    setIsSavingCompany(true);

    try {
      const result = await db.updateCompany(companyId, {
        name: companyForm.name,
        phone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website,
        address: companyForm.address,
      });

      if (result) {
        window.dispatchEvent(new Event('crm-company-updated'));
        toast.success('Company profile saved successfully!');
      } else {
        toast.error('Failed to save company profile');
      }
    } catch (error) {
      console.error('Save company error:', error);
      toast.error('Failed to save company profile');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const readFileAsDataUrl = async (file: File): Promise<string> => {
    const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';

    // Primary path: ArrayBuffer read is more reliable than FileReader on some WebKit sessions.
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binary = '';

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }

      if (binary.length > 0) {
        const base64 = btoa(binary);
        return 'data:' + mimeType + ';base64,' + base64;
      }
    } catch (arrayBufferError) {
      console.warn('ArrayBuffer image fallback read failed:', arrayBufferError);
    }

    // Secondary path: FileReader DataURL.
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string' && result.startsWith('data:image/')) {
          resolve(result);
        } else {
          reject(new Error('Failed to read image fallback'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image fallback'));
      reader.readAsDataURL(file);
    });
  };

  const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image fallback'));
      img.src = dataUrl;
    });

  const resizeImageSourceToDataUrl = async (
    sourceImage: HTMLImageElement,
    maxDimension: number = 512,
    quality: number = 0.82
  ): Promise<string> => {
    const scale = Math.min(1, maxDimension / Math.max(sourceImage.width, sourceImage.height));
    const width = Math.max(1, Math.round(sourceImage.width * scale));
    const height = Math.max(1, Math.round(sourceImage.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to prepare image canvas');

    ctx.drawImage(sourceImage, 0, 0, width, height);

    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/webp', quality);
    } catch {
      dataUrl = '';
    }

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Failed to encode image fallback');
    }

    return dataUrl;
  };

  const resizeImageToDataUrl = async (
    file: File,
    maxDimension: number = 512,
    quality: number = 0.82
  ): Promise<string> => {
    const sourceDataUrl = await readFileAsDataUrl(file);
    const sourceImage = await loadImageFromDataUrl(sourceDataUrl);
    return resizeImageSourceToDataUrl(sourceImage, maxDimension, quality);
  };

  const resizeImageFromObjectUrlToDataUrl = async (
    objectUrl: string,
    maxDimension: number = 512,
    quality: number = 0.82
  ): Promise<string> => {
    const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode preview image fallback'));
      img.src = objectUrl;
    });
    return resizeImageSourceToDataUrl(sourceImage, maxDimension, quality);
  };

  const resizeImageSourceToBlob = (
    sourceImage: HTMLImageElement,
    maxDimension: number,
    quality: number,
    outputType: string
  ): Promise<Blob | null> =>
    new Promise((resolve) => {
      const scale = Math.min(1, maxDimension / Math.max(sourceImage.width, sourceImage.height));
      const width = Math.max(1, Math.round(sourceImage.width * scale));
      const height = Math.max(1, Math.round(sourceImage.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(sourceImage, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), outputType, quality);
    });

  const optimizeImageForUpload = async (
    file: File,
    maxDimension: number,
    quality: number,
    maxBytes: number
  ): Promise<File> => {
    // Preserve compatibility for already-light files and formats where re-encoding is risky.
    if (file.size <= maxBytes) {
      return file;
    }
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return file;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode image for optimization'));
        img.src = objectUrl;
      });

      try {
        const preferredType =
          file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
            ? file.type
            : 'image/jpeg';
        const optimizedBlob = await resizeImageSourceToBlob(sourceImage, maxDimension, quality, preferredType);
        if (!optimizedBlob || optimizedBlob.size === 0 || optimizedBlob.size >= file.size) {
          return file;
        }

        const extension =
          preferredType === 'image/png'
            ? 'png'
            : preferredType === 'image/webp'
            ? 'webp'
            : 'jpg';
        const originalBase = file.name.replace(/\.[^/.]+$/, '');
        return new File([optimizedBlob], `${originalBase}.${extension}`, { type: preferredType });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      console.warn('Image optimization skipped:', error);
      return file;
    }
  };

  const retryCompanyLogoSave = async (companyId: string, logoUrl: string): Promise<Awaited<ReturnType<typeof db.updateCompany>>> => {
    let last: Awaited<ReturnType<typeof db.updateCompany>> = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      last = await withTimeout(db.updateCompany(companyId, { logo_url: logoUrl }), 12000, 'Company logo save');
      if (last?.logo_url) return last;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return last;
  };

  const retryAvatarSave = async (avatarUrl: string): Promise<{ error: Error | null }> => {
    let last: { error: Error | null } = { error: new Error('Unknown avatar save failure') };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      last = await withTimeout(updateProfile({ avatar_url: avatarUrl }), 12000, 'Profile avatar save');
      if (!last.error) return last;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return last;
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const getReadableError = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;

    if (error && typeof error === 'object') {
      const maybeMessage = (error as any).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;

      const maybeStatus = (error as any).status || (error as any).statusCode;
      const maybeName = (error as any).name;
      const summary = [maybeName, maybeStatus ? `status ${maybeStatus}` : '']
        .filter(Boolean)
        .join(' | ');

      try {
        const raw = JSON.stringify(error);
        return summary ? `${summary} | ${raw}` : raw;
      } catch {
        return summary || 'Unknown object error';
      }
    }

    return 'Unknown error';
  };

  const isFileReadError = (message: string): boolean =>
    /I\/O read operation failed|NotReadableError|Failed to read image fallback|Failed to decode image fallback|WebKitBlobResource|Browser could not read the selected file/i.test(message);

  const readErrorHint = 'Browser could not read this image file. Use Save URL below, or export the image as JPG/PNG and re-upload.';

  const handleCompanyLogoPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    await handleCompanyLogoChange({ target: { files: [file], value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleAvatarPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    await handleProfileAvatarChange({ target: { files: [file], value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleSaveProfile = async () => {
    if (profile) {
      try {
        const { error } = await updateProfile({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
        });
        if (error) {
          throw error;
        }

        setEditingProfile(false);
        toast.success("Profile updated successfully");
      } catch (error) {
        toast.error('Failed to update profile');
        console.error('Profile update error:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  const handleStartFreshWorkspace = async () => {
    if (!profile?.id || !profile?.email) {
      toast.error('You must be signed in to start fresh');
      return;
    }

    const confirmed = window.confirm(
      'Start fresh with a brand new company workspace? This will switch your profile to a new company and initialize default settings.'
    );
    if (!confirmed) return;

    setIsStartingFresh(true);
    try {
      const { data: newCompanyId, error: startFreshError } = await withTimeout(
        supabase.rpc('start_fresh_workspace'),
        15000,
        'Start fresh workspace'
      );

      if (startFreshError || !newCompanyId) {
        throw startFreshError || new Error('Failed to create new company workspace');
      }

      const profileUpdate = await updateProfile({ company_id: newCompanyId as string });
      if (profileUpdate.error) {
        throw profileUpdate.error;
      }

      await ensureDefaultLeadSources(newCompanyId as string);

      dispatch({ type: 'SET_COMPANY_ID', payload: newCompanyId as string });
      dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
      window.dispatchEvent(new Event('crm-company-updated'));
      toast.success('Fresh workspace created. You are now in a brand-new company.');
    } catch (error) {
      console.error('Start fresh workspace error:', error);
      toast.error('Failed to start fresh workspace: ' + getReadableError(error));
    } finally {
      setIsStartingFresh(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile?.id) {
      toast.error('You must be signed in');
      return;
    }

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm account deletion');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) {
        throw error;
      }

      await signOut();
      toast.success('Your account has been deleted');
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(
        'Account deletion requires a server-side function. For now, use "Start fresh workspace" or contact admin to run account deletion.'
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const isValidImageUrl = (value: string): boolean =>
    /^https?:///i.test(value) || /^data:image//i.test(value);

  const handleSaveCompanyLogoUrl = async () => {
    const companyId = effectiveCompanyId || await resolveCompanyId();
    if (!companyId) {
      toast.error('No company context available. Please refresh and sign in again.');
      return;
    }

    const value = companyLogoUrlInput.trim();
    if (value && !isValidImageUrl(value)) {
      toast.error('Enter a valid image URL (https://... or data:image/...)');
      return;
    }

    setIsSavingLogoUrl(true);
    try {
      const updated = await withTimeout(db.updateCompany(companyId, { logo_url: value || null }), 12000, 'Save company logo URL');
      if (!updated) {
        toast.error('Failed to save company logo URL');
        return;
      }
      setCompanyLogo(value || null);
      window.dispatchEvent(new Event('crm-company-updated'));
      toast.success(value ? 'Company logo URL saved' : 'Company logo cleared');
    } catch (error) {
      toast.error('Failed to save company logo URL: ' + getReadableError(error));
    } finally {
      setIsSavingLogoUrl(false);
    }
  };

  const handleSaveAvatarUrl = async () => {
    const value = profileAvatarUrlInput.trim();
    if (value && !isValidImageUrl(value)) {
      toast.error('Enter a valid image URL (https://... or data:image/...)');
      return;
    }

    setIsSavingAvatarUrl(true);
    try {
      const { error } = await withTimeout(updateProfile({ avatar_url: value || null }), 12000, 'Save profile avatar URL');
      if (error) {
        throw error;
      }
      setProfileAvatar(value || null);
      toast.success(value ? 'Profile photo URL saved' : 'Profile photo cleared');
    } catch (error) {
      toast.error('Failed to save profile photo URL: ' + getReadableError(error));
    } finally {
      setIsSavingAvatarUrl(false);
    }
  };

  const handleCompanyLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previousLogo = companyLogo;
    let previewUrl: string | null = null;

    // Validate file
    const validationError = validateImageFile(file, 5);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploadingLogo(true);

    try {
      const companyId = effectiveCompanyId || await resolveCompanyId();

      if (!companyId) {
        toast.error('No company context available. Please refresh and sign in again.');
        setCompanyLogo(previousLogo);
        return;
      }

      // Non-blocking preview: do not fail upload if preview creation fails.
      try {
        previewUrl = URL.createObjectURL(file);
        setCompanyLogo(previewUrl);
      } catch (previewError) {
        console.warn('Logo preview creation failed:', previewError);
      }

      const uploadFile = await optimizeImageForUpload(file, 900, 0.84, 450 * 1024);

      // Upload to Supabase if user has company
      if (companyId) {
        const result = await withTimeout(uploadCompanyLogo(uploadFile, companyId), 25000, 'Company logo upload');

        if (result.error) {
          try {
            const fallbackDataUrl =
              previewUrl && previewUrl.startsWith('blob:')
                ? await resizeImageFromObjectUrlToDataUrl(previewUrl, 520, 0.84)
                : await resizeImageToDataUrl(file, 520, 0.84);
            const fallbackSave = await withTimeout(db.updateCompany(companyId, { logo_url: fallbackDataUrl }), 12000, 'Company logo fallback save');
            if (!fallbackSave?.logo_url) throw new Error('Fallback save did not persist');
            setCompanyLogo(fallbackSave.logo_url);
            setCompanyLogoUrlInput(fallbackSave.logo_url);
            window.dispatchEvent(new Event('crm-company-updated'));
            toast.success('Logo saved using compatibility mode');
            return;
          } catch (fallbackError) {
            const fallbackMessage = getReadableError(fallbackError);
            if (isFileReadError(result.error) && isFileReadError(fallbackMessage)) {
              toast.error(readErrorHint);
            } else {
              toast.error(`Upload failed: ${result.error} | fallback failed: ${fallbackMessage}`);
            }
            setCompanyLogo(previousLogo);
            return;
          }
        } else {
          // Persist logo URL in company profile.
          const updatedCompany = await retryCompanyLogoSave(companyId, result.url);
          if (!updatedCompany?.logo_url) {
            setCompanyLogo(previousLogo);
            toast.error('Logo uploaded, but failed to persist to company profile');
            return;
          }

          setCompanyLogo(updatedCompany.logo_url);
          setCompanyLogoUrlInput(updatedCompany.logo_url);
          window.dispatchEvent(new Event('crm-company-updated'));
          toast.success('Logo uploaded and saved successfully');
        }
      } else {
        toast.error('No company context available. Please refresh and sign in again.');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      const message = getReadableError(error);

      try {
        const companyId = effectiveCompanyId || await resolveCompanyId();
        if (companyId) {
          const fallbackDataUrl = await withTimeout(
            previewUrl && previewUrl.startsWith('blob:')
              ? resizeImageFromObjectUrlToDataUrl(previewUrl, 520, 0.84)
              : resizeImageToDataUrl(file, 520, 0.84),
            12000,
            'Company logo fallback encode'
          );
          const fallbackSave = await withTimeout(db.updateCompany(companyId, { logo_url: fallbackDataUrl }), 12000, 'Company logo fallback save');
          if (fallbackSave?.logo_url) {
            setCompanyLogo(fallbackSave.logo_url);
            setCompanyLogoUrlInput(fallbackSave.logo_url);
            window.dispatchEvent(new Event('crm-company-updated'));
            toast.success('Logo saved using compatibility mode');
          } else {
            throw new Error('Fallback save did not persist');
          }
        } else {
          throw new Error('No company context available');
        }
      } catch (fallbackError) {
        const fallbackMessage = getReadableError(fallbackError);
        if (isFileReadError(message) || isFileReadError(fallbackMessage)) {
          toast.error(readErrorHint);
        } else {
          toast.error(`Failed to upload logo: ${message} | fallback failed: ${fallbackMessage}`);
        }
        setCompanyLogo(previousLogo);
      }
    } finally {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // ignore blob URL revoke errors
        }
      }
      e.target.value = '';
      setIsUploadingLogo(false);
    }
  };

  const handleProfileAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previousAvatar = profileAvatar;
    let previewUrl: string | null = null;

    // Validate file
    const validationError = validateImageFile(file, 2);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create preview immediately (non-blocking)
      try {
        previewUrl = URL.createObjectURL(file);
        setProfileAvatar(previewUrl);
      } catch (previewError) {
        console.warn('Avatar preview creation failed:', previewError);
      }

      const uploadFile = await optimizeImageForUpload(file, 640, 0.82, 280 * 1024);

      // Upload to Supabase if user is authenticated
      if (profile?.id) {
        const result = await withTimeout(uploadUserAvatar(uploadFile, profile.id), 25000, 'Profile avatar upload');
        
        if (result.error) {
          if (isFileReadError(result.error)) {
            toast.error(readErrorHint);
            setProfileAvatar(profile.avatar_url || null);
            return;
          }

          try {
            const fallbackDataUrl = await resizeImageToDataUrl(file, 400, 0.82);
            const { error: fallbackErr } = await withTimeout(updateProfile({ avatar_url: fallbackDataUrl }), 12000, 'Profile avatar fallback save');
            if (fallbackErr) throw fallbackErr;
            setProfileAvatar(fallbackDataUrl);
            setProfileAvatarUrlInput(fallbackDataUrl);
            toast.success('Avatar saved using compatibility mode');
          } catch (fallbackError) {
            toast.error(`Upload failed: ${result.error} | fallback failed: ${getReadableError(fallbackError)}`);
            setProfileAvatar(profile.avatar_url || null);
          }
        } else {
          setProfileAvatar(result.url);
          
          // Update profile with new avatar URL
          try {
            const { error } = await retryAvatarSave(result.url);
            if (error) {
              throw error;
            }

            setProfileAvatar(result.url);
            setProfileAvatarUrlInput(result.url);
            toast.success("Avatar uploaded and saved successfully");
          } catch (updateError) {
            console.error('Failed to update profile with new avatar:', updateError);
            setProfileAvatar(previousAvatar || profile.avatar_url || null);
            toast.error(`Avatar uploaded but failed to save to profile: ${getReadableError(updateError)}`);
          }
        }
      } else {
        toast.success('Avatar preview loaded (sign in to persist)');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      const message = getReadableError(error);
      if (isFileReadError(message)) {
        toast.error(readErrorHint);
        setProfileAvatar(profile?.avatar_url || null);
        return;
      }

      try {
        const fallbackDataUrl = await withTimeout(resizeImageToDataUrl(file, 400, 0.82), 12000, 'Profile avatar fallback encode');
        const { error: fallbackErr } = await withTimeout(updateProfile({ avatar_url: fallbackDataUrl }), 12000, 'Profile avatar fallback save');
        if (fallbackErr) throw fallbackErr;
        setProfileAvatar(fallbackDataUrl);
        setProfileAvatarUrlInput(fallbackDataUrl);
        toast.success('Avatar saved using compatibility mode');
      } catch (fallbackError) {
        const fallbackMessage = getReadableError(fallbackError);
        if (isFileReadError(message) || isFileReadError(fallbackMessage)) {
          toast.error(readErrorHint);
        } else {
          toast.error(`Failed to upload avatar: ${message} | fallback failed: ${fallbackMessage}`);
        }
        setProfileAvatar(profile?.avatar_url || null);
      }
    } finally {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // ignore blob URL revoke errors
        }
      }
      e.target.value = '';
      setIsUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (!isUploadingLogo) return;

    const timer = window.setTimeout(() => {
      setIsUploadingLogo(false);
      toast.error('Logo upload is taking too long. Please try again.');
    }, 35000);

    return () => window.clearTimeout(timer);
  }, [isUploadingLogo]);

  useEffect(() => {
    if (!isUploadingAvatar) return;

    const timer = window.setTimeout(() => {
      setIsUploadingAvatar(false);
      toast.error('Avatar upload is taking too long. Please try again.');
    }, 35000);

    return () => window.clearTimeout(timer);
  }, [isUploadingAvatar]);

  const tabs = [
    { id: 'company', label: 'Company', icon: <Building2 size={18} /> },
    { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
    { id: 'integrations', label: 'Integrations', icon: <Link size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
    { id: 'api', label: 'API Access', icon: <Key size={18} /> },
  ];

  useEffect(() => {
    const onOpenSettingsTab = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: SettingsTab }>;
      const requestedTab = customEvent.detail?.tab;
      if (requestedTab) {
        setActiveTab(requestedTab);
      }
    };

    window.addEventListener('crm-open-settings-tab', onOpenSettingsTab);
    return () => window.removeEventListener('crm-open-settings-tab', onOpenSettingsTab);
  }, []);

  const integrationLinks: Record<string, string> = {
    QuickBooks: 'https://quickbooks.intuit.com/',
    Twilio: 'https://www.twilio.com/',
    'Google Calendar': 'https://calendar.google.com/',
    EagleView: 'https://www.eagleview.com/',
    Stripe: 'https://stripe.com/',
    DocuSign: 'https://www.docusign.com/',
    ScopeMGR: 'https://crm-kanban-integrate.vercel.app/',
    Zapier: 'https://zapier.com/',
  };

  const integrations = [
    {
      name: 'QuickBooks',
      description: 'Sync invoices, payments, and financial data',
      icon: '💰',
      connected: false,
      category: 'Accounting',
    },
    {
      name: 'Twilio',
      description: 'Send and receive SMS messages',
      icon: '📱',
      connected: true,
      category: 'Communication',
    },
    {
      name: 'Google Calendar',
      description: 'Sync appointments and scheduling',
      icon: '📅',
      connected: true,
      category: 'Calendar',
    },
    {
      name: 'EagleView',
      description: 'Aerial roof measurements and reports',
      icon: '🦅',
      connected: false,
      category: 'Measurements',
    },
    {
      name: 'Stripe',
      description: 'Process payments and subscriptions',
      icon: '💳',
      connected: false,
      category: 'Payments',
    },
    {
      name: 'DocuSign',
      description: 'Electronic signatures for contracts',
      icon: '✍️',
      connected: false,
      category: 'Documents',
    },
    {
      name: 'ScopeMGR',
      description: 'Mobile app for photo and customer documentation',
      icon: '📸',
      connected: true,
      category: 'Field Tools',
    },
    {
      name: 'Zapier',
      description: 'Connect with 5,000+ apps',
      icon: '⚡',
      connected: false,
      category: 'Automation',
    },
  ];

  return (
    <div className="h-full flex">
      {/* Hidden file inputs */}
      <input
        ref={companyLogoInputRef}
        type="file"
        accept="image/*"
        onChange={handleCompanyLogoChange}
        className="hidden"
        disabled={isUploadingLogo}
      />
      <input
        ref={profileAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleProfileAvatarChange}
        className="hidden"
        disabled={isUploadingAvatar}
      />

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 px-3">Settings</h2>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'company' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Company Profile</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    {isUploadingLogo ? (
                      <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                      </div>
                    ) : companyLogo ? (
                      <img
                        src={companyLogo}
                        alt="Company logo"
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Building2 className="text-white" size={36} />
                      </div>
                    )}
                    {!isUploadingLogo && (
                      <button
                        onClick={() => companyLogoInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        disabled={isUploadingLogo}
                      >
                        <Upload className="text-white" size={24} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{companyForm.name}</h4>
                    <p className="text-gray-500">Premium roofing and restoration services</p>
                    <button
                      onClick={() => companyLogoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Change Logo
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Max 5MB • JPG, PNG, GIF, WebP</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="url"
                        value={companyLogoUrlInput}
                        onChange={(e) => setCompanyLogoUrlInput(e.target.value)}
                        placeholder="Or paste logo image URL"
                        className="w-72 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <button
                        onClick={handleSaveCompanyLogoUrl}
                        disabled={isSavingLogoUrl}
                        className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                      >
                        {isSavingLogoUrl ? 'Saving...' : 'Save URL'}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 gap-6"
                  onPaste={handleCompanyLogoPaste}
                  title="Paste an image here to upload the company logo"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Phone
                    </label>
                    <input
                      type="tel"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Email
                    </label>
                    <input
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveCompany}
                  disabled={isSavingCompany}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingCompany ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lead Sources */}
            {canManageSources && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Lead Sources</h3>
                  <button
                    onClick={() => setShowAddLeadSource(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    Add Source
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {allLeadSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            source.isCustom ? 'bg-purple-500' : 'bg-blue-500'
                          }`}
                        />
                        <span className="font-medium text-gray-900">{source.name}</span>
                        {source.isCustom && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            Custom
                          </span>
                        )}
                      </div>
                      {source.isCustom && (
                        <button
                          onClick={async () => {
                            try {
                              if (effectiveCompanyId) {
                                const ok = await db.deleteLeadSource(source.id);
                                if (!ok) {
                                  toast.error('Failed to delete lead source');
                                  return;
                                }
                              }

                              dispatch({ type: 'DELETE_LEAD_SOURCE', payload: source.id });
                              toast.success('Lead source deleted');
                            } catch (error) {
                              console.error('Error deleting lead source:', error);
                              toast.error('Failed to delete lead source');
                            }
                          }}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {showAddLeadSource && (
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="text"
                      value={newLeadSource}
                      onChange={(e) => setNewLeadSource(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLeadSource()}
                      placeholder="Enter lead source name..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleAddLeadSource}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setShowAddLeadSource(false);
                        setNewLeadSource('');
                      }}
                      className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">My Profile</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div
                  className="flex items-center gap-6"
                  onPaste={handleAvatarPaste}
                  title="Paste an image here to upload your avatar"
                >
                  <div className="relative group">
                    {isUploadingAvatar ? (
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                      </div>
                    ) : profileAvatar ? (
                      <img
                        src={profileAvatar}
                        alt="Profile avatar"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {profile?.first_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                        {profile?.last_name?.[0]?.toUpperCase() || ''}
                      </div>
                    )}
                    {!isUploadingAvatar && (
                      <button
                        onClick={() => profileAvatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        <Upload className="text-white" size={24} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {profile?.first_name && profile?.last_name 
                        ? `${profile.first_name} ${profile.last_name}`
                        : profile?.email || 'User'}
                    </h4>
                    <p className="text-gray-500">{profile?.email}</p>
                    <p className="text-sm text-gray-400 capitalize mt-1">{profile?.role || 'User'}</p>
                    <button
                      onClick={() => profileAvatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Change Photo
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Max 2MB • JPG, PNG, GIF, WebP</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="url"
                        value={profileAvatarUrlInput}
                        onChange={(e) => setProfileAvatarUrlInput(e.target.value)}
                        placeholder="Or paste profile image URL"
                        className="w-72 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <button
                        onClick={handleSaveAvatarUrl}
                        disabled={isSavingAvatarUrl}
                        className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                      >
                        {isSavingAvatarUrl ? 'Saving...' : 'Save URL'}
                      </button>
                    </div>
                  </div>
                </div>

                {editingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.first_name}
                          onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.last_name}
                          onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveProfile}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Save size={18} />
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingProfile(false)}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setProfileForm({
                        first_name: profile?.first_name || '',
                        last_name: profile?.last_name || '',
                      });
                      setEditingProfile(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Edit2 size={18} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-4xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Integrations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                        <span className="text-xs text-gray-400">{integration.category}</span>
                      </div>
                    </div>
                    {integration.connected && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{integration.description}</p>
                  <button
                    onClick={() => {
                      const url = integrationLinks[integration.name];
                      if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                        return;
                      }

                      toast.info(
                        integration.connected
                          ? `Manage ${integration.name} integration`
                          : `Connect ${integration.name} integration`
                      );
                    }}
                    className={`w-full py-2 rounded-lg font-medium transition-colors ${
                      integration.connected
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {integration.connected ? 'Manage' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Security & Account</h3>
              <p className="text-sm text-gray-500">
                Manage your session and account lifecycle actions.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">Session</h4>
              <p className="text-sm text-gray-500">
                Log out from this device. You can sign back in at any time.
              </p>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">Start Fresh</h4>
              <p className="text-sm text-gray-500">
                Create a new empty company workspace and move your user to it. This is the safest way to restart setup without deleting your login.
              </p>
              <button
                onClick={handleStartFreshWorkspace}
                disabled={isStartingFresh}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStartingFresh ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {isStartingFresh ? 'Creating new workspace...' : 'Start fresh workspace'}
              </button>
            </div>

            <div className="bg-red-50 rounded-xl border border-red-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle size={16} />
                Delete Account
              </h4>
              <p className="text-sm text-red-700">
                Permanent delete requires a backend function (`delete_my_account`) with elevated Supabase permissions.
              </p>
              <div>
                <label className="block text-sm font-medium text-red-800 mb-1">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full max-w-sm px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                />
              </div>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingAccount ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isDeletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        )}

        {/* Add other tabs here if needed - notifications, security, billing, api */}
      </div>
    </div>
  );
}
