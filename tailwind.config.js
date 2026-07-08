/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg:      '#0d1117',
          surface: '#161c2d',
          border:  '#2a3549',
          green:   '#4ade80',
          amber:   '#fbbf24',
          red:     '#f87171',
          blue:    '#60a5fa',
          dim:     '#e2e8f0',
          muted:   '#1e2a3d',
        },
      },
      fontFamily: {
        sans: ['Rajdhani', 'system-ui', 'sans-serif'],
        mono: ['Rajdhani', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow':   'spin 2s linear infinite',
        'pulse-glow':  'pulseGlow 1.5s ease-in-out infinite',
        'slide-in':    'slideIn 0.3s ease-out',
        'fade-in':     'fadeIn 0.4s ease-out',
        'shake':       'shake 0.4s ease-in-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%':      { opacity: '0.7', filter: 'brightness(1.4)' },
        },
        slideIn: {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':      { transform: 'translateX(-6px)' },
          '40%':      { transform: 'translateX(6px)' },
          '60%':      { transform: 'translateX(-4px)' },
          '80%':      { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
}
