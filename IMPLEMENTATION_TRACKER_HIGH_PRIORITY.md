# 🚀 HIGH PRIORITY FEATURES - Implementation Tracker

**Date Started:** March 2026  
**Features:** Automated Review Requests + Mobile Photo Tagging  
**Estimated Time:** 4-6 hours  
**Status:** 🟡 IN PROGRESS

---

## 📋 Pre-Implementation Checklist

### System State Verification ✅
- [x] Verified automationEngine.ts exists and functional
- [x] Verified emailApi.ts exists and functional
- [x] Verified storage.ts exists and functional
- [x] Verified DocumentCenter.tsx exists and functional
- [x] Confirmed no blocking issues

### Current Capabilities ✅
- [x] Automation framework operational
- [x] Email sending functional (requires Resend API key)
- [x] File upload working
- [x] Photo upload with mobile camera working
- [x] Document metadata storage working

---

## 🎯 Feature 1: Automated Review Requests

### Implementation Plan

**Goal:** Automatically send review request emails when work order/project status changes to "completed"

**Components to Modify:**
1. `src/lib/automationEngine.ts` - Add review request email template
2. `src/components/crm/AutomationsView.tsx` - Add UI for review automation
3. `src/lib/crmData.ts` - Add company review links to Company interface
4. `src/components/settings/CompanySettings.tsx` - Add review links input fields

**New Files to Create:**
- None (using existing infrastructure)

**Database Changes:**
- None (using existing automations table)

**Configuration Required:**
- Company must have review links (Google, Yelp) in settings
- Email integration (Resend API) must be configured

### Implementation Steps

#### Step 1: Add Review Links to Company Settings
**File:** `src/lib/crmData.ts`
**Changes:**
- Add `googleReviewUrl?: string` to Company interface
- Add `yelpReviewUrl?: string` to Company interface

#### Step 2: Add Review Links UI in Settings
**File:** `src/components/settings/CompanySettings.tsx`
**Changes:**
- Add input fields for Google Review URL
- Add input fields for Yelp Review URL
- Save to company profile

#### Step 3: Add Review Request Email Template
**File:** `src/lib/automationEngine.ts`
**Changes:**
- Add `buildReviewRequestEmail()` function
- Add review request handling in `executeAction()`
- Include Google/Yelp links in email

#### Step 4: Add Review Automation to UI
**File:** `src/components/crm/AutomationsView.tsx`
**Changes:**
- Add "Send Review Request" action type
- Add trigger: "When status changes to completed"
- Add delay option (immediate, 24 hours, 48 hours)

### Testing Checklist
- [ ] Company settings save review links
- [ ] Review links display in settings
- [ ] Automation triggers on status change to completed
- [ ] Email contains correct review links
- [ ] Email template looks professional
- [ ] Works with and without review links configured

### Rollback Plan
- All changes are additive (no breaking changes)
- If issues occur, disable automation in UI
- Review links are optional fields

---

## 🎯 Feature 2: Mobile Photo Tagging

### Implementation Plan

**Goal:** Allow users to tag photos during upload (before/during/after, damage type, location)

**Components to Modify:**
1. `src/lib/database.ts` - Add tags field to documents table
2. `src/components/crm/DocumentCenter.tsx` - Add tag selection UI on upload
3. `src/lib/storage.ts` - Store tags in document metadata

**New Files to Create:**
- `src/components/crm/PhotoTagSelector.tsx` - Tag selection component

**Database Changes:**
- Add `tags` JSONB column to `documents` table (migration)

**Tag Categories:**
- **Stage:** Before, During, After, Final
- **Type:** Roof Damage, Hail Damage, Wind Damage, Water Damage, Interior, Exterior
- **Location:** Front, Back, Left Side, Right Side, Roof, Interior
- **Custom:** User-defined tags

### Implementation Steps

#### Step 1: Database Migration
**File:** `supabase/migrations/20260315000001_add_photo_tags.sql`
**Changes:**
- Add `tags` JSONB column to documents table
- Add index on tags for filtering
- Backward compatible (nullable field)

#### Step 2: Update Database Interface
**File:** `src/lib/database.ts`
**Changes:**
- Add `tags?: string[]` to DbDocument interface
- Update createDocument() to accept tags
- Update getDocuments() to return tags

#### Step 3: Create Tag Selector Component
**File:** `src/components/crm/PhotoTagSelector.tsx`
**Changes:**
- Create multi-select tag component
- Predefined tags + custom tag input
- Visual tag chips
- Mobile-friendly UI

#### Step 4: Integrate Tag Selector in Upload Flow
**File:** `src/components/crm/DocumentCenter.tsx`
**Changes:**
- Add tag selector before upload
- Show tags on uploaded photos
- Filter photos by tag
- Display tags as badges on photo cards

### Testing Checklist
- [ ] SQL migration runs successfully
- [ ] Tags save to database
- [ ] Tags display on photos
- [ ] Filter by tag works
- [ ] Mobile camera upload includes tags
- [ ] Desktop upload includes tags
- [ ] Tags are optional (backward compatible)
- [ ] Old photos without tags still work

### Rollback Plan
- SQL migration is additive (nullable column)
- Old photos continue to work without tags
- If issues occur, tags simply won't display

---

## 🔍 Testing Strategy

### Unit Testing
- [ ] Review email template renders correctly
- [ ] Tag selector component works in isolation
- [ ] Database functions handle tags correctly

### Integration Testing
- [ ] Automation triggers on status change
- [ ] Email sends with correct content
- [ ] Photo upload with tags saves correctly
- [ ] Filter by tag returns correct results

### End-to-End Testing
- [ ] Complete work order → status completed → email sent
- [ ] Upload photo with tags → view photo → tags display
- [ ] Filter photos by tag → correct photos shown

### Regression Testing
- [ ] Existing automations still work
- [ ] Existing photo uploads still work
- [ ] Document center functionality unchanged
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Build succeeds

---

## 📝 Change Log

### Files Modified
*Will be updated as implementation progresses*

### Files Created
*Will be updated as implementation progresses*

### Database Changes
*Will be updated as implementation progresses*

---

## 🐛 Known Issues / Troubleshooting

*Will be updated if issues are discovered*

---

## ✅ Completion Criteria

### Feature 1: Automated Review Requests
- [ ] Company can configure review links in settings
- [ ] Automation sends email on status = completed
- [ ] Email contains working review links
- [ ] Email template is professional
- [ ] Works without breaking existing features
- [ ] Documented in user guide

### Feature 2: Mobile Photo Tagging
- [ ] Users can select tags during upload
- [ ] Tags save to database
- [ ] Tags display on photos
- [ ] Filter by tag works
- [ ] Mobile and desktop both work
- [ ] Backward compatible with old photos
- [ ] Documented in user guide

---

## 📊 Progress Tracking

**Feature 1: Automated Review Requests**
- [ ] Step 1: Company settings (30 min)
- [ ] Step 2: Settings UI (30 min)
- [ ] Step 3: Email template (45 min)
- [ ] Step 4: Automation UI (30 min)
- [ ] Testing (30 min)

**Feature 2: Mobile Photo Tagging**
- [ ] Step 1: Database migration (15 min)
- [ ] Step 2: Database interface (15 min)
- [ ] Step 3: Tag selector component (60 min)
- [ ] Step 4: Integration (45 min)
- [ ] Testing (30 min)

**Total Estimated:** 4.5 hours  
**Actual Time:** TBD

---

## 🚀 Deployment Checklist

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Build succeeds
- [ ] SQL migration ready
- [ ] Documentation updated
- [ ] Change log complete
- [ ] Ready for production

---

**Status:** Ready to begin implementation  
**Next Step:** Feature 1, Step 1 - Add review links to Company interface
