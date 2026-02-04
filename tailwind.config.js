/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 使用 CSS 变量实现动态主题
        surface: {
          900: "var(--surface-900)",
          800: "var(--surface-800)",
          700: "var(--surface-700)",
          600: "var(--surface-600)",
          500: "var(--surface-500)",
          400: "var(--surface-400)",
        },
        accent: {
          cyan: "var(--accent-cyan)",
          pink: "var(--accent-pink)",
          purple: "var(--accent-purple)",
          green: "var(--accent-green)",
          orange: "var(--accent-orange)",
          yellow: "var(--accent-yellow)",
          red: "var(--accent-red)",
          blue: "var(--accent-blue)",
        },
        // 文字颜色
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-muted": "var(--text-muted)",
      },
      fontFamily: {
        sans: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "var(--border-color)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(88, 209, 235, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(88, 209, 235, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};
