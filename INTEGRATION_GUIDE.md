# CRM Integration System Documentation

## Overview

The CRM integration system provides a comprehensive framework for connecting third-party services to your roofing contractor CRM platform. It includes support for accounting (QuickBooks), payments (Stripe), communication (Twilio), aerial imagery (EagleView), and weather tracking services.

## Architecture

### Core Components

1. **Integration Manager** (`lib/integrations/manager.ts`)
   - Centralized manager for all integrations
   - Handles connection lifecycle
   - Manages credentials securely
   - Auto-sync capabilities

2. **Integration Modules**
   - `stripe.ts` - Stripe payment processing
   - `quickbooks.ts` - QuickBooks accounting
   - `twilio.ts` - SMS/voice communication
   - `eagleview.ts` - Aerial imagery services
   - `weather.ts` - Weather and hail tracking

3. **React Hook** (`hooks/useIntegrations.ts`)
   - `useIntegrations()` - Main hook for UI integration
   - Manages integration state
   - Provides configuration methods

4. **UI Components**
   - `IntegrationConfigDialog` - Configuration UI
   - SettingsView integrations tab

5. **Utilities** (`lib/integrations/utils.ts`)
   - Validation helpers
   - Formatting utilities
   - Status management

## Supported Integrations

### Stripe (Payment Processing)
- **Category**: Payment Processing
- **Setup Difficulty**: Moderate
- **Required Credentials**:
  - `secretKey` - Stripe Secret Key (sk_live_...)
  - `publishableKey` - Publishable Key (optional)

**Features**:
- Create payment intents
- Manage customers
- Track invoices
- Payment history

**Example Usage**:
```typescript
const stripe = new StripeIntegration('sk_live_...');
const paymentIntent = await stripe.createPaymentIntent(100, 'usd');
```

### QuickBooks Online (Accounting)
- **Category**: Accounting
- **Setup Difficulty**: Moderate
- **Required Credentials**:
  - `accessToken` - OAuth Access Token
  - `companyId` - QuickBooks Company ID
  - `environment` - 'production' or 'sandbox'

**Features**:
- Sync customers
- Create/manage invoices
- Track payments
- Payment method management

**Example Usage**:
```typescript
const qb = new QuickBooksIntegration(accessToken, companyId);
const result = await qb.syncCustomers();
```

### Twilio (Communications)
- **Category**: Communication
- **Setup Difficulty**: Easy
- **Required Credentials**:
  - `accountSid` - Twilio Account SID
  - `authToken` - Auth Token
  - `fromNumber` - Phone number for outbound messages

**Features**:
- Send SMS/MMS
- Make phone calls
- Message tracking
- Bulk messaging

**Example Usage**:
```typescript
const twilio = new TwilioIntegration(accountSid, authToken, fromNumber);
await twilio.sendSMS('+1234567890', 'Hello from CRM!');
```

### EagleView (Aerial Imagery)
- **Category**: Aerial Imagery
- **Setup Difficulty**: Hard
- **Required Credentials**:
  - `apiKey` - EagleView API Key
  - `clientId` - Client ID
  - `environment` - 'production' or 'sandbox'

**Features**:
- Order aerial reports
- Track order status
- Download report data
- Property search

**Example Usage**:
```typescript
const eagleview = new EagleViewIntegration(apiKey, clientId);
const report = await eagleview.orderReport('123 Main St, Dallas, TX');
```

### Weather Services
- **OpenWeather**: Weather forecasting and current conditions
- **HailTrace**: Hail damage detection and alerts

**Example Usage**:
```typescript
const weather = new OpenWeatherIntegration(apiKey);
const forecast = await weather.getForecast(32.7767, -96.7970);

const hailtrace = new HailTraceIntegration(apiKey);
const damage = await hailtrace.checkHailDamage(32.7767, -96.7970, 5);
```

## Using the Integration System

### 1. Basic Setup in Components

```typescript
import useIntegrations from '@/hooks/useIntegrations';

function MyComponent() {
  const {
    integrations,
    integrationsByCategory,
    configureIntegration,
    testIntegration,
  } = useIntegrations();

  // Use integrations...
}
```

### 2. Configuring an Integration

```typescript
const handleConfigure = async (integrationId, credentials, settings) => {
  try {
    await configureIntegration(integrationId, credentials, settings);
    toast.success('Integration configured!');
  } catch (error) {
    toast.error('Configuration failed: ' + error.message);
  }
};
```

### 3. Testing a Connection

```typescript
const handleTest = async (integrationId) => {
  const result = await testIntegration(integrationId, credentials);
  if (result.success) {
    console.log('Connected:', result.details);
  } else {
    console.error('Failed:', result.message);
  }
};
```

### 4. Syncing Data

```typescript
const handleSync = async (integrationId) => {
  const result = await syncIntegration(integrationId);
  console.log(`Synced ${result.recordsProcessed} records`);
};
```

### 5. Setting Up Auto-Sync

```typescript
// Set up hourly sync
setupAutoSync('quickbooks', 60);

// Set up 30-minute sync
setupAutoSync('stripe', 30);
```

## Credentials Storage

Credentials are stored in localStorage with the key `crm_integrations`. For production systems, consider:

1. **Encrypt credentials** before storage
2. **Use environment variables** for API keys
3. **Implement secure backend** for credential management
4. **Rotate tokens regularly**

### Current Implementation
```typescript
// Stored as plain JSON in localStorage
// ⚠️ WARNING: Not secure for production
localStorage.setItem('crm_integrations', JSON.stringify(integrations));
```

### Recommended Production Setup
```typescript
// Store encrypted in Supabase vault
const vault = supabase.vault.setSecret({
  name: 'stripe_api_key',
  secret: 'sk_live_...',
  description: 'Stripe Secret Key'
});
```

## Error Handling

All integrations return structured error responses:

```typescript
interface IntegrationTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}
```

**Example Error Handling**:
```typescript
try {
  const result = await stripe.testConnection();
  if (!result.success) {
    console.error('Connection failed:', result.message);
    // Show user-friendly error
    toast.error(result.message);
  }
} catch (error) {
  // Network or unexpected errors
  toast.error('Unexpected error: ' + error.message);
}
```

## API Response Examples

### Stripe - Payment Intent
```json
{
  "id": "pi_1234567890",
  "status": "requires_payment_method",
  "amount": 10000,
  "currency": "usd",
  "client_secret": "pi_1234567890_secret_abcdef"
}
```

### QuickBooks - Customer
```json
{
  "QueryResponse": {
    "Customer": [{
      "Id": "123",
      "DisplayName": "Acme Corp",
      "PrimaryEmailAddr": { "Address": "contact@acme.com" }
    }],
    "startPosition": 1,
    "maxResults": 10
  }
}
```

### Twilio - Message
```json
{
  "sid": "SM1234567890abcdef1234567890abcdef",
  "date_created": "Fri, 01 Dec 2023 12:00:00 +0000",
  "date_sent": null,
  "date_updated": "Fri, 01 Dec 2023 12:00:00 +0000",
  "status": "queued",
  "to": "+12125551234",
  "from": "+15551234567"
}
```

## Webhook Integration

For integrations that support webhooks:

```typescript
// Register webhook handler
integrationManager.registerWebhookHandler('stripe', async (event) => {
  if (event.type === 'payment_intent.succeeded') {
    console.log('Payment succeeded:', event.data);
  }
});

// Handle incoming webhook
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;
  await integrationManager.handleWebhook('stripe', event);
  res.json({ received: true });
});
```

## Utility Functions

### Validation
```typescript
import { validateCredentials } from '@/lib/integrations/utils';

const { valid, errors } = validateCredentials('stripe', credentials);
if (!valid) {
  console.error('Validation errors:', errors);
}
```

### Formatting
```typescript
import {
  formatIntegrationStatus,
  formatLastSyncTime,
  getIntegrationStatusColor,
} from '@/lib/integrations/utils';

console.log(formatIntegrationStatus('connected')); // "Connected"
console.log(formatLastSyncTime(lastSync)); // "2h ago"
console.log(getIntegrationStatusColor('error')); // CSS color class
```

### Checking Integration Status
```typescript
import { isIntegrationReady } from '@/lib/integrations/utils';

if (isIntegrationReady(integration)) {
  // Integration is enabled, configured, and connected
}
```

## Adding a New Integration

### 1. Create Integration Module

```typescript
// src/lib/integrations/mynewservice.ts
import { IntegrationTestResult } from './apiTypes';

export class MyNewServiceIntegration {
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async testConnection(): Promise<IntegrationTestResult> {
    // Implement test logic
  }

  async doSomething(): Promise<any> {
    // Implement API calls
  }
}
```

### 2. Update API Types

```typescript
// src/lib/integrations/apiTypes.ts
export const INTEGRATION_TEMPLATES: Record<string, Partial<BaseIntegration>> = {
  // ... existing ...
  mynewservice: {
    name: 'My New Service',
    description: 'Service description',
    category: 'custom'
  }
};
```

### 3. Add to Integration Manager

```typescript
// src/lib/integrations/manager.ts
case 'mynewservice':
  connection = new MyNewServiceIntegration(integration.credentials.apiKey);
  break;

private async testMyNewService(credentials: any): Promise<IntegrationTestResult> {
  const service = new MyNewServiceIntegration(credentials.apiKey);
  return service.testConnection();
}
```

### 4. Update Integration Config Dialog

```typescript
// src/components/IntegrationConfigDialog.tsx
const INTEGRATION_CONFIGS: Record<string, ...> = {
  // ... existing ...
  mynewservice: [
    { field: 'apiKey', label: 'API Key', type: 'password', required: true }
  ]
};
```

## Security Best Practices

### ✅ Do
- ✓ Validate all credentials before storing
- ✓ Use HTTPS for all API calls
- ✓ Implement credential encryption
- ✓ Regularly rotate API keys
- ✓ Use environment variables for development
- ✓ Implement rate limiting
- ✓ Log integration activity

### ❌ Don't
- ✗ Store credentials in plain text
- ✗ Expose credentials in client-side code
- ✗ Use hardcoded API keys
- ✗ Log sensitive data
- ✗ Request unnecessary permissions
- ✗ Skip credential validation
- ✗ Use expired access tokens

## Troubleshooting

### Connection Fails
1. Verify credentials are correct
2. Check API endpoint availability
3. Verify network connectivity
4. Review integration logs

### Sync Issues
```typescript
// Check integration health
const health = integrationManager.getIntegrationHealth();
console.log(health);
```

### Credential Errors
```typescript
// Validate credentials
const { valid, errors } = validateCredentials('stripe', credentials);
if (!valid) {
  console.log('Errors:', errors);
}
```

## Rate Limiting

Integrate rate limiter to avoid API throttling:

```typescript
// Implement with p-queue or similar
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 10 });

const makeRequest = async (fn: Function) => {
  return queue.add(fn);
};
```

## Monitoring & Logging

```typescript
// Log integration activities
const log = (integrationId: string, action: string, details: any) => {
  console.log({
    timestamp: new Date().toISOString(),
    integration: integrationId,
    action,
    details
  });
};

// Export integration status
const status = integrationManager.exportStatus();
console.log(JSON.stringify(status, null, 2));
```

## Future Enhancements

1. **Webhook Management UI** - Configure webhooks through settings
2. **Integration Marketplace** - Browse and install pre-built integrations
3. **Custom Integration Builder** - Create custom integrations without coding
4. **Integration Logs** - Detailed logs of all integration activities
5. **Retry Logic** - Automatic retry for failed operations
6. **Backup & Restore** - Backup integration configurations
7. **Multi-Tenant Support** - Separate integrations per company
8. **OAuth Flow** - Streamlined OAuth configuration

## Support & Resources

- [Stripe Documentation](https://stripe.com/docs)
- [QuickBooks API](https://developer.intuit.com)
- [Twilio API](https://www.twilio.com/docs)
- [EagleView API](https://developer.eagleview.com)
- [OpenWeather API](https://openweathermap.org/api)

---

**Last Updated**: 2024
**Version**: 1.0.0
