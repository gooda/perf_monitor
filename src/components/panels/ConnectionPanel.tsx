import { useState, useEffect, useMemo } from "react";
import {
  Wifi,
  WifiOff,
  Play,
  Square,
  Settings,
  Clock,
  Trash2,
  Globe,
  Home,
  RefreshCw,
  ChevronDown,
  Target,
} from "lucide-react";
import { Button, Input, Toggle, Card, StatusBadge } from "@/components/ui";
import { usePerfStore } from "@/stores/perfStore";
import { useWebSocket } from "@/hooks/useWebSocket";

// 本地存储 key
const HISTORY_STORAGE_KEY = "ios_perf_ws_history";
const MAX_HISTORY_COUNT = 10;

// 预设地址
const PRESET_ADDRESSES = [
  { label: "本地服务", url: "ws://localhost:8766", icon: <Home size={12} /> },
  {
    label: "局域网 (示例)",
    url: "ws://192.168.1.100:8766",
    icon: <Globe size={12} />,
  },
];

// 解析 URL 获取主机信息
function parseWsUrl(
  url: string
): { host: string; port: string; isRemote: boolean } | null {
  try {
    // 补全协议前缀
    let fullUrl = url;
    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      fullUrl = "ws://" + url;
    }
    const parsed = new URL(fullUrl);
    const isRemote =
      parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
    return {
      host: parsed.hostname,
      port: parsed.port || "8766",
      isRemote,
    };
  } catch {
    return null;
  }
}

// 格式化 URL（确保有协议前缀）
function formatWsUrl(url: string): string {
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    return "ws://" + url;
  }
  return url;
}

// 历史记录项
interface HistoryItem {
  url: string;
  lastUsed: number;
  label?: string;
}

// 加载历史记录
function loadHistory(): HistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return [];
}

// 保存历史记录
function saveHistory(history: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

// 添加到历史记录
function addToHistory(url: string, history: HistoryItem[]): HistoryItem[] {
  const formattedUrl = formatWsUrl(url);
  const existing = history.findIndex((h) => h.url === formattedUrl);
  let newHistory: HistoryItem[];

  if (existing >= 0) {
    // 更新已有记录的时间
    newHistory = [
      { ...history[existing], lastUsed: Date.now() },
      ...history.slice(0, existing),
      ...history.slice(existing + 1),
    ];
  } else {
    // 添加新记录
    newHistory = [{ url: formattedUrl, lastUsed: Date.now() }, ...history];
  }

  // 限制数量
  return newHistory.slice(0, MAX_HISTORY_COUNT);
}

export function ConnectionPanel() {
  const {
    connectionStatus,
    isMonitoring,
    wsUrl,
    setWsUrl,
    deviceId,
    setDeviceId,
    targetProcessName,
    setTargetProcessName,
    enableStackshot,
    setEnableStackshot,
    serverStats,
    configuredDevices,
    focusedProcessConfigs,
  } = usePerfStore();

  const {
    connect,
    disconnect,
    startMonitoring,
    stopMonitoring,
    getStats,
    listDevices,
    listFocusedProcesses,
  } = useWebSocket();

  const [localUrl, setLocalUrl] = useState(wsUrl);
  const [localDeviceId, setLocalDeviceId] = useState(deviceId || "");
  const [localProcessName, setLocalProcessName] = useState(
    targetProcessName || ""
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);

  // 加载历史记录
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 解析当前 URL
  const urlInfo = useMemo(() => parseWsUrl(localUrl), [localUrl]);

  // 验证 URL
  const validateUrl = (url: string): boolean => {
    const info = parseWsUrl(url);
    if (!info) {
      setUrlError("无效的 WebSocket 地址");
      return false;
    }
    setUrlError(null);
    return true;
  };

  const handleUrlChange = (value: string) => {
    setLocalUrl(value);
    if (value) {
      validateUrl(value);
    } else {
      setUrlError(null);
    }
  };

  const handleConnect = async () => {
    if (connectionStatus === "connected") {
      disconnect();
    } else {
      const formattedUrl = formatWsUrl(localUrl);
      if (!validateUrl(formattedUrl)) {
        return;
      }

      setWsUrl(formattedUrl);
      setLocalUrl(formattedUrl);

      // 保存到历史记录
      const newHistory = addToHistory(formattedUrl, history);
      setHistory(newHistory);
      saveHistory(newHistory);

      // 直接传入 URL，避免状态更新时序问题
      await connect(formattedUrl);
      // 连接后获取服务器状态、设备列表和关注进程列表
      setTimeout(() => {
        getStats();
        listDevices();
        listFocusedProcesses();
      }, 500);
    }
  };

  const handleSelectHistory = (url: string) => {
    setLocalUrl(url);
    setShowHistory(false);
    validateUrl(url);
  };

  const handleDeleteHistory = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter((h) => h.url !== url);
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const handleStartMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      setDeviceId(localDeviceId);
      setTargetProcessName(localProcessName || null);
      startMonitoring({
        udid: localDeviceId,
        targetProcessName: localProcessName || undefined,
        enableStackshot,
      });
    }
  };

  // 从服务器状态获取活跃设备列表（正在监控的设备）
  const activeDevices = serverStats?.devices
    ? Object.entries(serverStats.devices)
    : [];

  // 使用配置的设备列表，如果没有则回退到活跃设备
  const hasConfiguredDevices = configuredDevices.length > 0;

  return (
    <Card title="连接配置" className="mb-4">
      <div className="space-y-4">
        {/* 连接状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={connectionStatus} />
            {connectionStatus === "connected" && urlInfo && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    urlInfo.isRemote
                      ? "bg-accent-orange/15 text-accent-orange"
                      : "bg-accent-green/15 text-accent-green"
                  }`}
                >
                {urlInfo.isRemote ? "远端" : "本地"}
              </span>
            )}
          </div>
          {connectionStatus === "connected" && serverStats && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {urlInfo?.host}:{urlInfo?.port}
            </span>
          )}
        </div>

        {/* WebSocket URL */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                label="WebSocket 地址"
                value={localUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="ws://localhost:8766 或 IP:端口"
                disabled={connectionStatus === "connected"}
                error={urlError || undefined}
              />
              {/* 历史记录按钮 */}
              {connectionStatus !== "connected" && history.length > 0 && (
                <button
                  className="absolute right-2 top-7 p-1 text-gray-500 hover:text-gray-300"
                  onClick={() => setShowHistory(!showHistory)}
                  title="历史记录"
                >
                  <Clock size={14} />
                </button>
              )}
            </div>
            <div className="flex items-end">
              <Button
                variant={
                  connectionStatus === "connected" ? "danger" : "primary"
                }
                onClick={handleConnect}
                disabled={!!urlError && connectionStatus !== "connected"}
                icon={
                  connectionStatus === "connected" ? (
                    <WifiOff size={16} />
                  ) : (
                    <Wifi size={16} />
                  )
                }
              >
                {connectionStatus === "connected" ? "断开" : "连接"}
              </Button>
            </div>
          </div>

          {/* 历史记录下拉 */}
          {showHistory && connectionStatus !== "connected" && (
            <div className="bg-surface-700 border border-surface-600 rounded-lg overflow-hidden">
              <div className="text-xs text-[var(--text-tertiary)] px-3 py-1.5 border-b border-surface-600">
                最近连接
              </div>
              {history.map((item) => {
                const info = parseWsUrl(item.url);
                return (
                  <button
                    key={item.url}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-600 transition-colors"
                    onClick={() => handleSelectHistory(item.url)}
                  >
                    <div className="flex items-center gap-2">
                      {info?.isRemote ? (
                        <Globe size={12} className="text-accent-orange" />
                      ) : (
                        <Home size={12} className="text-accent-green" />
                      )}
                      <span className="text-sm text-[var(--text-primary)]">{item.url}</span>
                    </div>
                    <button
                      className="p-1 text-[var(--text-muted)] hover:text-accent-red"
                      onClick={(e) => handleDeleteHistory(item.url, e)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </button>
                );
              })}
            </div>
          )}

          {/* 快捷预设 */}
          {connectionStatus !== "connected" && !showHistory && (
            <div className="flex gap-1">
              {PRESET_ADDRESSES.map((preset) => (
                <button
                  key={preset.url}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                    localUrl === preset.url
                      ? "bg-accent-cyan/15 text-accent-cyan"
                      : "bg-surface-700 text-[var(--text-secondary)] hover:bg-surface-600 hover:text-[var(--text-primary)]"
                  }`}
                  onClick={() => handleUrlChange(preset.url)}
                >
                  {preset.icon}
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 设备选择 */}
        {connectionStatus === "connected" && (
          <>
            <div className="pt-2 border-t border-surface-600">
              <label className="block text-xs text-[var(--text-secondary)] mb-1.5">选择设备</label>
              <div className="flex items-center gap-2 min-w-0">
                <select
                  className="flex-1 min-w-0 px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-accent-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={localDeviceId}
                  onChange={(e) => setLocalDeviceId(e.target.value)}
                  disabled={isMonitoring}
                >
                  <option value="">-- 请选择设备 --</option>
                  {hasConfiguredDevices ? (
                    // 使用配置的设备列表
                    configuredDevices.map((device) => (
                      <option key={device.udid} value={device.udid}>
                        {device.device_name} · iOS {device.product_version}
                        {device.is_active ? " ✓" : " (离线)"}
                      </option>
                    ))
                  ) : (
                    // 使用活跃设备列表
                    activeDevices.map(([id, info]) => (
                      <option key={id} value={id}>
                        {info.device_name} · iOS {info.product_version}
                      </option>
                    ))
                  )}
                </select>
                <button
                  className="flex-shrink-0 p-2 text-[var(--text-muted)] hover:text-accent-cyan transition-colors rounded-lg hover:bg-surface-600"
                  onClick={() => listDevices()}
                  title="刷新设备列表"
                  disabled={isMonitoring}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              {/* 选中设备信息提示 */}
              {localDeviceId && (
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                  {hasConfiguredDevices 
                    ? (() => {
                        const device = configuredDevices.find(d => d.udid === localDeviceId);
                        return device 
                          ? `${device.product_type} · ${device.is_active ? "在线" : "离线"}`
                          : "已选择设备";
                      })()
                    : "已选择设备"
                  }
                </p>
              )}
              {!localDeviceId && !hasConfiguredDevices && activeDevices.length === 0 && (
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                  等待设备列表加载...
                </p>
              )}
            </div>

            {/* 目标进程 - 默认展示，醒目样式 */}
            <div className="pt-2 border-t border-surface-600">
              <div className="p-3 bg-surface-700/50 rounded-lg border border-surface-600">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={14} className="text-accent-cyan" />
                  <span className="text-xs text-[var(--text-primary)] font-medium">目标进程</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">(用于网络数据采集)</span>
                </div>

                {/* 从关注列表选择 - 下拉形式 */}
                {focusedProcessConfigs.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <select
                        className="flex-1 min-w-0 px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-accent-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed truncate"
                        value={localProcessName}
                        onChange={(e) => setLocalProcessName(e.target.value)}
                        disabled={isMonitoring}
                      >
                        <option value="">-- 从关注列表选择 --</option>
                        {focusedProcessConfigs.filter(p => p.enabled).map((proc) => {
                          const actualProcessName = proc.patterns?.[0] || proc.name;
                          const displayText = proc.name !== actualProcessName 
                            ? `${proc.name} (${actualProcessName})`
                            : proc.name;
                          return (
                            <option key={proc.name} value={actualProcessName}>
                              {displayText}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        className="flex-shrink-0 p-2 text-[var(--text-muted)] hover:text-accent-cyan transition-colors rounded-lg hover:bg-surface-600"
                        onClick={() => listFocusedProcesses()}
                        title="刷新关注列表"
                        disabled={isMonitoring}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 手动输入 */}
                <div className={focusedProcessConfigs.length > 0 ? "pt-2 border-t border-surface-600" : ""}>
                  <Input
                    label={focusedProcessConfigs.length > 0 ? "或手动输入进程名" : "进程名 (可选)"}
                    value={localProcessName}
                    onChange={(e) => setLocalProcessName(e.target.value)}
                    placeholder="如: MyApp、SpringBoard"
                    disabled={isMonitoring}
                    hint={localProcessName ? "✓ 已设置目标进程，将采集网络数据" : "留空则不采集网络数据"}
                  />
                </div>
              </div>
            </div>

            {/* 调用栈分析开关 */}
            <div className="pt-2 border-t border-surface-600">
              <Toggle
                checked={enableStackshot}
                onChange={setEnableStackshot}
                label="启用调用栈分析"
                disabled={isMonitoring}
              />
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 ml-9">
                {enableStackshot 
                  ? "✓ 将采集调用栈数据，可在「调用栈分析」面板查看火焰图" 
                  : "未启用时，「调用栈分析」面板不可用"}
              </p>
            </div>

            {/* 更多设置（折叠） */}
            <div className="pt-2 border-t border-surface-600">
              <button
                className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings size={14} />
                更多设置
                <ChevronDown
                  size={12}
                  className={`transform transition-transform ${
                    showSettings ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showSettings && (
                <div className="mt-3 space-y-3 pl-4">
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    暂无更多设置项
                  </div>
                </div>
              )}
            </div>

            {/* 监控控制 */}
            <div className="pt-2">
              <Button
                variant={isMonitoring ? "danger" : "primary"}
                onClick={handleStartMonitoring}
                disabled={!localDeviceId}
                icon={isMonitoring ? <Square size={16} /> : <Play size={16} />}
                className="w-full"
              >
                {isMonitoring ? "停止监控" : "开始监控"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
