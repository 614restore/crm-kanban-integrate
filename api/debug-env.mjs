export default function handler(req, res) {
  res.json({
    has_supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_supabase_anon_key: !!(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    has_qbo_client_id: !!process.env.QBO_CLIENT_ID,
    has_qbo_client_secret: !!process.env.QBO_CLIENT_SECRET,
    qbo_env: process.env.QBO_ENVIRONMENT || '(not set)',
    has_resend: !!process.env.RESEND_API_KEY,
    has_vite_supabase_url: !!process.env.VITE_SUPABASE_URL,
    has_vite_anon_key: !!process.env.VITE_SUPABASE_ANON_KEY,
  });
}
