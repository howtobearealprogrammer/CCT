import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, children, className = "" }: ChartCardProps) {
  return (
    <div
      className={`rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3.5 flex flex-col ${className}`}
    >
      <div className="text-xs font-medium text-[#8a94a6] mb-2">{title}</div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
