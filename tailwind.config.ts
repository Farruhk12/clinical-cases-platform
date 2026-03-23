import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        brand: {
          50: "#f0faf8",
          100: "#d8f0ec",
          200: "#b0e0d8",
          300: "#7eb8b0",
          400: "#5a9a92",
          500: "#3d7d76",
          600: "#2f6560",
          700: "#285451",
          800: "#234542",
          900: "#1f3a38",
        },
        mist: {
          50: "#f7f8fc",
          100: "#eceef6",
          200: "#d9deeb",
        },
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgb(45 101 96 / 0.12), 0 8px 32px -8px rgb(15 23 42 / 0.06)",
        card: "0 2px 16px -2px rgb(45 101 96 / 0.08), 0 4px 24px -6px rgb(15 23 42 / 0.05)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.7s ease-out forwards",
        "fade-up": "fadeUp 0.6s ease-out both",
        floaty: "floaty 5s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
