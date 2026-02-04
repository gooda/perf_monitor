import { create } from "zustand";
import {
  ConnectionStatus,
  MonitorMode,
  TimeSeriesPoint,
  ProcessInfo,
  SystemInfo,
  FlameGraphNode,
  ServerStats,
  ConfiguredDevice,
  FocusedProcessConfig,
  NetworkStats,
  ProcessNetworkStats,
} from "@/types";

// 最大数据点数量（防止内存溢出）
const MAX_DATA_POINTS = 300; // 约 30 秒 @10Hz

// 进程数据
interface ProcessData {
  pid: number;
  name: string;
  cpu: number;
  threads: number;

  // 内存指标 (MB)
  memoryMb: number; // 物理内存 (physFootprint)
  memResidentMb: number; // 常驻内存 (RSS)
  memVirtualMb: number; // 虚拟内存
  memPrivateMb: number; // 私有内存
  memSharedMb: number; // 共享内存
  memCompressedMb: number; // 压缩内存

  // 磁盘 I/O
  diskReadMb: number; // 累计读取 (MB)
  diskWriteMb: number; // 累计写入 (MB)
  diskReadRateBps: number; // 读取速率 (bytes/s)
  diskWriteRateBps: number; // 写入速率 (bytes/s)

  // 网络 I/O
  networkRxBytes: number; // 累计接收 (bytes)
  networkTxBytes: number; // 累计发送 (bytes)
  networkRxRate: number; // 接收速率 (bytes/s)
  networkTxRate: number; // 发送速率 (bytes/s)

  // 能耗
  powerScore: number;
  totalEnergyScore: number;
  avgPowerScore: number;
}

// Store 状态
interface PerfState {
  // 连接状态
  connectionStatus: ConnectionStatus;
  wsUrl: string;

  // 监控配置
  isMonitoring: boolean;
  sessionId: string | null;
  deviceId: string | null;
  deviceName: string | null;
  targetProcessName: string | null;
  enableStackshot: boolean;
  monitorMode: MonitorMode;

  // 系统时序数据
  systemCpu: TimeSeriesPoint[];
  systemMemory: TimeSeriesPoint[];
  gpuUtilization: TimeSeriesPoint[];
  gpuMemory: TimeSeriesPoint[];
  fps: TimeSeriesPoint[];
  jank: TimeSeriesPoint[];

  // 网络时序数据
  networkRxRate: TimeSeriesPoint[]; // 接收速率 (bytes/s)
  networkTxRate: TimeSeriesPoint[]; // 发送速率 (bytes/s)
  networkRxTotal: TimeSeriesPoint[]; // 累计接收 (bytes)
  networkTxTotal: TimeSeriesPoint[]; // 累计发送 (bytes)

  // 进程数据
  processes: Map<number, ProcessData>;
  processHistory: Map<
    number,
    {
      cpu: TimeSeriesPoint[];
      memory: TimeSeriesPoint[];
      power: TimeSeriesPoint[];
      diskRead: TimeSeriesPoint[]; // 磁盘读取速率
      diskWrite: TimeSeriesPoint[]; // 磁盘写入速率
      networkRx: TimeSeriesPoint[]; // 网络接收速率
      networkTx: TimeSeriesPoint[]; // 网络发送速率
      // 内存细化时序（可选）
      memResident: TimeSeriesPoint[]; // 常驻内存
      memVirtual: TimeSeriesPoint[]; // 虚拟内存
      memPrivate: TimeSeriesPoint[]; // 私有内存
      memCompressed: TimeSeriesPoint[]; // 压缩内存
    }
  >;

  // 火焰图数据
  flamegraphData: FlameGraphNode | null;
  callstackSummary: {
    totalSamples: number;
    uniqueThreads: number;
    analysisDuration: number;
  } | null;
  threadStats: Record<
    string,
    {
      process_id: number;
      thread_id: string;
      sample_count: number;
      cpu_time_ratio: number;
      top_functions: Record<string, number>;
    }
  > | null;

  // 服务器信息
  serverStats: ServerStats | null;

  // 配置的设备列表
  configuredDevices: ConfiguredDevice[];

  // 关注进程列表和选中的进程
  focusedProcessConfigs: FocusedProcessConfig[];
  selectedProcessPid: number | null;

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setWsUrl: (url: string) => void;
  setMonitoring: (isMonitoring: boolean) => void;
  setSessionId: (id: string | null) => void;
  setDeviceId: (id: string | null) => void;
  setDeviceName: (name: string | null) => void;
  setTargetProcessName: (name: string | null) => void;
  setEnableStackshot: (enable: boolean) => void;
  setMonitorMode: (mode: MonitorMode) => void;

  // 数据更新
  updateSystemMetrics: (data: {
    timestamp: number;
    system?: SystemInfo;
    processes?: ProcessInfo[];
  }) => void;
  updateGraphicsMetrics: (data: {
    timestamp: number;
    system?: SystemInfo;
  }) => void;
  updateFpsMetrics: (data: {
    timestamp: number;
    fps: number;
    jankCount: number;
  }) => void;
  updateNetworkMetrics: (data: {
    timestamp: number;
    network?: NetworkStats;
    targetProcessNetwork?: ProcessNetworkStats;
  }) => void;
  updateFlamegraph: (
    data: FlameGraphNode,
    summary: {
      totalSamples: number;
      uniqueThreads: number;
      analysisDuration: number;
    },
    threadStats?: Record<
      string,
      {
        process_id: number;
        thread_id: string;
        sample_count: number;
        cpu_time_ratio: number;
        top_functions: Record<string, number>;
      }
    >
  ) => void;
  setServerStats: (stats: ServerStats) => void;
  setConfiguredDevices: (devices: ConfiguredDevice[]) => void;
  setFocusedProcessConfigs: (configs: FocusedProcessConfig[]) => void;
  setSelectedProcessPid: (pid: number | null) => void;

  // 工具方法
  clearData: () => void;
}

// 辅助函数：解析内存字符串为 GB 数值
// 支持格式: "7.35 GiB", "169.34 MiB", "1.75 GB", "500 MB", "1024 KiB"
function parseMemoryStringToGB(str: string): number {
  if (!str || typeof str !== "string") return 0;
  const match = str.match(/^([\d.]+)\s*(GiB|GB|MiB|MB|KiB|KB|B)?/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  switch (unit) {
    case "GIB":
    case "GB":
      return value;
    case "MIB":
    case "MB":
      return value / 1024;
    case "KIB":
    case "KB":
      return value / (1024 * 1024);
    case "B":
      return value / (1024 * 1024 * 1024);
    default:
      return value;
  }
}

// 辅助函数：添加数据点并保持最大长度
function addDataPoint(
  arr: TimeSeriesPoint[],
  point: TimeSeriesPoint
): TimeSeriesPoint[] {
  const newArr = [...arr, point];
  if (newArr.length > MAX_DATA_POINTS) {
    return newArr.slice(-MAX_DATA_POINTS);
  }
  return newArr;
}

export const usePerfStore = create<PerfState>((set, get) => ({
  // 初始状态
  connectionStatus: "disconnected",
  wsUrl: "ws://localhost:8766",

  isMonitoring: false,
  sessionId: null,
  deviceId: null,
  deviceName: null,
  targetProcessName: null,
  enableStackshot: false,
  monitorMode: "overview",

  systemCpu: [],
  systemMemory: [],
  gpuUtilization: [],
  gpuMemory: [],
  fps: [],
  jank: [],

  networkRxRate: [],
  networkTxRate: [],
  networkRxTotal: [],
  networkTxTotal: [],

  processes: new Map(),
  processHistory: new Map(),

  flamegraphData: null,
  callstackSummary: null,
  threadStats: null,

  serverStats: null,
  configuredDevices: [],
  focusedProcessConfigs: [],
  selectedProcessPid: null,

  // Actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setWsUrl: (url) => set({ wsUrl: url }),
  setMonitoring: (isMonitoring) => set({ isMonitoring }),
  setSessionId: (id) => set({ sessionId: id }),
  setDeviceId: (id) => set({ deviceId: id }),
  setDeviceName: (name) => set({ deviceName: name }),
  setTargetProcessName: (name) => set({ targetProcessName: name }),
  setEnableStackshot: (enable) => set({ enableStackshot: enable }),
  setMonitorMode: (mode) => set({ monitorMode: mode }),

  updateSystemMetrics: (data) => {
    const { timestamp, system, processes } = data;
    const state = get();

    // 更新系统指标
    const newState: Partial<PerfState> = {};

    if (system) {
      // 兼容两种 CPU 字段格式: CPUUsage 或 CPU
      const cpuValue = system.CPUUsage ?? system.CPU;
      if (cpuValue !== undefined && typeof cpuValue === "number") {
        newState.systemCpu = addDataPoint(state.systemCpu, {
          timestamp,
          value: cpuValue,
        });
      }

      // 兼容两种内存格式
      // 格式1: { TotalMemory, UsedMemory } (bytes)
      // 格式2: { Memory: { "Memory Used": "7.35 GiB", ... } }
      if (system.UsedMemory !== undefined && system.TotalMemory !== undefined) {
        const memoryPercent = (system.UsedMemory / system.TotalMemory) * 100;
        newState.systemMemory = addDataPoint(state.systemMemory, {
          timestamp,
          value: memoryPercent,
        });
      } else if (system.Memory && typeof system.Memory === "object") {
        // 解析 "Memory Used" 字符串格式 (如 "7.35 GiB")
        const memUsedStr = (system.Memory as Record<string, string>)[
          "Memory Used"
        ];
        if (memUsedStr) {
          const memUsedGB = parseMemoryStringToGB(memUsedStr);
          if (memUsedGB > 0) {
            newState.systemMemory = addDataPoint(state.systemMemory, {
              timestamp,
              value: memUsedGB, // 单位: GB
            });
          }
        }
      }
    }

    // 更新进程数据
    if (processes && processes.length > 0) {
      const newProcesses = new Map(state.processes);
      const newHistory = new Map(state.processHistory);

      for (const proc of processes) {
        const pid = proc.Pid ?? proc.pid ?? 0;
        const name = proc.Name ?? proc.name ?? "Unknown";
        const cpu = proc.CPU ?? proc.cpuUsage ?? 0;
        const threads = proc.Threads ?? proc.ThreadCount ?? 0;

        // 详细内存指标 (转换为 MB)
        const bytesToMb = (bytes: number | undefined) =>
          (bytes ?? 0) / (1024 * 1024);

        let memoryMb = bytesToMb(proc._raw_physFootprint);
        if (memoryMb === 0 && proc._raw_memResidentSize) {
          memoryMb = bytesToMb(proc._raw_memResidentSize);
        } else if (
          memoryMb === 0 &&
          proc.Memory &&
          typeof proc.Memory === "string"
        ) {
          const match = proc.Memory.match(/^([\d.]+)\s*(MB|GB|KB)?/i);
          if (match) {
            memoryMb = parseFloat(match[1]);
            if (match[2]?.toUpperCase() === "GB") memoryMb *= 1024;
            if (match[2]?.toUpperCase() === "KB") memoryMb /= 1024;
          }
        }

        const memResidentMb = bytesToMb(proc._raw_memResidentSize);
        const memVirtualMb = bytesToMb(
          proc._validated_memVirtualSize ?? proc._raw_memVirtualSize
        );
        const memPrivateMb = bytesToMb(proc._raw_memRPrvt);
        const memSharedMb = bytesToMb(proc._raw_memRShrd);
        const memCompressedMb = bytesToMb(proc._raw_memCompressed);

        // 磁盘 I/O 指标
        const diskReadMb = bytesToMb(proc._raw_disk_read_bytes);
        const diskWriteMb = bytesToMb(proc._raw_disk_write_bytes);
        const diskReadRateBps = proc.disk_read_rate_bps ?? 0;
        const diskWriteRateBps = proc.disk_write_rate_bps ?? 0;

        const processData: ProcessData = {
          pid,
          name,
          cpu,
          threads,
          // 内存
          memoryMb,
          memResidentMb,
          memVirtualMb,
          memPrivateMb,
          memSharedMb,
          memCompressedMb,
          // 磁盘
          diskReadMb,
          diskWriteMb,
          diskReadRateBps,
          diskWriteRateBps,
          // 网络（初始化为 0，由 network.stats 协议更新）
          networkRxBytes: 0,
          networkTxBytes: 0,
          networkRxRate: 0,
          networkTxRate: 0,
          // 能耗
          powerScore: proc.powerScore ?? 0,
          totalEnergyScore: proc.totalEnergyScore ?? 0,
          avgPowerScore: proc.avgPowerScore ?? 0,
        };

        newProcesses.set(pid, processData);

        // 更新历史数据
        const history = newHistory.get(pid) ?? {
          cpu: [],
          memory: [],
          power: [],
          diskRead: [],
          diskWrite: [],
          networkRx: [],
          networkTx: [],
          memResident: [],
          memVirtual: [],
          memPrivate: [],
          memCompressed: [],
        };

        newHistory.set(pid, {
          cpu: addDataPoint(history.cpu, { timestamp, value: cpu }),
          memory: addDataPoint(history.memory, { timestamp, value: memoryMb }),
          power: addDataPoint(history.power, {
            timestamp,
            value: proc.powerScore ?? 0,
          }),
          diskRead: addDataPoint(history.diskRead ?? [], {
            timestamp,
            value: diskReadRateBps / 1024, // 转换为 KB/s
          }),
          diskWrite: addDataPoint(history.diskWrite ?? [], {
            timestamp,
            value: diskWriteRateBps / 1024, // 转换为 KB/s
          }),
          networkRx: history.networkRx ?? [],
          networkTx: history.networkTx ?? [],
          // 内存细化数据
          memResident: addDataPoint(history.memResident ?? [], {
            timestamp,
            value: memResidentMb,
          }),
          memVirtual: addDataPoint(history.memVirtual ?? [], {
            timestamp,
            value: memVirtualMb / 1024, // 转换为 GB
          }),
          memPrivate: addDataPoint(history.memPrivate ?? [], {
            timestamp,
            value: memPrivateMb,
          }),
          memCompressed: addDataPoint(history.memCompressed ?? [], {
            timestamp,
            value: memCompressedMb,
          }),
        });
      }

      newState.processes = newProcesses;
      newState.processHistory = newHistory;
    }

    set(newState);
  },

  updateGraphicsMetrics: (data) => {
    const { timestamp, system } = data;
    const state = get();

    const newState: Partial<PerfState> = {};

    if (system) {
      // GPU 使用率
      if (system.device_utilization !== undefined) {
        newState.gpuUtilization = addDataPoint(state.gpuUtilization, {
          timestamp,
          value: system.device_utilization,
        });
      }

      // GPU 显存
      if (system.in_use_system_memory_mb !== undefined) {
        newState.gpuMemory = addDataPoint(state.gpuMemory, {
          timestamp,
          value: system.in_use_system_memory_mb,
        });
      }

      // FPS 数据（从 graphics.opengl 获取）
      const fpsValue = system.FPS ?? system.fps;
      if (fpsValue !== undefined && fpsValue > 0) {
        newState.fps = addDataPoint(state.fps, {
          timestamp,
          value: fpsValue,
        });
        // 暂时设置 jank 为 0（graphics.opengl 不提供 jank 数据）
        newState.jank = addDataPoint(state.jank, {
          timestamp,
          value: 0,
        });
      }
    }

    set(newState);
  },

  updateFpsMetrics: (data) => {
    const { timestamp, fps, jankCount } = data;
    const state = get();

    set({
      fps: addDataPoint(state.fps, { timestamp, value: fps }),
      jank: addDataPoint(state.jank, { timestamp, value: jankCount }),
    });
  },

  updateNetworkMetrics: (data) => {
    const { timestamp, network, targetProcessNetwork } = data;
    const state = get();

    const newState: Partial<PerfState> = {};

    if (network) {
      // 更新系统级网络数据
      const rxRate = network.delta_rx_bytes ?? 0;
      const txRate = network.delta_tx_bytes ?? 0;

      newState.networkRxRate = addDataPoint(state.networkRxRate, {
        timestamp,
        value: rxRate / 1024, // 转换为 KB/s
      });
      newState.networkTxRate = addDataPoint(state.networkTxRate, {
        timestamp,
        value: txRate / 1024, // 转换为 KB/s
      });
      newState.networkRxTotal = addDataPoint(state.networkRxTotal, {
        timestamp,
        value: (network.total_rx_bytes ?? 0) / (1024 * 1024), // 转换为 MB
      });
      newState.networkTxTotal = addDataPoint(state.networkTxTotal, {
        timestamp,
        value: (network.total_tx_bytes ?? 0) / (1024 * 1024), // 转换为 MB
      });
    }

    // 更新目标进程的网络数据
    if (targetProcessNetwork) {
      const pid = targetProcessNetwork.pid;
      const existingProcess = state.processes.get(pid);

      if (existingProcess) {
        const newProcesses = new Map(state.processes);
        newProcesses.set(pid, {
          ...existingProcess,
          networkRxBytes: targetProcessNetwork.rx_bytes ?? 0,
          networkTxBytes: targetProcessNetwork.tx_bytes ?? 0,
          networkRxRate: targetProcessNetwork.delta_rx_bytes ?? 0,
          networkTxRate: targetProcessNetwork.delta_tx_bytes ?? 0,
        });
        newState.processes = newProcesses;
      }

      // 更新进程历史中的网络数据
      const history = state.processHistory.get(pid);
      if (history) {
        const newHistory = new Map(state.processHistory);
        newHistory.set(pid, {
          ...history,
          networkRx: addDataPoint(history.networkRx ?? [], {
            timestamp,
            value: (targetProcessNetwork.delta_rx_bytes ?? 0) / 1024, // KB/s
          }),
          networkTx: addDataPoint(history.networkTx ?? [], {
            timestamp,
            value: (targetProcessNetwork.delta_tx_bytes ?? 0) / 1024, // KB/s
          }),
        });
        newState.processHistory = newHistory;
      }
    }

    set(newState);
  },

  updateFlamegraph: (data, summary, threadStats) => {
    set({
      flamegraphData: data,
      callstackSummary: summary,
      threadStats: threadStats || null,
    });
  },

  setServerStats: (stats) => set({ serverStats: stats }),
  setConfiguredDevices: (devices) => set({ configuredDevices: devices }),
  setFocusedProcessConfigs: (configs) =>
    set({ focusedProcessConfigs: configs }),
  setSelectedProcessPid: (pid) => set({ selectedProcessPid: pid }),

  clearData: () =>
    set({
      systemCpu: [],
      systemMemory: [],
      gpuUtilization: [],
      gpuMemory: [],
      fps: [],
      jank: [],
      networkRxRate: [],
      networkTxRate: [],
      networkRxTotal: [],
      networkTxTotal: [],
      processes: new Map(),
      processHistory: new Map(),
      flamegraphData: null,
      callstackSummary: null,
      threadStats: null,
    }),
}));
