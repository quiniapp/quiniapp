import path from 'path';
import { execSync } from 'child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { visualizer } from 'rollup-plugin-visualizer';

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

// Los ids de módulo se normalizan a `/` porque en Windows pueden venir con `\`.
const normalizeId = (id: string) => id.replace(/\\/g, '/');

/**
 * Chunk de cada dependencia externa, para mejor caching. Todo módulo de
 * node_modules recibe un nombre (el último caso es 'vendor').
 */
function vendorChunkName(rawId: string): string | null {
  const id = normalizeId(rawId);

  if (id.includes('node_modules')) {
    // PDF generation (lazy-loaded, separate chunk)
    // DEBE estar primero porque NO depende de React
    if (id.includes('jspdf')) {
      return 'pdf-vendor';
    }

    // Calendar component dependencies (lazy-loaded via SelectDayToSearch)
    if (id.includes('react-day-picker') || id.includes('date-fns')) {
      return 'calendar-vendor';
    }

    // Date libraries (lazy-loaded con ClockProvider)
    // Puede estar separado porque no depende de React directamente
    if (id.includes('dayjs')) {
      return 'date-vendor';
    }

    // React core - base que todo depende
    if (id.includes('react-dom')) {
      return 'react-dom-vendor';
    }

    // React base (scheduler, react)
    if (id.includes('/react/') || id.includes('scheduler')) {
      return 'react-vendor';
    }

    // React Router
    if (id.includes('react-router') || id.includes('@remix-run')) {
      return 'router-vendor';
    }

    // TanStack Query
    if (id.includes('@tanstack/react-query')) {
      return 'query-vendor';
    }

    // Radix UI components (separado para mejor caching)
    if (id.includes('@radix-ui')) {
      return 'radix-vendor';
    }

    // Icons (lucide-react es grande)
    if (id.includes('lucide-react')) {
      return 'icons-vendor';
    }

    // Utility libraries
    if (
      id.includes('clsx') ||
      id.includes('tailwind-merge') ||
      id.includes('class-variance-authority')
    ) {
      return 'utils-vendor';
    }

    // Otras dependencias
    return 'vendor';
  }

  return null;
}

/**
 * Feature chunks - solo para archivos grandes. Las rutas lazy-loaded ya generan
 * chunks automáticamente; esto es para features específicos que queremos
 * separar. Devolver null deja el módulo al reparto automático de Rolldown.
 */
function featureChunkName(rawId: string): string | null {
  const id = normalizeId(rawId);

  if (id.includes('node_modules')) {
    return null;
  }
  if (id.includes('src/features/make-plays')) {
    return 'feature-make-plays';
  }
  if (id.includes('src/features/plays-and-hits')) {
    return 'feature-plays-hits';
  }
  if (id.includes('src/features/results')) {
    return 'feature-results';
  }
  if (id.includes('src/features/terminal-ticket')) {
    return 'feature-tickets';
  }

  return null;
}

export default defineConfig({
  define: {
    __COMMIT_DATE__: JSON.stringify(commitDate),
    // Speed Insights se monta solo si el build corre con ENABLE_SPEED_INSIGHTS=true
    // (en Vercel, cargarla solo en el entorno Production). Se lee de process.env,
    // no de los .env. Sin la variable, el paquete queda fuera del bundle.
    __ENABLE_SPEED_INSIGHTS__: JSON.stringify(process.env.ENABLE_SPEED_INSIGHTS === 'true'),
    __SPEED_INSIGHTS_SAMPLE_RATE__: JSON.stringify(speedInsightsSampleRate),
  },

  plugins: [
    react(),
    // Bundle analyzer - genera stats.html en dist/
    visualizer({
      filename: './dist/stats.html',
      open: false, // No abrir automáticamente
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // 'sunburst' | 'treemap' | 'network'
    }),
  ],

  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },

  server: {
    port: 5173,
    hmr: {
      overlay: false,
    },
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
    // Build optimizations
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remover console.log en producción
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
      },
      mangle: {
        safari10: true, // Compatibilidad con Safari 10
      },
    },

    // Reportar tamaño comprimido
    reportCompressedSize: true,

    // Advertir si chunks > 500KB
    chunkSizeWarningLimit: 500,

    // CSS code splitting
    cssCodeSplit: true,

    // Sourcemaps solo en dev
    sourcemap: false,

    // Opciones de Rolldown (Vite 8) para code splitting
    rolldownOptions: {
      output: {
        // Vite 8 deprecó `manualChunks`; esto reproduce el reparto que hacía.
        // Rolldown mete en el chunk de cada módulo capturado también sus
        // dependencias, así que el orden importa: con un solo grupo, un feature
        // se llevaba react-dom, el router y Radix.
        codeSplitting: {
          groups: [
            // 1º las dependencias, cada una a su chunk y sin arrastrar las suyas
            // (también tienen nombre propio).
            {
              name: vendorChunkName,
              priority: 2,
              includeDependenciesRecursively: false,
              debugName: 'vendor-chunks',
            },
            // 2º los features, que se llevan el código propio que usan y no
            // quedó en otro chunk (como hacía Rollup).
            { name: featureChunkName, priority: 1, debugName: 'feature-chunks' },
          ],
        },
        // Hay chunks que se importan en ciclo (vendor ↔ react-dom-vendor y
        // vendor ↔ radix-vendor). Rollup lo toleraba; con Rolldown el CommonJS
        // de un chunk puede no estar inicializado cuando el otro lo llama
        // ("require_react_dom is not a function", página en blanco). Esto
        // respeta el orden de ejecución del código fuente, como pide Rolldown
        // al usar includeDependenciesRecursively: false.
        strictExecutionOrder: true,

        // Nombres de archivos con hash para cache busting
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Organizar assets por tipo (`name` está deprecado en Rolldown)
          const name = assetInfo.names[0] ?? '';
          if (/\.css$/.test(name)) {
            return 'css/[name]-[hash][extname]';
          }
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(name)) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },

  // Optimización de dependencias
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    exclude: [
      // Excluir jsPDF para lazy loading
      'jspdf',
      'jspdf-autotable',
    ],
  },
});
