// Supabase Integration for AI Assistant Configuration
// Handles secure storage and team permission management

import { supabase } from '@/lib/supabase';

// ── AES-256-GCM encryption helpers ───────────────────────────────────────────
// Key is derived from VITE_ENCRYPTION_SECRET env var (set in Vercel dashboard)
const ENCRYPTION_SECRET = import.meta.env.VITE_ENCRYPTION_SECRET || 'fallback-dev-secret-32chars!!xx';

async function getEncryptionKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(ENCRYPTION_SECRET.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptAES(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}:${ctB64}`;
}

async function decryptAES(encrypted: string): Promise<string> {
  // Handle legacy Base64-only values stored before this fix
  if (!encrypted.includes(':')) {
    return atob(encrypted);
  }
  const key = await getEncryptionKey();
  const [ivB64, ctB64] = encrypted.split(':');
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
// ─────────────────────────────────────────────────────────────────────────────

export interface AIConfigurationRecord {
  id: string;
  company_id: string;
  user_id: string;
  provider: 'openai' | 'anthropic' | 'google';
  api_key_encrypted: string;
  organization_id?: string;
  region?: string;
  model: string;
  max_tokens: number;
  temperature: number;
  system_prompt: string;
  features: Record<string, boolean>;
  is_approved: boolean;
  approved_by?: string;
  approval_date?: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  last_used?: string;
}

export interface AIAccessApproval {
  id: string;
  company_id: string;
  ai_config_id: string;
  user_id: string;
  access_level: 'read' | 'write' | 'admin';
  approved_by?: string;
  approval_date?: string;
  created_at: string;
  expires_at?: string;
}

/**
 * Manages AI Configuration storage and team permissions via Supabase
 */
export class AIConfigurationManager {
  /**
   * Save AI configuration securely
   * Encrypts API key with AES-256-GCM before storage
   */
  async saveConfiguration(
    companyId: string,
    userId: string,
    config: {
      provider: 'openai' | 'anthropic' | 'google';
      apiKey: string;
      organizationId?: string;
      region?: string;
      model: string;
      maxTokens: number;
      temperature: number;
      systemPrompt: string;
      features: Record<string, boolean>;
    }
  ): Promise<AIConfigurationRecord | null> {
    try {
      const encryptedKey = await this.encryptApiKey(config.apiKey);

      const { data, error } = await supabase
        .from('ai_configurations')
        .insert({
          company_id: companyId,
          user_id: userId,
          provider: config.provider,
          api_key_encrypted: encryptedKey,
          organization_id: config.organizationId,
          region: config.region,
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system_prompt: config.systemPrompt,
          features: config.features,
          is_approved: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to save AI configuration:', error);
      return null;
    }
  }

  /**
   * Get AI configurations for a company
   */
  async getConfigurationsForCompany(companyId: string): Promise<AIConfigurationRecord[]> {
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as AIConfigurationRecord[]) || [];
    } catch (error) {
      console.error('Failed to fetch AI configurations:', error);
      return [];
    }
  }

  /**
   * Get approved configurations accessible to user
   */
  async getApprovedConfigurations(
    companyId: string,
    userId: string
  ): Promise<AIConfigurationRecord[]> {
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_approved', true);

      if (error) throw error;

      return (data as AIConfigurationRecord[])?.filter(
        (config) => config.user_id === userId || config.is_approved
      ) || [];
    } catch (error) {
      console.error('Failed to fetch approved configurations:', error);
      return [];
    }
  }

  /**
   * Request approval for AI configuration
   */
  async requestApproval(
    configId: string,
    companyId: string
  ): Promise<AIConfigurationRecord | null> {
    try {
      await this.notifyAdminsForApproval(configId, companyId);
      return null;
    } catch (error) {
      console.error('Failed to request approval:', error);
      return null;
    }
  }

  /**
   * Approve AI configuration (admin only)
   */
  async approveConfiguration(
    configId: string,
    approvedBy: string,
    companyId: string
  ): Promise<AIConfigurationRecord | null> {
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .update({
          is_approved: true,
          approved_by: approvedBy,
          approval_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data as AIConfigurationRecord;
    } catch (error) {
      console.error('Failed to approve configuration:', error);
      return null;
    }
  }

  /**
   * Revoke access to AI configuration
   */
  async revokeConfiguration(configId: string, companyId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_configurations')
        .update({
          is_approved: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId)
        .eq('company_id', companyId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to revoke configuration:', error);
      return false;
    }
  }

  /**
   * Grant team member access to configuration
   */
  async grantAccess(
    configId: string,
    userId: string,
    accessLevel: 'read' | 'write' | 'admin' = 'read'
  ): Promise<AIAccessApproval | null> {
    try {
      const config = await supabase
        .from('ai_configurations')
        .select('company_id')
        .eq('id', configId)
        .single();

      if (config.error) throw config.error;

      const { data, error } = await supabase
        .from('ai_access_approvals')
        .insert({
          company_id: (config.data as any).company_id,
          ai_config_id: configId,
          user_id: userId,
          access_level: accessLevel,
          created_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as AIAccessApproval;
    } catch (error) {
      console.error('Failed to grant access:', error);
      return null;
    }
  }

  /**
   * Revoke team member access
   */
  async revokeAccess(configId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_access_approvals')
        .delete()
        .eq('ai_config_id', configId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to revoke access:', error);
      return false;
    }
  }

  /**
   * Get team members' access to configuration
   */
  async getConfigurationAccessors(configId: string): Promise<AIAccessApproval[]> {
    try {
      const { data, error } = await supabase
        .from('ai_access_approvals')
        .select('*')
        .eq('ai_config_id', configId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as AIAccessApproval[]) || [];
    } catch (error) {
      console.error('Failed to fetch accessors:', error);
      return [];
    }
  }

  /**
   * Update usage stats
   */
  async recordUsage(configId: string): Promise<void> {
    try {
      const config = (await supabase
        .from('ai_configurations')
        .select('usage_count')
        .eq('id', configId)
        .single()).data as any;

      if (!config) return;

      await supabase
        .from('ai_configurations')
        .update({
          usage_count: (config.usage_count || 0) + 1,
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId);
    } catch (error) {
      console.error('Failed to record usage:', error);
    }
  }

  /**
   * Private: Notify admins for approval
   */
  private async notifyAdminsForApproval(configId: string, companyId: string): Promise<void> {
    try {
      const { data: admins } = await supabase
        .from('team_members')
        .select('email, name')
        .eq('company_id', companyId)
        .in('role', ['admin', 'owner']);

      if (admins && admins.length > 0) {
        // TODO: notify admins via Edge Function or email service
      }
    } catch (error) {
      console.error('Failed to notify admins:', error);
    }
  }

  /**
   * Encrypt API key using AES-256-GCM via Web Crypto API
   */
  private async encryptApiKey(apiKey: string): Promise<string> {
    return encryptAES(apiKey);
  }

  /**
   * Decrypt API key — handles both legacy Base64 and new AES-256-GCM format
   */
  async decryptApiKey(encrypted: string): Promise<string> {
    return decryptAES(encrypted);
  }
}

export const aiConfigurationManager = new AIConfigurationManager();
