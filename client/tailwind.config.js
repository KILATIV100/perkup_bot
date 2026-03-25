/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50:  '#fdf6ed',
          100: '#f5e6c8',
          200: '#e8c98a',
          300: '#d9a84e',
          400: '#c8973a',
          500: '#6b3a2a',
          600: '#3d1c02',
          700: '#2d1502',
          800: '#1e0e01',
          900: '#0f0700',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-wheel': 'spin 3s cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards',
        'fly-to-cart': 'flyToCart 0.5s ease-in forwards',
        'bounce-in': 'bounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        flyToCart: {
          '0%': { transform: 'scale(1) translate(0, 0)', opacity: '1' },
          '100%': { transform: 'scale(0.2) translate(200px, -200px)', opacity: '0' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
