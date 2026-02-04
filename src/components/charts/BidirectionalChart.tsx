import ReactECharts from "echarts-for-react";
import { TimeSeriesPoint } from "@/types";
import { useMemo } from "react";

interface BidirectionalChartProps {
  title?: string;
  positiveData: TimeSeriesPoint[];
  negativeData: TimeSeriesPoint[];
  positiveName: string;
  negativeName: string;
  positiveColor?: string;
  negativeColor?: string;
  unit?: string;
  height?: number;
}

/**
 * 双向图表组件 - 用于显示正负轴数据（如网络收发、磁盘读写）
 * 正向数据显示在 Y 轴正方向，负向数据显示在 Y 轴负方向
 */
export function BidirectionalChart({
  title = "",
  positiveData,
  negativeData,
  positiveName,
  negativeName,
  positiveColor = "#7ee787",
  negativeColor = "#f778ba",
  unit = "KB/s",
  height = 180,
}: BidirectionalChartProps) {
  const option = useMemo(() => {
    // 使用正向数据的时间轴
    const primaryData = positiveData.length > 0 ? positiveData : negativeData;
    const times = primaryData.map((d) => {
      const date = new Date(d.timestamp);
      return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    });

    // 正向数据保持原值
    const positiveValues = positiveData.map((d) => d.value);
    // 负向数据取负值
    const negativeValues = negativeData.map((d) => -d.value);

    // 计算 Y 轴范围
    const maxPositive = positiveValues.length > 0 ? Math.max(...positiveValues, 0) : 0;
    const maxNegative = negativeValues.length > 0 ? Math.min(...negativeValues, 0) : 0;
    const maxAbsValue = Math.max(Math.abs(maxPositive), Math.abs(maxNegative));
    // 给一点余量
    const yMax = maxAbsValue * 1.1 || 10;

    return {
      backgroundColor: "transparent",
      title: title
        ? {
            text: title,
            textStyle: {
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "JetBrains Mono",
            },
            left: 0,
            top: 0,
          }
        : undefined,
      legend: {
        data: [positiveName, negativeName],
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
          interval: Math.floor(times.length / 5),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: -yMax,
        max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#8b949e",
          fontSize: 10,
          formatter: (v: number) => {
            const absValue = Math.abs(v);
            if (absValue >= 1024) {
              return `${(absValue / 1024).toFixed(0)} M`;
            }
            return `${absValue.toFixed(0)}`;
          },
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
        formatter: (params: { seriesName: string; value: number; color: string }[]) => {
          if (!params || params.length === 0) return "";
          let result = "";
          params.forEach((param) => {
            const value = Math.abs(param.value);
            const displayValue = value >= 1024 
              ? `${(value / 1024).toFixed(2)} MB/s`
              : `${value.toFixed(2)} ${unit}`;
            result += `<div style="display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${param.color}"></span>
              <span>${param.seriesName}: ${displayValue}</span>
            </div>`;
          });
          return result;
        },
      },
      series: [
        {
          name: positiveName,
          type: "line",
          data: positiveValues,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: positiveColor,
            width: 2,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${positiveColor}50` },
                { offset: 1, color: `${positiveColor}10` },
              ],
            },
          },
        },
        {
          name: negativeName,
          type: "line",
          data: negativeValues,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: negativeColor,
            width: 2,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 1,
              x2: 0,
              y2: 0,
              colorStops: [
                { offset: 0, color: `${negativeColor}50` },
                { offset: 1, color: `${negativeColor}10` },
              ],
            },
          },
        },
      ],
    };
  }, [positiveData, negativeData, positiveName, negativeName, positiveColor, negativeColor, unit, title, height]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
}






