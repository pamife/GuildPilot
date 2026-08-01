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
        discord: {
          dark: "#313338",
          darker: "#2b2d31",
          darkest: "#1e1f22",
          sidebar: "#2b2d31",
          active: "#35373c",
          hover: "#35373c",
          brand: "#5865f2",
          brandHover: "#4752c4",
          green: "#23a55a",
          yellow: "#f0b232",
          red: "#f23f43",
          text: "#dbdee1",
          muted: "#949ba4",
          header: "#f2f3f5",
        },
      },
      fontFamily: {
        sans: ["gg sans", "Noto Sans", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
