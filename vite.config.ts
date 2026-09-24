import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Each build gets an id; open tabs poll /version.json and offer a reload when it
// changes, since sw.js is byte-identical across deploys and never signals one.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

// QuoteMGR's Supabase project is read-only for this app. Refuse to produce a
// bundle that would read and write it (web, GitHub Pages or the iOS app).
const READ_ONLY_SUPABASE_REF = 'qgvuzrvpyyrrulhwlzma';

export default defineConfig(({ mode, command }) => {
  const base = process.env.VITE_BASE_URL ?? '/';
  const supabaseUrl = loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL || '';
  if (command === 'build' && supabaseUrl.includes(READ_ONLY_SUPABASE_REF)) {
    throw new Error(
      `VITE_SUPABASE_URL points at the read-only QuoteMGR project (${READ_ONLY_SUPABASE_REF}). ` +
      'Use the TrussCTR production project (llamtjsquoqlejznmyjl).'
    );
  }

  return {
    base,
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
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
    plugins: [
      react(),
      {
        name: 'emit-version-json',
        apply: 'build',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) });
        },
      },
    ],
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
      rollupOptions: {
        external: ['exceljs'], // Node package - exclude from browser bundle
      },
    },
  };
});
