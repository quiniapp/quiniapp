// tailwind.config.ts
import type { Config } from 'tailwindcss';

/** Color de un token de `index.css` (canales HSL) con soporte de opacidad. */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // El tema lo elige cada usuario (Configuración) y se aplica con `data-theme`
  // en <html>: `dark:` sigue a esa elección, no a la del sistema operativo.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.css',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: token('border'),
        input: {
          DEFAULT: token('input'),
          foreground: token('input-foreground'),
          placeholder: token('input-placeholder'),
          border: token('input-border'),
        },
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: {
          DEFAULT: token('primary'),
          light: 'hsl(var(--primary) / 0.6)',
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
          bg: token('card'),
        },
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
        },
        /** Casillero acertado. */
        hit: {
          DEFAULT: token('hit'),
          foreground: token('hit-foreground'),
        },
        'nav-active': {
          DEFAULT: token('nav-active'),
          foreground: token('nav-active-foreground'),
        },
        'table-head': token('table-head'),
        'row-stripe': token('row-stripe'),
        warning: {
          DEFAULT: 'hsl(38 92% 50%)',
          foreground: 'hsl(38 92% 10%)',
        },
        cyan: {
          DEFAULT: 'hsl(180 100% 50%)',
          foreground: 'hsl(180 100% 10%)',
        },
        'blue-light': {
          DEFAULT: 'hsl(220 70% 80%)',
          '80': 'hsl(220 70% 80% / 0.8)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      screens: {
        '1440': '1440px',
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '0' }],
        xl: ['1.25rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      lineHeight: {
        tight: '1.25',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.625',
        loose: '2',
      },
    },
  },
  plugins: [],
};

export default config;
