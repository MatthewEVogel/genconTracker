/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '17': 'repeat(17, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))'
      }
    },
  },
  plugins: [],
};
