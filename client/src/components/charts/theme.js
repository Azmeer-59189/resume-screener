// Chart tokens for the app's dark navy surface (#111D2C cards).
// Series colors were validated against that surface with the dataviz palette
// validator (single series: contrast + band; tiers: ordinal ramp, one hue).
export const chart = {
  surface: "#111D2C",
  page: "#0D1B2A",
  textPrimary: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  grid: "#1E293B",
  baseline: "#334155",
  series: "#3987e5",
  deemphasis: "#475569",
  font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
};

// Ordered recommendation tiers, lowest -> highest. One blue hue, stepping
// brighter with quality so "better" reads as more prominent on the dark surface.
export const SCORE_TIERS = [
  { key: "not_suitable", label: "Not suitable", range: "0–49", min: 0, color: "#184f95" },
  { key: "partial_match", label: "Partial", range: "50–69", min: 50, color: "#2a78d6" },
  { key: "good_match", label: "Good", range: "70–84", min: 70, color: "#6da7ec" },
  { key: "strong_match", label: "Strong", range: "85–100", min: 85, color: "#b7d3f6" },
];

export const tierForScore = (score) => {
  const value = Number(score) || 0;
  return [...SCORE_TIERS].reverse().find((tier) => value >= tier.min) || SCORE_TIERS[0];
};

export const axisProps = {
  stroke: chart.baseline,
  tick: { fill: chart.textMuted, fontSize: 12, fontFamily: chart.font },
  tickLine: false,
};

export const formatCount = (value) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : String(value);
