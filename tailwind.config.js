/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./public/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#233DFF',
          hover: '#1a2fbf',
          light: 'rgba(35, 61, 255, 0.06)',
          ring: 'rgba(35, 61, 255, 0.12)',
        },
      },
      boxShadow: {
        'elevation-1': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'elevation-2': '0 4px 12px -2px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)',
        'elevation-3': '0 12px 32px -4px rgba(0,0,0,0.10), 0 4px 8px -2px rgba(0,0,0,0.04)',
        'elevation-4': '0 24px 48px -8px rgba(0,0,0,0.12), 0 8px 16px -4px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'card': '20px',
        'card-lg': '28px',
        'modal': '24px',
        'container': '32px',
      },
    },
  },
  plugins: [],
}
