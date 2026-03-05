SELECT 
  id,
  email,
  role,
  token,
  accepted,
  expires_at,
  created_at
FROM invitations 
WHERE company_id = 'fd18628f-b0f8-4e57-adbb-0b3176ed91bc'
ORDER BY created_at DESC 
LIMIT 5;
