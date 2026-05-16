/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/index.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "on-tertiary-container": "#5c0008",
        "on-surface-variant": "#c2c6d6",
        "surface-container-highest": "#27354c",
        "primary": "#adc6ff",
        "tertiary-fixed": "#ffdad7",
        "on-tertiary-fixed": "#410004",
        "primary-container": "#4d8eff",
        "on-surface": "#d6e3ff",
        "on-tertiary": "#68000a",
        "inverse-on-surface": "#233148",
        "tertiary": "#ffb3ad",
        "on-secondary-fixed-variant": "#005236",
        "surface-dim": "#041329",
        "inverse-primary": "#005ac2",
        "surface-bright": "#2c3951",
        "secondary-fixed": "#6ffbbe",
        "outline": "#8c909f",
        "outline-variant": "#434754",
        "inverse-surface": "#d6e3ff",
        "on-primary-fixed": "#001a43",
        "on-secondary-container": "#bcece5",
        "surface": "#041329",
        "secondary-container": "#005041",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-surface-variant-variant": "#434754",
        "secondary": "#51dfb0",
        "on-primary-fixed-variant": "#004294",
        "on-primary-container": "#ffffff",
        "on-tertiary-fixed-variant": "#930014",
        "tertiary-container": "#d60021",
        "on-error-container": "#ffdad6",
        "on-secondary": "#00382d",
        "surface-container-low": "#101f37",
        "surface-container-lowest": "#000818",
        "primary-fixed": "#d7e2ff",
        "on-primary": "#002e6c",
        "error": "#ffb4ab",
        "surface-container-high": "#1c2a41",
        "surface-container": "#15253c",
        "on-secondary-fixed": "#002119",
        "tertiary-fixed-dim": "#ffb3ad"
      },
      "fontFamily": {
        "label-caps": [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji"
        ],
        "data-mono": [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji"
        ]
      },
      "fontSize": {
        "label-caps": "11px",
        "data-mono": "13px"
      }
    }
  },
  plugins: [],
}
