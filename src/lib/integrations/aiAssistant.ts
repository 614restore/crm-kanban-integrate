// AI Assistant Integration with Multiple Providers
// Supports OpenAI, Anthropic Claude, and Google Gemini
// Secure API key storage via Supabase

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  organizationId?: string; // OpenAI
  region?: string; // Google (e.g., 'us-central1')
}

export interface AIAssistantSettings {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  features: {
    customerSupport: boolean;
    emailDrafting: boolean;
    contractAnalysis: boolean;
    estimateReview: boolean;
    leadScoring: boolean;
  };
}

/**
 * Multi-provider AI Assistant Service
 * Abstracts differences between OpenAI, Anthropic, and Google APIs
 */
export class AIAssistantService {
  private provider: AIProvider;
  private apiKey: string;
  private config: any;

  constructor(providerConfig: AIProviderConfig, private settings: AIAssistantSettings) {
    this.provider = providerConfig.provider;
    this.apiKey = providerConfig.apiKey;
    this.config = {
      organizationId: providerConfig.organizationId,
      region: providerConfig.region,
    };
  }

  /**
   * Generate smart email responses
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
    const prompt = `
      As a professional contractor assistant, generate a response to:
      Customer Email: ${context.customerEmail}
      Project Type: ${context.projectType}
      Customer Sentiment: ${context.customerSentiment}
      Previous Context: ${context.previousConversation.slice(-3).join('\n---\n')}
      
      Generate a professional, helpful response that addresses their concerns and moves the project forward.
      Respond in JSON format: { subject, body, tone, nextSteps: [] }
    `;

    return this.callAI(prompt);
  }

  /**
   * Analyze customer inquiries for lead scoring
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
    const prompt = `
      Analyze this contractor lead for quality and priority:
      Email: ${leadData.email}
      Message: ${leadData.message}
      Property Type: ${leadData.propertyType}
      Urgency: ${leadData.urgency}
      
      Consider:
      - Urgency indicators in language
      - Property type and potential project value
      - Communication quality
      - Timeline indicators
      
      Respond in JSON: { score (1-100), priority, recommendations: [], estimatedValue, conversionProbability (0-1) }
    `;

    return this.callAI(prompt);
  }

  /**
   * Smart estimate analysis and optimization
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
    const prompt = `
      Analyze this contractor estimate for optimization:
      Project Type: ${estimateData.projectType}
      Current Price: $${estimateData.currentPrice}
      Timeframe: ${estimateData.timeframe}
      Material count: ${estimateData.materials.length} items
      Labor items: ${estimateData.labor.length}
      
      Provide competitive pricing recommendations and risk analysis.
      Respond in JSON: { optimizedPrice, competitivePosition, adjustmentReasons: [], riskFactors: [], winProbability (0-1) }
    `;

    return this.callAI(prompt);
  }

  /**
   * Real-time customer support chat
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
    const prompt = `
      Customer Support Query:
      Message: ${query.message}
      Recent History: ${query.customerHistory.slice(-2).join('\n')}
      Context: ${query.context}
      
      Provide helpful, accurate information. If too complex or sensitive, set needsHuman to true.
      Respond in JSON: { response, confidence (0-1), needsHuman, suggestedActions: [] }
    `;

    return this.callAI(prompt);
  }

  /**
   * Generic AI call - abstracts provider differences
   */
  private async callAI(prompt: string): Promise<any> {
    switch (this.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'google':
        return this.callGoogle(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * OpenAI API call
   */
  private async callOpenAI(prompt: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId }),
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: this.settings.systemPrompt || 'You are a professional contractor assistant. Respond in valid JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.settings.temperature,
        max_tokens: this.settings.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    return this.parseJSON(content);
  }

  /**
   * Anthropic Claude API call
   */
  private async callAnthropic(prompt: string): Promise<any> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.settings.model,
        max_tokens: this.settings.maxTokens,
        system: this.settings.systemPrompt || 'You are a professional contractor assistant. Respond in valid JSON format.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.settings.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    return this.parseJSON(content);
  }

  /**
   * Google Gemini API call
   */
  private async callGoogle(prompt: string): Promise<any> {
    const model = this.settings.model || 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${this.settings.systemPrompt || 'You are a professional contractor assistant. Respond in valid JSON format.'}\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: this.settings.temperature,
          maxOutputTokens: this.settings.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.candidates[0]?.content?.parts[0]?.text;
    return this.parseJSON(content);
  }

  /**
   * Safely parse JSON response
   */
  private parseJSON(content: string): any {
    if (!content) throw new Error('Empty response from AI provider');

    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try direct JSON parse
      return JSON.parse(content);
    } catch {
      // If JSON parsing fails, return the raw content
      console.warn('Failed to parse JSON response, returning raw content');
      return { response: content };
    }
  }
}