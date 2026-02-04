import {
  WsMessage,
  SysmontapData,
  GraphicsData,
  FPSData,
  CallstackData,
  NetworkData,
  ConnectionStatus,
} from "@/types";

export type MessageHandler = (data: WsMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private _url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set();
  private _status: ConnectionStatus = "disconnected";

  constructor(url: string = "ws://localhost:8766") {
    this._url = url;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get url(): string {
    return this._url;
  }

  set url(value: string) {
    this._url = value;
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus("connecting");

      try {
        console.log("🔗 正在连接:", this._url);
        this.ws = new WebSocket(this._url);

        this.ws.onopen = () => {
          console.log("✅ WebSocket 已连接");
          this.setStatus("connected");
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WsMessage;
            this.messageHandlers.forEach((handler) => handler(data));
          } catch (e) {
            console.error("解析消息失败:", e);
          }
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket 错误:", error);
          this.setStatus("error");
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("🔌 WebSocket 已断开");
          this.setStatus("disconnected");
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        this.setStatus("error");
        reject(error);
      }
    });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止重连
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("❌ 达到最大重连次数");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `🔄 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect().catch(() => {});
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ action: "heartbeat" });
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket 未连接，无法发送消息");
    }
  }

  // 订阅消息
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // 订阅状态变化
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  // 启动监控
  startMonitoring(options: {
    udid: string;
    protocols?: string[];
    target_process_name?: string;
    need_stackshot?: boolean;
    session_id?: string;
  }) {
    // 根据 need_stackshot 决定默认协议
    // 系统概述模式：不需要 coreprofilesessiontap，FPS 从 graphics.opengl 获取
    // 细致分析模式：需要 coreprofilesessiontap 获取 stackshot 数据
    // network.stats 协议用于采集目标进程的网络流量数据
    const defaultProtocols = options.need_stackshot
      ? ["sysmontap", "graphics.opengl", "coreprofilesessiontap", "network.stats"]
      : ["sysmontap", "graphics.opengl", "network.stats"];

    this.send({
      action: "start_monitoring",
      udid: options.udid,
      protocols: options.protocols || defaultProtocols,
      target_process_name: options.target_process_name,
      need_stackshot: options.need_stackshot || false,
      session_id: options.session_id || `session_${Date.now()}`,
    });
  }

  // 停止监控
  stopMonitoring() {
    this.send({ action: "stop_monitoring" });
  }

  // 获取服务器状态
  getStats() {
    this.send({ action: "get_stats" });
  }

  // 触发 stackshot
  triggerStackshot(udid: string) {
    this.send({
      action: "trigger_coreprofile_stackshot",
      udid,
    });
  }

  // 获取配置的设备列表
  listDevices() {
    this.send({ action: "list_devices" });
  }

  // 获取关注进程列表
  listFocusedProcesses() {
    this.send({ action: "list_focused_processes" });
  }
}

// 单例
export const wsService = new WebSocketService();

// 类型守卫
export function isSysmontapData(msg: WsMessage): msg is WsMessage & SysmontapData {
  return (
    msg.action === "sysmontap_metrics" &&
    (msg as unknown as SysmontapData).subtype === "sysmontap"
  );
}

export function isGraphicsData(msg: WsMessage): msg is WsMessage & GraphicsData {
  return (
    msg.action === "sysmontap_metrics" &&
    (msg as unknown as GraphicsData).subtype === "graphics.opengl"
  );
}

export function isFPSData(msg: WsMessage): msg is WsMessage & FPSData {
  return (
    msg.action === "sysmontap_metrics" &&
    (msg as unknown as FPSData).subtype === "coreprofilesessiontap" &&
    !(msg as unknown as CallstackData).is_accumulated
  );
}

export function isCallstackData(msg: WsMessage): msg is WsMessage & CallstackData {
  return (
    msg.action === "sysmontap_metrics" &&
    (msg as unknown as CallstackData).subtype === "coreprofilesessiontap" &&
    (msg as unknown as CallstackData).is_accumulated === true
  );
}

export function isNetworkData(msg: WsMessage): msg is WsMessage & NetworkData {
  return (
    msg.action === "sysmontap_metrics" &&
    (msg as unknown as NetworkData).subtype === "network.stats"
  );
}
