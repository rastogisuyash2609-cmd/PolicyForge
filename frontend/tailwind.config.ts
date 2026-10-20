import type { Config } from "tailwindcss";

const color = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: color("background"),
        surface: color("surface"),
        raised: color("elevated"),
        sidebar: color("sidebar"),
        text: color("foreground"),
        muted: color("muted"),
        border: color("border"),
        primary: color("primary"),
        "primary-hover": color("primary-hover"),
        "on-primary": color("on-primary"),
        secondary: color("secondary"),
        hover: color("hover"),
        selected: color("selected"),
        "selected-text": color("selected-text"),
        focus: color("focus"),
        disabled: color("disabled"),
        "disabled-text": color("disabled-text"),
        success: color("success"),
        "success-bg": color("success-bg"),
        warning: color("warning"),
        "warning-bg": color("warning-bg"),
        danger: color("danger"),
        "danger-bg": color("danger-bg"),
        info: color("info"),
        "info-bg": color("info-bg"),
        // Compatibility aliases for existing screens.
        allow: color("success"),
        "allow-bg": color("success-bg"),
        deny: color("danger"),
        "deny-bg": color("danger-bg"),
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "page-title": [
          "1.875rem",
          { lineHeight: "1.2", letterSpacing: "-0.035em", fontWeight: "600" },
        ],
        "section-title": [
          "1.125rem",
          { lineHeight: "1.5", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
        "card-title": [
          "0.9375rem",
          { lineHeight: "1.5", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
      },
      // Retain the complete Tailwind 4px scale; even increments give an 8px rhythm.
      maxWidth: { page: "1240px", reading: "72ch" },
      borderRadius: { DEFAULT: "8px" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.035)",
        panel: "0 4px 20px -8px rgb(var(--shadow) / 0.12)",
        subtle: "0 1px 3px rgb(var(--shadow) / 0.05)",
      },
      transitionDuration: { fast: "150ms", base: "180ms" },
    },
  },
  plugins: [],
} satisfies Config;
