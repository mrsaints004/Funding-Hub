import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#14F195",
        "primary-dark": "#0B8C61",
        surface: "#0B1223",
        accent: "#9945FF"
      }
    }
  },
  plugins: []
};

export default config;
