# 🚀 Production Deployment Checklist - One-Time Setup

## ✅ Status: READY FOR LAUNCH

All critical build issues have been resolved. Follow this checklist to ensure a successful deployment.

---

## 📋 Pre-Deployment Verification (COMPLETED)

### ✅ Code Issues - FIXED
- [x] **Vite build configuration** - Removed incompatible `manualChunks` config
- [x] **Missing dependency** - Added `react-is` package
- [x] **Package.json** - Added `"type": "module"` to eliminate warnings
- [x] **Environment variables** - Removed `NODE_ENV` from `.env.production`
- [x] **TypeScript** - No compilation errors
- [x] **Local build** - Passes successfully

### ✅ Latest Commit
- **Commit**: `ae79ef1` - "Fix Vite build: remove incompatible manualChunks config"
- **Status**: Pushed to main branch
- **Build**: Verified working locally

---

## 🔧 Vercel Configuration (ACTION REQUIRED)

### 1. Environment Variables Setup
Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

#### Required Frontend Variables (Production):
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
VITE_BASE_URL=/
```

#### Required Backend Variables (Production):
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
APP_URL=https://your-vercel-app.vercel.app
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
QBO_CLIENT_ID=your-qbo-client-id
QBO_CLIENT_SECRET=your-qbo-client-secret
QBO_ENVIRONMENT=production
QB_ENCRYPT_KEY=your-32-char-encryption-key
QB_STATE_SECRET=your-state-secret
RESEND_API_KEY=re_xxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxx
```

### 2. Build Settings Verification
Ensure these settings in Vercel:
- **Framework Preset**: Vite
- **Build Command**: `VITE_BASE_URL=/ npm run build` (auto-configured via vercel.json)
- **Install Command**: `npm install --legacy-peer-deps` (auto-configured via vercel.json)
- **Output Directory**: `dist` (auto-configured via vercel.json)
- **Node Version**: 20.x (configured in GitHub Actions)

### 3. Clear Build Cache
- Go to: **Vercel Dashboard → Your Project → Settings → General**
- Scroll to "Build & Development Settings"
- Click **"Clear Build Cache"**
- This ensures the new configuration is used

---

## 🗄️ Supabase Configuration (ACTION REQUIRED)

### 1. Database Setup
Run the SQL scripts in order:
1. `docs/supabase-setup/01-enable-extensions.sql`
2. `docs/supabase-setup/02-create-tables.sql`
3. `docs/supabase-setup/03-create-policies.sql`
4. `docs/supabase-setup/04-create-functions.sql`

### 2. Authentication Setup
- **Email Provider**: Enable in Supabase Dashboard → Authentication → Providers
- **Site URL**: Set to your Vercel production URL
- **Redirect URLs**: Add your Vercel production URL + `/auth/callback`

### 3. Storage Buckets
Create these buckets in Supabase Dashboard → Storage:
- `avatars` (public)
- `documents` (private)
- `company-logos` (public)

### 4. API Keys
- Copy **Project URL** and **anon/public key** to Vercel environment variables
- Copy **service_role key** to Vercel environment variables (keep secret!)

---

## 💳 Stripe Configuration (ACTION REQUIRED)

### 1. Create Products & Prices
Create subscription products in Stripe Dashboard:
- Starter (Monthly & Yearly)
- Pro (Monthly & Yearly)
- Business (Monthly & Yearly)
- Enterprise (Monthly & Yearly)

### 2. Get Price IDs
Copy the price IDs and add to Vercel environment variables:
```
VITE_STRIPE_STARTER_MONTHLY=price_xxxxx
VITE_STRIPE_STARTER_YEARLY=price_xxxxx
VITE_STRIPE_PRO_MONTHLY=price_xxxxx
VITE_STRIPE_PRO_YEARLY=price_xxxxx
VITE_STRIPE_BUSINESS_MONTHLY=price_xxxxx
VITE_STRIPE_BUSINESS_YEARLY=price_xxxxx
VITE_STRIPE_ENTERPRISE_MONTHLY=price_xxxxx
VITE_STRIPE_ENTERPRISE_YEARLY=price_xxxxx
```

### 3. Webhook Setup
- Create webhook endpoint: `https://your-vercel-app.vercel.app/api/stripe/webhook`
- Select events: `customer.subscription.*`, `invoice.*`, `payment_intent.*`
- Copy webhook signing secret to Vercel: `STRIPE_WEBHOOK_SECRET`

---

## 📊 QuickBooks Configuration (ACTION REQUIRED)

### 1. Create App
- Go to: https://developer.intuit.com/
- Create new app
- Set redirect URI: `https://your-vercel-app.vercel.app/api/quickbooks/callback`

### 2. Get Credentials
Copy to Vercel environment variables:
```
QBO_CLIENT_ID=your-client-id
QBO_CLIENT_SECRET=your-client-secret
QBO_ENVIRONMENT=production
```

### 3. Generate Encryption Keys
Run locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Add to Vercel:
```
QB_ENCRYPT_KEY=generated-key
QB_STATE_SECRET=generated-key
```

---

## 🚀 Deployment Steps

### Step 1: Commit Final Changes
```bash
cd /Users/jeffreynewell/crm-kanban-integrate
git add .
git commit -m "Production ready: final configuration updates"
git push origin main
```

### Step 2: Monitor Deployment
- Watch GitHub Actions: https://github.com/614restore/crm-kanban-integrate/actions
- Watch Vercel Dashboard: https://vercel.com/dashboard
- Deployment should complete in ~2 minutes

### Step 3: Verify Deployment
Once deployed, test:
- [ ] Homepage loads
- [ ] Login/signup works
- [ ] Supabase connection works
- [ ] No console errors
- [ ] All routes accessible

---

## 🐛 Troubleshooting

### If Build Fails on Vercel:
1. Check Vercel build logs for specific error
2. Verify all environment variables are set
3. Clear build cache in Vercel settings
4. Redeploy

### If App Loads But Features Don't Work:
1. Check browser console for errors
2. Verify Supabase URL and keys in Vercel env vars
3. Check Supabase logs for authentication issues
4. Verify CORS settings in Supabase

### If Stripe Integration Fails:
1. Verify Stripe keys are correct (test vs live)
2. Check webhook endpoint is accessible
3. Verify webhook signing secret matches

### If QuickBooks Integration Fails:
1. Verify redirect URI matches exactly
2. Check encryption keys are set
3. Verify QBO_ENVIRONMENT is set to "production"

---

## 📞 Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Stripe Docs**: https://stripe.com/docs
- **QuickBooks API**: https://developer.intuit.com/app/developer/qbo/docs/get-started

---

## ✨ Post-Launch Checklist

After successful deployment:
- [ ] Test all critical user flows
- [ ] Monitor error tracking (if configured)
- [ ] Check performance metrics
- [ ] Set up uptime monitoring
- [ ] Configure custom domain (if applicable)
- [ ] Enable Vercel Analytics
- [ ] Set up backup strategy for Supabase

---

**Last Updated**: March 13, 2025
**Build Status**: ✅ PASSING
**Ready for Production**: ✅ YES
