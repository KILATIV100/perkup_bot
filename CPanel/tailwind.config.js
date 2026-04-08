/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#fdf8f0',
          100: '#f9eddb',
          200: '#f2d8b0',
          300: '#e9bd7c',
          400: '#dfa048',
          500: '#c8973a',
          600: '#a67520',
          700: '#7d5518',
          800: '#5c3e14',
          900: '#3d1c02',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
