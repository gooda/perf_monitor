import { clsx } from "clsx";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  color?: "cyan" | "pink" | "green" | "orange" | "purple" | "yellow";
  trend?: "up" | "down" | "stable";
  subtitle?: string;
}

const colorClasses = {
  cyan: "border-accent-cyan/30 bg-accent-cyan/5",
  pink: "border-accent-pink/30 bg-accent-pink/5",
  green: "border-accent-green/30 bg-accent-green/5",
  orange: "border-accent-orange/30 bg-accent-orange/5",
  purple: "border-accent-purple/30 bg-accent-purple/5",
  yellow: "border-accent-yellow/30 bg-accent-yellow/5",
};

const textColors = {
  cyan: "text-accent-cyan",
  pink: "text-accent-pink",
  green: "text-accent-green",
  orange: "text-accent-orange",
  purple: "text-accent-purple",
  yellow: "text-accent-yellow",
};

export function MetricCard({
  title,
  value,
  unit,
  icon,
  color = "cyan",
  trend,
  subtitle,
}: MetricCardProps) {
  return (
    <div
      className={clsx(
        "p-4 rounded-xl border transition-all duration-300 card-hover",
        colorClasses[color]
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <span className={clsx("text-lg", textColors[color])}>{icon}</span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className={clsx("text-2xl font-bold tabular-nums", textColors[color])}
        >
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-sm text-[var(--text-tertiary)]">{unit}</span>}

        {trend && (
          <span
            className={clsx(
              "ml-2 text-xs",
              trend === "up" && "text-accent-red",
              trend === "down" && "text-accent-green",
              trend === "stable" && "text-[var(--text-tertiary)]"
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trend === "stable" && "→"}
          </span>
        )}
      </div>

      {subtitle && <div className="mt-1 text-xs text-[var(--text-tertiary)]">{subtitle}</div>}
    </div>
  );
}
