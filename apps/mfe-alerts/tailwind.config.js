/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'surface-container': '#112240',
        'surface-container-high': '#1B2A4E',
        'surface-variant': '#233554',
        'on-surface': '#d6e3ff',
        'on-surface-variant': '#94a3b8',
        'outline-variant': '#233554',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
        'error': '#ffb4ab',
        'primary': '#3B82F6',
        'on-primary': '#ffffff',
        'secondary': '#4edea3',
        'tertiary': '#ffb3ad'
      }
    },
  },
  plugins: [],
}
