export function formatNumber(n: number): { value: string; suffix: string } {
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(1), suffix: "M" };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(2), suffix: "K" };
  return { value: Math.round(n).toString(), suffix: "" };
}

export function formatDuration(seconds: number): { value: string; suffix: string } {
  if (seconds >= 3600) return { value: (seconds / 3600).toFixed(1), suffix: "hrs" };
  if (seconds >= 60) return { value: (seconds / 60).toFixed(0), suffix: "min" };
  return { value: Math.round(seconds).toString(), suffix: "s" };
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
