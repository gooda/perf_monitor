import ReactECharts from "echarts-for-react";
import { TimeSeriesPoint } from "@/types";
import { useMemo } from "react";

interface SeriesData {
  name: string;
  data: TimeSeriesPoint[];
  color: string;
}

interface MultiLineChartProps {
  title: string;
  series: SeriesData[];
  unit?: string;
  height?: number;
  stacked?: boolean;
}

export function MultiLineChart({
  title,
  series,
  unit = "%",
  height = 250,
  stacked = false,
}: MultiLineChartProps) {
  const option = useMemo(() => {
    // 使用每个系列自己的时间轴，避免不同协议时间戳不对齐导致的断线
    // 取第一个有数据的系列的时间轴作为 x 轴标签
    const primarySeries = series.find((s) => s.data.length > 0) || series[0];
    const times = primarySeries.data.map((d) => {
      const date = new Date(d.timestamp);
      return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    });

    // 每个系列使用自己的数据数组（直接使用 value）
    const seriesOptions = series.map((s) => {
      // 直接使用该系列自己的数据点
      const values = s.data.map((d) => d.value);

      return {
        name: s.name,
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        connectNulls: true,
        stack: stacked ? "total" : undefined,
        lineStyle: {
          color: s.color,
          width: 2,
        },
        areaStyle: stacked
          ? {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${s.color}60` },
                  { offset: 1, color: `${s.color}10` },
                ],
              },
            }
          : undefined,
      };
    });

    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        textStyle: {
          color: "#8b949e",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "JetBrains Mono",
        },
        left: 0,
        top: 0,
      },
      legend: {
        data: series.map((s) => s.name),
        top: 0,
        right: 0,
        textStyle: {
          color: "#8b949e",
          fontSize: 10,
          fontFamily: "JetBrains Mono",
        },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: {
        left: 45,
        right: 15,
        top: 40,
        bottom: 25,
      },
      xAxis: {
        type: "category",
        data: times,
        axisLine: {
          lineStyle: { color: "#30363d" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "#8b949e",
          fontSize: 10,
          interval: Math.floor(times.length / 5),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#8b949e",
          fontSize: 10,
          formatter: (v: number) => `${v}${unit}`,
        },
        splitLine: {
          lineStyle: {
            color: "#21262d",
            type: "dashed",
          },
        },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#161b22",
        borderColor: "#30363d",
        textStyle: {
          color: "#f0f6fc",
          fontSize: 12,
          fontFamily: "JetBrains Mono",
        },
      },
      series: seriesOptions,
    };
  }, [series, title, unit, stacked, height]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge={false} // 增量更新，避免大幅度重新渲染
      lazyUpdate={true} // 延迟更新，提高性能
    />
  );
}
