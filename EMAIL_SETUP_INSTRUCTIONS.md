# Email Notifications Setup - Action Required

## What You Need to Do

### 1. Add RESEND_API_KEY to Vercel

Go to your Vercel project settings and add the environment variable:

**Steps**:
1. Go to https://vercel.com/dashboard
2. Select your project: `crm-kanban-integrate`
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (from https://resend.com/api-keys)
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**

### 2. Get Your Resend API Key

If you don't have one yet:
1. Go to https://resend.com/api-keys
2. Create a new API key
3. Copy the key (starts with `re_`)
4. Add it to Vercel (see step 1)

### 3. Commit and Deploy

```bash
git add .
git commit -m "Add email notifications for estimate viewed/signed events"
git push origin main
```

Vercel will auto-deploy with the new environment variable.

## What This Does

Once deployed, the sender will receive **both**:

### 1. When Customer Views Estimate
- **In-app notification**: "Estimate #123 has been opened by the customer"
- **Email notification**: Sent to sender's email with estimate details and link

### 2. When Customer Signs Estimate
- **In-app notification**: "Estimate #123 has been signed by John Doe"
- **Email notification**: Sent to sender's email with signature confirmation and link

## Email Templates

### Viewed Email
- Subject: "Estimate #123 Viewed"
- Blue theme with 📧 icon
- Shows customer name, estimate details
- "View Estimate" button

### Signed Email
- Subject: "✅ Estimate #123 Signed by John Doe"
- Green theme with ✅ icon
- Shows signer name, estimate details
- "View Signed Estimate" button

## Testing

After deployment:
1. Send an estimate to a test email
2. Open the signing link → Check sender's email for "Viewed" notification
3. Sign the estimate → Check sender's email for "Signed" notification

## Notes

- Emails are sent from: `614 Restore <scopemgr@614restore.com>`
- If email fails, in-app notification still works (silent fail)
- Only first view triggers notification (not subsequent views)
- Requires sender to have email in their profile
