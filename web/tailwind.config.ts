import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050507",
        glow: "#3b82f6",
        win: "#22d3ee",
        loss: "#1e293b",
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "lock-in": "lockIn 0.5s ease-out forwards",
      },
      keyframes: {
        lockIn: {
          "0%": { transform: "scale(1)", filter: "brightness(1)" },
          "60%": { transform: "scale(1.07)", filter: "brightness(1.4)" },
          "100%": { transform: "scale(1.04)", filter: "brightness(1.2)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
