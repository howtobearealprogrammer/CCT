import { TIME_RANGES, REFRESH_OPTIONS } from "../hooks/useTimeRange";

interface TopBarProps {
  rangeSeconds: number;
  onRangeChange: (seconds: number) => void;
  refreshSeconds: number | null;
  onRefreshChange: (seconds: number | null) => void;
  isLive: boolean;
  timelineVisible: boolean;
  onToggleTimeline: () => void;
}

export default function TopBar({
  rangeSeconds,
  onRangeChange,
  refreshSeconds,
  onRefreshChange,
  isLive,
  timelineVisible,
  onToggleTimeline,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-[#e2e8f0] tracking-tight">
          Claude Code Telemetry
        </h1>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            isLive
              ? "bg-[#5794F2]/15 text-[#5794F2]"
              : "bg-[#FF9830]/15 text-[#FF9830]"
          }`}
        >
          {isLive ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTimeline}
          title={timelineVisible ? "Hide timeline" : "Show timeline"}
          className={`text-[11px] px-2 py-1 rounded border cursor-pointer ${
            timelineVisible
              ? "bg-[#5794F2]/15 border-[#5794F2]/40 text-[#5794F2]"
              : "bg-white/[0.06] border-white/[0.08] text-[#8a94a6] hover:text-[#e2e8f0]"
          }`}
        >
          Timeline
        </button>
        <select
          value={rangeSeconds}
          onChange={(e) => onRangeChange(Number(e.target.value))}
          className="bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1 text-xs text-[#8a94a6] outline-none cursor-pointer"
        >
          {TIME_RANGES.map((r) => (
            <option key={r.seconds} value={r.seconds}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={refreshSeconds ?? "off"}
          onChange={(e) =>
            onRefreshChange(e.target.value === "off" ? null : Number(e.target.value))
          }
          className="bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1 text-xs text-[#8a94a6] outline-none cursor-pointer"
        >
          {REFRESH_OPTIONS.map((r) => (
            <option key={r.label} value={r.seconds ?? "off"}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
