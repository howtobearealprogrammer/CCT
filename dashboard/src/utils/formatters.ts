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

export function formatCost(usd: number): { value: string; suffix: string } {
  if (usd >= 1000) return { value: `$${(usd / 1000).toFixed(1)}K`, suffix: "" };
  if (usd >= 100) return { value: `$${usd.toFixed(1)}`, suffix: "" };
  return { value: `$${usd.toFixed(2)}`, suffix: "" };
}
