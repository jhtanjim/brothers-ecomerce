import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Design tokens. `brand` is the single accent colour used for actions, links and focus rings
 * across the storefront and the admin. Neutrals are Tailwind's `slate`; status colours use
 * emerald (success), amber (warning) and rose (error / discount).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf4',
          100: '#d5f5e3',
          200: '#aeeacb',
          300: '#79d8ab',
          400: '#42be86',
          500: '#1fa36b',
          600: '#128556',
          700: '#106a47',
          800: '#10543a',
          900: '#0e4531',
          950: '#062619',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'var(--font-bengali)', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
