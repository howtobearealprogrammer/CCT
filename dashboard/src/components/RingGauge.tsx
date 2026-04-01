import ReactECharts from "echarts-for-react";
import type { PieSlice } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface RingGaugeProps {
  data: PieSlice[];
  colorMap?: Record<string, string>;
  height?: string;
  centerValue?: number;
  centerLabel?: string;
  centerColor?: string;
  legendLabels?: Record<string, string>;
}

export default function RingGauge({
  data,
  colorMap,
  height = "100%",
  centerValue,
  centerLabel,
  centerColor,
  legendLabels,
}: RingGaugeProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const hasData = data.length > 0 && total > 0;
  const dominant = data[0];
  const dominantPct = hasData && dominant ? Math.round((dominant.value / total) * 100) : 0;
  const dominantName = dominant?.name ?? "";
  const shortName =
    dominantName.length > 10 ? dominantName.split(/[-_]/)[0] ?? dominantName : dominantName;

  const displayPct = centerValue !== undefined ? centerValue : dominantPct;
  const displayLabel = centerLabel ?? shortName;
  const displayColor = centerColor ?? "#e2e8f0";

  const centerText = hasData
    ? `{pct|${displayPct}%}\n{sub|${displayLabel}}`
    : "{nodata|No data}";

  const option = {
    animation: true,
    animationDuration: 800,
    tooltip: {
      trigger: "item" as const,
      backgroundColor: "rgba(10,14,23,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
      formatter: (params: { name: string; percent: number }) =>
        `${params.name}: ${params.percent}%`,
    },
    series: [
      {
        type: "pie" as const,
        radius: ["52%", "75%"],
        center: ["30%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: { borderWidth: 2, borderColor: "#0a0e17" },
        label: {
          show: true,
          position: "center" as const,
          formatter: centerText,
          rich: {
            pct: { fontSize: 20, fontWeight: 700, color: displayColor, lineHeight: 26 },
            sub: { fontSize: 10, color: "#5a6a7a", lineHeight: 14 },
            nodata: { fontSize: 11, fontWeight: 500, color: "#5a6a7a", lineHeight: 16 },
          },
        },
        emphasis: {
          label: { show: true, fontSize: 20, fontWeight: 700 },
        },
        data: hasData
          ? data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: {
              color: colorMap?.[d.name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
            },
          }))
          : [{ name: "", value: 1, itemStyle: { color: "#1e2a3a" } }],
      },
    ],
    legend: {
      orient: "vertical" as const,
      right: 10,
      top: "center",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#8a94a6", fontSize: 10 },
      formatter: (name: string) => {
        if (legendLabels?.[name]) return legendLabels[name];
        const item = data.find((d) => d.name === name);
        const pct = total > 0 && item ? Math.round((item.value / total) * 100) : 0;
        return `${name}  ${pct}%`;
      },
    },
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
