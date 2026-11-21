import path from 'path';
import { execSync } from 'child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Versión visible en la app, como en QuiniApp: la fecha del último commit.
const commitDate = (() => {
  try {
    return execSync('git log -1 --format=%cd --date=format:"%d/%m/%Y"').toString().trim();
  } catch {
    return '';
  }
})();

export default defineConfig({
  define: {
    __COMMIT_DATE__: JSON.stringify(commitDate),
  },

  plugins: [react()],

  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },

  server: {
    // 5174 para poder levantar QuiniApp (5173) y Polla a la vez.
    port: 5174,
    hmr: { overlay: false },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@helper': path.resolve(import.meta.dirname, '../helper'),
    },
  },

  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
    // Vite 8 (Rolldown) ya no acepta `manualChunks` como objeto: cada grupo
    // toma los módulos de esos paquetes, y sus dependencias van con ellos.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router-vendor', test: /node_modules[\\/]react-router(-dom)?[\\/]/ },
            { name: 'query-vendor', test: /node_modules[\\/]@tanstack[\\/]react-query[\\/]/ },
            { name: 'radix-vendor', test: /node_modules[\\/]@radix-ui[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
