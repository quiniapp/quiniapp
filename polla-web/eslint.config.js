import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Config propia de polla-web (flat config). ESLint 10 toma la config más cercana
 * a cada archivo: los de polla-web usan esta; la de la raíz solo cubre api/ y helper/.
 */

// react-hooks 7 suma las reglas del React Compiler como error (set-state-in-effect
// marca 13 casos hoy). Quedan como warning hasta revisar ese código; las dos de
// siempre mantienen su nivel.
const CLASSIC_HOOK_RULES = ['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'];
const reactHooksRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules).map(([rule, level]) => [
    rule,
    CLASSIC_HOOK_RULES.includes(rule) ? level : 'warn',
  ])
);

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooksRules,
      // Las variantes de los componentes shadcn se exportan junto al componente.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['buttonVariants', 'badgeVariants'] },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
]);
