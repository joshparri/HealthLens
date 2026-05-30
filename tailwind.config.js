/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0D0F12',
          soft: '#1A1D23',
          muted: '#2A2E37',
        },
        jade: {
          DEFAULT: '#2DD4A0',
          dark: '#1BA87C',
          glow: '#2DD4A033',
        },
        amber: {
          health: '#F59E2A',
          glow: '#F59E2A22',
        },
        crimson: {
          health: '#FF5A6E',
          glow: '#FF5A6E22',
        },
        slate: {
          ui: '#6B7280',
          border: '#2A2E37',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
