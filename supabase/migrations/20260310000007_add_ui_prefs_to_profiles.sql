-- Add ui_prefs JSONB column to profiles for per-user UI preferences
-- (e.g., DocumentTemplates custom folders and folder assignments)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ui_prefs JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.ui_prefs IS
  'Per-user UI preferences stored as JSONB. Keys: dt_custom_folders (string[]), dt_folder_map (Record<string,string>).';
