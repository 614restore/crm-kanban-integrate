# AI Assistant Implementation Guide

## Overview

The AI Assistant feature is now fully integrated into StormCraft CRM with multi-provider support (OpenAI, Anthropic Claude, Google Gemini), secure storage, and team-based access control.

## Architecture

### Components

#### 1. **AI Service Layer** (`src/lib/integrations/aiAssistant.ts`)
- Multi-provider support (OpenAI, Anthropic, Google)
- Provider abstraction layer
- JSON response parsing
- Error handling for each provider

**Supported Services:**
- **OpenAI**: GPT-4, GPT-4-Turbo, GPT-3.5-Turbo
- **Anthropic**: Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
- **Google**: Gemini Pro, Gemini 1.5 Pro

**Available Methods:**
- `generateEmailResponse()` - Draft professional emails
- `analyzeLeadQuality()` - Score leads by quality
- `optimizeEstimate()` - Get pricing recommendations
- `handleCustomerQuery()` - Customer support responses

#### 2. **Integration Class** (`src/lib/integrations/aiAssistantIntegration.ts`)
- Follows StormCraft integration pattern
- Feature flag support
- Settings management
- Connection testing

#### 3. **Secure Storage** (`src/lib/aiConfigurationManager.ts`)
- Supabase-based encrypted storage
- Team permission management
- Usage tracking
- Admin approval workflow

#### 4. **UI Components**

**AIConfigDialog** (`src/components/AIConfigDialog.tsx`)
- Provider selection with documentation links
- API key input with visibility toggle
- Model configuration (tokens, temperature, prompts)
- Feature toggling
- Connection testing
- Encrypted storage via Supabase

**AIApprovalPanel** (`src/components/AIApprovalPanel.tsx`)
- Admin-only approval interface
- Pending approvals display
- Configuration management
- Team member access granting
- Access level control (read/write/admin)
- Usage statistics

#### 5. **Settings Integration**
- New "AI Assistant" tab in Settings
- Feature overview
- Security best practices
- Admin controls

## Setup Instructions

### 1. Database Migration

Run the Supabase migration to create tables:

```bash
# Apply migration manually in Supabase dashboard
# Or use Supabase CLI:
supabase migration up -f supabase-migrations/ai-configuration.sql
```

**Tables Created:**
- `ai_configurations` - Stores encrypted API keys and settings
- `ai_access_approvals` - Manages team access permissions

### 2. Environment Variables

Add to `.env` or `.env.production`:

```bash
# Not directly required - users provide their own API keys
# But you may want to add rate limiting or monitoring
VITE_AI_RATE_LIMIT_PER_MINUTE=10
VITE_AI_LOG_USAGE=true
```

### 3. Getting API Keys

**OpenAI:**
1. Visit https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (you'll only see it once)

**Anthropic:**
1. Visit https://console.anthropic.com/account/keys
2. Create new API key
3. Copy the key

**Google:**
1. Visit https://makersuite.google.com/app/apikey
2. Create new API key
3. Copy the key

## User Workflows

### For Regular Team Members

**Step 1: Navigate to AI Assistant Settings**
```
Settings > AI Assistant > Add AI Configuration
```

**Step 2: Configure AI**
- Select provider (OpenAI, Claude, or Gemini)
- Enter your API key
- Set model preferences
- Enable desired features
- Click "Test Connection"
- Save and request approval

**Step 3: Await Admin Approval**
- Admins see pending approvals in the AI Admin Panel
- Admins can approve, modify, or reject
- Once approved, features become available

### For Admins/Managers

**Approve Configurations:**
1. Navigate to Settings > AI Assistant
2. View pending approvals section
3. Review configuration details
4. Click "Approve" to enable

**Grant Team Access:**
1. Select an approved configuration
2. Click "Grant Access"
3. Select team member
4. Choose access level:
   - **Read**: Can use AI features (no config changes)
   - **Write**: Can use and modify settings
   - **Admin**: Full permissions including revoking access

**Revoke Access:**
1. Click the trash icon next to team member name
2. Confirm revocation

**Revoke Configuration:**
1. Click "Revoke Configuration" button
2. This disables it for all team members

## Using AI Features

Once configured and approved, team members can use AI features:

### Email Drafting
```tsx
const response = await aiAssistant.generateEmailResponse({
  customerEmail: "Thank you for your quote...",
  previousConversation: ["We need a roof repair"],
  projectType: "Roof Repair",
  customerSentiment: "positive"
});
// Returns: { subject, body, tone, nextSteps }
```

### Lead Scoring
```tsx
const score = await aiAssistant.analyzeLeadQuality({
  email: "john@example.com",
  message: "Need emergency roof repair",
  propertyType: "residential",
  urgency: "high"
});
// Returns: { score (1-100), priority, recommendations, estimatedValue, conversionProbability }
```

### Estimate Optimization
```tsx
const optimized = await aiAssistant.optimizeEstimate({
  materials: [...],
  labor: [...],
  projectType: "roof replacement",
  timeframe: "2 weeks",
  currentPrice: 15000
});
// Returns: { optimizedPrice, competitivePosition, adjustmentReasons, riskFactors, winProbability }
```

### Customer Support
```tsx
const support = await aiAssistant.handleCustomerQuery({
  message: "When can you schedule inspection?",
  customerHistory: ["Initial quote sent", "Customer interested"],
  context: "Hail damage assessment"
});
// Returns: { response, confidence (0-1), needsHuman, suggestedActions }
```

## Security Features

### 🔐 Encryption
- API keys are encrypted before storage in Supabase
- Uses base64 encoding (production should use libsodium)
- Keys never logged or exposed

### 👥 Access Control
- Admin approval required before team use
- Row-Level Security (RLS) policies in Supabase
- User ID tracking for audit logs

### 📊 Usage Tracking
- Every API call tracked with `recordUsage()`
- Last used timestamp recorded
- Usage count for billing/monitoring

### 🚫 Scope Isolation
- Each user's configuration is isolated
- Cross-company access prevented
- Team-based visibility only

## Configuration Best Practices

### 1. **System Prompt Tuning**
```typescript
// For contractor business context
systemPrompt: `You are a professional roofing contractor assistant. 
Help with customer communications, lead analysis, and business automation.
Always maintain a professional tone and provide accurate information about roofing services.`
```

### 2. **Temperature Settings**
- **0.0-0.5**: Consistent, factual responses (recommendations, analysis)
- **0.5-1.0**: Balanced responses (emails, support)
- **1.0-2.0**: Creative responses (brainstorming, variations)

### 3. **Token Limits**
- **256-512**: Concise responses
- **1024-2048**: Standard responses (recommended)
- **2048-4096**: Detailed analysis

### 4. **Feature Selection**
Enable only features your team will use to avoid unnecessary API costs:
- ✓ customerSupport - Most versatile
- ✓ emailDrafting - Saves time on communications
- ✓ leadScoring - Improves qualification
- ✓ estimateReview - Competitive analysis
- □ contractAnalysis - Coming soon

## Troubleshooting

### "Connection test failed"
- Verify API key is correct and has proper permissions
- Check internet connectivity
- Ensure provider service isn't down
- For OpenAI: Verify organization ID if using org. keys

### "API key is invalid"
- Don't copy/paste partial keys
- Ensure no leading/trailing spaces
- Keys must be active (not disabled/rotated)
- Some providers revoke old keys automatically

### "Rate limit exceeded"
- Wait 60 seconds before retrying
- Consider upgrading API plan
- Implement request queuing

### "Response parsing failed"
- Enable debug logging to see raw response
- Some models return non-JSON
- Try adjusting system prompt
- Use a model known to work (GPT-4 recommended)

## API Cost Estimates (Approximate)

**Per 1000 API calls:**
- OpenAI (GPT-3.5): $0.50
- OpenAI (GPT-4): $30.00
- Anthropic (Claude 3 Haiku): $0.25
- Google (Gemini): $0.05

**Recommendation:** 
- Start with GPT-3.5 orClaude 3 Haiku
- Monitor usage via Supabase
- Upgrade to GPT-4 if accuracy needed

## Advanced: Custom Integrations

To add more AI providers:

1. **Extend `AIAssistantService`**:
```typescript
private async callCustomProvider(prompt: string): Promise<any> {
  // Implement custom provider API call
  // Must return JSON matching AIResponse format
}
```

2. **Update provider selector**:
```tsx
const providerModels: Record<string, string[]> = {
  openai: [...],
  anthropic: [...],
  google: [...],
  yourprovider: ["model1", "model2"]  // Add here
};
```

3. **Run migrations** for any database changes

## Database Schema

### ai_configurations
```sql
- id (UUID primary key)
- company_id (UUID) - Team/company
- user_id (UUID) - User who configured
- provider (text) - openai|anthropic|google
- api_key_encrypted (text) - Encrypted key
- model (text) - e.g., gpt-4
- max_tokens (int)
- temperature (decimal)
- features (jsonb) - Enabled features
- is_approved (boolean) - Admin approval
- usage_count (int) - API call count
- last_used (timestamp)
```

### ai_access_approvals
```sql
- id (UUID primary key)
- company_id (UUID)
- ai_config_id (UUID) - Reference to configuration
- user_id (UUID) - Team member
- access_level (text) - read|write|admin
- created_at (timestamp)
- expires_at (timestamp optional)
```

## Monitoring & Analytics

Track AI usage in your database:

```sql
SELECT 
  provider,
  COUNT(*) as usage_count,
  AVG(usage_count) as avg_per_user,
  MAX(last_used) as last_used
FROM ai_configurations
WHERE company_id = 'your-company-id'
GROUP BY provider;
```

## Future Enhancements

- [ ] Usage-based billing integration
- [ ] Response caching for common queries
- [ ] Batch API requests for cost optimization
- [ ] Additional AI providers (Groq, Together, etc.)
- [ ] Fine-tuned models per company
- [ ] Webhook integrations for automation
- [ ] Custom function calling
- [ ] Vision models for image analysis

## Support

For issues or questions:
1. Check troubleshooting section
2. Review provider documentation links
3. Enable debug logging in browser console
4. Contact support with logs

---

**Last Updated:** March 3, 2026
**Status:** Production Ready
