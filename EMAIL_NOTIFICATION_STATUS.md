# Email & Notification Status - Estimate System

## ✅ What's Working:

### 1. **Email Sending** ✅ WORKING
- **Estimate Sent Email**: When you click "Send Estimate", customer receives email with:
  - Estimate details
  - Line items table
  - Total amount
  - Notes and terms
  - Professional HTML formatting
- **Signature Request Email**: When you click "Request Signature", customer receives:
  - Unique signing link
  - Estimate summary
  - Call-to-action button
  - Link expires when signed

**Location**: `EstimatesView.tsx` lines ~350-400 (handleSendEstimate) and ~550-600 (handleRequestSignature)

---

### 2. **Public Signing Page** ✅ WORKING
- Customer clicks link in email
- Sees full estimate with line items
- Can draw signature
- Submits to accept estimate
- **API Endpoint**: `/api/sign-document.mjs` (Vercel serverless function)
- **Frontend**: `SignEstimate.tsx`

**Features**:
- Token-based security (unique per estimate)
- Validates estimate status (must be 'sent' or 'viewed')
- Prevents double-signing
- Shows success confirmation

---

### 3. **Estimate Status Tracking** ✅ WORKING
- **Draft** → **Sent** → **Viewed** → **Accepted**
- Database fields track:
  - `sent_at` - When estimate was emailed
  - `viewed_at` - When customer opened it
  - `accepted_at` - When customer signed
  - `signed_by` - Customer name
  - `signature_data` - Base64 signature image

---

## ⚠️ What's MISSING:

### 1. **"Estimate Viewed" Notification** ❌ NOT IMPLEMENTED
**Problem**: When customer opens the estimate link, no notification is sent to sales team

**What's needed**:
- Track when customer views the estimate (page load)
- Create notification for salesman/owner
- Update `viewed_at` timestamp
- Change status from 'sent' → 'viewed'

**Where to add**: `SignEstimate.tsx` - Add API call on page load

---

### 2. **"Estimate Signed" Notification** ❌ NOT IMPLEMENTED  
**Problem**: When customer signs estimate, no notification is sent to sales team

**What's needed**:
- After successful signature submission
- Create notification for salesman/owner
- Notification should say: "🎉 [Customer Name] signed Estimate #[number]!"

**Where to add**: `api/sign-document.mjs` - After successful signature save

---

### 3. **Automatic Contact Status Sync** ⚠️ PARTIAL
**Current**: Contact status updates to 'estimate_sent' and 'signed' happen in the UI
**Problem**: If customer signs via public link, contact status doesn't update automatically
**What's needed**: API endpoint should also update contact status

---

## 🔧 How to Fix:

### Fix #1: Add "Estimate Viewed" Tracking

**In `SignEstimate.tsx`**, add this after estimate loads:

```typescript
useEffect(() => {
  if (!estimate || alreadySigned) return;
  
  // Track view
  fetch(`${API_BASE}/track-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estimateId: estimate.id, token: id })
  }).catch(console.error);
}, [estimate, alreadySigned, id]);
```

**Create new API endpoint** `/api/track-estimate-view.mjs`:
- Update estimate status to 'viewed'
- Set `viewed_at` timestamp
- Create notification for salesman/owner
- Update contact status

---

### Fix #2: Add "Estimate Signed" Notification

**In `api/sign-document.mjs`**, after successful signature (line ~70), add:

```javascript
// Create notification for salesman/owner
const notificationRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    company_id: updated.company_id,
    user_id: updated.created_by, // or assigned salesman
    type: 'success',
    title: `🎉 Estimate Signed!`,
    message: `${signedBy} signed Estimate #${updated.estimate_number}`,
    related_id: estimateId,
    related_type: 'estimate',
    read: false,
  }),
});
```

---

### Fix #3: Sync Contact Status Automatically

**In `api/sign-document.mjs`**, after signature save, add:

```javascript
// Update contact status to 'signed'
await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${updated.contact_id}`, {
  method: 'PATCH',
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'signed',
    project_value: updated.total,
    updated_at: new Date().toISOString(),
  }),
});
```

---

## 📊 Current Flow:

```
1. Salesman creates estimate → Status: draft
2. Salesman clicks "Send Estimate" → Email sent → Status: sent
3. Customer opens email link → ❌ NO NOTIFICATION → Status: viewed (manual)
4. Customer signs estimate → ❌ NO NOTIFICATION → Status: accepted
5. Salesman sees status change in UI (if they refresh)
```

## 🎯 Desired Flow:

```
1. Salesman creates estimate → Status: draft
2. Salesman clicks "Send Estimate" → Email sent → Status: sent
3. Customer opens email link → ✅ NOTIFICATION: "Customer viewed estimate" → Status: viewed
4. Customer signs estimate → ✅ NOTIFICATION: "Customer signed estimate!" → Status: accepted
5. Salesman gets real-time notification → Can immediately follow up
```

---

## 🚀 Quick Fix Summary:

**To make everything work**, you need to:

1. ✅ **Email sending** - Already working
2. ❌ **Add view tracking** - Create `/api/track-estimate-view.mjs`
3. ❌ **Add signed notification** - Modify `/api/sign-document.mjs`
4. ❌ **Auto-sync contact status** - Modify `/api/sign-document.mjs`

**Estimated time**: 30-45 minutes to implement all 3 fixes

---

## 📝 Files to Modify:

1. `/src/pages/SignEstimate.tsx` - Add view tracking
2. `/api/sign-document.mjs` - Add notifications + contact sync
3. `/api/track-estimate-view.mjs` - NEW FILE (create this)

---

**Want me to implement these fixes now?** Just say the word and I'll add all the missing notification features! 🚀
