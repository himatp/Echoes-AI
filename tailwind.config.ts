import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#F7F7F9",
          muted: "#EFEFEF",
        },
        hero: {
          DEFAULT: "#4F46E5", // Electric Indigo Accent
          dark: "#4338CA",
          light: "#EEF2FF",
        },
        contrast: {
          DEFAULT: "#18181B", // Zinc-900 Near-Black Card
          light: "#27272A",
        },
        priority: {
          urgent: "#EF4444",
          high: "#F97316",
          medium: "#F59E0B",
          low: "#10B981",
        }
      },
      borderRadius: {
        "2xl": "1.25rem", // 20px
        "xl": "1rem",     // 16px
      },
      boxShadow: {
        "card": "0 10px 30px -10px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.02)",
        "card-hover": "0 20px 40px -12px rgba(0,0,0,0.08), 0 8px 16px -4px rgba(0,0,0,0.03)",
        "hero": "0 14px 36px -10px rgba(79, 70, 229, 0.35)",
        "contrast": "0 14px 36px -10px rgba(24, 24, 27, 0.4)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "wave": "wave 1.5s ease-in-out infinite",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        }
      }
    },
  },
  plugins: [],
};

export default config;
