/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Colors reference CSS variables as RGB triplets so opacity modifiers (bg-accent/10) work correctly
      colors: {
        surface: {
          DEFAULT: "rgb(var(--rv-surface) / <alpha-value>)",
          raised:  "rgb(var(--rv-surface-raised) / <alpha-value>)",
          border:  "rgb(var(--rv-border) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--rv-accent) / <alpha-value>)",
          dim:     "rgb(var(--rv-accent-dim) / <alpha-value>)",
        },
        data: {
          primary:   "rgb(var(--rv-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--rv-text-secondary) / <alpha-value>)",
          muted:     "rgb(var(--rv-text-muted) / <alpha-value>)",
        },
        status: {
          green:  "rgb(var(--rv-green) / <alpha-value>)",
          yellow: "rgb(var(--rv-yellow) / <alpha-value>)",
          red:    "rgb(var(--rv-red) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
