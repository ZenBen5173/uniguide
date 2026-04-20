import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modernised UM palette — design tokens from Claude Design mockups.
        // Use as bg-ink, text-crimson, border-line, etc.
        ink: {
          DEFAULT: "#0B2545",
          2: "#1B3566",
          3: "#3B4E74",
          4: "#6A7A99",
          5: "#9AA6BE",
        },
        line: {
          DEFAULT: "#E4E2DC",
          2: "#EFEDE7",
        },
        paper: {
          DEFAULT: "#F6F4EE",
          2: "#FBFAF5",
        },
        card: "#FFFFFF",
        crimson: {
          DEFAULT: "#A1253A",
          soft: "#F5E6E8",
        },
        gold: {
          DEFAULT: "#B8935A",
          soft: "#F1EADC",
        },
        moss: {
          DEFAULT: "#3F6B4E",
          soft: "#E6EEE6",
        },
        amber: {
          DEFAULT: "#8A6B1E",
          soft: "#F4ECD4",
        },
        ai: {
          tint: "#F3F1FB",
          line: "#DCD6F0",
          ink: "#4B3D8F",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        serif: ["Instrument Serif", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        ug: "14px",
        "ug-lg": "18px",
      },
      boxShadow: {
        "ug-card": "0 1px 0 rgba(11,37,69,.04), 0 12px 40px -12px rgba(11,37,69,.12)",
        "ug-lift": "0 1px 0 rgba(11,37,69,.04), 0 24px 60px -20px rgba(11,37,69,.18)",
      },
    },
  },
  plugins: [],
};

export default config;
