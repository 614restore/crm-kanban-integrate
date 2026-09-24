import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Each build gets an id; open tabs poll /version.json and offer a reload when it
// changes, since sw.js is byte-identical across deploys and never signals one.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

// TrussCTR must only ever talk to its own Supabase project. QuoteMGR's
// projects (old qgvuzrvpyyrrulhwlzma, live yjnnvocctprfuwirrxcx and the
// TrussCENTER copy gcuxoinrijaogtswslhy) are read-only for this app, so any
// other project fails the build instead of shipping a bundle that writes to it.
const TRUSSCTR_SUPABASE_REF = 'llamtjsquoqlejznmyjl';

export default defineConfig(({ mode, command }) => {
  const base = process.env.VITE_BASE_URL ?? '/';
  const supabaseUrl = loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL || '';
  if (command === 'build' && supabaseUrl && !supabaseUrl.includes(TRUSSCTR_SUPABASE_REF)) {
    throw new Error(
      `VITE_SUPABASE_URL (${supabaseUrl}) is not the TrussCTR production project (${TRUSSCTR_SUPABASE_REF}). ` +
      'QuoteMGR projects are read-only for TrussCTR.'
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
