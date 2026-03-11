/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0d1117",
        panel: "#161b22",
        surface: "#21262d",
        border: "#30363d",
        muted: "#8b949e",
        accent: "#2563eb",
        "accent-hover": "#1d4ed8",
        "accent-subtle": "#1e3a5f",
        "user-msg": "#1d4ed8",
        "ai-msg": "#1f2937",
        success: "#238636",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
