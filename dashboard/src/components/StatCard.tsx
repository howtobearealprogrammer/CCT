import ReactECharts from "echarts-for-react";
import type { TimeSeriesPoint } from "../types";

interface StatCardProps {
  label: string;
  value: string;
  suffix: string;
  color: string;
  sparklineData: TimeSeriesPoint[];
}

export default function StatCard({ label, value, suffix, color, sparklineData }: StatCardProps) {
  const sparkOption = {
    animation: false,
    grid: { top: 0, right: 0, bottom: 0, left: 0 },
    xAxis: { type: "time" as const, show: false },
    yAxis: { type: "value" as const, show: false, min: "dataMin" },
    series: [
      {
        type: "line" as const,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 1.5, color },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + "44" },
              { offset: 1, color: color + "00" },
            ],
          },
        },
        data: sparklineData.map((p) => [p.timestamp * 1000, p.value]),
      },
    ],
  };

  return (
    <div
      className="rounded-[10px] px-4 py-3 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${color}1F 0%, ${color}0A 100%)`,
        border: `1px solid ${color}26`,
      }}
    >
      <div className="shrink-0">
        <div className="text-[10px] uppercase tracking-[1px] text-[#5a6a7a] mb-1.5">
          {label}
        </div>
        <div className="text-[28px] font-bold leading-none tracking-tight" style={{ color }}>
          {value}
          {suffix && (
            <span className="text-sm font-normal ml-0.5 opacity-70">{suffix}</span>
          )}
        </div>
      </div>
      {/* Sparkline fills remaining space */}
      <div className="flex-1 min-w-0 h-full self-stretch">
        <ReactECharts
          option={sparkOption}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  );
}
