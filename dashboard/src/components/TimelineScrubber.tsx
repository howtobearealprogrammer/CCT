import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { COLORS } from "../utils/colors";

interface Props {
  earliestSeconds: number | null;
  rangeSeconds: number;
  endSeconds: number | null; // null = live
  onEndChange: (s: number | null) => void;
  histogram: { t: number; count: number }[];
}

function fmt(unixSec: number) {
  const d = new Date(unixSec * 1000);
  const date = d.toLocaleDateString([], { month: "short", day: "2-digit" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

export default function TimelineScrubber({
  earliestSeconds,
  rangeSeconds,
  endSeconds,
  onEndChange,
  histogram,
}: Props) {
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const i = setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 5000);
    return () => clearInterval(i);
  }, []);

  const earliest = earliestSeconds ?? nowSeconds - 3600;
  const fullSpan = Math.max(nowSeconds - earliest, 1);
  const isLive = endSeconds === null;
  const effectiveEnd = endSeconds ?? nowSeconds;
  const effectiveStart = effectiveEnd - rangeSeconds;
  const scrubbingDisabled = rangeSeconds >= fullSpan;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startEnd: number } | null>(null);

  const pctFromTime = useCallback(
    (t: number) => ((t - earliest) / fullSpan) * 100,
    [earliest, fullSpan]
  );

  const brushLeftPct = Math.max(0, pctFromTime(effectiveStart));
  const brushWidthPct = Math.min(100 - brushLeftPct, (rangeSeconds / fullSpan) * 100);

  const commitEndFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const t = earliest + ratio * fullSpan;
      // Treat the click position as the END of the window.
      const clamped = Math.min(nowSeconds, Math.max(earliest + rangeSeconds, Math.floor(t)));
      onEndChange(clamped >= nowSeconds ? null : clamped);
    },
    [earliest, fullSpan, nowSeconds, onEndChange, rangeSeconds]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (scrubbingDisabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { startX: e.clientX, startEnd: effectiveEnd };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const dxRatio = (e.clientX - dragState.current.startX) / rect.width;
    const newEnd = dragState.current.startEnd + dxRatio * fullSpan;
    const clamped = Math.min(nowSeconds, Math.max(earliest + rangeSeconds, Math.floor(newEnd)));
    onEndChange(clamped >= nowSeconds ? null : clamped);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (scrubbingDisabled) return;
    if (dragState.current) return;
    commitEndFromClientX(e.clientX);
  };

  const chartOption = useMemo(() => {
    const maxCount = histogram.reduce((m, p) => Math.max(m, p.count), 0);
    return {
      grid: { left: 0, right: 0, top: 4, bottom: 4 },
      xAxis: {
        type: "time",
        min: earliest * 1000,
        max: nowSeconds * 1000,
        show: false,
      },
      yAxis: { type: "value", min: 0, max: Math.max(maxCount, 1), show: false },
      tooltip: { show: false },
      animation: false,
      series: [
        {
          type: "bar",
          data: histogram.map((p) => [p.t * 1000, p.count]),
          itemStyle: { color: COLORS.blue, opacity: 0.55 },
          barCategoryGap: "10%",
          large: true,
        },
      ],
    };
  }, [histogram, earliest, nowSeconds]);

  return (
    <div className="flex items-center gap-2 px-1 h-full w-full min-w-0">
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
          isLive
            ? "bg-[#73BF69]/20 text-[#73BF69]"
            : "bg-[#FF9830]/20 text-[#FF9830]"
        }`}
      >
        {isLive ? "LIVE" : "HISTORICAL"}
      </span>
      <div className="text-[10px] text-[#8a94a6] tabular-nums w-[100px] text-right">
        {fmt(effectiveStart)}
      </div>
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className="relative flex-1 min-w-0 h-[22px] rounded bg-white/[0.04] border border-white/[0.06] overflow-hidden cursor-pointer select-none"
      >
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
          notMerge
          lazyUpdate
        />
        {!scrubbingDisabled && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
            style={{
              left: `${brushLeftPct}%`,
              width: `${brushWidthPct}%`,
              background: "rgba(255,152,48,0.18)",
              borderLeft: "2px solid #FF9830",
              borderRight: "2px solid #FF9830",
            }}
          />
        )}
      </div>
      <div className="text-[10px] text-[#8a94a6] tabular-nums w-[100px]">
        {fmt(effectiveEnd)}
      </div>
      <button
        onClick={() => onEndChange(null)}
        disabled={isLive}
        className={`text-[11px] px-2 py-1 rounded border ${
          isLive
            ? "border-white/[0.06] text-[#5a6373] cursor-default"
            : "border-[#FF9830] text-[#FF9830] hover:bg-[#FF9830]/10 cursor-pointer"
        }`}
      >
        Now
      </button>
    </div>
  );
}
