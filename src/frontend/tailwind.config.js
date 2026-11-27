import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontSize: {
        sm: ["16px", "20px"],
        lg: ["16px", "24px"],
        xl: ["24px", "32px"],
        "3xl": ["32px", "40px"],
      },
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        success: "oklch(var(--success) / <alpha-value>)",
        warning: "oklch(var(--warning) / <alpha-value>)",
        hp: "oklch(var(--hp) / <alpha-value>)",
        hunger: "oklch(var(--hunger) / <alpha-value>)",
        torch: "oklch(var(--torch) / <alpha-value>)",
        ember: "oklch(var(--ember-glow) / <alpha-value>)",
        frost: "oklch(var(--frost) / <alpha-value>)",
        night: "oklch(var(--night-deep) / <alpha-value>)",
        chart: {
          1: "oklch(var(--chart-1))",
          2: "oklch(var(--chart-2))",
          3: "oklch(var(--chart-3))",
          4: "oklch(var(--chart-4))",
          5: "oklch(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "max(calc(var(--radius) - 2px), 0px)",
        sm: "max(calc(var(--radius) - 4px), 0px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        subtle: "0 2px 0 0 oklch(0.11 0.03 268 / 0.6)",
        pixel: "4px 4px 0 0 oklch(0.11 0.03 268 / 0.7)",
        "pixel-inset": "inset 0 0 0 2px oklch(0.11 0.03 268)",
        "ember-glow": "0 0 24px 4px oklch(0.78 0.17 60 / 0.35)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "30%": { opacity: "0.82" },
          "55%": { opacity: "0.95" },
          "75%": { opacity: "0.7" },
        },
        "pixel-blink": {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "ember-rise": {
          "0%": { transform: "translateY(0)", opacity: "0.9" },
          "100%": { transform: "translateY(-40px)", opacity: "0" },
        },
        "step-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        flicker: "flicker 1.4s steps(6) infinite",
        "pixel-blink": "pixel-blink 1s steps(1) infinite",
        "ember-rise": "ember-rise 2.4s steps(8) infinite",
        "step-in": "step-in 0.3s steps(4) both",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [typography, containerQueries, animate],
};
