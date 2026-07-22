import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          DEFAULT: "#1f2430",
          soft: "#2b313d",
        },
        accent: {
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
        },
      },
      fontFamily: {
        plate: ["var(--font-plate)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
