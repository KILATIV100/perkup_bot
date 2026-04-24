/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50:  '#fdf6ed',
          100: '#f9e8d0',
          200: '#f2cfA0',
          300: '#e8b06a',
          400: '#de9240',
          500: '#d4762a',
          600: '#bb5d22',
          700: '#9b461f',
          800: '#7c3820',
          900: '#662f1e',
          950: '#3a1709',
        }
      }
    }
  },
  plugins: [],
}
