# Supabase Database Migrations

This folder contains SQL migration files for the CRM application.

## How to Run Migrations

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the contents of the migration file
   - Paste into the SQL editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - Check for the completion message at the bottom
   - Verify tables exist in "Table Editor"

## Migration Files

### `add-suppliers-orders-estimates.sql`
**Purpose:** Adds supplier management, material orders, and customer estimates functionality

**Creates:**
- `suppliers` table - Store supplier/vendor information
- `material_orders` table - Track material orders from suppliers
- `estimates` table - Create and manage customer estimates

**Features:**
- ✅ Row Level Security (RLS) policies for all tables
- ✅ Indexes for performance optimization
- ✅ Auto-updating `updated_at` timestamps
- ✅ Helpful views for reporting
- ✅ Adds `work_email` column to `profiles` table

**Rollback:** If you need to undo this migration:
```sql
-- Remove tables
DROP TABLE IF EXISTS estimates CASCADE;
DROP TABLE IF EXISTS material_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- Remove views
DROP VIEW IF EXISTS active_suppliers_with_stats;
DROP VIEW IF EXISTS estimates_with_customer;
DROP VIEW IF EXISTS pending_estimates;

-- Remove triggers/functions
DROP TRIGGER IF EXISTS suppliers_updated_at_trigger ON suppliers;
DROP TRIGGER IF EXISTS material_orders_updated_at_trigger ON material_orders;
DROP TRIGGER IF EXISTS estimates_updated_at_trigger ON estimates;
DROP FUNCTION IF EXISTS update_suppliers_updated_at();
DROP FUNCTION IF EXISTS update_material_orders_updated_at();
DROP FUNCTION IF EXISTS update_estimates_updated_at();

-- Remove work_email column (optional - only if you want to remove it)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS work_email;
```

## Troubleshooting

### Error: "relation 'companies' does not exist"
Make sure you have a `companies` table created first. The suppliers, material_orders, and estimates tables reference it.

### Error: "relation 'profiles' does not exist"
The RLS policies reference the `profiles` table. Ensure it exists with a `company_id` column.

### Error: "relation 'contacts' does not exist"
The estimates table references the `contacts` table. Make sure it exists first.

### Permission Errors
Ensure you're running the migration as a database administrator or user with sufficient privileges.

## Next Steps After Migration

1. **Test the tables** - Try creating a supplier, material order, and estimate in the app
2. **Verify RLS policies** - Log in as different users to ensure they only see their company's data
3. **Check performance** - Monitor query performance; indexes should be working
4. **Backup your database** - Always have backups before making schema changes

## Database Schema

### Suppliers Table
- Stores vendor/supplier information
- Soft delete support (`is_active` flag)
- Foreign key to `companies` table

### Material Orders Table
- Tracks orders from suppliers
- JSONB column for line items
- Status: pending → ordered → delivered/cancelled
- Foreign keys to `companies` and `suppliers`

### Estimates Table
- Customer-facing estimates/quotes
- JSONB column for line items
- Status workflow: draft → sent → viewed → accepted/declined
- Signature capture support
- Foreign keys to `companies` and `contacts`

## Support

If you encounter issues:
1. Check the Supabase logs in the dashboard
2. Verify all prerequisite tables exist
3. Ensure RLS is enabled on your database
4. Contact support with error messages
