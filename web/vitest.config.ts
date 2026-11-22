import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Tests de la lógica en TypeScript de QuiniApp (web). Viven en
 * `src/**\/*.test.ts`. Los de la Polla están en polla-web, cada app con los
 * suyos.
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
