import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCRM, canManageLeadSources } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { defaultLeadSources } from '@/lib/crmData';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { uploadCompanyLogo, uploadUserAvatar, validateImageFile } from '@/lib/storage';
import useIntegrations from '@/hooks/useIntegrations';
import IntegrationConfigDialog from '@/components/IntegrationConfigDialog';
import AIConfigDialog from '@/components/AIConfigDialog';
import { formatPhoneNumber } from '@/lib/utils';
import AIApprovalPanel from '@/components/AIApprovalPanel';
import SubscriptionView from '@/components/crm/SubscriptionView';
import FeatureToggles from '@/components/crm/FeatureToggles';
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
  FilePlus,
  User,
  Upload,
  Loader2,
  LogOut,
  AlertTriangle,
  RotateCcw,
  AlertCircle,
  Zap,
  Target,
  DollarSign,
  Receipt,
  ToggleLeft,
  Eye,
  EyeOff,
  Send,
  Server,
} from 'lucide-react';
import { supabase, isDemoMode } from '@/lib/supabase';
import { ensureDefaultLeadSources } from '@/lib/setupCompany';
import ImageCropDialog from '@/components/ui/ImageCropDialog';
import DocumentTemplates from '@/components/crm/DocumentTemplates';

type SettingsTab = 'company' | 'profile' | 'integrations' | 'ai-assistant' | 'notifications' | 'security' | 'billing' | 'customer-billing' | 'api' | 'features' | 'document-templates';

interface CompanyFormData {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tagline: string;
  contractor_license: string;
  tax_id: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
}

function normalizeCompanyName(rawName?: string | null, email?: string | null): string {
  const trimmed = (rawName || '').trim();
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (trimmed && !emailLike.test(trimmed)) {
    return trimmed;
  }

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

export default function SettingsView() {
  const { state, dispatch } = useCRM();
  const { profile, user, updateProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [newLeadSource, setNewLeadSource] = useState('');
  const [showAddLeadSource, setShowAddLeadSource] = useState(false);
  const [isSavingLeadSource, setIsSavingLeadSource] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Integration hooks
  const {
    integrations,
    integrationsByCategory,
    configureIntegration,
    toggleIntegration,
    testIntegration,
    syncIntegration,
  } = useIntegrations();

  // Integration UI state
  const [selectedIntegration, setSelectedIntegration] = useState<any | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  
  // AI Assistant state
  const [aiConfigDialogOpen, setAiConfigDialogOpen] = useState(false);
  
  // Company form state - will be populated from database
  const [companyForm, setCompanyForm] = useState<CompanyFormData>({
    name: 'Loading...',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    tagline: '',
    contractor_license: '',
    tax_id: '',
    from_email: '',
    from_name: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: false,
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
  
  // Image crop dialog state
  const [avatarCropDialogOpen, setAvatarCropDialogOpen] = useState(false);
  const [logoCropDialogOpen, setLogoCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  
  // Refs for file inputs
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const userRole = (state.currentUser?.role || profile?.role || 'owner') as any;
  const canManageSources = canManageLeadSources(userRole);
  const effectiveCompanyId = profile?.company_id || state.companyId || null;

  const resolveCompanyId = useCallback(async (): Promise<string | null> => {
    const currentCompanyId = profile?.company_id || state.companyId || null;
    if (currentCompanyId) return currentCompanyId;

    const userId = profile?.id || user?.id;
    if (!userId) {
      console.warn('No user ID available for company lookup');
      return null;
    }

    try {
      // Try to fetch the profile with company_id
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

      // If no company_id found, try to create one automatically
      const userEmail = user?.email || profile?.email || '';
      
      if (userEmail) {
        const { setupNewUser } = await import('@/lib/setupCompany');
        const setupSuccess = await setupNewUser(userId, userEmail);
        
        if (setupSuccess) {
          // Fetch the profile again to get the new company_id
          const retryResult = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', userId)
            .single();
          
          if (retryResult.data?.company_id) {
            dispatch({ type: 'SET_COMPANY_ID', payload: retryResult.data.company_id });
            return retryResult.data.company_id;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('resolveCompanyId error:', error);
      return state.companyId || null;
    }
  }, [dispatch, profile?.company_id, profile?.id, profile?.email, state.companyId, user?.id, user?.email]);

  // Combine default and custom lead sources
  const allLeadSources = [...defaultLeadSources, ...state.leadSources.filter((ls) => ls.isCustom)];

  // Load company data on mount and recover missing company context if needed.
  useEffect(() => {
    let cancelled = false;

    const loadCompanyData = async () => {
      setIsLoadingCompany(true);
      
      // Force a visible log
      
      try {
        const companyId = effectiveCompanyId || await resolveCompanyId();
        
        
        if (!companyId) {
          console.warn('[Settings] ❌ No company ID available, cannot load company data');
          // Don't show an error toast on initial mount — the profile may still be loading.
          // Only warn if we've been waiting a while.
          return;
        }

        // getCompany already has internal 5-s timeouts per path + cache fallback
        const company = await withTimeout(db.getCompany(companyId), 15000, 'Load company profile');
        
        
        if (company && !cancelled) {
          const companyName = normalizeCompanyName(company.name, company.email);
          setCompanyForm({
            name: companyName,
            phone: company.phone || '',
            email: company.email || '',
            website: company.website || '',
            address: company.address || '',
            city: company.city || '',
            state: company.state || '',
            zip: company.zip || '',
            tagline: company.tagline || '',
            contractor_license: company.contractor_license || '',
            tax_id: company.tax_id || '',
            from_email: company.from_email || '',
            from_name: company.from_name || '',
            smtp_host: company.smtp_host || '',
            smtp_port: String(company.smtp_port || 587),
            smtp_user: company.smtp_user || '',
            smtp_pass: company.smtp_pass || '',
            smtp_secure: company.smtp_secure ?? false,
          });
          if (company.logo_url && !company.logo_url.startsWith('blob:')) {
            setCompanyLogo(company.logo_url);
            setCompanyLogoUrlInput(company.logo_url);
          } else {
            setCompanyLogo(null);
            setCompanyLogoUrlInput('');
          }
          toast.success('Company data loaded');
        } else if (!company) {
          console.warn('[Settings] ❌ No company found in database for ID:', companyId);
          toast.error('Company not found in database');
        }
      } catch (error) {
        console.error('[Settings] ❌ Error loading company data:', error);
        toast.error('Failed to load company data: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

    setIsSavingLeadSource(true);
    try {
      const companyId = effectiveCompanyId || await resolveCompanyId();
      if (!companyId) {
        toast.error('Unable to find your company. Your account may need to be set up. Please sign out and sign back in.');
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
    } finally {
      setIsSavingLeadSource(false);
    }
  };

  const handleSaveCompany = async () => {
    const companyId = effectiveCompanyId || await resolveCompanyId();

    if (!companyId) {
      toast.error('Unable to find your company. Your account may need to be set up. Please sign out and sign back in.');
      return;
    }

    setIsSavingCompany(true);

    try {
      const result = await withTimeout(
        db.updateCompany(companyId, {
          name: companyForm.name,
          phone: companyForm.phone,
          email: companyForm.email,
          website: companyForm.website,
          address: companyForm.address,
          city: companyForm.city,
          state: companyForm.state,
          zip: companyForm.zip,
          tagline: companyForm.tagline,
          contractor_license: companyForm.contractor_license,
          tax_id: companyForm.tax_id,
          from_email: companyForm.from_email,
          from_name: companyForm.from_name,
        }),
        15000,
        'Save company profile'
      );

      if (result) {
        window.dispatchEvent(new Event('crm-company-updated'));
        toast.success('Company profile saved successfully!');
      } else {
        toast.error('Failed to save company profile');
      }
    } catch (error) {
      console.error('Save company error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save company profile';
      toast.error(errorMessage);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSaveSmtp = async () => {
    const companyId = effectiveCompanyId || await resolveCompanyId();
    if (!companyId) { toast.error('Unable to find your company.'); return; }
    setIsSavingSmtp(true);
    try {
      const ok = await db.updateSmtpSettings(companyId, {
        smtp_host: companyForm.smtp_host || undefined,
        smtp_port: companyForm.smtp_port ? parseInt(companyForm.smtp_port, 10) : undefined,
        smtp_user: companyForm.smtp_user || undefined,
        smtp_pass: companyForm.smtp_pass || undefined,
        smtp_secure: companyForm.smtp_secure,
      });
      if (ok) toast.success('SMTP settings saved.');
      else toast.error('Failed to save SMTP settings.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save SMTP settings.');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    try {
      const { sendEmail } = await import('@/lib/emailApi');
      await sendEmail({
        to: profile?.email || user?.email || '',
        subject: 'SMTP Test — CRM',
        html: '<p>Your custom SMTP settings are working correctly.</p>',
      });
      toast.success('Test email sent! Check your inbox.');
    } catch (err) {
      toast.error(`Test failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTestingSmtp(false);
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

  const buildLogoFallbackDataUrl = async (
    file: File,
    previewUrl: string | null,
    maxDimension: number = 520,
    quality: number = 0.84
  ): Promise<string> => {
    // Prefer direct file read first to avoid WebKit blob URL decode instability.
    try {
      return await resizeImageToDataUrl(file, maxDimension, quality);
    } catch (fileReadError) {
      console.warn('Logo file-read fallback failed, trying preview decode path:', fileReadError);
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      return resizeImageFromObjectUrlToDataUrl(previewUrl, maxDimension, quality);
    }

    throw new Error('Failed to build logo fallback image');
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

  const saveCompanyLogoUrl = async (companyId: string, logoUrl: string | null): Promise<{ logo_url: string | null }> => {
    // In demo mode, save logo locally without hitting Supabase
    if (isDemoMode) {
      try {
        // Store in localStorage for persistence across demo sessions
        const demoCompanyKey = `demo_company_${companyId}`;
        const existing = localStorage.getItem(demoCompanyKey);
        const companyData = existing ? JSON.parse(existing) : {};
        companyData.logo_url = logoUrl;
        companyData.updated_at = new Date().toISOString();
        localStorage.setItem(demoCompanyKey, JSON.stringify(companyData));
        return { logo_url: logoUrl };
      } catch (error) {
        console.warn('[Settings] Failed to save logo to localStorage:', error);
        // Even if localStorage fails, return success with the URL so UI updates
        return { logo_url: logoUrl };
      }
    }

    const tryDirect = async () => {
      // Try RPC first (bypasses RLS)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('update_my_company', {
          p_logo_url: logoUrl,
        });
        if (!rpcError && rpcData) {
          return { logo_url: (rpcData as any).logo_url || logoUrl };
        }
      } catch (e) {
        console.warn('[Settings] update_my_company RPC for logo failed, trying direct:', e);
      }

      // Fallback: direct table update
      const { data, error } = await supabase
        .from('companies')
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', companyId)
        .select('logo_url')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Company logo save did not persist');
      return { logo_url: data.logo_url || null };
    };

    try {
      return await tryDirect();
    } catch (directError) {
      // Last-resort RPC path for environments with stricter company update policies.
      const { data: rpcData, error: rpcError } = await supabase.rpc('set_my_company_logo', {
        p_logo_url: logoUrl,
      });
      if (rpcError) throw directError;
      return { logo_url: (rpcData as string | null) || null };
    }
  };

  const retryCompanyLogoSave = async (companyId: string, logoUrl: string): Promise<{ logo_url: string | null } | null> => {
    let last: { logo_url: string | null } | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      last = await withTimeout(saveCompanyLogoUrl(companyId, logoUrl), 12000, 'Company logo save');
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
      // Add timeout to prevent hanging
      const logoutPromise = signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 5000)
      );
      
      await Promise.race([logoutPromise, timeoutPromise]);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, force logout by redirecting
      const basePath = import.meta.env.BASE_URL || '/';
      window.location.replace(basePath);
    }
  };

  const handleStartFreshWorkspace = () => {
    if (!profile?.id || !profile?.email) {
      toast.error('You must be signed in to start fresh');
      return;
    }

    toast.warning(
      'Start fresh with a brand new company workspace? This will switch your profile to a new company and initialize default settings.',
      {
        action: {
          label: 'Start Fresh',
          onClick: async () => {
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
          },
        },
        cancel: { label: 'Cancel' },
        duration: 10000,
      }
    );
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
      toast.error('Unable to find your company. Your account may need to be set up. Please sign out and sign back in.');
      return;
    }

    const value = companyLogoUrlInput.trim();
    if (value && !isValidImageUrl(value)) {
      toast.error('Enter a valid image URL (https://... or data:image/...)');
      return;
    }

    setIsSavingLogoUrl(true);
    try {
      const updated = await withTimeout(saveCompanyLogoUrl(companyId, value || null), 12000, 'Save company logo URL');
      if (!updated) {
        toast.error('Failed to save company logo URL');
        return;
      }
      setCompanyLogo(updated.logo_url || null);
      setCompanyLogoUrlInput(updated.logo_url || '');
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

    // Validate file
    const validationError = validateImageFile(file, 5);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }

    // Read as data URL (self-contained string — no blob lifecycle/revocation
    // issues, works identically in all browsers, loads reliably in <img> tags
    // even inside Radix portals and CSS-animated dialogs).
    try {
      const previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target!.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setImageToCrop(previewUrl);
      setPendingImageFile(file);
      setLogoCropDialogOpen(true);
    } catch (error) {
      console.error('Failed to create preview:', error);
      toast.error('Failed to load image for cropping');
    }

    e.target.value = '';
  };

  const handleLogoCropComplete = async (croppedBlob: Blob) => {
    const previousLogo = companyLogo;
    let precomputedFallbackDataUrl: string | null = null;
    let compatibilitySaved = false;

    setLogoCropDialogOpen(false);
    setIsUploadingLogo(true);

    try {
      const croppedFile = new File([croppedBlob], pendingImageFile?.name || 'logo.jpg', {
        type: 'image/jpeg',
      });

      const loadingToastId = toast.loading?.('Preparing upload...') || undefined;
      const companyId = effectiveCompanyId || await resolveCompanyId();

      // Always dismiss the loading toast before any early return or continuation
      if (loadingToastId && toast.dismiss) {
        toast.dismiss(loadingToastId);
      }

      if (!companyId) {
        toast.error('Unable to find your company. Please sign out and sign back in.');
        setCompanyLogo(previousLogo);
        setIsUploadingLogo(false);
        return;
      }

      if (loadingToastId && toast.dismiss) toast.dismiss(loadingToastId);

      // Encode a compact fallback data-URL (runs locally, no network needed).
      try {
        precomputedFallbackDataUrl = await withTimeout(
          resizeImageToDataUrl(croppedFile, 520, 0.84),
          10000,
          'Company logo fallback precompute'
        );
      } catch (precomputeError) {
        console.warn('Logo fallback precompute failed:', precomputeError);
      }

      // Prepare the optimized file for storage upload while potentially running
      // the baseline DB save concurrently below.
      const uploadFile = await optimizeImageForUpload(croppedFile, 900, 0.84, 450 * 1024);

      // ── Run baseline DB save and storage upload IN PARALLEL ───────────────
      // Previously these ran sequentially (12 s + 32 s + 12 s = up to 56 s).
      // Now the user waits at most max(DB timeout, storage timeout) ≈ 15 s.
      const baselineSavePromise = precomputedFallbackDataUrl
        ? withTimeout(saveCompanyLogoUrl(companyId, precomputedFallbackDataUrl), 10000, 'Company logo baseline save')
            .then((r) => {
              if (r?.logo_url) {
                compatibilitySaved = true;
                setCompanyLogo(r.logo_url);
                setCompanyLogoUrlInput(r.logo_url);
                window.dispatchEvent(new Event('crm-company-updated'));
              }
              return r;
            })
            .catch((e) => { console.warn('Company logo baseline save failed:', e); return null; })
        : Promise.resolve(null);

      const storageUploadPromise = withTimeout(
        uploadCompanyLogo(uploadFile, companyId),
        15000,
        'Company logo upload'
      ).catch((e) => ({ url: '', path: '', error: getReadableError(e) }));

      // Wait for both to settle.
      const [storageResult] = await Promise.all([storageUploadPromise, baselineSavePromise]);

      // Storage succeeded → upgrade to CDN URL.
      if (!storageResult.error) {
        const updatedCompany = await retryCompanyLogoSave(companyId, storageResult.url);
        if (updatedCompany?.logo_url) {
          setCompanyLogo(updatedCompany.logo_url);
          setCompanyLogoUrlInput(updatedCompany.logo_url);
          window.dispatchEvent(new Event('crm-company-updated'));
          toast.success('Logo uploaded and saved successfully');
          return;
        }
      }

      // Storage failed but baseline DB save already persisted → good enough.
      if (compatibilitySaved) {
        toast.success('Logo saved successfully');
        return;
      }

      // Both failed — one final attempt to save the data-URL.
      if (precomputedFallbackDataUrl) {
        try {
          const finalSave = await withTimeout(
            saveCompanyLogoUrl(companyId, precomputedFallbackDataUrl),
            8000,
            'Company logo final save'
          );
          if (finalSave?.logo_url) {
            setCompanyLogo(finalSave.logo_url);
            setCompanyLogoUrlInput(finalSave.logo_url);
            window.dispatchEvent(new Event('crm-company-updated'));
            toast.success('Logo saved successfully');
            return;
          }
        } catch (finalErr) {
          console.warn('Company logo final save failed:', finalErr);
        }
      }

      // Everything failed.
      const uploadErr = storageResult.error || 'Upload failed';
      if (isFileReadError(uploadErr)) {
        toast.error(readErrorHint);
      } else {
        toast.error('Failed to save logo — please try again or check your connection.');
      }
      setCompanyLogo(previousLogo);

    } catch (error) {
      console.error('Logo upload error:', error);
      const message = getReadableError(error);

      if (compatibilitySaved) {
        toast.success('Logo saved successfully');
        return;
      }

      // Emergency fallback using pre-encoded data-URL.
      if (precomputedFallbackDataUrl) {
        try {
          const cid = effectiveCompanyId || await resolveCompanyId();
          if (cid) {
            const emergencySave = await withTimeout(
              saveCompanyLogoUrl(cid, precomputedFallbackDataUrl),
              8000,
              'Company logo emergency save'
            );
            if (emergencySave?.logo_url) {
              setCompanyLogo(emergencySave.logo_url);
              setCompanyLogoUrlInput(emergencySave.logo_url);
              window.dispatchEvent(new Event('crm-company-updated'));
              toast.success('Logo saved successfully');
              return;
            }
          }
        } catch (emergencyErr) {
          console.warn('Emergency save failed:', emergencyErr);
        }
      }

      if (isFileReadError(message)) {
        toast.error(readErrorHint);
      } else {
        toast.error('Failed to save logo — please try again or check your connection.');
      }
      setCompanyLogo(previousLogo);
    } finally {
      setIsUploadingLogo(false);
      setPendingImageFile(null);
      if (imageToCrop && imageToCrop.startsWith('blob:')) {
        URL.revokeObjectURL(imageToCrop);
      }
      setImageToCrop(null);
    }
  };

  const handleProfileAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validationError = validateImageFile(file, 2);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }

    // Read as data URL — same rationale as handleCompanyLogoChange above.
    try {
      const previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target!.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setImageToCrop(previewUrl);
      setPendingImageFile(file);
      setAvatarCropDialogOpen(true);
    } catch (error) {
      console.error('Failed to create preview:', error);
      toast.error('Failed to load image for cropping');
    }

    e.target.value = '';
  };

  const handleAvatarCropComplete = async (croppedBlob: Blob) => {
    const previousAvatar = profileAvatar;

    setAvatarCropDialogOpen(false);
    setIsUploadingAvatar(true);

    try {
      // Convert blob to file
      const croppedFile = new File([croppedBlob], pendingImageFile?.name || 'avatar.jpg', {
        type: 'image/jpeg',
      });

      const uploadFile = await optimizeImageForUpload(croppedFile, 640, 0.82, 280 * 1024);

      // Upload to Supabase if user is authenticated
      if (profile?.id) {
        const result = await withTimeout(uploadUserAvatar(uploadFile, profile.id), 25000, 'Profile avatar upload');
        
        if (result.error) {
          try {
            const fallbackDataUrl = await resizeImageToDataUrl(croppedFile, 400, 0.82);
            const { error: fallbackErr } = await withTimeout(updateProfile({ avatar_url: fallbackDataUrl }), 12000, 'Profile avatar fallback save');
            if (fallbackErr) throw fallbackErr;
            setProfileAvatar(fallbackDataUrl);
            setProfileAvatarUrlInput(fallbackDataUrl);
            toast.success('Avatar saved using compatibility mode');
          } catch (fallbackError) {
            const fallbackMessage = getReadableError(fallbackError);
            if (isFileReadError(result.error) && isFileReadError(fallbackMessage)) {
              toast.error(readErrorHint);
            } else {
              toast.error(`Upload failed: ${result.error} | fallback failed: ${fallbackMessage}`);
            }
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

      try {
        const fallbackDataUrl = await withTimeout(
          resizeImageToDataUrl(new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' }), 400, 0.82),
          12000,
          'Profile avatar fallback encode'
        );
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
      setIsUploadingAvatar(false);
      setPendingImageFile(null);
      if (imageToCrop && imageToCrop.startsWith('blob:')) {
        URL.revokeObjectURL(imageToCrop);
      }
      setImageToCrop(null);
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
    { id: 'features', label: 'Feature Toggles', icon: <ToggleLeft size={18} /> },
    { id: 'integrations', label: 'Integrations', icon: <Link size={18} /> },
    { id: 'ai-assistant', label: 'AI Assistant', icon: <Zap size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'billing', label: 'My Plan', icon: <CreditCard size={18} /> },
    { id: 'customer-billing', label: 'Customer Billing', icon: <Receipt size={18} /> },
    { id: 'api', label: 'API Access', icon: <Key size={18} /> },
    { id: 'document-templates', label: 'Document Templates', icon: <FilePlus size={18} /> },
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

  return (
    <div className="flex flex-col w-full h-full">
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

      {/* Main content row */}
      <div className="flex flex-1 overflow-hidden">

      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto">
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
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: formatPhoneNumber(e.target.value) })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="1234 Commerce Blvd"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={companyForm.city}
                      onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="Columbus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={companyForm.state}
                      onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="OH"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={companyForm.zip}
                      onChange={(e) => setCompanyForm({ ...companyForm, zip: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="43215"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Tagline</label>
                  <input
                    type="text"
                    value={companyForm.tagline}
                    onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Professional Storm Damage Restoration"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contractor License #</label>
                    <input
                      type="text"
                      value={companyForm.contractor_license}
                      onChange={(e) => setCompanyForm({ ...companyForm, contractor_license: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="OH-RC-2024-8812"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / EIN</label>
                    <input
                      type="text"
                      value={companyForm.tax_id}
                      onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="31-1234567"
                    />
                  </div>
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

            {/* Email Sender Settings */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Email Sender Settings</h3>

              {/* Display name + from address */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6">
                <p className="text-sm text-gray-500">
                  The name and address shown in the "From" field on all outgoing emails.
                  {!companyForm.smtp_host && ' Leave blank to use the system default.'}
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                    <input
                      type="text"
                      value={companyForm.from_name}
                      onChange={(e) => setCompanyForm({ ...companyForm, from_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder={companyForm.name || 'Your Company Name'}
                    />
                    <p className="text-xs text-gray-400 mt-1">Appears as the "from" name in customer emails</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email Address</label>
                    <input
                      type="email"
                      value={companyForm.from_email}
                      onChange={(e) => setCompanyForm({ ...companyForm, from_email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="invoices@yourdomain.com"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {companyForm.smtp_host ? 'Must match your SMTP username / sending address.' : 'Used as the display address when sending via system mail.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSaveCompany}
                  disabled={isSavingCompany}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingCompany ? <><Loader2 size={18} className="animate-spin" />Saving...</> : <><Save size={18} />Save Display Settings</>}
                </button>
              </div>

              {/* Custom SMTP */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <Server size={20} className="text-gray-500" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Custom SMTP Server</h4>
                    <p className="text-sm text-gray-500">Send emails directly from your own mail server or provider (Gmail, Outlook, SendGrid, etc.). Leave blank to use the system default.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={companyForm.smtp_host}
                      onChange={(e) => setCompanyForm({ ...companyForm, smtp_host: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={companyForm.smtp_port}
                      onChange={(e) => setCompanyForm({ ...companyForm, smtp_port: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="587"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={companyForm.smtp_user}
                      onChange={(e) => setCompanyForm({ ...companyForm, smtp_user: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="you@yourdomain.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
                    <div className="relative">
                      <input
                        type={showSmtpPass ? 'text' : 'password'}
                        value={companyForm.smtp_pass}
                        onChange={(e) => setCompanyForm({ ...companyForm, smtp_pass: e.target.value })}
                        className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">For Gmail/Outlook, use an App Password — not your account password.</p>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={companyForm.smtp_secure}
                    onChange={(e) => setCompanyForm({ ...companyForm, smtp_secure: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Use SSL/TLS (port 465) — uncheck for STARTTLS (port 587)</span>
                </label>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleSaveSmtp}
                    disabled={isSavingSmtp}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingSmtp ? <><Loader2 size={18} className="animate-spin" />Saving...</> : <><Save size={18} />Save SMTP Settings</>}
                  </button>
                  <button
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp || !companyForm.smtp_host}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingSmtp ? <><Loader2 size={18} className="animate-spin" />Sending...</> : <><Send size={18} />Send Test Email</>}
                  </button>
                </div>
                {companyForm.smtp_host && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check size={13} /> Custom SMTP active — emails will be sent from your server.
                  </p>
                )}
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
                      disabled={isSavingLeadSource}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSavingLeadSource ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
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

        {activeTab === 'features' && <FeatureToggles />}

        {activeTab === 'integrations' && (
          <div className="max-w-4xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Integrations</h3>
              <p className="text-sm text-gray-500">Connect third-party services to enhance your CRM workflow.</p>
            </div>

            {Object.entries(integrationsByCategory).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-lg font-semibold text-gray-800 mb-4 capitalize">{category}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((integration) => (
                    <div
                      key={integration.id}
                      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">{integration.description}</p>
                        </div>
                        {integration.status === 'connected' && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap ml-2">
                            <Check size={12} />
                            Connected
                          </span>
                        )}
                      </div>

                      {integration.status === 'error' && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                          <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">Connection error</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setConfigDialogOpen(true);
                          }}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
                            integration.isConfigured
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {integration.isConfigured ? 'Manage' : 'Configure'}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const result = await testIntegration(integration.id);
                              if (result.success) {
                                toast.success(`${integration.name} is working!`);
                              } else {
                                toast.error(result.message);
                              }
                            } catch (error) {
                              toast.error(`Failed to test ${integration.name}`);
                            }
                          }}
                          disabled={!integration.isConfigured}
                          className="py-2 px-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Test
                        </button>
                      </div>

                      {integration.lastSync && (
                        <p className="text-xs text-gray-400 mt-2">
                          Last synced: {new Date(integration.lastSync).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h4 className="font-semibold text-blue-900 mb-2">Need help?</h4>
              <p className="text-sm text-blue-800 mb-4">
                Check out our integration documentation to learn how to connect and configure each service.
              </p>
              <a
                href="https://docs.example.com/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                View Documentation
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <div className="max-w-4xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Assistant</h3>
              <p className="text-sm text-gray-500">
                Configure AI providers (OpenAI, Claude, Gemini) for smart business automation
              </p>
            </div>

            {/* User Configuration */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Your AI Configuration</h4>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      Set up your own AI API key to enable AI features for your account
                    </p>
                  </div>
                  <button
                    onClick={() => setAiConfigDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Zap size={16} />
                    Add AI Configuration
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  💡 Your API key is encrypted and stored securely. Team admins must approve access.
                </p>
              </div>
            </div>

            {/* Admin Approval Panel */}
            {(state.currentUser?.role === 'admin' || state.currentUser?.role === 'owner') && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Admin Panel - Approve Access</h4>
                <AIApprovalPanel companyId={state.companyId || ''} />
              </div>
            )}

            {/* Feature Overview */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Available Features</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <Mail size={16} />
                    Email Drafting
                  </p>
                  <p className="text-sm text-gray-600">Generate professional email responses from customer inquiries</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <Users size={16} />
                    Customer Support  
                  </p>
                  <p className="text-sm text-gray-600">AI-powered chat for answering customer questions</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <Target size={16} />
                    Lead Scoring
                  </p>
                  <p className="text-sm text-gray-600">Analyze and rank leads by quality and conversion probability</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
                    <DollarSign size={16} />
                    Estimate Optimization
                  </p>
                  <p className="text-sm text-gray-600">AI-powered pricing recommendations and competitive analysis</p>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <p className="font-semibold text-blue-900 mb-2">🔒 Security & Privacy</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ API keys are encrypted before storage</li>
                <li>✓ Access requires team admin approval</li>
                <li>✓ Usage is tracked and logged</li>
                <li>✓ Team members can only use approved configurations</li>
              </ul>
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

        {activeTab === 'notifications' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Notification Settings</h3>
              <p className="text-sm text-gray-500">Configure when and how you receive notifications.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">Email Notifications</h4>
              <div className="space-y-3">
                {['New leads assigned to me', 'Estimate status changes', 'Invoice payments received', 'Appointment reminders', 'Team updates'].map((option) => (
                  <label key={option} className="flex items-center gap-3"><input type="checkbox" defaultChecked className="rounded"/><span className="text-sm">{option}</span></label>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">SMS Notifications</h4>
              <div className="space-y-3">
                {['Urgent inquiries', 'Job completion', 'Payment reminders'].map((option) => (
                  <label key={option} className="flex items-center gap-3"><input type="checkbox" className="rounded"/><span className="text-sm">{option}</span></label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MY PLAN TAB — app subscription only, deep-linked from paywall via tab: 'billing' */}
        {activeTab === 'billing' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">My Plan</h3>
              <p className="text-sm text-gray-500">Manage your TrussCTR subscription and plan details.</p>
            </div>
            <SubscriptionView />
          </div>
        )}

        {/* CUSTOMER BILLING TAB — payment gateway, invoicing, and tax settings */}
        {activeTab === 'customer-billing' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Customer Billing</h3>
              <p className="text-sm text-gray-500">Configure how you collect payments from your customers — payment gateway, invoice numbering, and tax settings.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">Payment Gateway</h4>
              <p className="text-sm text-gray-500">Select the payment processor your customers will use to pay invoices and estimates.</p>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option>Stripe</option><option>Square</option><option>PayPal</option></select>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">Invoice Settings</h4>
              <p className="text-sm text-gray-500">Customize your invoice numbering format.</p>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-2">Invoice Prefix</label><input type="text" defaultValue="INV-" className="w-full px-3 py-2 border rounded-lg"/></div><div><label className="block text-sm font-medium mb-2">Starting #</label><input type="number" defaultValue="1000" className="w-full px-3 py-2 border rounded-lg"/></div></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h4 className="text-base font-semibold text-gray-900">Tax Rate</h4>
              <p className="text-sm text-gray-500">Default tax rate applied to customer invoices and estimates.</p>
              <input type="number" step="0.01" defaultValue="7.5" className="w-full px-3 py-2 border rounded-lg" placeholder="Tax %"/>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">API Access</h3>
              <p className="text-sm text-gray-500">
                Generate API keys to integrate with external systems and custom applications.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">API Keys</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Use these keys to authenticate API requests. Keep them secure and never share them publicly.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700">Production Key</span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                      </div>
                      <code className="text-xs text-gray-600 font-mono">
                        {isDemoMode ? 'demo_••••••••••••••••••••••••••••' : 'prod_••••••••••••••••••••••••••••'}
                      </code>
                    </div>
                    <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                      Copy
                    </button>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700">Test Key</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Test Mode</span>
                      </div>
                      <code className="text-xs text-gray-600 font-mono">
                        test_••••••••••••••••••••••••••••
                      </code>
                    </div>
                    <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                      Copy
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => toast.info('Generate new API key')}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus size={16} />
                  Generate New Key
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Webhooks</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Configure webhook endpoints to receive real-time notifications about events.
                </p>
                
                <div className="space-y-2 mb-4">
                  {([] as { event: string; url: string }[]).map((webhook, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-700 mb-1">{webhook.event}</div>
                        <code className="text-xs text-gray-600 font-mono">{webhook.url}</code>
                      </div>
                      <button className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => toast.info('Add new webhook endpoint')}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  <Plus size={16} />
                  Add Webhook
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-base font-semibold text-gray-900 mb-2">API Documentation</h4>
                <p className="text-sm text-gray-500 mb-3">
                  Learn how to integrate with our REST API and explore available endpoints.
                </p>
                <a
                  href="https://docs.example.com/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                >
                  <ExternalLink size={16} />
                  View API Docs
                </a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'document-templates' && (
          <div className="w-full">
            <DocumentTemplates />
          </div>
        )}
      </div>

      {/* Image Crop Dialogs */}
      {imageToCrop && (
        <>
          <ImageCropDialog
            open={avatarCropDialogOpen}
            imageUrl={imageToCrop}
            onClose={() => {
              setAvatarCropDialogOpen(false);
              setPendingImageFile(null);
              if (imageToCrop.startsWith('blob:')) {
                URL.revokeObjectURL(imageToCrop);
              }
              setImageToCrop(null);
            }}
            onCropComplete={handleAvatarCropComplete}
            aspectRatio={1}
            title="Crop Profile Photo"
          />
          <ImageCropDialog
            open={logoCropDialogOpen}
            imageUrl={imageToCrop}
            onClose={() => {
              setLogoCropDialogOpen(false);
              setPendingImageFile(null);
              if (imageToCrop.startsWith('blob:')) {
                URL.revokeObjectURL(imageToCrop);
              }
              setImageToCrop(null);
            }}
            onCropComplete={handleLogoCropComplete}
            title="Crop Company Logo"
          />
        </>
      )}

      {/* Integration Configuration Dialog */}
      {selectedIntegration && (
        <IntegrationConfigDialog
          integration={selectedIntegration}
          isOpen={configDialogOpen}
          onClose={() => {
            setConfigDialogOpen(false);
            setSelectedIntegration(null);
          }}
          onConfigure={async (credentials, settings) => {
            await configureIntegration(selectedIntegration.id, credentials, settings);
            toast.success(`${selectedIntegration.name} configured successfully`);
            setConfigDialogOpen(false);
            setSelectedIntegration(null);
          }}
          onTest={async (credentials) => {
            return testIntegration(selectedIntegration.id, credentials);
          }}
        />
      )}

      <AIConfigDialog
        open={aiConfigDialogOpen}
        onOpenChange={setAiConfigDialogOpen}
        onSave={() => {
          // Refresh the AI configurations in the approval panel
        }}
      />

      </div>{/* end main content row */}
    </div>
  );
}
