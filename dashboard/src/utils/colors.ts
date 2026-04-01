export const COLORS = {
  bg: "#0a0e17",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.06)",
  blue: "#5794F2",
  green: "#73BF69",
  purple: "#B877D9",
  amber: "#FF9830",
  teal: "#4ECDC4",
  coral: "#FF6B6B",
  textPrimary: "#e2e8f0",
  textSecondary: "#8a94a6",
  textMuted: "#5a6a7a",
} as const;

export const CHART_PALETTE = [
  COLORS.blue,
  COLORS.green,
  COLORS.purple,
  COLORS.amber,
  COLORS.teal,
  COLORS.coral,
  "#9FE2BF",
  "#FFD700",
] as const;

export const TOKEN_TYPE_COLORS: Record<string, string> = {
  cacheRead: COLORS.blue,
  cacheCreation: COLORS.purple,
  input: COLORS.green,
  output: COLORS.amber,
};

export const MODEL_COLORS: Record<string, string> = {
  opus: COLORS.purple,
  haiku: COLORS.teal,
  sonnet: COLORS.blue,
};

export const ACT_TOOL_COLORS: Record<string, string> = {
  Bash: COLORS.green,
  Edit: COLORS.blue,
  Write: COLORS.purple,
};

export const AGENT_TYPE_COLORS: Record<string, string> = {
  "general-purpose": COLORS.amber,
  Explore: COLORS.teal,
  Plan: COLORS.purple,
};

export function colorForModel(model: string): string {
  if (model.includes("opus")) return MODEL_COLORS.opus!;
  if (model.includes("haiku")) return MODEL_COLORS.haiku!;
  if (model.includes("sonnet")) return MODEL_COLORS.sonnet!;
  return COLORS.blue;
}
