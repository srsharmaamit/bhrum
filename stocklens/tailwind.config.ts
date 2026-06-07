import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Light-gray surface scale (replaces the old dark-navy palette)
        navy: {
          950: '#D1D5DB', // gray-300
          900: '#F9FAFB', // gray-50  — page background
          800: '#FFFFFF', // white    — card background
          700: '#F3F4F6', // gray-100 — secondary areas, subtle borders
          600: '#E5E7EB', // gray-200 — stronger borders / dividers
          500: '#D1D5DB', // gray-300 — even stronger borders
        },
        accent: {
          DEFAULT: '#3B82F6',
          dim: '#2563EB',
          bright: '#60A5FA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        card: '0 1px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        glow: '0 0 16px rgba(59,130,246,0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
