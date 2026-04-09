import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ZombieTech brand green — matches design reference #1d9e75
        zt: {
          50:  '#e8f7f0',
          100: '#a3d9bc',
          200: '#5dcaa5',
          400: '#1d9e75',  // primary
          600: '#166534',
          800: '#0f4a2a',
          dark: '#085041',
        },
      },
    },
  },
  plugins: [],
};

export default config;
