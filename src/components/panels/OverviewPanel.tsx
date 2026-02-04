import { useMemo } from "react";
import { Cpu, MemoryStick, Monitor, Gauge, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, MetricCard } from "@/components/ui";
import { LineChart, MultiLineChart } from "@/components/charts";
import { usePerfStore } from "@/stores/perfStore";

export function OverviewPanel() {
  const {
    systemCpu,
    systemMemory,
    gpuUtilization,
    gpuMemory,
    fps,
    networkRxRate,
    networkTxRate,
    isMonitoring,
    targetProcessName,
  } = usePerfStore();

  // 是否有目标进程（网络数据需要指定目标进程才能采集）
  const hasTargetProcess = !!targetProcessName;

  // 获取最新值
  const latestCpu = systemCpu.at(-1)?.value ?? 0;
  const latestMemory = systemMemory.at(-1)?.value ?? 0;
  const latestGpu = gpuUtilization.at(-1)?.value ?? 0;
  const latestFps = fps.at(-1)?.value ?? 0;
  const latestNetworkRx = networkRxRate.at(-1)?.value ?? 0;
  const latestNetworkTx = networkTxRate.at(-1)?.value ?? 0;

  // 合并 CPU 和 GPU 数据用于对比图
  const cpuGpuSeries = useMemo(
    () => [
      { name: "CPU", data: systemCpu, color: "#58d1eb" },
      { name: "GPU", data: gpuUtilization, color: "#f778ba" },
    ],
    [systemCpu, gpuUtilization]
  );

  // 网络速率数据
  const networkSeries = useMemo(
    () => [
      { name: "接收", data: networkRxRate, color: "#7ee787" },
      { name: "发送", data: networkTxRate, color: "#f778ba" },
    ],
    [networkRxRate, networkTxRate]
  );

  if (!isMonitoring && systemCpu.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">系统概览</h3>
          <p className="text-sm text-gray-500 max-w-md">
            连接 WebSocket 服务并启动监控后，这里将显示 CPU、内存、GPU 和 FPS
            等实时性能指标。
          </p>
        </div>
      </Card>
    );
  }

  // 格式化网络速率
  const formatNetworkRate = (kbps: number) => {
    if (kbps < 1) return "0";
    if (kbps < 1024) return kbps.toFixed(1);
    return (kbps / 1024).toFixed(1);
  };

  const getNetworkUnit = (kbps: number) => {
    if (kbps < 1024) return "KB/s";
    return "MB/s";
  };

  return (
    <div className="space-y-4">
      {/* 核心指标卡片 - 根据是否有目标进程决定列数 */}
      <div className={`grid gap-3 ${hasTargetProcess ? "grid-cols-6" : "grid-cols-4"}`}>
        <MetricCard
          title="CPU 使用率"
          value={latestCpu}
          unit="%"
          color="cyan"
          icon={<Cpu size={18} />}
        />
        <MetricCard
          title="内存使用"
          value={latestMemory}
          unit="GB"
          color="purple"
          icon={<MemoryStick size={18} />}
        />
        <MetricCard
          title="GPU 使用率"
          value={latestGpu}
          unit="%"
          color="pink"
          icon={<Monitor size={18} />}
        />
        <MetricCard
          title="帧率 FPS"
          value={latestFps}
          unit="fps"
          color="green"
          icon={<Gauge size={18} />}
        />
        {/* 网络指标仅在有目标进程时显示 */}
        {hasTargetProcess && (
          <>
            <MetricCard
              title="网络接收"
              value={formatNetworkRate(latestNetworkRx)}
              unit={getNetworkUnit(latestNetworkRx)}
              color="cyan"
              icon={<ArrowDownToLine size={18} />}
            />
            <MetricCard
              title="网络发送"
              value={formatNetworkRate(latestNetworkTx)}
              unit={getNetworkUnit(latestNetworkTx)}
              color="pink"
              icon={<ArrowUpFromLine size={18} />}
            />
          </>
        )}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="CPU & GPU 使用率" noPadding>
          <div className="p-3">
            <MultiLineChart
              title=""
              series={cpuGpuSeries}
              unit="%"
              height={220}
            />
          </div>
        </Card>

        <Card title="帧率 FPS" noPadding>
          <div className="p-3">
            <LineChart
              title=""
              data={fps}
              color="#7ee787"
              unit="fps"
              max={65}
              min={0}
              height={220}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="系统内存" noPadding>
          <div className="p-3">
            <LineChart
              title=""
              data={systemMemory}
              color="#b392f0"
              unit="GB"
              height={200}
            />
          </div>
        </Card>

        <Card title="GPU 显存" noPadding>
          <div className="p-3">
            <LineChart
              title=""
              data={gpuMemory}
              color="#ffa657"
              unit="MB"
              height={200}
            />
          </div>
        </Card>
      </div>

      {/* 网络流量图表 - 仅在有目标进程时显示 */}
      {hasTargetProcess && (
        <Card title="网络流量" subtitle={`目标进程: ${targetProcessName} - 接收/发送速率 (KB/s)`} noPadding>
          <div className="p-3">
            <MultiLineChart
              title=""
              series={networkSeries}
              unit="KB/s"
              height={200}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
