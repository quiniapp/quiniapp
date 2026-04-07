import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
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
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
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
      '@': path.resolve(__dirname, './src'),
      '@helper': path.resolve(__dirname, '../helper'),
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

    // Rollup options para code splitting
    rollupOptions: {
      output: {
        // Manual chunks para mejor caching
        manualChunks: (id) => {
          // Vendor chunks - dependencias externas
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
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'utils-vendor';
            }

            // Otras dependencias
            return 'vendor';
          }

          // Feature chunks - solo para archivos grandes
          // Las rutas lazy-loaded ya generan chunks automáticamente
          // Esto es para features específicos que queremos separar
          if (id.includes('src/features/make-plays') && !id.includes('node_modules')) {
            return 'feature-make-plays';
          }
          if (id.includes('src/features/plays-and-hits') && !id.includes('node_modules')) {
            return 'feature-plays-hits';
          }
          if (id.includes('src/features/results') && !id.includes('node_modules')) {
            return 'feature-results';
          }
          if (id.includes('src/features/terminal-ticket') && !id.includes('node_modules')) {
            return 'feature-tickets';
          }
        },

        // Nombres de archivos con hash para cache busting
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Organizar assets por tipo
          const name = assetInfo.name || '';
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
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    exclude: [
      // Excluir jsPDF para lazy loading
      'jspdf',
      'jspdf-autotable',
    ],
  },
});
