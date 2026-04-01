export interface TimeSeriesPoint {
  timestamp: number; // Unix seconds
  value: number;
}

export interface TimeSeries {
  label: string;
  data: TimeSeriesPoint[];
}

export interface PieSlice {
  name: string;
  value: number;
}

export interface TimeRangeOption {
  label: string;
  seconds: number;
}

export interface RefreshOption {
  label: string;
  seconds: number | null; // null = off
}

export interface DashboardData {
  totalTokens: { value: number; series: TimeSeriesPoint[] };
  linesOfCode: { value: number; series: TimeSeriesPoint[] };
  activeTime: { value: number; series: TimeSeriesPoint[] };
  commits: { value: number; series: TimeSeriesPoint[] };
  tokenUsageOverTime: TimeSeries[];
  tokensByType: PieSlice[];
  tokensByModel: PieSlice[];
  toolCallsOverTime: TimeSeries[];
  toolDistribution: PieSlice[];
  toolDecisions: PieSlice[];
  agentCallsOverTime: TimeSeries[];
  mcpToolCallsOverTime: TimeSeries[];
  agentTypes: PieSlice[];
}
