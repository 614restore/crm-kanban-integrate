import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_URL ?? '/';

  return {
    base,
    server: {
      host: '::',
      port: 8080,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Only chunk packages we actually have installed
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-popover',
              '@radix-ui/react-toast',
              '@radix-ui/react-switch',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-label',
            ],
            'vendor-utils': ['date-fns', 'lucide-react', 'sonner'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
    },
  };
});
