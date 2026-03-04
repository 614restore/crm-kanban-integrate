import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = mode === "production" ? "/crm-kanban-integrate/" : "/";

  return {
    base,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Core vendor libraries
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
            // Supabase in separate chunk
            'vendor-supabase': ['@supabase/supabase-js'],
            // CRM core functionality
            'crm-core': [
              './src/lib/crmStore.ts',
              './src/lib/crmData.ts',
              './src/lib/database.ts'
            ],
            // Integration modules
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
      // Optimize chunk size
      chunkSizeWarningLimit: 500,
      // Enable minification
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
