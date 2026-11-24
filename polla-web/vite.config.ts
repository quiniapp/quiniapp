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

// Fracción de page views que Speed Insights envía a Vercel: SPEED_INSIGHTS_SAMPLE_RATE
// en el build (de process.env, no de los .env), 0.01 (1 %) si no está. Un valor fuera
// de (0, 1] corta el build: el paquete trata 0 como "sin muestreo" y mandaría el 100 %.
const speedInsightsSampleRate = (() => {
  const raw = process.env.SPEED_INSIGHTS_SAMPLE_RATE?.trim();
  if (!raw) return 0.01;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
    throw new Error(
      `SPEED_INSIGHTS_SAMPLE_RATE inválida: "${raw}". Debe ser un número mayor que 0 y hasta 1.`
    );
  }
  return rate;
})();

export default defineConfig({
  define: {
    __COMMIT_DATE__: JSON.stringify(commitDate),
    // Speed Insights se monta solo si el build corre con ENABLE_SPEED_INSIGHTS=true
    // (en Vercel, cargarla solo en el entorno Production). Se lee de process.env,
    // no de los .env. Sin la variable, el paquete queda fuera del bundle.
    __ENABLE_SPEED_INSIGHTS__: JSON.stringify(process.env.ENABLE_SPEED_INSIGHTS === 'true'),
    __SPEED_INSIGHTS_SAMPLE_RATE__: JSON.stringify(speedInsightsSampleRate),
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
