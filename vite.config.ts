import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Default to root path; GitHub Pages can override with VITE_BASE_URL=/crm-kanban-integrate/
  const base = process.env.VITE_BASE_URL ?? "/";

  return {
    base,
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Forward /api/* to the Vercel dev server (run `vercel dev` on port 3000)
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-popover',
              '@radix-ui/react-toast',
              '@radix-ui/react-switch',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-label'
            ],
            'vendor-utils': [
              '@tanstack/react-query',
              'date-fns',
              'lucide-react',
              'sonner',
              'recharts'
            ],
            'vendor-forms': [
              'react-hook-form',
              '@hookform/resolvers',
              'zod'
            ],
            'vendor-supabase': ['@supabase/supabase-js'],
            'crm-core': [
              './src/lib/crmStore.ts',
              './src/lib/crmData.ts',
              './src/lib/database.ts'
            ],
            'integrations': [
              './src/lib/integrations/manager.ts',
              './src/lib/integrations/stripe.ts',
              './src/lib/integrations/quickbooks.ts',
              './src/lib/integrations/twilio.ts',
              './src/lib/integrations/eagleview.ts',
              './src/lib/integrations/weather.ts',
              './src/lib/integrations/aiAssistant.ts'
            ]
          }
        }
      },
      chunkSizeWarningLimit: 500,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      }
    }
  };
});
