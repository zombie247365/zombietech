import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        zombie: {
          50:  '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          900: '#14532d',
        },
        brand: {
          green:  '#16a34a',
          dark:   '#0f172a',
          accent: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
