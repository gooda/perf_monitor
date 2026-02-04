import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore, ThemeMode } from "@/stores/themeStore";

const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: "light",
    label: "浅色模式",
    icon: <Sun size={16} />,
  },
  {
    mode: "dark",
    label: "深色模式",
    icon: <Moon size={16} />,
  },
  {
    mode: "system",
    label: "跟随系统",
    icon: <Monitor size={16} />,
  },
];

export function ThemeToggle() {
  const { mode, resolvedTheme, setMode } = useThemeStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 快速切换（点击按钮直接切换明暗）
  const handleQuickToggle = () => {
    if (mode === "system") {
      // 如果当前是系统模式，根据实际主题切换
      setMode(resolvedTheme === "dark" ? "light" : "dark");
    } else {
      setMode(mode === "dark" ? "light" : "dark");
    }
  };

  // 长按或右键打开菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(!showMenu);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="theme-toggle-btn"
        onClick={handleQuickToggle}
        onContextMenu={handleContextMenu}
        title={`当前: ${themeOptions.find((o) => o.mode === mode)?.label} (右键查看更多)`}
      >
        <Sun size={18} className="icon-sun" />
        <Moon size={18} className="icon-moon" />
      </button>

      {showMenu && (
        <div ref={menuRef} className="theme-menu">
          {themeOptions.map((option) => (
            <button
              key={option.mode}
              className={`theme-menu-item ${mode === option.mode ? "active" : ""}`}
              onClick={() => {
                setMode(option.mode);
                setShowMenu(false);
              }}
            >
              {option.icon}
              <span>{option.label}</span>
              {mode === option.mode && (
                <span className="ml-auto text-xs opacity-60">✓</span>
              )}
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
            <p className="px-3 py-1 text-[10px] text-[var(--text-tertiary)]">
              点击按钮快速切换
              <br />
              右键打开此菜单
            </p>
          </div>
        </div>
      )}
    </div>
  );
}






