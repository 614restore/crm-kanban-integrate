# Integration Quick Start Guide

## 5-Minute Setup

### Step 1: Import the Hook

```typescript
import useIntegrations from '@/hooks/useIntegrations';
```

### Step 2: Use in Your Component

```typescript
function MyComponent() {
  const {
    integrations,
    integrationsByCategory,
    configureIntegration,
    testIntegration,
  } = useIntegrations();

  return (
    <div>
      {integrations.map(integration => (
        <div key={integration.id}>
          <h3>{integration.name}</h3>
          <p>{integration.status}</p>
        </div>
      ))}
    </div>
  );
}
```

### Step 3: Configure an Integration

```typescript
const handleSetupStripe = async () => {
  try {
    await configureIntegration('stripe', {
      secretKey: 'sk_live_...',
      publishableKey: 'pk_live_...'
    }, {
      currency: 'usd',
      captureMethod: 'automatic'
    });
    toast.success('Stripe configured!');
  } catch (error) {
    toast.error(error.message);
  }
};
```

### Step 4: Test Connection

```typescript
const handleTestConnection = async () => {
  const result = await testIntegration('stripe');
  if (result.success) {
    toast.success('Connected! ' + result.details?.businessName);
  } else {
    toast.error(result.message);
  }
};
```

## Common Tasks

### Get All Configured Integrations

```typescript
const { integrations } = useIntegrations();
const configured = integrations.filter(i => i.isConfigured);
```

### Group by Category

```typescript
const { integrationsByCategory } = useIntegrations();

Object.entries(integrationsByCategory).forEach(([category, items]) => {
  console.log(`${category}:`, items);
});
```

### Format Status for Display

```typescript
import { formatIntegrationStatus, formatLastSyncTime } from '@/lib/integrations/utils';

<p>{formatIntegrationStatus(integration.status)}</p>
<p>Last sync: {formatLastSyncTime(integration.lastSync)}</p>
```

### Check if Ready to Use

```typescript
import { isIntegrationReady } from '@/lib/integrations/utils';

if (isIntegrationReady(integration)) {
  // Safe to use integration
}
```

## Integration Examples

### Stripe Payment

```typescript
const { integrations } = useIntegrations();
const stripe = integrations.find(i => i.id === 'stripe');

if (stripe?.status === 'connected') {
  const stripeClient = new StripeIntegration(stripe.credentials.secretKey);
  const payment = await stripeClient.createPaymentIntent(amount);
}
```

### QuickBooks Sync

```typescript
const { syncIntegration } = useIntegrations();

const result = await syncIntegration('quickbooks');
console.log(`Synced ${result.recordsProcessed} records`);
```

### Send SMS via Twilio

```typescript
const { integrations } = useIntegrations();
const twilio = integrations.find(i => i.id === 'twilio');

if (twilio?.status === 'connected') {
  const client = new TwilioIntegration(
    twilio.credentials.accountSid,
    twilio.credentials.authToken,
    twilio.credentials.fromNumber
  );
  await client.sendSMS('+1234567890', 'Hello!');
}
```

### Get Weather Data

```typescript
const { integrations } = useIntegrations();
const weather = integrations.find(i => i.id === 'openweather');

if (weather?.status === 'connected') {
  const client = new OpenWeatherIntegration(weather.credentials.apiKey);
  const forecast = await client.getForecast(latitude, longitude);
}
```

## Error Handling Pattern

```typescript
const handleIntegrationAction = async (integrationId: string, action: Function) => {
  try {
    const result = await action();
    if (!result.success) {
      toast.error(`Failed: ${result.message}`);
      return;
    }
    toast.success('Success!');
    return result;
  } catch (error) {
    console.error('Integration error:', error);
    toast.error(
      error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred'
    );
  }
};

// Usage
await handleIntegrationAction('stripe', async () => {
  return await testIntegration('stripe');
});
```

## State Management Pattern

```typescript
function IntegrationPanel() {
  const [loading, setLoading] = useState(false);
  const { configureIntegration } = useIntegrations();

  const handleConfigure = async (id: string, credentials: any) => {
    setLoading(true);
    try {
      await configureIntegration(id, credentials, {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <button disabled={loading} onClick={() => handleConfigure('stripe', {})}>
      {loading ? 'Configuring...' : 'Configure'}
    </button>
  );
}
```

## Environment Setup

### .env.local
```bash
# Add your integration credentials here for development
VITE_STRIPE_KEY=pk_test_...
VITE_TWILIO_ACCOUNT_SID=AC...
VITE_QUICKBOOKS_CLIENT_ID=...
```

### Load from Environment
```typescript
const credentials = {
  secretKey: import.meta.env.VITE_STRIPE_KEY,
  accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID,
};
```

## Testing Integrations

### Mock for Development
```typescript
if (isDevelopment) {
  integrationManager.setMockMode(true);
  // Will return mock responses
}
```

### Write Tests
```typescript
describe('Stripe Integration', () => {
  it('should create payment intent', async () => {
    const stripe = new StripeIntegration('sk_test_123');
    const result = await stripe.createPaymentIntent(100);
    expect(result.id).toBeDefined();
  });
});
```

## Debugging

### View Integration Status
```typescript
const { getHealth, exportStatus } = useIntegrations();

console.log('Health:', getHealth());
console.log('Status:', exportStatus());
```

### Check Stored Credentials
```typescript
console.log(localStorage.getItem('crm_integrations'));
```

### View Network Calls
Open DevTools → Network tab and filter by integration domain names.

## Performance Tips

1. **Lazy load integrations**
```typescript
const { integrations } = useIntegrations();
const activeOnly = integrations.filter(i => i.isEnabled);
```

2. **Use auto-sync for regular data**
```typescript
useEffect(() => {
  setupAutoSync('quickbooks', 60); // Every hour
}, []);
```

3. **Batch API calls**
```typescript
const results = await Promise.all([
  stripe.listCharges(),
  qb.queryInvoices(),
  twilio.listMessages()
]);
```

4. **Cache responses**
```typescript
const cache = new Map();
const getCachedData = async (key: string, fetcher: Function) => {
  if (cache.has(key)) return cache.get(key);
  const data = await fetcher();
  cache.set(key, data);
  return data;
};
```

## Next Steps

1. ✅ Set up your first integration in SettingsView
2. ✅ Test the connection
3. ✅ Configure sync schedule
4. ✅ Monitor logs
5. ✅ Implement error handling
6. ✅ Add webhooks (optional)
7. ✅ Deploy to production

---

For more details, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
