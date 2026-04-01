import ReactECharts from "echarts-for-react";
import type { PieSlice } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface RingGaugeProps {
  data: PieSlice[];
  colorMap?: Record<string, string>;
  height?: string;
}

export default function RingGauge({ data, colorMap, height = "100%" }: RingGaugeProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const dominant = data[0];
  const dominantPct = total > 0 && dominant ? Math.round((dominant.value / total) * 100) : 0;
  const dominantName = dominant?.name ?? "";
  const shortName =
    dominantName.length > 10 ? dominantName.split(/[-_]/)[0] ?? dominantName : dominantName;

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
        radius: ["58%", "78%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: { borderWidth: 2, borderColor: "#0a0e17" },
        label: {
          show: true,
          position: "center" as const,
          formatter: [`{pct|${dominantPct}%}`, `{sub|${shortName}}`].join("\n"),
          rich: {
            pct: { fontSize: 18, fontWeight: 700, color: "#e2e8f0", lineHeight: 24 },
            sub: { fontSize: 9, color: "#5a6a7a", lineHeight: 14 },
          },
        },
        data: data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: {
            color: colorMap?.[d.name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
          },
        })),
      },
    ],
    legend: {
      orient: "vertical" as const,
      right: 0,
      top: "center",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#8a94a6", fontSize: 10 },
      formatter: (name: string) => {
        const item = data.find((d) => d.name === name);
        const pct = total > 0 && item ? Math.round((item.value / total) * 100) : 0;
        return `${name}  ${pct}%`;
      },
    },
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
