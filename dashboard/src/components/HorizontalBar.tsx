import ReactECharts from "echarts-for-react";
import type { PieSlice } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface HorizontalBarProps {
  data: PieSlice[];
  height?: string;
}

export default function HorizontalBar({ data, height = "100%" }: HorizontalBarProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  const option = {
    animation: true,
    animationDuration: 500,
    grid: { top: 4, right: 40, bottom: 4, left: 90 },
    xAxis: { type: "value" as const, show: false },
    yAxis: {
      type: "category" as const,
      data: sorted.map((d) => d.name),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#8a94a6", fontSize: 10 },
    },
    tooltip: {
      backgroundColor: "rgba(10,14,23,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((d, i) => ({
          value: d.value,
          itemStyle: {
            color: {
              type: "linear" as const,
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: CHART_PALETTE[i % CHART_PALETTE.length]! },
                { offset: 1, color: CHART_PALETTE[i % CHART_PALETTE.length]! + "99" },
              ],
            },
            borderRadius: [0, 3, 3, 0],
          },
        })),
        barMaxWidth: 14,
        label: {
          show: true,
          position: "right" as const,
          color: "#5a6a7a",
          fontSize: 10,
          formatter: (params: { value: number }) =>
            total > 0 ? `${Math.round((params.value / total) * 100)}%` : "0%",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
