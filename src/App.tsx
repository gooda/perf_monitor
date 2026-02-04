import { useState } from "react";
import { BarChart3, Activity, Layers, Info, Lock } from "lucide-react";
import { clsx } from "clsx";
import {
  ConnectionPanel,
  OverviewPanel,
  DetailedPanel,
  ProcessPanel,
} from "@/components/panels";
import { ThemeToggle } from "@/components/ui";
import { usePerfStore } from "@/stores/perfStore";
import { MonitorMode } from "@/types";

const tabs: {
  id: MonitorMode;
  label: string;
  icon: React.ReactNode;
  description: string;
  requiresStackshot?: boolean;
}[] = [
  {
    id: "overview",
    label: "系统概览",
    icon: <BarChart3 size={18} />,
    description: "系统级 CPU、内存、GPU、FPS 实时指标",
  },
  {
    id: "process",
    label: "应用专项",
    icon: <Layers size={18} />,
    description: "各进程 CPU、内存、能耗分布对比",
  },
  {
    id: "detailed",
    label: "调用栈分析",
    icon: <Activity size={18} />,
    description: "实时调用栈火焰图、线程 CPU 分布",
    requiresStackshot: true,
  },
];

export default function App() {
  const {
    monitorMode,
    setMonitorMode,
    isMonitoring,
    sessionId,
    enableStackshot,
  } = usePerfStore();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="min-h-screen bg-surface-900 bg-grid">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-surface-800/95 backdrop-blur border-b border-surface-600">
        <div className="max-w-[1920px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center">
                <BarChart3 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gradient">
                  iOS Perf Monitor
                </h1>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  实时性能监控
                </p>
              </div>
            </div>

            {/* 标签页导航 */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                // 如果标签页需要调用栈但未启用，则禁用
                const isDisabled = tab.requiresStackshot && !enableStackshot;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setMonitorMode(tab.id)}
                    disabled={isDisabled}
                    title={
                      isDisabled
                        ? "请先在左侧配置面板启用「调用栈分析」开关"
                        : tab.description
                    }
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isDisabled
                        ? "text-[var(--text-muted)] cursor-not-allowed opacity-50"
                        : monitorMode === tab.id
                        ? "bg-accent-cyan/20 text-accent-cyan"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface-700"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    {isDisabled && (
                      <Lock size={12} className="text-[var(--text-muted)]" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* 状态指示和主题切换 */}
            <div className="flex items-center gap-3">
              {isMonitoring && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-green/10 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-accent-green status-dot" />
                  <span className="text-xs text-accent-green font-medium">
                    监控中
                  </span>
                  {sessionId && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {sessionId.slice(0, 20)}...
                    </span>
                  )}
                </div>
              )}

              {/* 主题切换按钮 */}
              <ThemeToggle />

              <button
                onClick={() => setShowInfo(!showInfo)}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface-700 rounded-lg transition-colors"
              >
                <Info size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 信息提示 */}
      {showInfo && (
        <div className="bg-surface-800 border-b border-surface-600 px-4 py-3">
          <div className="max-w-[1920px] mx-auto">
            <div className="flex items-start gap-4 text-sm">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                  {tabs.find((t) => t.id === monitorMode)?.label}
                </h3>
                <p className="text-[var(--text-secondary)]">
                  {tabs.find((t) => t.id === monitorMode)?.description}
                </p>
              </div>
              <div className="text-xs text-[var(--text-secondary)] space-y-1">
                <div>
                  WebSocket 服务:{" "}
                  <code className="text-accent-cyan">ws://localhost:8766</code>
                </div>
                <div>数据刷新频率: ~10Hz (100ms)</div>
                <div>火焰图更新: 每 10 秒</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <main className="max-w-[1920px] mx-auto p-4">
        <div className="flex gap-4">
          {/* 左侧控制面板 */}
          <aside className="w-80 flex-shrink-0">
            <div className="sticky top-20">
              <ConnectionPanel />

              {/* 使用说明卡片 */}
              <div className="mt-4 p-4 bg-surface-800 border border-surface-600 rounded-xl">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  快速入门
                </h3>
                <ol className="text-xs text-[var(--text-secondary)] space-y-2">
                  <li className="flex gap-2">
                    <span className="text-accent-cyan">1.</span>
                    确保 ios_perf WebSocket 服务已启动
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent-cyan">2.</span>
                    点击"连接"建立 WebSocket 连接
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent-cyan">3.</span>
                    输入设备 UDID 或从列表选择
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent-cyan">4.</span>
                    点击"开始监控"采集性能数据
                  </li>
                </ol>
              </div>
            </div>
          </aside>

          {/* 右侧内容区域 */}
          <div className="flex-1 min-w-0">
            {monitorMode === "overview" && <OverviewPanel />}
            {monitorMode === "detailed" && <DetailedPanel />}
            {monitorMode === "process" && <ProcessPanel />}
          </div>
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-surface-800/95 backdrop-blur border-t border-surface-600 py-2 px-4">
        <div className="max-w-[1920px] mx-auto flex items-center justify-center text-xs text-[var(--text-secondary)]">
          <span>iOS Perf Monitor v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
