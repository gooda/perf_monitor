// WebSocket 消息类型定义

export interface WsMessage {
  action: string;
  [key: string]: unknown;
}

// 监控启动/停止消息
export interface MonitoringStartedMessage {
  action: "monitoring_started";
  session_id: string;
  device_id: string;
  protocols: string[];
  message: string;
}

export interface MonitoringStoppedMessage {
  action: "monitoring_stopped";
  session_id: string;
  duration: number;
  data_counts: Record<string, number>;
  message: string;
}

// 系统信息
export interface SystemInfo {
  // CPU 相关 (兼容两种格式)
  CPUCount?: number;
  CPUUsage?: number; // 格式1
  CPU?: number; // 格式2: 实际数据中的字段名
  SystemCPUUsage?: number;
  UserCPUUsage?: number;

  // 内存相关 (兼容两种格式)
  TotalMemory?: number; // 格式1: bytes
  UsedMemory?: number; // 格式1: bytes
  FreeMemory?: number;
  Memory?: {
    // 格式2: 实际数据中的嵌套对象
    "App Memory"?: string;
    "Cached Files"?: string;
    Compressed?: string;
    "Memory Used"?: string;
    "Wired Memory"?: string;
    "Swap Used"?: string;
  };

  // 网络相关
  Network?: {
    "Data Received"?: string;
    "Data Received/sec"?: string;
    "Data Sent"?: string;
    "Data Sent/sec"?: string;
    bytes_in?: number;
    bytes_out?: number;
  };

  // 磁盘相关
  Disk?: {
    "Data Read"?: string;
    "Data Written"?: string;
  };

  // 速率相关
  Rates?: {
    cpu_rate_percent_per_sec?: number;
    memory_rate_mb_per_sec?: number;
  };

  // Graphics 相关
  FPS?: number;
  device_utilization?: number;
  tiler_utilization?: number;
  renderer_utilization?: number;
  alloc_system_memory_mb?: number;
  in_use_system_memory_mb?: number;

  // FPS 相关
  fps?: number;
  jank_count?: number;
  big_jank_count?: number;
  stutter_ratio?: number;
  frame_count?: number;
  time_elapsed?: number;
}

// 进程信息
export interface ProcessInfo {
  Pid?: number;
  pid?: number;
  Name?: string;
  name?: string;
  CPU?: number;
  cpuUsage?: number;
  Memory?: string;
  memory?: string;
  Threads?: number;
  ThreadCount?: number;
  Priority?: number;
  powerScore?: number;
  totalEnergyScore?: number;
  avgPowerScore?: number;

  // 详细内存指标
  _raw_physFootprint?: number; // 物理内存占用
  _raw_memResidentSize?: number; // 常驻内存 (RSS)
  _raw_memVirtualSize?: number; // 虚拟内存
  _validated_memVirtualSize?: number; // 验证后的虚拟内存
  _raw_memRPrvt?: number; // 私有常驻内存
  _raw_memRShrd?: number; // 共享常驻内存
  _raw_memCompressed?: number; // 压缩内存

  // 磁盘 I/O 指标
  DiskReads?: string; // 累计读取（格式化）
  DiskWrites?: string; // 累计写入（格式化）
  _raw_disk_read_bytes?: number; // 累计读取字节
  _raw_disk_write_bytes?: number; // 累计写入字节
  disk_read_rate_bps?: number; // 读取速率 (bytes/s)
  disk_write_rate_bps?: number; // 写入速率 (bytes/s)
  disk_read_rate_display?: string; // 读取速率（格式化）
  disk_write_rate_display?: string; // 写入速率（格式化）
  disk_reads_cumulative?: string; // 累计读取
  disk_writes_cumulative?: string; // 累计写入

  // CPU 时间
  CpuUserTime?: number;
  CpuSystemTime?: number;
  CpuTotalTime?: number;
  _raw_cpu_user_ns?: number;
  _raw_cpu_sys_ns?: number;
  cpu_time_delta?: number;

  // 标记
  is_focused?: boolean;
}

// 目标进程信息
export interface TargetProcess {
  pid: number;
  name: string;
  matched_by?: string;
}

// Sysmontap 数据
export interface SysmontapData {
  action: "sysmontap_metrics";
  subtype: "sysmontap";
  udid: string;
  timestamp: number;
  enhanced?: boolean;
  enhancement_version?: string;
  system?: SystemInfo;
  processes?: ProcessInfo[];
  target_process?: TargetProcess;
  focused_processes?: {
    processes: Record<
      string,
      {
        pid: number;
        name: string;
        cpu: number;
        memory_mb: number;
      }
    >;
  };
}

// Graphics 数据
export interface GraphicsData {
  action: "sysmontap_metrics";
  subtype: "graphics.opengl";
  udid: string;
  timestamp: number;
  system?: SystemInfo;
  data?: {
    system?: SystemInfo;
    per_pid?: Record<string, unknown>;
  };
}

// 网络数据
export interface NetworkStats {
  total_rx_bytes: number;
  total_tx_bytes: number;
  total_rx_packets: number;
  total_tx_packets: number;
  delta_rx_bytes: number;
  delta_tx_bytes: number;
  delta_rx_packets: number;
  delta_tx_packets: number;
}

export interface ProcessNetworkStats {
  pid: number;
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
  delta_rx_bytes: number;
  delta_tx_bytes: number;
  delta_rx_packets: number;
  delta_tx_packets: number;
}

export interface NetworkData {
  action: "sysmontap_metrics";
  subtype: "network.stats";
  udid: string;
  timestamp: number;
  network?: NetworkStats;
  targets?: ProcessNetworkStats[];
  target_process_network?: ProcessNetworkStats;
  target_process?: TargetProcess;
}

// FPS 数据
export interface FPSData {
  action: "sysmontap_metrics";
  subtype: "coreprofilesessiontap";
  udid: string;
  timestamp: number;
  system?: {
    fps: number;
    jank_count: number;
    big_jank_count: number;
    stutter_ratio: number;
    frame_count: number;
    time_elapsed: number;
  };
  fps_details?: {
    type: "fps";
    fps: number;
    jank_count: number;
    big_jank_count: number;
    stutter_ratio: number;
  };
}

// Callstack 分析数据 (火焰图)
export interface CallstackAnalysis {
  summary: {
    total_samples: number;
    unique_threads: number;
    analysis_duration_s: number;
  };
  thread_stats: Record<
    string,
    {
      process_id: number;
      thread_id: string;
      sample_count: number;
      cpu_time_ratio: number;
      top_functions: Record<string, number>;
    }
  >;
  flamegraph: FlameGraphNode;
}

export interface FlameGraphNode {
  name: string;
  value: number;
  address?: string;
  children?: FlameGraphNode[];
}

export interface CallstackData {
  action: "sysmontap_metrics";
  subtype: "coreprofilesessiontap";
  udid: string;
  session_id: string;
  timestamp: number;
  is_accumulated: true;
  callstack_analysis: CallstackAnalysis;
}

// 联合类型
export type PerfMetricsMessage =
  | SysmontapData
  | GraphicsData
  | FPSData
  | CallstackData
  | NetworkData;

// 服务器统计
export interface ServerStats {
  total_connections: number;
  active_connections: number;
  active_sessions: number;
  start_time: number;
  uptime: number;
  current_time: number;
  device_count: number;
  devices: Record<
    string,
    {
      connection_type: string;
      userspace_enabled: boolean;
      decision_reason: string;
      device_name: string;
      product_version: string;
      uptime: number;
    }
  >;
}

// 配置的设备信息
export interface ConfiguredDevice {
  udid: string;
  device_name: string;
  product_version: string;
  product_type: string;
  is_active: boolean;
  connection_mode: string;
  tunnel_host?: string;
  tunnel_port?: number;
}

// 关注进程配置
export interface FocusedProcessConfig {
  name: string;
  patterns: string[];
  enabled: boolean;
  detailed_memory: boolean;
  network_monitoring: boolean;
  disk_monitoring: boolean;
}

// 时序数据点
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

// 进程时序数据
export interface ProcessTimeSeries {
  pid: number;
  name: string;
  cpu: TimeSeriesPoint[];
  memory: TimeSeriesPoint[];
  power: TimeSeriesPoint[];
}

// 连接状态
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

// 监控模式
export type MonitorMode = "overview" | "detailed" | "process";
