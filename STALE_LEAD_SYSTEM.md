# 🎯 Stale Lead Detection & Nudge System

## ✅ Implementation Complete

### Overview
A comprehensive system to ensure no leads fall through the cracks by:
1. **Auto-assigning** all contacts to a user when created
2. **Detecting stale contacts** (24+ hours with no appointments)
3. **Notifying owners** about stale leads
4. **Nudge feature** to remind team members to follow up

---

## 🔧 Components Implemented

### 1. **Auto-Assignment** (`QuickAddModal.tsx`)
**What it does:**
- Every new contact is automatically assigned to someone
- Defaults to the current user if no one is specified
- Ensures 100% of contacts have an owner

**Code location:** Line ~197-199
```typescript
const assignedTo = formData.assignedTo || profile?.id || user?.id;
```

**Result:** ✅ No unassigned contacts

---

### 2. **Stale Lead Detection** (`staleLeadDetection.ts`)
**What it does:**
- Scans all contacts every hour (or on-demand)
- Identifies contacts older than 24 hours with no appointments
- Groups by assigned user
- Calculates priority scores

**Key Functions:**
- `detectStaleContacts()` - Finds stale leads
- `ensureContactsAreAssigned()` - Assigns any unassigned contacts
- `runStaleLeadDetection()` - Main function to run detection
- `getStaleContactsForDisplay()` - Get stale leads for UI

**Criteria for "Stale":**
- ✅ Contact created 24+ hours ago
- ✅ No appointments scheduled
- ✅ Not in closed/won/lost status

---

### 3. **Owner Notifications** (`staleLeadDetection.ts`)
**What it does:**
- Automatically notifies owners/admins about stale leads
- Groups notifications by assigned user
- Separate notification for unassigned leads

**Notification Types:**
1. **Unassigned Stale Leads**
   - Title: "X Unassigned Stale Leads"
   - Sent to: All owners/admins
   
2. **User-Specific Stale Leads**
   - Title: "X Stale Leads - [User Name]"
   - Sent to: All owners/admins
   - Shows which team member needs to follow up

---

### 4. **Nudge Feature** (`OwnerPriorityBoard.tsx`)
**What it does:**
- Owners can manually "nudge" team members about stale leads
- Sends notification to assigned user
- Logs the nudge in contact communications
- Works for both assigned and unassigned contacts

**How it works:**
1. Owner clicks "Nudge" button on stale lead
2. System sends notification to assigned user (or all owners if unassigned)
3. Notification includes:
   - Contact name
   - Days stale
   - Reminder to schedule appointment
4. Logs nudge in contact's communication history

**Code location:** `OwnerPriorityBoard.tsx` lines ~57-120

---

## 📊 Data Flow

```
New Contact Created
        ↓
Auto-Assigned to User
        ↓
24 Hours Pass
        ↓
Stale Detection Runs
        ↓
No Appointments? → Mark as Stale
        ↓
Notify Owners/Admins
        ↓
Owner Clicks "Nudge"
        ↓
Notification Sent to Assigned User
        ↓
User Schedules Appointment
        ↓
Contact No Longer Stale ✅
```

---

## 🎯 Priority Board View

The `OwnerPriorityBoard` component shows:
- **Stale contacts** sorted by priority score
- **Days stale** for each contact
- **Assigned user** name
- **Project value** (or warning if not set)
- **Recommended action** based on status

**Priority Score Calculation:**
- Days stale × 10
- +50 if estimate viewed (hot lead!)
- +30 if estimate sent
- +20 if no project value set
- +100 if payment overdue

---

## 🔔 Notification System

### Notification Types

| Type | Title | Trigger | Recipient |
|------|-------|---------|-----------|
| Warning | "X Unassigned Stale Leads" | Unassigned contacts 24+ hrs old | All owners/admins |
| Warning | "X Stale Leads - [User]" | User's contacts 24+ hrs old | All owners/admins |
| Info | "Reminder: Follow up with [Contact]" | Owner clicks "Nudge" | Assigned user |

### Notification Fields
```typescript
{
  company_id: string,
  user_id: string,        // Who receives it
  type: 'warning' | 'info',
  title: string,
  message: string,
  related_id: string,     // Contact ID
  related_type: 'contact' | 'stale_leads',
  read: boolean
}
```

---

## 🚀 How to Use

### For Owners/Admins

1. **View Stale Leads**
   - Go to Dashboard
   - Look for "Owner Priority Board" widget
   - Shows all stale leads sorted by priority

2. **Nudge a Team Member**
   - Click "Nudge" button on any stale lead
   - Notification sent to assigned user
   - Confirmation message appears

3. **Check Notifications**
   - Bell icon in sidebar shows unread count
   - Click to see all stale lead notifications
   - Click notification to view contact

### For Team Members

1. **Receive Nudge**
   - Notification appears in bell icon
   - Shows contact name and days stale
   - Click to open contact

2. **Take Action**
   - Schedule an appointment
   - Update contact status
   - Add notes about follow-up

3. **Contact Removed from Stale List**
   - Once appointment scheduled, no longer stale
   - Owner sees updated status

---

## 🔧 Configuration

### Stale Threshold
Currently set to **24 hours**. To change:

**File:** `src/lib/staleLeadDetection.ts`
**Line:** ~40
```typescript
if (hoursSinceCreated < 24) {  // Change this number
  continue;
}
```

### Detection Frequency
Stale detection should run:
- **Automatically:** Every hour (via cron job or scheduled task)
- **Manually:** Owner clicks "Refresh" on Priority Board

To set up automatic detection:
```typescript
// In AppLayout.tsx or similar
useEffect(() => {
  const interval = setInterval(() => {
    if (profile?.company_id) {
      runStaleLeadDetection(profile.company_id);
    }
  }, 60 * 60 * 1000); // Every hour
  
  return () => clearInterval(interval);
}, [profile?.company_id]);
```

---

## 📝 Database Schema

### Required Tables

**contacts**
- `id` - UUID
- `company_id` - UUID
- `assigned_to` - UUID (user ID) ← **Must not be null**
- `created_at` - Timestamp
- `status` - String

**appointments**
- `id` - UUID
- `company_id` - UUID
- `contact_id` - UUID
- `created_at` - Timestamp

**notifications**
- `id` - UUID
- `company_id` - UUID
- `user_id` - UUID
- `type` - String
- `title` - String
- `message` - String
- `related_id` - UUID
- `related_type` - String
- `read` - Boolean
- `created_at` - Timestamp

**communications**
- `id` - UUID
- `company_id` - UUID
- `contact_id` - UUID
- `type` - String
- `direction` - String
- `subject` - String
- `content` - String
- `user_id` - UUID
- `created_at` - Timestamp

---

## 🎨 UI Components

### Owner Priority Board
**Location:** Dashboard (for owners/admins only)
**Features:**
- List of stale contacts
- Priority score
- Days stale
- Assigned user
- Project value
- Nudge button
- Quick actions (mark viewed, etc.)

### Notification Bell
**Location:** Sidebar (all users)
**Features:**
- Unread count badge
- Dropdown with notifications
- Click to view contact
- Mark as read
- Clear all

---

## ✅ Testing Checklist

### Auto-Assignment
- [ ] Create new contact without assigning
- [ ] Verify contact is assigned to current user
- [ ] Check database `assigned_to` field is not null

### Stale Detection
- [ ] Create contact
- [ ] Wait 24+ hours (or modify threshold for testing)
- [ ] Run `runStaleLeadDetection(companyId)`
- [ ] Verify contact appears in stale list

### Notifications
- [ ] Verify owner receives notification about stale leads
- [ ] Check notification appears in bell icon
- [ ] Verify unread count updates
- [ ] Click notification and verify it opens contact

### Nudge Feature
- [ ] Click "Nudge" on stale lead
- [ ] Verify assigned user receives notification
- [ ] Check communication log on contact
- [ ] Verify confirmation message appears

### Priority Board
- [ ] View as owner/admin
- [ ] Verify stale leads appear
- [ ] Check priority scores are calculated
- [ ] Verify "Nudge" button works
- [ ] Test "Refresh" button

---

## 🐛 Troubleshooting

### "Nudge sent but no notification received"
**Cause:** User might not have notifications enabled or database error
**Fix:** Check browser console for errors, verify notifications table exists

### "All contacts showing as stale"
**Cause:** Appointments not being counted
**Fix:** Verify appointments table has correct `contact_id` foreign keys

### "Unassigned contacts not being auto-assigned"
**Cause:** Profile or user ID not available
**Fix:** Ensure user is logged in and profile exists

### "Priority board not showing"
**Cause:** User role is not owner/admin
**Fix:** Check user role in profiles table

---

## 📈 Future Enhancements

### Planned Features
1. **Email Nudges** - Send email in addition to in-app notification
2. **SMS Nudges** - Text message reminders
3. **Escalation** - Auto-escalate if still stale after X days
4. **Custom Thresholds** - Per-user or per-status thresholds
5. **Stale Reasons** - Track why leads go stale
6. **Auto-Reassignment** - Reassign if user doesn't respond
7. **Stale Analytics** - Dashboard showing stale lead trends

### Possible Improvements
- Configurable stale threshold per company
- Different thresholds for different lead sources
- Snooze feature for nudges
- Bulk nudge multiple contacts
- Stale lead reports

---

## 🔐 Permissions

| Role | View Stale Leads | Send Nudges | Receive Nudges |
|------|------------------|-------------|----------------|
| Owner | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ |
| Manager | ❌ | ❌ | ✅ |
| Sales | ❌ | ❌ | ✅ |
| Field | ❌ | ❌ | ❌ |

---

## 📚 Related Files

- `src/lib/staleLeadDetection.ts` - Core detection logic
- `src/components/crm/OwnerPriorityBoard.tsx` - UI for owners
- `src/components/crm/QuickAddModal.tsx` - Auto-assignment
- `src/lib/database.ts` - Database operations
- `src/components/crm/Sidebar.tsx` - Notification bell

---

**Status:** ✅ Fully Implemented and Ready for Testing
**Last Updated:** 2024
**Version:** 1.0
