import { useMemo, useState, useEffect, useRef } from "react";
import {
  Layers,
  Cpu,
  MemoryStick,
  Zap,
  ArrowUpDown,
  RefreshCw,
  HardDrive,
  ChevronDown,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Card, MetricCard, Button } from "@/components/ui";
import { StackedAreaChart, LineChart, MultiLineChart, BidirectionalChart } from "@/components/charts";
import { usePerfStore } from "@/stores/perfStore";
import { useWebSocket } from "@/hooks/useWebSocket";

// 基础颜色池
const BASE_COLORS = [
  "#58d1eb", // cyan
  "#f778ba", // pink
  "#7ee787", // green
  "#b392f0", // purple
  "#ffa657", // orange
  "#ffc83d", // yellow
  "#79c0ff", // blue
  "#f85149", // red
  "#a5d6ff", // light blue
  "#d2a8ff", // light purple
  "#ffd8b5", // peach
  "#7ce38b", // light green
];

// 根据字符串生成稳定的哈希值
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// 根据进程名获取固定颜色
function getProcessColor(processName: string): string {
  const index = hashString(processName) % BASE_COLORS.length;
  return BASE_COLORS[index];
}

type SortField = "cpu" | "memory" | "power" | "disk" | "network";
type ViewMode = "list" | "detail";

// 进程信息（包含历史数据的进程）
interface ProcessWithHistory {
  pid: number;
  name: string;
  cpu: number;
  threads: number;
  // 内存指标 (MB)
  memoryMb: number;
  memResidentMb: number;
  memVirtualMb: number;
  memPrivateMb: number;
  memSharedMb: number;
  memCompressedMb: number;
  // 磁盘 I/O
  diskReadMb: number;
  diskWriteMb: number;
  diskReadRateBps: number;
  diskWriteRateBps: number;
  // 网络 I/O
  networkRxBytes: number;
  networkTxBytes: number;
  networkRxRate: number;
  networkTxRate: number;
  // 能耗
  powerScore: number;
  totalEnergyScore: number;
  avgPowerScore: number;
  // 状态
  isActive: boolean;
  color: string;
}

export function ProcessPanel() {
  const {
    processes,
    processHistory,
    isMonitoring,
    focusedProcessConfigs,
    selectedProcessPid,
    setSelectedProcessPid,
    connectionStatus,
    targetProcessName,
  } = usePerfStore();

  // 是否有目标进程（网络数据需要指定目标进程才能采集）
  const hasTargetProcess = !!targetProcessName;

  const { listFocusedProcesses } = useWebSocket();

  const [sortField, setSortField] = useState<SortField>("cpu");
  const [showTopN, setShowTopN] = useState(8);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // 使用 ref 保存进程名到颜色的映射，确保颜色稳定
  const processColorMapRef = useRef<Map<string, string>>(new Map());

  // 连接后获取关注进程列表
  useEffect(() => {
    if (connectionStatus === "connected") {
      listFocusedProcesses();
    }
  }, [connectionStatus, listFocusedProcesses]);

  // 获取或分配进程颜色
  const getOrAssignColor = (processName: string): string => {
    if (!processColorMapRef.current.has(processName)) {
      processColorMapRef.current.set(processName, getProcessColor(processName));
    }
    return processColorMapRef.current.get(processName)!;
  };

  // 合并当前进程和历史进程数据，保证图表数据稳定
  const allProcessesWithHistory = useMemo(() => {
    const result: ProcessWithHistory[] = [];
    const seenPids = new Set<number>();

    // 首先添加当前存在的进程
    for (const [pid, proc] of processes) {
      seenPids.add(pid);
      result.push({
        ...proc,
        networkRxBytes: proc.networkRxBytes ?? 0,
        networkTxBytes: proc.networkTxBytes ?? 0,
        networkRxRate: proc.networkRxRate ?? 0,
        networkTxRate: proc.networkTxRate ?? 0,
        isActive: true,
        color: getOrAssignColor(proc.name),
      });
    }

    // 添加有历史数据但当前不存在的进程
    // 暂时跳过没有当前数据的进程在列表中的显示
    // 但它们的历史数据会保留在图表中
    // 注：processHistory 保留以供将来使用
    void processHistory;

    return result;
  }, [processes, processHistory]);

  // 将 Map 转换为数组并排序（仅活跃进程）
  const sortedProcesses = useMemo(() => {
    return allProcessesWithHistory
      .filter((p) => p.isActive)
      .sort((a, b) => {
        switch (sortField) {
          case "cpu":
            return b.cpu - a.cpu;
          case "memory":
            return b.memoryMb - a.memoryMb;
          case "power":
            return (b.powerScore || 0) - (a.powerScore || 0);
          case "disk":
            return (
              b.diskReadRateBps +
              b.diskWriteRateBps -
              (a.diskReadRateBps + a.diskWriteRateBps)
            );
          case "network":
            return (
              (b.networkRxRate || 0) +
              (b.networkTxRate || 0) -
              ((a.networkRxRate || 0) + (a.networkTxRate || 0))
            );
          default:
            return 0;
        }
      });
  }, [allProcessesWithHistory, sortField]);

  // 获取 Top N 进程
  const topProcesses = sortedProcesses.slice(0, showTopN);

  // 获取选中的进程数据
  const selectedProcess = useMemo(() => {
    if (!selectedProcessPid) return null;
    return (
      allProcessesWithHistory.find((p) => p.pid === selectedProcessPid) || null
    );
  }, [selectedProcessPid, allProcessesWithHistory]);

  // 获取选中进程的历史数据
  const selectedProcessHistory = useMemo(() => {
    if (!selectedProcessPid) return null;
    return processHistory.get(selectedProcessPid) || null;
  }, [selectedProcessPid, processHistory]);

  // 匹配关注进程：根据配置的 patterns 匹配实际运行的进程
  const matchedFocusedProcesses = useMemo(() => {
    const matched: Array<{
      config: (typeof focusedProcessConfigs)[0];
      process: ProcessWithHistory | null;
    }> = [];

    for (const config of focusedProcessConfigs) {
      if (!config.enabled) continue;

      // 查找匹配的进程
      const matchedProcess = sortedProcesses.find((proc) => {
        const procNameLower = proc.name.toLowerCase();
        return config.patterns.some((pattern) => {
          const patternLower = pattern.toLowerCase().replace(/\*/g, "");
          return procNameLower.includes(patternLower);
        });
      });

      matched.push({
        config,
        process: matchedProcess || null,
      });
    }

    return matched;
  }, [focusedProcessConfigs, sortedProcesses]);

  // 计算总和
  const totals = useMemo(() => {
    return {
      cpu: sortedProcesses.reduce((sum, p) => sum + p.cpu, 0),
      memory: sortedProcesses.reduce((sum, p) => sum + p.memoryMb, 0),
      power: sortedProcesses.reduce((sum, p) => sum + (p.powerScore || 0), 0),
    };
  }, [sortedProcesses]);

  // 保持图表数据顺序稳定 - 基于进程名排序而不是当前值排序
  // 这样当进程排名变化时，图表不会大幅度重新渲染
  const stableTopProcesses = useMemo(() => {
    // 复制一份并按进程名排序，确保图表数据顺序稳定
    return [...topProcesses].sort((a, b) => a.name.localeCompare(b.name));
  }, [topProcesses]);

  // 构建堆叠面积图数据 - 使用固定颜色和稳定顺序
  const cpuStackedData = useMemo(() => {
    return stableTopProcesses.map((proc) => {
      const history = processHistory.get(proc.pid);
      return {
        name: proc.name.slice(0, 15),
        values: history?.cpu ?? [],
        color: proc.color, // 使用固定颜色
      };
    });
  }, [stableTopProcesses, processHistory]);

  const memoryStackedData = useMemo(() => {
    return stableTopProcesses.map((proc) => {
      const history = processHistory.get(proc.pid);
      return {
        name: proc.name.slice(0, 15),
        values: history?.memory ?? [],
        color: proc.color, // 使用固定颜色
      };
    });
  }, [stableTopProcesses, processHistory]);

  const powerStackedData = useMemo(() => {
    return stableTopProcesses.map((proc) => {
      const history = processHistory.get(proc.pid);
      return {
        name: proc.name.slice(0, 15),
        values: history?.power ?? [],
        color: proc.color, // 使用固定颜色
      };
    });
  }, [stableTopProcesses, processHistory]);

  const diskReadStackedData = useMemo(() => {
    return stableTopProcesses.map((proc) => {
      const history = processHistory.get(proc.pid);
      return {
        name: proc.name.slice(0, 15),
        values: history?.diskRead ?? [],
        color: proc.color,
      };
    });
  }, [stableTopProcesses, processHistory]);

  const diskWriteStackedData = useMemo(() => {
    return stableTopProcesses.map((proc) => {
      const history = processHistory.get(proc.pid);
      return {
        name: proc.name.slice(0, 15),
        values: history?.diskWrite ?? [],
        color: proc.color,
      };
    });
  }, [stableTopProcesses, processHistory]);

  // 处理进程选择
  const handleSelectProcess = (pid: number) => {
    setSelectedProcessPid(pid);
    setViewMode("detail");
  };

  // 返回列表视图
  const handleBackToList = () => {
    setSelectedProcessPid(null);
    setViewMode("list");
  };

  if (!isMonitoring && processes.size === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📱</div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            应用专项分析
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            此面板展示各应用进程的 CPU、内存和能耗分布，帮助识别资源消耗大户。
          </p>
        </div>
      </Card>
    );
  }

  // 格式化字节显示
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // 进程详情视图
  if (viewMode === "detail" && selectedProcess) {
    return (
      <div className="space-y-4">
        {/* 返回按钮和标题 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            ← 返回列表
          </Button>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedProcess.color }}
            />
            <h2 className="text-lg font-semibold text-gray-200">
              {selectedProcess.name}
            </h2>
            <span className="text-xs text-gray-500">
              PID: {selectedProcess.pid} | 线程:{" "}
              {selectedProcess.threads || "-"}
            </span>
          </div>
        </div>

        {/* 核心指标 - 根据是否有目标进程决定列数 */}
        <div className={`grid gap-3 ${hasTargetProcess ? "grid-cols-7" : "grid-cols-5"}`}>
          <MetricCard
            title="CPU 使用"
            value={selectedProcess.cpu}
            unit="%"
            color="cyan"
            icon={<Cpu size={18} />}
          />
          <MetricCard
            title="物理内存"
            value={selectedProcess.memoryMb.toFixed(1)}
            unit="MB"
            color="purple"
            icon={<MemoryStick size={18} />}
          />
          <MetricCard
            title="磁盘读取"
            value={formatBytes(selectedProcess.diskReadRateBps)}
            unit="/s"
            color="green"
            icon={<HardDrive size={18} />}
          />
          <MetricCard
            title="磁盘写入"
            value={formatBytes(selectedProcess.diskWriteRateBps)}
            unit="/s"
            color="orange"
            icon={<HardDrive size={18} />}
          />
          {/* 网络指标仅在有目标进程时显示 */}
          {hasTargetProcess && (
            <>
              <MetricCard
                title="网络接收"
                value={formatBytes(selectedProcess.networkRxRate)}
                unit="/s"
                color="cyan"
                icon={<ArrowDownToLine size={18} />}
              />
              <MetricCard
                title="网络发送"
                value={formatBytes(selectedProcess.networkTxRate)}
                unit="/s"
                color="pink"
                icon={<ArrowUpFromLine size={18} />}
              />
            </>
          )}
          <MetricCard
            title="功耗评分"
            value={(selectedProcess.powerScore || 0).toFixed(2)}
            unit=""
            color={selectedProcess.powerScore > 10 ? "orange" : "green"}
            icon={<Zap size={18} />}
          />
        </div>

        {/* 详细内存指标 */}
        <Card title="内存详情" subtitle="各类型内存占用明细" noPadding>
          <div className="p-3">
            <div className="grid grid-cols-6 gap-3">
              <div className="bg-surface-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">物理内存</div>
                <div className="text-lg font-semibold text-accent-purple">
                  {selectedProcess.memoryMb.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">MB</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">常驻内存</div>
                <div className="text-lg font-semibold text-accent-cyan">
                  {(selectedProcess.memResidentMb || 0).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">MB</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">虚拟内存</div>
                <div className="text-lg font-semibold text-accent-yellow">
                  {((selectedProcess.memVirtualMb || 0) / 1024).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">GB</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">私有内存</div>
                <div className="text-lg font-semibold text-accent-green">
                  {(selectedProcess.memPrivateMb || 0).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">MB</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">共享内存</div>
                <div className="text-lg font-semibold text-accent-pink">
                  {(selectedProcess.memSharedMb || 0).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">MB</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">压缩内存</div>
                <div className="text-lg font-semibold text-accent-orange">
                  {(selectedProcess.memCompressedMb || 0).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">MB</div>
              </div>
            </div>
          </div>
        </Card>

        {/* CPU 和内存图表 */}
        <div className="grid grid-cols-2 gap-4">
          <Card title="CPU 使用率" noPadding>
            <div className="p-3">
              <LineChart
                title=""
                data={selectedProcessHistory?.cpu ?? []}
                color="#58d1eb"
                unit="%"
                height={180}
              />
            </div>
          </Card>

          <Card title="物理内存占用趋势" noPadding>
            <div className="p-3">
              <LineChart
                title=""
                data={selectedProcessHistory?.memory ?? []}
                color="#b392f0"
                unit="MB"
                height={180}
              />
            </div>
          </Card>
        </div>

        {/* 内存细化图表 - 堆叠多线图 */}
        <Card title="内存细化分析" subtitle="各类型内存占用趋势 (MB)" noPadding>
          <div className="p-3">
            {/* 虚拟内存数值显示 - 通常是常量 */}
            <div className="flex items-center gap-4 mb-3 pb-3 border-b border-surface-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-yellow"></span>
                <span className="text-xs text-gray-400">虚拟内存:</span>
                <span className="text-sm font-semibold text-accent-yellow">
                  {((selectedProcess.memVirtualMb || 0) / 1024).toFixed(2)} GB
                </span>
              </div>
              <span className="text-[10px] text-gray-500">(虚拟地址空间，通常为常量)</span>
            </div>
            
            {/* 其他内存指标 - 多线堆叠图 */}
            <MultiLineChart
              title=""
              series={[
                {
                  name: "物理内存",
                  data: selectedProcessHistory?.memory ?? [],
                  color: "#b392f0",
                },
                {
                  name: "常驻内存",
                  data: selectedProcessHistory?.memResident ?? [],
                  color: "#58d1eb",
                },
                {
                  name: "私有内存",
                  data: selectedProcessHistory?.memPrivate ?? [],
                  color: "#7ee787",
                },
                {
                  name: "压缩内存",
                  data: selectedProcessHistory?.memCompressed ?? [],
                  color: "#ffa657",
                },
              ]}
              unit="MB"
              height={220}
              stacked={false}
            />
          </div>
        </Card>

        {/* 磁盘 I/O 图表 - 正负轴显示（读取↑ 写入↓） */}
        <Card 
          title="磁盘 I/O" 
          subtitle={`累计读取: ${selectedProcess.diskReadMb.toFixed(1)} MB | 累计写入: ${selectedProcess.diskWriteMb.toFixed(1)} MB`} 
          noPadding
        >
          <div className="p-3">
            <BidirectionalChart
              positiveData={selectedProcessHistory?.diskRead ?? []}
              negativeData={selectedProcessHistory?.diskWrite ?? []}
              positiveName="读取 ↑"
              negativeName="写入 ↓"
              positiveColor="#7ee787"
              negativeColor="#ffa657"
              unit="KB/s"
              height={180}
            />
          </div>
        </Card>

        {/* 网络 I/O 图表 - 正负轴显示（接收↑ 发送↓），仅在有目标进程时显示 */}
        {hasTargetProcess && (
          <Card 
            title="网络 I/O" 
            subtitle={`累计接收: ${formatBytes(selectedProcess.networkRxBytes)} | 累计发送: ${formatBytes(selectedProcess.networkTxBytes)}`} 
            noPadding
          >
            <div className="p-3">
              <BidirectionalChart
                positiveData={selectedProcessHistory?.networkRx ?? []}
                negativeData={selectedProcessHistory?.networkTx ?? []}
                positiveName="接收 ↑"
                negativeName="发送 ↓"
                positiveColor="#58d1eb"
                negativeColor="#f778ba"
                unit="KB/s"
                height={180}
              />
            </div>
          </Card>
        )}

        {/* 能耗图表 */}
        <Card title="功耗评分趋势" subtitle="实时功耗评分变化" noPadding>
          <div className="p-3">
            <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
              <span>
                累计能耗:{" "}
                {((selectedProcess.totalEnergyScore || 0) / 1e12).toFixed(3)} TJ
              </span>
              <span>
                平均功耗: {(selectedProcess.avgPowerScore || 0).toFixed(2)}
              </span>
            </div>
            <LineChart
              title=""
              data={selectedProcessHistory?.power ?? []}
              color="#f778ba"
              unit=""
              height={180}
            />
          </div>
        </Card>
      </div>
    );
  }

  // 列表视图
  return (
    <div className="space-y-4">
      {/* 关注进程选择器 - 下拉 + 快速切换标签 */}
      {focusedProcessConfigs.length > 0 && (
        <Card title="关注进程" subtitle="选择目标应用查看专项数据" noPadding>
          <div className="p-3">
            {/* 上方：下拉选择器 + 刷新按钮 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <select
                  className="w-full appearance-none bg-surface-700 border border-surface-600 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-200 
                    focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer"
                  value={selectedProcessPid || ""}
                  onChange={(e) => {
                    const pid = e.target.value ? Number(e.target.value) : null;
                    if (pid) {
                      handleSelectProcess(pid);
                    } else {
                      setSelectedProcessPid(null);
                      setViewMode("list");
                    }
                  }}
                >
                  <option value="">全部进程 (列表视图)</option>
                  {matchedFocusedProcesses.map(({ config, process }) => (
                    <option
                      key={config.name}
                      value={process?.pid || ""}
                      disabled={!process}
                    >
                      {config.name} {process ? `(PID: ${process.pid})` : "(未运行)"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={listFocusedProcesses}
                icon={<RefreshCw size={14} />}
              >
                刷新
              </Button>
            </div>

            {/* 下方：快速切换标签（水平滚动） */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-surface-600">
              <button
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !selectedProcessPid
                    ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                    : "bg-surface-700 text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
                onClick={() => {
                  setSelectedProcessPid(null);
                  setViewMode("list");
                }}
              >
                全部
              </button>
              {matchedFocusedProcesses.map(({ config, process }) => (
                <button
                  key={config.name}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    process && selectedProcessPid === process.pid
                      ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                      : process
                      ? "bg-surface-700 text-gray-400 hover:text-gray-200 border border-transparent"
                      : "bg-surface-800 text-gray-600 cursor-not-allowed border border-transparent"
                  }`}
                  onClick={() => process && handleSelectProcess(process.pid)}
                  disabled={!process}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: process ? process.color : "#6b7280",
                    }}
                  />
                  {config.name}
                  {process && (
                    <span className="text-[10px] opacity-70">
                      {process.cpu.toFixed(0)}%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 选中进程的快速指标预览 */}
            {selectedProcess && (
              <div className="mt-3 pt-3 border-t border-surface-600">
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-surface-700 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-accent-cyan">
                      {selectedProcess.cpu.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-gray-500">CPU</div>
                  </div>
                  <div className="bg-surface-700 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-accent-purple">
                      {selectedProcess.memoryMb.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-gray-500">内存 MB</div>
                  </div>
                  <div className="bg-surface-700 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-accent-green">
                      {formatBytes(selectedProcess.diskReadRateBps)}
                    </div>
                    <div className="text-[10px] text-gray-500">磁盘读</div>
                  </div>
                  <div className="bg-surface-700 rounded-lg p-2 text-center">
                    <div className="text-lg font-semibold text-accent-orange">
                      {formatBytes(selectedProcess.diskWriteRateBps)}
                    </div>
                    <div className="text-[10px] text-gray-500">磁盘写</div>
                  </div>
                  <div className="bg-surface-700 rounded-lg p-2 text-center">
                    <div className={`text-lg font-semibold ${
                      (selectedProcess.powerScore || 0) > 15
                        ? "text-accent-red"
                        : (selectedProcess.powerScore || 0) > 5
                        ? "text-accent-orange"
                        : "text-accent-green"
                    }`}>
                      {(selectedProcess.powerScore || 0).toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-500">功耗</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 总览指标 */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          title="进程总数"
          value={processes.size}
          unit="个"
          color="cyan"
          icon={<Layers size={18} />}
        />
        <MetricCard
          title="总 CPU 使用"
          value={totals.cpu}
          unit="%"
          color="pink"
          icon={<Cpu size={18} />}
        />
        <MetricCard
          title="总内存占用"
          value={(totals.memory / 1024).toFixed(1)}
          unit="GB"
          color="purple"
          icon={<MemoryStick size={18} />}
        />
        <MetricCard
          title="总功耗评分"
          value={totals.power.toFixed(1)}
          unit=""
          color="orange"
          icon={<Zap size={18} />}
        />
      </div>

      {/* 排序控制 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">排序方式:</span>
        <div className="flex gap-1">
          {/* 根据是否有目标进程决定是否显示网络排序选项 */}
          {(hasTargetProcess 
            ? ["cpu", "memory", "disk", "network", "power"] 
            : ["cpu", "memory", "disk", "power"] as SortField[]
          ).map((field) => (
            <Button
              key={field}
              variant={sortField === field ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSortField(field as SortField)}
            >
              {field === "cpu"
                ? "CPU"
                : field === "memory"
                ? "内存"
                : field === "disk"
                ? "磁盘"
                : field === "network"
                ? "网络"
                : "能耗"}
            </Button>
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-4">显示数量:</span>
        <select
          className="bg-surface-700 border border-surface-600 rounded px-2 py-1 text-xs text-gray-300"
          value={showTopN}
          onChange={(e) => setShowTopN(Number(e.target.value))}
        >
          <option value={5}>Top 5</option>
          <option value={8}>Top 8</option>
          <option value={10}>Top 10</option>
          <option value={15}>Top 15</option>
        </select>
      </div>

      {/* 进程列表 */}
      <Card title="进程排行" subtitle="点击进程查看详情" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-600">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">
                  进程
                </th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">
                  PID
                </th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">
                  <button
                    className="flex items-center gap-1 ml-auto hover:text-gray-300"
                    onClick={() => setSortField("cpu")}
                  >
                    CPU {sortField === "cpu" && <ArrowUpDown size={12} />}
                  </button>
                </th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">
                  <button
                    className="flex items-center gap-1 ml-auto hover:text-gray-300"
                    onClick={() => setSortField("memory")}
                  >
                    内存 {sortField === "memory" && <ArrowUpDown size={12} />}
                  </button>
                </th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">
                  <button
                    className="flex items-center gap-1 ml-auto hover:text-gray-300"
                    onClick={() => setSortField("disk")}
                  >
                    磁盘 {sortField === "disk" && <ArrowUpDown size={12} />}
                  </button>
                </th>
                {/* 网络列仅在有目标进程时显示 */}
                {hasTargetProcess && (
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">
                    <button
                      className="flex items-center gap-1 ml-auto hover:text-gray-300"
                      onClick={() => setSortField("network")}
                    >
                      网络 {sortField === "network" && <ArrowUpDown size={12} />}
                    </button>
                  </th>
                )}
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">
                  <button
                    className="flex items-center gap-1 ml-auto hover:text-gray-300"
                    onClick={() => setSortField("power")}
                  >
                    功耗 {sortField === "power" && <ArrowUpDown size={12} />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {topProcesses.map((proc) => {
                const diskTotal = proc.diskReadRateBps + proc.diskWriteRateBps;
                const diskDisplay =
                  diskTotal < 1024
                    ? `${diskTotal.toFixed(0)} B/s`
                    : diskTotal < 1024 * 1024
                    ? `${(diskTotal / 1024).toFixed(1)} KB/s`
                    : `${(diskTotal / (1024 * 1024)).toFixed(1)} MB/s`;

                const networkTotal = (proc.networkRxRate || 0) + (proc.networkTxRate || 0);
                const networkDisplay =
                  networkTotal < 1024
                    ? `${networkTotal.toFixed(0)} B/s`
                    : networkTotal < 1024 * 1024
                    ? `${(networkTotal / 1024).toFixed(1)} KB/s`
                    : `${(networkTotal / (1024 * 1024)).toFixed(1)} MB/s`;

                return (
                  <tr
                    key={proc.pid}
                    className="border-b border-surface-700 hover:bg-surface-700/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectProcess(proc.pid)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: proc.color }}
                        />
                        <span className="text-sm text-gray-200 truncate max-w-[200px]">
                          {proc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-500 tabular-nums">
                      {proc.pid}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-sm text-accent-cyan tabular-nums">
                        {proc.cpu.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-sm text-accent-purple tabular-nums">
                        {proc.memoryMb.toFixed(1)} MB
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-sm text-accent-green tabular-nums">
                        {diskDisplay}
                      </span>
                    </td>
                    {/* 网络列仅在有目标进程时显示 */}
                    {hasTargetProcess && (
                      <td className="px-4 py-2 text-right">
                        <span className="text-sm text-accent-cyan tabular-nums">
                          {networkDisplay}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`text-sm tabular-nums ${
                          (proc.powerScore || 0) > 15
                            ? "text-accent-red"
                            : (proc.powerScore || 0) > 5
                            ? "text-accent-orange"
                            : "text-accent-green"
                        }`}
                      >
                        {(proc.powerScore || 0).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 堆叠面积图 */}
      <div className="grid grid-cols-1 gap-4">
        <Card
          title="CPU 分布 (堆叠面积图)"
          subtitle="显示各进程 CPU 使用占比"
          noPadding
        >
          <div className="p-3">
            <StackedAreaChart
              title=""
              data={cpuStackedData}
              unit="%"
              height={280}
            />
          </div>
        </Card>

        <Card
          title="内存分布 (堆叠面积图)"
          subtitle="显示各进程内存占用"
          noPadding
        >
          <div className="p-3">
            <StackedAreaChart
              title=""
              data={memoryStackedData}
              unit="MB"
              height={280}
            />
          </div>
        </Card>

        {/* 磁盘 I/O 分布 */}
        <div className="grid grid-cols-2 gap-4">
          <Card title="磁盘读取分布" subtitle="各进程读取速率 (KB/s)" noPadding>
            <div className="p-3">
              <StackedAreaChart
                title=""
                data={diskReadStackedData}
                unit="KB/s"
                height={240}
              />
            </div>
          </Card>

          <Card title="磁盘写入分布" subtitle="各进程写入速率 (KB/s)" noPadding>
            <div className="p-3">
              <StackedAreaChart
                title=""
                data={diskWriteStackedData}
                unit="KB/s"
                height={240}
              />
            </div>
          </Card>
        </div>

        <Card
          title="能耗分布 (堆叠面积图)"
          subtitle="显示各进程功耗评分"
          noPadding
        >
          <div className="p-3">
            <StackedAreaChart
              title=""
              data={powerStackedData}
              unit=""
              height={280}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
