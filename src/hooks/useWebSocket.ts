import { useEffect, useCallback } from "react";
import {
  wsService,
  isSysmontapData,
  isGraphicsData,
  isFPSData,
  isCallstackData,
  isNetworkData,
} from "@/services/websocket";
import { usePerfStore } from "@/stores/perfStore";
import { WsMessage, ServerStats, ConfiguredDevice, FocusedProcessConfig } from "@/types";

export function useWebSocket() {
  const {
    wsUrl,
    setConnectionStatus,
    setMonitoring,
    setSessionId,
    updateSystemMetrics,
    updateGraphicsMetrics,
    updateFpsMetrics,
    updateNetworkMetrics,
    updateFlamegraph,
    setServerStats,
    setConfiguredDevices,
    setFocusedProcessConfigs,
    clearData,
  } = usePerfStore();

  // 处理消息
  const handleMessage = useCallback(
    (msg: WsMessage) => {
      // 欢迎消息
      if (msg.action === "welcome") {
        console.log("🎉 服务器欢迎:", msg.message);
        return;
      }

      // 监控已启动
      if (msg.action === "monitoring_started") {
        const data = msg as unknown as { session_id: string; protocols: string[] };
        console.log("📊 监控已启动:", data.session_id, "协议:", data.protocols);
        setMonitoring(true);
        setSessionId(data.session_id);
        return;
      }

      // 监控已停止
      if (msg.action === "monitoring_stopped") {
        const data = msg as unknown as {
          session_id: string;
          duration: number;
          data_counts: Record<string, number>;
        };
        console.log(
          "⏹️ 监控已停止:",
          data.session_id,
          "时长:",
          data.duration.toFixed(1),
          "s"
        );
        console.log("   数据统计:", data.data_counts);
        setMonitoring(false);
        setSessionId(null);
        return;
      }

      // 服务器统计
      if (msg.action === "server_stats") {
        const data = msg as unknown as { stats: ServerStats };
        setServerStats(data.stats);
        return;
      }

      // 设备列表
      if (msg.action === "device_list") {
        const data = msg as unknown as { devices: ConfiguredDevice[]; count: number };
        console.log("📱 收到设备列表:", data.count, "个设备");
        setConfiguredDevices(data.devices);
        return;
      }

      // 关注进程列表
      if (msg.action === "focused_processes_list") {
        const data = msg as unknown as { focused_processes: FocusedProcessConfig[]; count: number };
        console.log("📋 收到关注进程列表:", data.count, "个进程");
        setFocusedProcessConfigs(data.focused_processes);
        return;
      }

      // 心跳响应
      if (msg.action === "heartbeat_ack" || msg.action === "pong") {
        return;
      }

      // 错误消息
      if (msg.action === "error") {
        const data = msg as unknown as { message: string };
        console.error("❌ 服务器错误:", data.message);
        return;
      }

      // 调试：打印所有 coreprofilesessiontap 消息
      const subtype = (msg as { subtype?: string }).subtype;
      if (subtype === "coreprofilesessiontap") {
        const is_accumulated = (msg as { is_accumulated?: boolean })
          .is_accumulated;
        const system = (msg as { system?: Record<string, unknown> }).system;
        console.log("🔍 [CoreProfile] 收到消息:", {
          action: msg.action,
          subtype,
          is_accumulated,
          hasSystem: !!system,
          systemFps: system?.fps,
          isFPSData: isFPSData(msg),
          isCallstackData: isCallstackData(msg),
          keys: Object.keys(msg),
        });
      }

      // Sysmontap 数据
      if (isSysmontapData(msg)) {
        updateSystemMetrics({
          timestamp: msg.timestamp,
          system: msg.system,
          processes: msg.processes,
        });
        return;
      }

      // Graphics 数据（包含 FPS、GPU 使用率等）
      if (isGraphicsData(msg)) {
        updateGraphicsMetrics({
          timestamp: msg.timestamp,
          system: msg.system,
        });
        return;
      }

      // FPS 数据
      if (isFPSData(msg)) {
        console.log("🎮 [FPS] 收到数据:", {
          timestamp: msg.timestamp,
          system: msg.system,
          fps_details: (msg as { fps_details?: unknown }).fps_details,
        });
        if (msg.system) {
          updateFpsMetrics({
            timestamp: msg.timestamp,
            fps: msg.system.fps,
            jankCount: msg.system.jank_count,
          });
        }
        return;
      }

      // Callstack 火焰图数据
      if (isCallstackData(msg)) {
        const analysis = msg.callstack_analysis;
        if (analysis?.flamegraph) {
          updateFlamegraph(
            analysis.flamegraph,
            {
              totalSamples: analysis.summary.total_samples,
              uniqueThreads: analysis.summary.unique_threads,
              analysisDuration: analysis.summary.analysis_duration_s,
            },
            analysis.thread_stats
          );
        }
        return;
      }

      // 网络数据
      if (isNetworkData(msg)) {
        updateNetworkMetrics({
          timestamp: msg.timestamp,
          network: msg.network,
          targetProcessNetwork: msg.target_process_network,
        });
        return;
      }
    },
    [
      setMonitoring,
      setSessionId,
      updateSystemMetrics,
      updateGraphicsMetrics,
      updateFpsMetrics,
      updateNetworkMetrics,
      updateFlamegraph,
      setServerStats,
      setConfiguredDevices,
      setFocusedProcessConfigs,
    ]
  );

  // 连接 WebSocket
  // 接受可选的 URL 参数，解决状态更新时序问题
  const connect = useCallback(async (urlOverride?: string) => {
    try {
      // 优先使用传入的 URL，否则使用 store 中的 URL
      const targetUrl = urlOverride || wsUrl;
      wsService.url = targetUrl;
      console.log("🔗 正在连接到:", targetUrl);
      await wsService.connect();
    } catch (error) {
      console.error("连接失败:", error);
    }
  }, [wsUrl]);

  // 断开连接
  const disconnect = useCallback(() => {
    wsService.disconnect();
    setMonitoring(false);
    setSessionId(null);
  }, [setMonitoring, setSessionId]);

  // 开始监控
  const startMonitoring = useCallback(
    (options: {
      udid: string;
      targetProcessName?: string;
      enableStackshot?: boolean;
      protocols?: string[];
    }) => {
      clearData();
      // 根据是否需要 stackshot 决定协议列表
      // 系统概述模式：不需要 coreprofilesessiontap，FPS 从 graphics.opengl 获取
      // 细致分析模式：需要 coreprofilesessiontap 获取 stackshot 数据
      // network.stats 协议用于采集目标进程的网络流量数据
      const defaultProtocols = options.enableStackshot
        ? ["sysmontap", "graphics.opengl", "coreprofilesessiontap", "network.stats"]
        : ["sysmontap", "graphics.opengl", "network.stats"];
      
      wsService.startMonitoring({
        udid: options.udid,
        protocols: options.protocols || defaultProtocols,
        target_process_name: options.targetProcessName,
        need_stackshot: options.enableStackshot,
      });
    },
    [clearData]
  );

  // 停止监控
  const stopMonitoring = useCallback(() => {
    wsService.stopMonitoring();
  }, []);

  // 获取服务器状态
  const getStats = useCallback(() => {
    wsService.getStats();
  }, []);

  // 获取配置的设备列表
  const listDevices = useCallback(() => {
    wsService.listDevices();
  }, []);

  // 获取关注进程列表
  const listFocusedProcesses = useCallback(() => {
    wsService.listFocusedProcesses();
  }, []);

  // 设置事件监听
  useEffect(() => {
    const unsubMessage = wsService.onMessage(handleMessage);
    const unsubStatus = wsService.onStatusChange(setConnectionStatus);

    return () => {
      unsubMessage();
      unsubStatus();
    };
  }, [handleMessage, setConnectionStatus]);

  return {
    connect,
    disconnect,
    startMonitoring,
    stopMonitoring,
    getStats,
    listDevices,
    listFocusedProcesses,
  };
}
