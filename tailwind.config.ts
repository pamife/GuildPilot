import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--gp-canvas-rgb) / <alpha-value>)",
        panel: "rgb(var(--gp-panel-rgb) / <alpha-value>)",
        raised: "rgb(var(--gp-raised-rgb) / <alpha-value>)",
        line: "rgb(var(--gp-line-rgb) / <alpha-value>)",
        // Existing modules share the new mint accent without changing their behavior.
        indigo: {
          50: "#edfcf4",
          100: "#d2f9e5",
          200: "#adf0ce",
          300: "#8be9bd",
          400: "#7ce8b5",
          500: "#25855b",
          600: "#206b4b",
          700: "#1c583f",
          800: "#194735",
          900: "#173a2d",
          950: "#10271f",
        },
        discord: {
          dark: "#151b1e",
          darker: "#111719",
          darkest: "#0d1113",
          sidebar: "#111719",
          active: "#253b30",
          hover: "#202d26",
          brand: "#206b4b",
          brandHover: "#25855b",
          green: "#23a55a",
          yellow: "#f0b232",
          red: "#f23f43",
          text: "#dbdee1",
          muted: "#949ba4",
          header: "#f2f3f5",
        },
      },
      fontFamily: {
        sans: [
          "gg sans",
          "Noto Sans",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
