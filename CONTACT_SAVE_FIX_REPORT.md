# Contact Save Issue - Root Cause Analysis & Fix

**Date**: April 2, 2026  
**Issue**: Saving contacts was failing silently or with errors

## Root Cause

The application code and database schema were out of sync. The TypeScript interface `DbContact` and the save logic were trying to write fields that **do not exist** in the Supabase database.

### Missing Database Columns

The following fields exist in the code but were **missing from the contacts table**:

1. **Phone Fields**
   - `phone1` (code uses this)
   - `phone2` (code uses this)
   - Note: Database only had `phone` (singular)

2. **Deposit Tracking Fields**
   - `deposit_amount` (NUMERIC)
   - `deposit_paid` (BOOLEAN)
   - `deposit_date` (DATE)

3. **Final Payment Tracking Fields**
   - `final_payment_amount` (NUMERIC)
   - `final_payment_paid` (BOOLEAN)
   - `final_payment_date` (DATE)

4. **Other Fields**
   - `is_retail` (BOOLEAN) - might exist in some environments but not all
   - `retail_notes` (TEXT)
   - `project_type` (TEXT) - might exist in some environments

### Where the Mismatch Occurred

**Code Locations:**
- `src/components/crm/ContactDetail.tsx` (line 735-742): Tries to save deposit and final payment fields
- `src/lib/database.ts` (DbContact interface): Defines these fields as part of the type

**Database Schema:**
- `SUPABASE_FULL_BACKUP_20260401.sql`: Shows actual DB schema (no deposit/final_payment fields)
- Local schema file `supabase/setup-step-2-tables.sql`: Also outdated

### Why This Caused Save Failures

When the code tried to update a contact with:
```typescript
const updateData = {
  deposit_amount: editedContact.depositAmount ?? null,
  deposit_paid: editedContact.depositPaid ?? false,
  deposit_date: editedContact.depositDate ?? null,
  final_payment_amount: editedContact.finalPaymentAmount ?? null,
  final_payment_paid: editedContact.finalPaymentPaid ?? false,
  final_payment_date: editedContact.finalPaymentDate ?? null,
  // ... other fields
};

await db.updateContact(editedContact.id, updateData);
```

Supabase/PostgreSQL would reject the query because these columns don't exist, returning an error like:
- `column "deposit_amount" of relation "contacts" does not exist`
- `column "phone1" of relation "contacts" does not exist`

## Previous Attempts to Fix

Recent commits show attempts to address symptoms rather than the root cause:

1. **5c8d57f** (Apr 2): Extended timeout from 30s to 45s, added retry logic
2. **78b75be** (Apr 2): Added authentication debugging
3. **5b0614b**: Fixed infinite spinner on mobile

These helped with UX but didn't address the actual schema mismatch.

## The Fix

Created migration file: `supabase/migrations/20260402210000_fix_contacts_schema_mismatch.sql`

This migration:
1. ✅ Adds `phone1` and `phone2` columns
2. ✅ Adds all deposit tracking fields
3. ✅ Adds all final payment tracking fields
4. ✅ Adds retail and project_type fields
5. ✅ Migrates existing `phone` data to `phone1`
6. ✅ Adds helpful column comments
7. ✅ Notifies PostgREST to reload schema

## How to Apply the Fix

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Copy the content of `supabase/migrations/20260402210000_fix_contacts_schema_mismatch.sql`
3. Paste and run it
4. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts' ORDER BY column_name;`

### Option 2: Via Supabase CLI
```bash
npx supabase db push
```

## Verification Steps

After applying the migration:

1. **Check columns exist:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND column_name IN ('phone1', 'phone2', 'deposit_amount', 'deposit_paid', 
                       'deposit_date', 'final_payment_amount', 'final_payment_paid', 
                       'final_payment_date', 'is_retail', 'retail_notes', 'project_type')
ORDER BY column_name;
```

2. **Test contact save:**
   - Open the app
   - Create or edit a contact
   - Add phone numbers, deposit info, and final payment info
   - Save and verify no errors in browser console

3. **Check data persisted:**
```sql
SELECT id, first_name, last_name, phone1, phone2, deposit_amount, deposit_paid
FROM contacts
WHERE phone1 IS NOT NULL OR deposit_amount IS NOT NULL
LIMIT 5;
```

## Next Steps

1. ✅ Apply the migration to production database
2. ⚠️ Update local schema file `supabase/setup-step-2-tables.sql` to match production
3. ⚠️ Consider adding integration tests that verify schema matches TypeScript interfaces
4. ⚠️ Add a schema validation script to catch these mismatches in the future

## Files Modified

- Created: `supabase/migrations/20260402210000_fix_contacts_schema_mismatch.sql`
- Created: `CONTACT_SAVE_FIX_REPORT.md` (this file)

## Impact

- **Severity**: High (core feature broken)
- **Affected Users**: All users trying to save contact information
- **Fix Complexity**: Low (simple schema migration)
- **Risk**: Low (migration is idempotent and backward compatible)
