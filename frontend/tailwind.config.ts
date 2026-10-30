import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * BROTHERS design tokens. `brand` is warm ink used for actions, links and focus rings; `accent`
 * is brass for small highlights on dark backgrounds. Status colours stay emerald, amber and rose.
 * Corners are deliberately sharp.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f7f5f2',
          100: '#ece9e3',
          200: '#d8d3cb',
          300: '#bab4aa',
          400: '#8c867d',
          500: '#625d56',
          600: '#262421',
          700: '#1c1b19',
          800: '#141413',
          900: '#0e0e0d',
          950: '#080807',
        },
        accent: '#c9a25f',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'var(--font-bengali)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-display)', 'var(--font-bengali)', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        sm: '1px',
        md: '2px',
        lg: '2px',
        xl: '2px',
        '2xl': '2px',
        '3xl': '2px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
