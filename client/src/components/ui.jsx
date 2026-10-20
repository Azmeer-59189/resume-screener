import Icon from "./Icon";
import { tierForScore } from "./charts/theme";

export function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Stat tile: label · value · optional delta (vs a named period) · optional hint.
 * The delta is colored by direction × whether up is good, and always carries an
 * arrow + text so it never relies on color alone.
 */
export function StatTile({ label, value, icon, hint, delta, deltaLabel, upIsGood = true }) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const good = hasDelta && (delta === 0 ? null : (delta > 0) === upIsGood);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Icon name={icon} className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold text-white tracking-tight">{value ?? "—"}</p>
      <div className="mt-2 flex items-center gap-2 text-xs min-h-[1rem]">
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${
            good === null ? "text-slate-400" : good ? "text-emerald-400" : "text-rose-400"
          }`}>
            {delta !== 0 && <Icon name={delta > 0 ? "arrowUp" : "arrowDown"} className="w-3 h-3" strokeWidth={2.5} />}
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
        {(deltaLabel || hint) && <span className="text-slate-500">{hasDelta ? deltaLabel : hint}</span>}
      </div>
    </div>
  );
}

/** Thin horizontal meter; the track is a dim step of the same hue as the fill. */
export function ScoreMeter({ score, className = "", emptyText = "No scores yet" }) {
  if (score == null) return <span className="text-xs text-slate-500">{emptyText}</span>;
  const pct = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const tier = tierForScore(pct);
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex-1 h-1.5 rounded-full bg-blue-500/15 overflow-hidden min-w-16">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tier.color }} />
      </div>
      <span className="text-xs font-semibold text-slate-200 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

/** Circular score ring with the tier named underneath, so the color is never the only cue. */
export function ScoreRing({ score, pending, pendingLabel = "AI pending", size = 56 }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const tier = tierForScore(pct);

  return (
    <div className="flex flex-col items-center gap-1 shrink-0" style={{ width: size + 16 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(57,135,229,0.15)" strokeWidth={stroke} />
          {!pending && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={tier.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
            />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
          {pending ? <span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" /> : pct}
        </span>
      </div>
      <span className="text-[11px] text-slate-400 whitespace-nowrap">
        {pending ? pendingLabel : tier.label}
      </span>
    </div>
  );
}

export const STATUS_CONFIG = {
  applied:     { label: "Applied",     cls: "bg-slate-500/10 text-slate-300 border-slate-600/40" },
  reviewing:   { label: "Reviewing",   cls: "bg-blue-500/10 text-blue-300 border-blue-500/25" },
  shortlisted: { label: "Shortlisted", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  interviewed: { label: "Interviewed", cls: "bg-violet-500/10 text-violet-300 border-violet-500/25" },
  offered:     { label: "Offered",     cls: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25" },
  rejected:    { label: "Rejected",    cls: "bg-rose-500/10 text-rose-300 border-rose-500/25" },
};

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.applied;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${config.cls}`}>{config.label}</span>
  );
}

export function JobStatusBadge({ status }) {
  const cls = status === "active"
    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
    : status === "paused"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
      : "bg-slate-500/10 text-slate-400 border-slate-600/40";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border capitalize ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
