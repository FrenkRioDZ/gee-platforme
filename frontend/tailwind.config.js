/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  important: '#root',
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: '#0D3B6E', light: '#1565C0', dark: '#082647' },
        secondary: { DEFAULT: '#C8963E', light: '#F0B429' },
        surface:   { DEFAULT: '#F4F6FA', dark: '#E8ECF4' }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body:    ['"Source Sans 3"', 'sans-serif']
      }
    }
  },
  plugins: []
};
