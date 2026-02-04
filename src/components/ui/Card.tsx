import { clsx } from "clsx";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerRight?: ReactNode;
  noPadding?: boolean;
}

export function Card({
  children,
  title,
  subtitle,
  className,
  headerRight,
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={clsx(
        "bg-surface-800 border border-surface-600 rounded-xl overflow-hidden shadow-sm",
        className
      )}
    >
      {(title || headerRight) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight}
        </div>
      )}
      <div className={clsx(!noPadding && "p-4")}>{children}</div>
    </div>
  );
}
