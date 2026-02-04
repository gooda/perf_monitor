import { clsx } from "clsx";
import { ConnectionStatus } from "@/types";

interface StatusBadgeProps {
  status: ConnectionStatus;
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; color: string; bgColor: string }
> = {
  disconnected: {
    label: "未连接",
    color: "text-[var(--text-secondary)]",
    bgColor: "bg-surface-500/20",
  },
  connecting: {
    label: "连接中",
    color: "text-accent-yellow",
    bgColor: "bg-accent-yellow/20",
  },
  connected: {
    label: "已连接",
    color: "text-accent-green",
    bgColor: "bg-accent-green/20",
  },
  error: {
    label: "连接错误",
    color: "text-accent-red",
    bgColor: "bg-accent-red/20",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
        config.bgColor,
        config.color
      )}
    >
      <span
        className={clsx(
          "w-2 h-2 rounded-full",
          status === "connected" && "bg-accent-green status-dot",
          status === "connecting" && "bg-accent-yellow animate-pulse",
          status === "disconnected" && "bg-surface-400",
          status === "error" && "bg-accent-red"
        )}
      />
      {config.label}
    </div>
  );
}
