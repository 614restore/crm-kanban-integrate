/// <reference types="vite/client" />

declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL?: string
  readonly VITE_EMAIL_API_BASE_URL?: string
  readonly VITE_STRIPE_STARTER_MONTHLY?: string
  readonly VITE_STRIPE_PRO_MONTHLY?: string
  readonly VITE_STRIPE_BUSINESS_MONTHLY?: string
  readonly VITE_STRIPE_SCALE_MONTHLY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
