import { useMemo } from "react";
import { Flame, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, MetricCard } from "@/components/ui";
import { LineChart, FlameGraph } from "@/components/charts";
import { usePerfStore } from "@/stores/perfStore";

export function DetailedPanel() {
  const {
    fps,
    jank,
    gpuUtilization,
    flamegraphData,
    callstackSummary,
    threadStats,
    isMonitoring,
    enableStackshot,
  } = usePerfStore();

  // 计算统计数据
  const fpsStats = useMemo(() => {
    if (fps.length === 0) return { avg: 0, min: 0, max: 0 };
    const values = fps.map((d) => d.value);
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [fps]);

  const jankStats = useMemo(() => {
    if (jank.length === 0) return { total: 0, avg: 0 };
    const values = jank.map((d) => d.value);
    return {
      total: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }, [jank]);

  const latestFps = fps.at(-1)?.value ?? 0;
  const latestGpu = gpuUtilization.at(-1)?.value ?? 0;

  if (!isMonitoring && fps.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔬</div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">细致分析</h3>
          <p className="text-sm text-gray-500 max-w-md">
            此面板提供 FPS、卡顿检测和实时调用栈火焰图分析。
            启用"实时调用栈"选项可获取火焰图数据。
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 核心指标 */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          title="当前 FPS"
          value={latestFps}
          unit="fps"
          color="green"
          icon={<Activity size={18} />}
          subtitle={`平均: ${fpsStats.avg.toFixed(1)}`}
        />
        <MetricCard
          title="FPS 范围"
          value={`${fpsStats.min.toFixed(0)}-${fpsStats.max.toFixed(0)}`}
          unit="fps"
          color="cyan"
          icon={<TrendingUp size={18} />}
        />
        <MetricCard
          title="卡顿帧总数"
          value={jankStats.total}
          unit="帧"
          color={jankStats.total > 50 ? "orange" : "yellow"}
          icon={<AlertTriangle size={18} />}
          subtitle={`平均: ${jankStats.avg.toFixed(2)}/s`}
        />
        <MetricCard
          title="GPU 使用率"
          value={latestGpu}
          unit="%"
          color="pink"
          icon={<Flame size={18} />}
        />
      </div>

      {/* FPS 和卡顿图表 */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="帧率趋势" subtitle="FPS (frames per second)" noPadding>
          <div className="p-3">
            <LineChart
              title=""
              data={fps}
              color="#7ee787"
              unit="fps"
              max={65}
              min={0}
              height={200}
            />
          </div>
        </Card>

        <Card title="卡顿检测" subtitle="Jank Count (>16.67ms)" noPadding>
          <div className="p-3">
            <LineChart
              title=""
              data={jank}
              color="#ffa657"
              unit="帧"
              min={0}
              height={200}
              areaStyle={false}
            />
          </div>
        </Card>
      </div>

      {/* 火焰图 */}
      <Card
        title="实时调用栈火焰图"
        subtitle={
          callstackSummary
            ? `${callstackSummary.totalSamples} 样本 · ${callstackSummary.uniqueThreads} 线程 · ${callstackSummary.analysisDuration}s 分析周期`
            : enableStackshot
            ? "等待数据 (每 10 秒更新)"
            : "未启用 - 请在连接配置中启用实时调用栈"
        }
        noPadding
      >
        <div className="p-3">
          <FlameGraph 
            data={flamegraphData} 
            height={400} 
            threadStats={threadStats || undefined}
          />
        </div>
      </Card>

      {/* GPU 详细指标 */}
      <Card title="GPU 使用率趋势" noPadding>
        <div className="p-3">
          <LineChart
            title=""
            data={gpuUtilization}
            color="#f778ba"
            unit="%"
            max={100}
            height={180}
          />
        </div>
      </Card>
    </div>
  );
}
