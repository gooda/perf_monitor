import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  initTheme: () => void;
}

// 获取系统偏好
function getSystemTheme(): ResolvedTheme {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
}

// 解析实际主题
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

// 应用主题到 DOM
function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  
  // 添加过渡类
  root.classList.add("theme-transitioning");
  
  // 设置主题
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
  
  // 设置 meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      theme === "dark" ? "#0d1117" : "#f8fafc"
    );
  }
  
  // 移除过渡类（延迟以确保过渡完成）
  setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, 300);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",
      resolvedTheme: "dark",

      setMode: (mode) => {
        const resolvedTheme = resolveTheme(mode);
        applyTheme(resolvedTheme);
        set({ mode, resolvedTheme });
      },

      initTheme: () => {
        const { mode } = get();
        const resolvedTheme = resolveTheme(mode);
        applyTheme(resolvedTheme);
        set({ resolvedTheme });

        // 监听系统主题变化
        if (typeof window !== "undefined") {
          const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
          const handleChange = () => {
            const currentMode = get().mode;
            if (currentMode === "system") {
              const newResolvedTheme = getSystemTheme();
              applyTheme(newResolvedTheme);
              set({ resolvedTheme: newResolvedTheme });
            }
          };
          mediaQuery.addEventListener("change", handleChange);
        }
      },
    }),
    {
      name: "perf-monitor-theme",
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);






