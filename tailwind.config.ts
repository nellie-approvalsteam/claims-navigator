import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1C2B2E",
        teal: {
          50: "#EEF3F1",
          100: "#D6E3DE",
          600: "#33564E",
          700: "#2F5D50",
          800: "#254A40",
        },
        brass: {
          400: "#C79A5C",
          500: "#B98A46",
          600: "#9C6F30",
        },
        rust: {
          500: "#A6503A",
          600: "#954330",
        },
        paper: {
          50: "#FAF9F5",
          100: "#F8F6F0",
          200: "#F0EEE6",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
