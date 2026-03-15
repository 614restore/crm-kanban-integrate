# Estimate Notification System - Implementation Complete

## Overview
Implemented real-time notifications for estimate viewing and signing events. The sender (salesman/user who sent the estimate) now receives automatic notifications when:
1. Customer opens/views the estimate
2. Customer signs the estimate

## Changes Made

### 1. New API Endpoint: `/api/track-view.mjs`
**Purpose**: Track when customer first views estimate and notify sender

**Flow**:
- Called when customer loads the public signing page
- Updates estimate status from 'sent' → 'viewed'
- Records `viewed_at` timestamp
- Creates notification for sender with type 'estimate_viewed'
- Only tracks first view (ignores subsequent views)

**Notification Details**:
- Type: `estimate_viewed`
- Title: "Estimate Viewed"
- Message: "Estimate #[number] "[title]" has been opened by the customer"
- Link: `/estimates/[id]`

### 2. Updated: `/api/sign-document.mjs`
**Added GET Handler**:
- Loads estimate by token for public signing page
- Returns estimate details and `alreadySigned` flag
- Includes company information for display

**Enhanced POST Handler**:
- After successful signature submission
- Fetches estimate details (sent_by, estimate_number, title)
- Creates notification for sender with type 'estimate_signed'
- Silent fail on notification error (doesn't block signature)

**Notification Details**:
- Type: `estimate_signed`
- Title: "Estimate Signed"
- Message: "Estimate #[number] "[title]" has been signed by [customer name]"
- Link: `/estimates/[id]`

### 3. Updated: `/src/pages/SignEstimate.tsx`
**View Tracking**:
- Calls `/api/track-view` when estimate loads
- Passes token for identification
- Silent fail (doesn't block UI if tracking fails)
- Only tracks if estimate not already signed

**Signature Submission**:
- Now includes `token` in POST request body
- Required for security validation in backend

## Database Requirements

### Estimates Table
Must have these fields (should already exist):
- `sent_by` (UUID) - User who sent the estimate
- `estimate_number` (text) - Display number
- `title` (text) - Estimate title
- `status` (text) - Current status
- `viewed_at` (timestamp) - When first viewed
- `accepted_at` (timestamp) - When signed
- `sign_token` (text) - Unique token for public link
- `signed_by` (text) - Customer name
- `signature_data` (text) - Base64 signature image

### Notifications Table
Must have these fields:
- `user_id` (UUID) - Recipient user
- `type` (text) - Notification type
- `title` (text) - Notification title
- `message` (text) - Notification message
- `link` (text) - Navigation link
- `created_at` (timestamp) - Creation time
- `read` (boolean) - Read status (default false)

## User Experience

### For Salesman/Sender:
1. Sends estimate via email with signature request
2. Receives notification when customer opens link: "Estimate #123 has been opened by the customer"
3. Receives notification when customer signs: "Estimate #123 has been signed by John Doe"
4. Can click notification to view estimate details

### For Customer:
1. Receives email with signing link
2. Opens link (triggers view notification)
3. Reviews estimate details
4. Signs estimate (triggers signed notification)
5. Sees success confirmation

## Security Features
- Token-based authentication for public links
- UUID validation to prevent injection
- Status validation (only 'sent' or 'viewed' can be signed)
- Token must match estimate's sign_token
- CORS properly configured

## Testing Checklist

- [ ] Send estimate to test email
- [ ] Open signing link → verify sender gets "viewed" notification
- [ ] Sign estimate → verify sender gets "signed" notification
- [ ] Check notification links navigate correctly
- [ ] Verify notifications show in notification panel
- [ ] Test with already-signed estimate (should not create duplicate notifications)
- [ ] Test with invalid token (should show error)

## Deployment Notes

**Files to commit**:
- `api/track-view.mjs` (NEW)
- `api/sign-document.mjs` (MODIFIED)
- `src/pages/SignEstimate.tsx` (MODIFIED)

**Environment Variables Required**:
- `VITE_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Vercel Auto-Deploy**:
- Push to GitHub → Vercel automatically deploys
- New API endpoint will be available at `/api/track-view`
- Updated endpoints will replace existing ones

## Future Enhancements
- [ ] Email notification in addition to in-app notification
- [ ] Notification preferences (allow users to opt-out)
- [ ] Reminder notifications if estimate viewed but not signed after X days
- [ ] Analytics dashboard showing view/sign conversion rates
- [ ] Multiple signature support for multi-party estimates
