import { useMemo, useState, useCallback, useRef } from "react";
import { FlameGraphNode } from "@/types";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Filter } from "lucide-react";
import { clsx } from "clsx";

interface FlameGraphProps {
  data: FlameGraphNode | null;
  height?: number;
  threadStats?: Record<string, {
    process_id: number;
    thread_id: string;
    sample_count: number;
    cpu_time_ratio: number;
    top_functions: Record<string, number>;
  }>;
}

// 火焰图配色方案 - 暖色系（传统火焰图风格）
const FLAME_COLORS = [
  "#ff6b35", // 橙红
  "#f7931e", // 橙
  "#fbb03b", // 金橙
  "#fcee21", // 黄
  "#8cc63f", // 黄绿
  "#39b54a", // 绿
  "#00a99d", // 青绿
  "#2e3192", // 蓝紫
  "#662d91", // 紫
  "#ed1c24", // 红
];

// 系统函数配色
const SYSTEM_COLORS: Record<string, string> = {
  objc: "#6b7280",      // ObjC 运行时
  dyld: "#4b5563",      // 动态链接器
  libsystem: "#374151", // 系统库
  kernel: "#1f2937",    // 内核
  unknown: "#111827",   // 未知/地址
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getColorForName(name: string): string {
  // 系统函数使用灰色系
  if (name.startsWith("objc_") || name.includes("objc_msgSend")) {
    return SYSTEM_COLORS.objc;
  }
  if (name.startsWith("dyld") || name.includes("dyld")) {
    return SYSTEM_COLORS.dyld;
  }
  if (name.startsWith("libsystem") || name.includes("libsystem")) {
    return SYSTEM_COLORS.libsystem;
  }
  if (name.startsWith("0x") || name.match(/^[0-9a-f]+$/i)) {
    return SYSTEM_COLORS.unknown;
  }
  
  // 用户函数使用暖色
  return FLAME_COLORS[hashString(name) % FLAME_COLORS.length];
}

// 简化函数名显示
function simplifyFunctionName(name: string, maxLen = 50): string {
  if (name.length <= maxLen) return name;
  // 对于 ObjC 方法，保留类名和方法名
  if (name.startsWith("-[") || name.startsWith("+[")) {
    const match = name.match(/^([+-]\[[^\]]+\])/);
    if (match) return match[1];
  }
  return name.slice(0, maxLen - 3) + "...";
}

// 递归合并同名节点
function mergeNodesRecursive(nodes: FlameGraphNode[]): FlameGraphNode[] {
  if (!nodes || nodes.length === 0) return [];

  const map = new Map<string, FlameGraphNode>();

  for (const node of nodes) {
    const key = node.name;
    if (!map.has(key)) {
      map.set(key, {
        ...node,
        children: node.children ? [...node.children] : [],
      });
    } else {
      const existing = map.get(key)!;
      existing.value += node.value;
      if (node.children) {
        existing.children = [...(existing.children || []), ...node.children];
      }
    }
  }

  const result: FlameGraphNode[] = [];
  for (const [, node] of map) {
    if (node.children && node.children.length > 0) {
      node.children = mergeNodesRecursive(node.children);
    }
    result.push(node);
  }

  return result;
}

// 获取全局合并树（隐藏线程层）
function getMergedGlobalTree(rootNode: FlameGraphNode): FlameGraphNode {
  if (!rootNode || !rootNode.children) return rootNode;

  // 收集所有线程的子节点（即栈根）
  const allStackRoots: FlameGraphNode[] = [];
  rootNode.children.forEach((threadNode) => {
    if (threadNode.children) {
      allStackRoots.push(...threadNode.children);
    }
  });

  // 递归合并
  const mergedChildren = mergeNodesRecursive(allStackRoots);

  return {
    ...rootNode,
    children: mergedChildren,
  };
}

// 火焰图节点组件
interface FlameNodeProps {
  node: FlameGraphNode;
  total: number;
  depth: number;
  onHover: (node: FlameGraphNode | null, event?: React.MouseEvent) => void;
  onClick: (node: FlameGraphNode) => void;
  minWidthPercent?: number;
  zoomLevel: number;
}

function FlameNode({ node, total, depth, onHover, onClick, minWidthPercent = 0.3, zoomLevel }: FlameNodeProps) {
  const widthPercent = (node.value / total) * 100 * zoomLevel;
  
  // 过滤太小的节点
  if (widthPercent < minWidthPercent) return null;

  const backgroundColor = getColorForName(node.name);
  const displayPercent = ((node.value / total) * 100).toFixed(1);

  // 按值排序子节点
  const sortedChildren = node.children && node.children.length > 0
    ? [...node.children].sort((a, b) => (b.value || 0) - (a.value || 0))
    : [];

  return (
    <div 
      className="flame-node-container" 
      style={{ 
        width: `${widthPercent}%`,
        minWidth: widthPercent > 1 ? '2px' : '1px',
      }}
    >
      <div
        className="flame-node-bar group"
        style={{ 
          backgroundColor,
          opacity: depth === 0 ? 1 : 0.9 + (depth * 0.01),
        }}
        onMouseEnter={(e) => onHover(node, e)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node)}
        title={`${node.name}: ${node.value} 样本 (${displayPercent}%)`}
      >
        <span className="flame-node-text">
          {widthPercent > 3 ? simplifyFunctionName(node.name, Math.floor(widthPercent * 1.5)) : ""}
        </span>
      </div>
      {sortedChildren.length > 0 && (
        <div className="flame-node-children">
          {sortedChildren.map((child, idx) => (
            <FlameNode
              key={`${child.name}-${idx}`}
              node={child}
              total={node.value}
              depth={depth + 1}
              onHover={onHover}
              onClick={onClick}
              minWidthPercent={minWidthPercent}
              zoomLevel={zoomLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tooltip 组件
interface TooltipProps {
  node: FlameGraphNode | null;
  total: number;
  position: { x: number; y: number };
}

function Tooltip({ node, total, position }: TooltipProps) {
  if (!node) return null;

  const percentage = total > 0 ? ((node.value / total) * 100).toFixed(2) : "0";

  return (
    <div
      className="flame-tooltip"
      style={{
        left: position.x + 10,
        top: position.y + 10,
      }}
    >
      <div className="tooltip-name">{node.name}</div>
      <div className="tooltip-stats">
        <span className="tooltip-value">{node.value.toLocaleString()} 样本</span>
        <span className="tooltip-percent">{percentage}%</span>
      </div>
      {node.address && (
        <div className="tooltip-address">地址: {node.address}</div>
      )}
    </div>
  );
}

export function FlameGraph({ data, height = 400, threadStats }: FlameGraphProps) {
  const [selectedThread, setSelectedThread] = useState<string>("all");
  const [hoveredNode, setHoveredNode] = useState<FlameGraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [focusedNode, setFocusedNode] = useState<FlameGraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 提取线程列表
  const threads = useMemo(() => {
    if (threadStats) {
      return Object.entries(threadStats)
        .map(([key, stats]) => ({
          name: key,
          shortName: key.split(" (")[0],
          sampleCount: stats.sample_count,
          cpuRatio: stats.cpu_time_ratio,
        }))
        .sort((a, b) => b.sampleCount - a.sampleCount);
    }
    
    // 从树结构中提取
    if (data && data.children) {
      return data.children
        .map((child) => ({
          name: child.name,
          shortName: child.name.split(" (")[0],
          sampleCount: child.value,
          cpuRatio: data.value > 0 ? child.value / data.value : 0,
        }))
        .sort((a, b) => b.sampleCount - a.sampleCount);
    }
    
    return [];
  }, [data, threadStats]);

  // 过滤后的树数据
  const filteredTree = useMemo(() => {
    if (!data) return null;
    
    // 如果有聚焦的节点，使用聚焦的节点
    if (focusedNode) {
      return focusedNode;
    }

    if (selectedThread === "all") {
      // 全部线程：合并视图
      return getMergedGlobalTree(data);
    }

    // 查找特定线程
    const threadNode = data.children?.find(
      (child) => child.name === selectedThread
    );

    return threadNode || null;
  }, [data, selectedThread, focusedNode]);

  // 总样本数
  const displayTotal = filteredTree?.value || 0;

  // 处理 hover
  const handleHover = useCallback((node: FlameGraphNode | null, event?: React.MouseEvent) => {
    setHoveredNode(node);
    if (event && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  }, []);

  // 处理节点点击（聚焦）
  const handleNodeClick = useCallback((node: FlameGraphNode) => {
    if (focusedNode?.name === node.name) {
      // 再次点击取消聚焦
      setFocusedNode(null);
    } else {
      setFocusedNode(node);
    }
  }, [focusedNode]);

  // 重置视图
  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setFocusedNode(null);
  }, []);

  // 缩放控制
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * 1.5, 10));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / 1.5, 0.5));

  // 显示高度
  const displayHeight = isExpanded ? Math.max(height * 2, 600) : height;

  if (!data) {
    return (
      <div className="flame-graph-empty">
        <div className="empty-icon">🔥</div>
        <div className="empty-text">等待火焰图数据...</div>
        <div className="empty-hint">启用 Stackshot 后，每 10 秒推送一次火焰图数据</div>
      </div>
    );
  }

  return (
    <div className="flame-graph-wrapper">
      {/* 工具栏 */}
      <div className="flame-toolbar">
        <div className="toolbar-left">
          {/* 线程筛选 */}
          <div className="thread-filter">
            <Filter size={14} className="filter-icon" />
            <select
              value={selectedThread}
              onChange={(e) => {
                setSelectedThread(e.target.value);
                setFocusedNode(null);
              }}
              className="thread-select"
            >
              <option value="all">全部线程 ({threads.length})</option>
              {threads.slice(0, 20).map((t) => (
                <option key={t.name} value={t.name}>
                  {t.shortName} ({t.sampleCount} 样本)
                </option>
              ))}
            </select>
          </div>

          {/* 聚焦提示 */}
          {focusedNode && (
            <div className="focus-indicator">
              <span className="focus-label">聚焦:</span>
              <span className="focus-name">{simplifyFunctionName(focusedNode.name, 30)}</span>
              <button className="focus-clear" onClick={() => setFocusedNode(null)}>×</button>
            </div>
          )}
        </div>

        <div className="toolbar-right">
          {/* 统计信息 */}
          <div className="flame-stats">
            {hoveredNode ? (
              <span>
                <strong>{simplifyFunctionName(hoveredNode.name, 40)}</strong>: {hoveredNode.value.toLocaleString()} 样本
              </span>
            ) : (
              <span>总样本: {displayTotal.toLocaleString()}</span>
            )}
          </div>

          {/* 缩放控制 */}
          <div className="zoom-controls">
            <button onClick={handleZoomOut} title="缩小" disabled={zoomLevel <= 0.5}>
              <ZoomOut size={14} />
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={handleZoomIn} title="放大" disabled={zoomLevel >= 10}>
              <ZoomIn size={14} />
            </button>
            <button onClick={handleReset} title="重置">
              <RotateCcw size={14} />
            </button>
            <button onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "收起" : "展开"}>
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* 火焰图容器 */}
      <div 
        ref={containerRef}
        className={clsx("flame-graph-container", isExpanded && "expanded")}
        style={{ height: displayHeight }}
      >
        {filteredTree ? (
          <div className="flame-graph-scroll" style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}>
            <div className="flame-graph-viz icicle-view">
              {/* 根节点层 */}
              <div className="flame-root-layer">
                <div 
                  className="flame-root-bar"
                  style={{ backgroundColor: getColorForName(filteredTree.name) }}
                  onMouseEnter={(e) => handleHover(filteredTree, e)}
                  onMouseLeave={() => handleHover(null)}
                >
                  <span className="flame-root-text">
                    {focusedNode ? simplifyFunctionName(focusedNode.name, 60) : (selectedThread === "all" ? "All Threads" : simplifyFunctionName(selectedThread, 60))}
                    <span className="flame-root-value"> ({displayTotal.toLocaleString()} 样本)</span>
                  </span>
                </div>
              </div>
              
              {/* 子节点层级 */}
              <div className="flame-node-children root-children">
                {filteredTree.children
                  ?.sort((a, b) => b.value - a.value)
                  .map((child, idx) => (
                    <FlameNode
                      key={`${child.name}-${idx}`}
                      node={child}
                      total={displayTotal}
                      depth={0}
                      onHover={handleHover}
                      onClick={handleNodeClick}
                      zoomLevel={1}
                    />
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flame-no-data">
            选中的线程没有数据
          </div>
        )}
        
        {/* Tooltip */}
        <Tooltip node={hoveredNode} total={displayTotal} position={tooltipPos} />
      </div>

      {/* 线程占用概览 */}
      {threads.length > 0 && selectedThread === "all" && (
        <div className="thread-overview">
          <div className="overview-title">线程 CPU 占用分布</div>
          <div className="thread-bars">
            {threads.slice(0, 8).map((t) => {
              const pct = data.value > 0 ? (t.sampleCount / data.value) * 100 : 0;
              return (
                <div
                  key={t.name}
                  className={clsx("thread-bar-item", selectedThread === t.name && "active")}
                  onClick={() => setSelectedThread(t.name)}
                  title={`${t.name}: ${t.sampleCount} 样本`}
                >
                  <div className="thread-name">{t.shortName}</div>
                  <div className="thread-bar">
                    <div
                      className="thread-fill"
                      style={{
                        width: `${Math.max(pct, 1)}%`,
                        backgroundColor: getColorForName(t.name),
                      }}
                    />
                  </div>
                  <div className="thread-pct">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
