import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

interface StackedAreaData {
  name: string;
  values: { timestamp: number; value: number }[];
  color: string;
}

interface StackedAreaChartProps {
  title: string;
  data: StackedAreaData[];
  unit?: string;
  height?: number;
}

export function StackedAreaChart({
  title,
  data,
  unit = "%",
  height = 300,
}: StackedAreaChartProps) {
  const option = useMemo(() => {
    // 收集所有时间戳
    const allTimestamps = new Set<number>();
    data.forEach((d) =>
      d.values.forEach((v) => allTimestamps.add(v.timestamp))
    );
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    const times = sortedTimestamps.map((ts) => {
      const date = new Date(ts);
      return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    });

    const seriesOptions = data.map((d) => {
      const valueMap = new Map(d.values.map((v) => [v.timestamp, v.value]));
      const values = sortedTimestamps.map((ts) => valueMap.get(ts) ?? 0);

      return {
        name: d.name,
        type: "line",
        stack: "Total",
        data: values,
        smooth: true,
        symbol: "none",
        lineStyle: {
          width: 0,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${d.color}cc` },
              { offset: 1, color: `${d.color}66` },
            ],
          },
        },
        emphasis: {
          focus: "series",
        },
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
        data: data.map((d) => d.name),
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
        left: 50,
        right: 15,
        top: 45,
        bottom: 25,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
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
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "#21262d",
          },
        },
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
  }, [data, title, unit]);

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
