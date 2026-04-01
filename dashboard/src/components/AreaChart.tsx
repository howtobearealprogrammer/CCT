import ReactECharts from "echarts-for-react";
import type { TimeSeries } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface AreaChartProps {
  series: TimeSeries[];
  colorMap?: Record<string, string>;
  stacked?: boolean;
  showLegend?: boolean;
  height?: string;
  markLineTimestamps?: number[]; // Unix ms timestamps to show as vertical lines
  markLineLabel?: string;
  timeRangeMs?: { start: number; end: number }; // Force x-axis bounds
  integerAxis?: boolean; // Force integer tick marks (for count-based charts)
}

export default function AreaChart({
  series,
  colorMap,
  stacked = true,
  showLegend = true,
  height = "100%",
  markLineTimestamps,
  markLineLabel = "prompt",
  timeRangeMs,
  integerAxis = false,
}: AreaChartProps) {
  const option = {
    animation: true,
    animationDuration: 500,
    grid: {
      top: 8,
      right: 8,
      bottom: showLegend ? 28 : 8,
      left: 40,
    },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "rgba(10,14,23,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    xAxis: {
      type: "time" as const,
      min: timeRangeMs?.start,
      max: timeRangeMs?.end,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#5a6a7a", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#5a6a7a", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      ...(integerAxis ? { minInterval: 1 } : {}),
    },
    legend: showLegend
      ? {
          bottom: 0,
          textStyle: { color: "#5a6a7a", fontSize: 10 },
          icon: "roundRect",
          itemWidth: 10,
          itemHeight: 3,
        }
      : undefined,
    series: series.map((s, i) => {
      const color = colorMap?.[s.label] ?? CHART_PALETTE[i % CHART_PALETTE.length];
      const base = {
        name: s.label,
        type: "line" as const,
        stack: stacked ? "total" : undefined,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + "80" },
              { offset: 1, color: color + "05" },
            ],
          },
        },
        data: s.data.map((p) => [p.timestamp * 1000, p.value]),
      };
      // Add markLines only to the first series to avoid duplicates
      if (i === 0 && markLineTimestamps && markLineTimestamps.length > 0) {
        return {
          ...base,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: {
              color: "rgba(255,255,255,0.25)",
              type: "dashed" as const,
              width: 1,
            },
            label: {
              show: true,
              position: "start" as const,
              formatter: markLineLabel,
              fontSize: 8,
              color: "rgba(255,255,255,0.35)",
              distance: 4,
            },
            data: markLineTimestamps.map((ts) => ({ xAxis: ts })),
          },
        };
      }
      return base;
    }),
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
