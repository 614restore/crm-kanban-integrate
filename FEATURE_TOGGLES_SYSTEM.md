# 🎛️ Feature Toggles System

## ✅ Implementation Complete

### Overview
A comprehensive feature management system that allows companies to enable/disable features based on their needs and subscription plan.

---

## 🎯 Features Included

### Automation Features
1. **Stale Lead Detection** ✅
   - Auto-flag contacts with no activity after 24 hours
   - Notify owners automatically
   - Default: ON

2. **Auto Contact Assignment** ✅
   - Automatically assign new contacts to creating user
   - Ensures 100% assignment rate
   - Default: ON

3. **Automated Review Requests** 🔜
   - Send review requests after job completion
   - Coming Soon
   - Default: OFF

4. **Custom Workflows** 💼
   - Create automated workflows and triggers
   - Requires: Professional plan
   - Default: ON

### Notification Features
5. **Owner Nudge Notifications** ✅
   - Allow owners to send reminders to team members
   - Default: ON

6. **Email Notifications** ✅
   - Send email notifications for important events
   - Default: ON

7. **SMS Notifications** 🔜💼
   - Send text message notifications
   - Requires: Professional plan
   - Coming Soon
   - Default: OFF

### Integration Features
8. **Calendar Sync** ✅
   - Sync with Google Calendar, Outlook, etc.
   - Default: ON

9. **Mobile Photo Tagging** 🔜
   - Tag and organize photos from mobile
   - Coming Soon
   - Default: OFF

### Advanced Features
10. **AI Assistant** 💼
    - AI-powered insights and recommendations
    - Requires: Professional plan
    - Default: ON

11. **Advanced Reporting** 💼
    - Detailed analytics and custom reports
    - Requires: Professional plan
    - Default: ON

12. **API Access** 🏢
    - Access TrussCTR API for custom integrations
    - Requires: Enterprise plan
    - Default: OFF

---

## 📁 Files Created/Modified

### New Files
1. ✅ `src/components/crm/FeatureToggles.tsx` - Main component
2. ✅ `FEATURE_TOGGLES_SYSTEM.md` - This documentation

### Modified Files
1. ✅ `src/components/crm/SettingsView.tsx` - Added features tab
2. ✅ `src/lib/staleLeadDetection.ts` - Already created
3. ✅ `src/components/crm/OwnerPriorityBoard.tsx` - Already updated
4. ✅ `src/components/crm/QuickAddModal.tsx` - Already updated

---

## 🎨 UI Design

### Feature Card Layout
```
┌─────────────────────────────────────────────────┐
│ [Icon] Feature Name              [Toggle Switch]│
│        Description text                         │
│        ✓ Active (if enabled)                    │
│        [Coming Soon] [Professional+] (badges)   │
└─────────────────────────────────────────────────┘
```

### Categories
- **Automation** - Workflow and process automation
- **Notifications** - Alert and reminder systems
- **Integrations** - Third-party connections
- **Advanced Features** - Premium capabilities

---

## 🔐 Plan Requirements

| Plan | Features Available |
|------|-------------------|
| Trial | Basic features only |
| Starter | Basic features only |
| Professional | + Custom Workflows, SMS, AI, Advanced Reporting |
| Enterprise | + API Access |

---

## 💾 Data Storage

### Current Implementation
Features are stored in **localStorage** with key:
```
company_features_{companyId}
```

### Production Implementation (TODO)
Should be stored in database:

**Option 1: JSON Column in companies table**
```sql
ALTER TABLE companies ADD COLUMN features JSONB DEFAULT '{}';
```

**Option 2: Separate features table**
```sql
CREATE TABLE company_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, feature_key)
);
```

---

## 🚀 How to Use

### For Admins/Owners

1. **Access Feature Toggles**
   - Go to Settings
   - Click "Feature Toggles" tab
   - See all available features

2. **Enable/Disable Features**
   - Click toggle switch next to feature
   - Green = Enabled, Gray = Disabled
   - Changes save automatically

3. **Check Plan Requirements**
   - Features with badges require plan upgrades
   - Click toggle to see upgrade prompt
   - "Coming Soon" features can't be toggled yet

### For Developers

**Check if feature is enabled:**
```typescript
import { getFeatureStatus } from '@/lib/features';

const isStaleDetectionEnabled = await getFeatureStatus(
  companyId, 
  'stale_lead_detection'
);

if (isStaleDetectionEnabled) {
  // Run stale lead detection
}
```

**Wrap feature code:**
```typescript
// In component
const { features } = useFeatures();

{features.stale_lead_detection && (
  <OwnerPriorityBoard />
)}
```

---

## 🎯 Feature Flags in Code

### Stale Lead Detection
**Location:** `src/lib/staleLeadDetection.ts`
**Check before running:**
```typescript
if (features.stale_lead_detection) {
  await runStaleLeadDetection(companyId);
}
```

### Auto Contact Assignment
**Location:** `src/components/crm/QuickAddModal.tsx`
**Check before assigning:**
```typescript
const assignedTo = features.auto_contact_assignment
  ? (formData.assignedTo || profile?.id)
  : formData.assignedTo;
```

### Owner Nudge Notifications
**Location:** `src/components/crm/OwnerPriorityBoard.tsx`
**Check before showing:**
```typescript
{features.owner_nudge_notifications && (
  <button onClick={handleNudge}>Nudge</button>
)}
```

---

## 🔔 Notifications

### Feature Toggle Changed
When a feature is toggled, the system:
1. Updates localStorage (or database)
2. Shows success indicator
3. Applies change immediately
4. No page refresh needed

### Plan Upgrade Required
When user tries to enable premium feature:
1. Shows alert with plan requirement
2. Suggests upgrade
3. Links to billing section
4. Toggle stays in current state

### Coming Soon Features
When user tries to enable coming soon feature:
1. Shows "Coming Soon" alert
2. Provides timeline if available
3. Toggle stays disabled

---

## 📊 Analytics (Future)

Track feature usage:
- Which features are most popular
- Which features are never used
- Correlation with plan upgrades
- Feature adoption rates

---

## 🐛 Troubleshooting

### "Feature toggle not saving"
**Cause:** localStorage quota exceeded or database error
**Fix:** Clear localStorage or check database connection

### "Can't enable premium feature"
**Cause:** Plan doesn't support feature
**Fix:** Upgrade subscription in Billing section

### "Feature enabled but not working"
**Cause:** Code not checking feature flag
**Fix:** Add feature flag check in code

### "Features reset after logout"
**Cause:** Using localStorage instead of database
**Fix:** Implement database storage

---

## 🔄 Migration Path

### Phase 1: localStorage (Current) ✅
- Quick implementation
- No database changes needed
- Works immediately
- Lost on cache clear

### Phase 2: Database Storage (Recommended)
```sql
-- Add features column to companies table
ALTER TABLE companies ADD COLUMN features JSONB DEFAULT '{}';

-- Update existing companies with defaults
UPDATE companies SET features = '{
  "stale_lead_detection": true,
  "auto_contact_assignment": true,
  "owner_nudge_notifications": true,
  "email_notifications": true,
  "calendar_sync": true,
  "ai_assistant": true,
  "advanced_reporting": true,
  "custom_workflows": true
}'::jsonb;
```

### Phase 3: Feature Usage Tracking
```sql
CREATE TABLE feature_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  feature_key VARCHAR(100),
  action VARCHAR(20), -- 'enabled', 'disabled', 'used'
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ Testing Checklist

### UI Tests
- [ ] Feature Toggles tab appears in Settings
- [ ] All features are listed
- [ ] Toggle switches work
- [ ] Categories are organized
- [ ] Badges show correctly (Coming Soon, Professional+)
- [ ] Help text is visible

### Functionality Tests
- [ ] Toggle saves to localStorage
- [ ] Toggle persists after page refresh
- [ ] Premium features show upgrade prompt
- [ ] Coming Soon features show alert
- [ ] Active indicator shows when enabled

### Plan Restriction Tests
- [ ] Trial plan can't enable Professional features
- [ ] Starter plan can't enable Professional features
- [ ] Professional plan can enable Professional features
- [ ] Enterprise plan can enable all features

### Integration Tests
- [ ] Stale detection respects toggle
- [ ] Auto-assignment respects toggle
- [ ] Nudge feature respects toggle
- [ ] Other features check toggle before running

---

## 🎨 Customization

### Add New Feature
1. Add to `CompanyFeatures` interface
2. Add to `DEFAULT_FEATURES` object
3. Add to `FEATURE_CONFIGS` array
4. Implement feature flag check in code

Example:
```typescript
// 1. Add to interface
export interface CompanyFeatures {
  // ... existing features
  my_new_feature: boolean;
}

// 2. Add to defaults
const DEFAULT_FEATURES = {
  // ... existing defaults
  my_new_feature: false,
};

// 3. Add to configs
{
  key: 'my_new_feature',
  label: 'My New Feature',
  description: 'Description of what it does',
  icon: <Star className="w-5 h-5" />,
  category: 'automation',
  requiresPlan: 'professional',
},

// 4. Check in code
if (features.my_new_feature) {
  // Run feature
}
```

### Change Default State
Edit `DEFAULT_FEATURES` object in `FeatureToggles.tsx`

### Add New Category
1. Add to `CATEGORY_LABELS`
2. Update `category` type in `FeatureConfig`
3. Add features with new category

---

## 📈 Future Enhancements

1. **Feature Usage Analytics**
   - Track which features are used most
   - Show usage stats to admins

2. **A/B Testing**
   - Enable features for subset of users
   - Measure impact

3. **Scheduled Toggles**
   - Enable/disable features at specific times
   - Useful for maintenance

4. **User-Level Toggles**
   - Allow individual users to disable features
   - Personal preferences

5. **Feature Announcements**
   - Show "New Feature" badges
   - In-app announcements when features launch

---

## 🔐 Permissions

| Role | Can View | Can Toggle |
|------|----------|------------|
| Owner | ✅ | ✅ |
| Admin | ✅ | ✅ |
| Manager | ✅ | ❌ |
| Sales | ❌ | ❌ |
| Field | ❌ | ❌ |

---

## 📚 Related Documentation

- `STALE_LEAD_SYSTEM.md` - Stale lead detection details
- `CONTACT_TIMEOUT_FIX.md` - Contact creation fixes
- `LOGIN_PAGE_MESSAGING_UPDATE.md` - Login page updates

---

**Status:** ✅ Fully Implemented and Ready for Testing
**Storage:** localStorage (migrate to database recommended)
**Last Updated:** 2024
**Version:** 1.0
