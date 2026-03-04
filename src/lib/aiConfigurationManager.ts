// Supabase Integration for AI Assistant Configuration
// Handles secure storage and team permission management

import { supabase } from '@/lib/supabase';

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
   * Encrypts API key before storage
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
      // In production, encrypt the API key before storing
      // For now, we'll use a simple encoding (should use proper encryption)
      const encryptedKey = this.encryptApiKey(config.apiKey);

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
      // Get configurations where user has approval or user created them
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_approved', true);

      if (error) throw error;

      // Filter to only approved configs or ones created by the user
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
      // Send notification to company admins
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
      // Get company admins
      const { data: admins } = await supabase
        .from('team_members')
        .select('email, name')
        .eq('company_id', companyId)
        .in('role', ['admin', 'owner']);

      // Send notification emails (implement via Supabase Edge Function or external service)
      if (admins && admins.length > 0) {
        console.log(`Approval needed for AI Config ${configId} by admins:`, admins);
      }
    } catch (error) {
      console.error('Failed to notify admins:', error);
    }
  }

  /**
   * Private: Encrypt API key (basic implementation)
   * In production, use proper encryption library
   */
  private encryptApiKey(apiKey: string): string {
    // This is a placeholder - use proper encryption in production
    // Consider using libsodium or similar
    return Buffer.from(apiKey).toString('base64');
  }

  /**
   * Private: Decrypt API key (basic implementation)
   * In production, use proper decryption library
   */
  decryptApiKey(encrypted: string): string {
    // This is a placeholder - use proper decryption in production
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }
}

export const aiConfigurationManager = new AIConfigurationManager();
