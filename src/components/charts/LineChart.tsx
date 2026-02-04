import ReactECharts from "echarts-for-react";
import { TimeSeriesPoint } from "@/types";
import { useMemo } from "react";

interface LineChartProps {
  title: string;
  data: TimeSeriesPoint[];
  color?: string;
  unit?: string;
  max?: number;
  min?: number;
  areaStyle?: boolean;
  height?: number;
}

export function LineChart({
  title,
  data,
  color = "#58d1eb",
  unit = "%",
  max,
  min = 0,
  areaStyle = true,
  height = 200,
}: LineChartProps) {
  const option = useMemo(() => {
    const times = data.map((d) => {
      const date = new Date(d.timestamp);
      return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    });
    const values = data.map((d) => d.value);

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
      grid: {
        left: 45,
        right: 15,
        top: 35,
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
          interval: Math.floor(data.length / 5),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min,
        max,
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
        formatter: (params: { value: number; axisValue: string }[]) => {
          const p = params[0];
          return `<div style="font-size:11px;color:#8b949e">${p.axisValue}</div>
                  <div style="font-size:14px;font-weight:600;color:${color}">${p.value.toFixed(
            1
          )}${unit}</div>`;
        },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color,
            width: 2,
          },
          areaStyle: areaStyle
            ? {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${color}40` },
                    { offset: 1, color: `${color}05` },
                  ],
                },
              }
            : undefined,
        },
      ],
    };
  }, [data, title, color, unit, max, min, areaStyle]);

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
