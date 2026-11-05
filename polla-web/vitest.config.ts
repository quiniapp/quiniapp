import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Tests de la lógica en TypeScript de Polla (polla-web y `@helper/polla`).
 * Viven en `src/**\/*.test.ts`, también los de helper: si estuvieran en
 * `helper/`, el `tsc` de la API (que compila `../helper`) los compilaría.
 * Las reglas de la base (premios, pagos, cuenta corriente) se prueban con
 * pgTAP en `api/supabase/tests/database/`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  })
);
