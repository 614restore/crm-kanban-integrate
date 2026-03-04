// AI Assistant Integration Class
// Follows the pattern of other integrations (Stripe, QuickBooks, etc.)

import { BaseIntegration, IntegrationTestResult } from './apiTypes';
import { AIAssistantService, AIProvider, AIProviderConfig, AIAssistantSettings } from './aiAssistant';

export interface AIAssistantIntegration extends BaseIntegration {
  category: 'ai-assistant';
  credentials: AIProviderConfig & {
    userId: string; // User who owns this API key
    companyId: string; // Team/company this is configured for
  };
  settings: AIAssistantSettings;
  metadata?: {
    providedBy: string; // User email who configured it
    approvedBy?: string; // Admin who approved access
    approvalDate?: string;
    usageCount?: number;
    lastUsed?: string;
  };
}

export default class AIAssistantIntegrationClass {
  private service: AIAssistantService | null = null;
  private providerConfig: AIProviderConfig;
  private settings: AIAssistantSettings;

  constructor(
    provider: AIProvider,
    apiKey: string,
    settings: AIAssistantSettings,
    organizationId?: string,
    region?: string
  ) {
    this.providerConfig = {
      provider,
      apiKey,
      organizationId,
      region,
    };

    this.settings = settings;
    this.initializeService();
  }

  private initializeService(): void {
    try {
      this.service = new AIAssistantService(this.providerConfig, this.settings);
    } catch (error) {
      console.error('Failed to initialize AI Assistant Service:', error);
    }
  }

  /**
   * Test connection to AI provider
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      if (!this.service) {
        return {
          success: false,
          message: 'Service not initialized',
          timestamp: new Date().toISOString(),
        };
      }

      // Simple test - call generateEmailResponse with test data
      const result = await this.service.generateEmailResponse({
        customerEmail: 'test@example.com',
        previousConversation: ['This is a test'],
        projectType: 'Test Project',
        customerSentiment: 'neutral',
      });

      if (result && result.body) {
        return {
          success: true,
          message: `Connected to ${this.providerConfig.provider} successfully`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        message: 'Invalid response from AI provider',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate email response
   */
  async generateEmailResponse(context: {
    customerEmail: string;
    previousConversation: string[];
    projectType: string;
    customerSentiment: 'positive' | 'neutral' | 'negative';
  }): Promise<{
    subject: string;
    body: string;
    tone: string;
    nextSteps: string[];
  }> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }

    if (!this.settings.features.emailDrafting) {
      throw new Error('Email drafting feature is not enabled');
    }

    return this.service.generateEmailResponse(context);
  }

  /**
   * Analyze lead quality
   */
  async analyzeLeadQuality(leadData: {
    email: string;
    phone?: string;
    message: string;
    propertyType: string;
    urgency: string;
  }): Promise<{
    score: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    recommendations: string[];
    estimatedValue: number;
    conversionProbability: number;
  }> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }

    if (!this.settings.features.leadScoring) {
      throw new Error('Lead scoring feature is not enabled');
    }

    return this.service.analyzeLeadQuality(leadData);
  }

  /**
   * Optimize estimate
   */
  async optimizeEstimate(estimateData: {
    materials: any[];
    labor: any[];
    projectType: string;
    timeframe: string;
    currentPrice: number;
  }): Promise<{
    optimizedPrice: number;
    competitivePosition: string;
    adjustmentReasons: string[];
    riskFactors: string[];
    winProbability: number;
  }> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }

    if (!this.settings.features.estimateReview) {
      throw new Error('Estimate review feature is not enabled');
    }

    return this.service.optimizeEstimate(estimateData);
  }

  /**
   * Handle customer support query
   */
  async handleCustomerQuery(query: {
    message: string;
    customerHistory: string[];
    currentProject?: any;
    context: string;
  }): Promise<{
    response: string;
    confidence: number;
    needsHuman: boolean;
    suggestedActions: string[];
  }> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }

    if (!this.settings.features.customerSupport) {
      throw new Error('Customer support feature is not enabled');
    }

    return this.service.handleCustomerQuery(query);
  }

  /**
   * Get current settings
   */
  getSettings(): AIAssistantSettings {
    return this.settings;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AIAssistantSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get enabled features
   */
  getEnabledFeatures(): string[] {
    const features: string[] = [];
    if (this.settings.features.customerSupport) features.push('customerSupport');
    if (this.settings.features.emailDrafting) features.push('emailDrafting');
    if (this.settings.features.contractAnalysis) features.push('contractAnalysis');
    if (this.settings.features.estimateReview) features.push('estimateReview');
    if (this.settings.features.leadScoring) features.push('leadScoring');
    return features;
  }

  /**
   * Get provider info
   */
  getProviderInfo(): { provider: AIProvider; model: string } {
    return {
      provider: this.providerConfig.provider,
      model: this.settings.model,
    };
  }
}
