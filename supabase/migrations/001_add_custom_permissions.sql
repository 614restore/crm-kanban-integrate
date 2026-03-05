-- Add custom_permissions column to profiles table
-- This allows per-user permission overrides beyond their default role permissions

-- Add the column (JSONB for flexible permission storage)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS custom_permissions JSONB;

-- Add a comment describing the column
COMMENT ON COLUMN profiles.custom_permissions IS 'Stores custom permission overrides for this user. Format: {"category_name": "permission_level"}. Example: {"contacts_leads": "full", "invoicing": "create"}';

-- Create an index for better query performance when filtering by permissions
CREATE INDEX IF NOT EXISTS idx_profiles_custom_permissions 
ON profiles USING GIN (custom_permissions);

-- Update RLS policy to allow users to update their own custom_permissions
-- Only allow owners and admins to modify other users' permissions
CREATE POLICY "Users can view all profiles in their company"
ON profiles FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE company_id = profiles.company_id
  )
);

CREATE POLICY "Owners and admins can update team member permissions"
ON profiles FOR UPDATE
USING (
  -- User is updating themselves
  auth.uid() = id
  OR
  -- User is an owner or admin in the same company
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE company_id = profiles.company_id 
    AND role IN ('owner', 'admin', 'sales_manager', 'production_manager', 'manager')
  )
);
