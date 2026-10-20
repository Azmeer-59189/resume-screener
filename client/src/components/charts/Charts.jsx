import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Icon from "../Icon";
import { axisProps, chart, formatCount } from "./theme";

/**
 * Card wrapper for every chart. Each chart ships with a table twin so no value
 * is reachable only by hovering.
 */
export function ChartCard({ title, subtitle, table, children, className = "", empty, emptyText = "No data yet" }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`card p-5 flex flex-col ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {table && !empty && (
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
            aria-pressed={showTable}
          >
            <Icon name={showTable ? "chart" : "table"} className="w-3.5 h-3.5" />
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </header>
      {empty ? (
        <div className="flex-1 flex items-center justify-center min-h-[160px] text-sm text-slate-500">{emptyText}</div>
      ) : showTable ? (
        <DataTable {...table} />
      ) : (
        children
      )}
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
            {columns.map((column, index) => (
              <th key={column} className={`py-2 font-medium ${index > 0 ? "text-right" : ""}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-800/60 last:border-0">
              {row.map((cell, index) => (
                <td key={index} className={`py-1.5 ${index > 0 ? "text-right tabular-nums text-slate-200" : "text-slate-300"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tooltip: value leads (strong), label follows; series keyed with a short line, not a box. */
function TooltipBox({ active, payload, label, formatValue, formatLabel }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const color = item.payload?.color || item.color || chart.series;
  return (
    <div className="rounded-lg border border-slate-700 bg-[#0D1B2A]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-[11px] text-slate-400 mb-1">{formatLabel ? formatLabel(label, item.payload) : label}</p>
      <div className="flex items-center gap-2">
        <span className="w-3 h-0.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-white">{formatValue ? formatValue(item.value, item.payload) : item.value}</span>
      </div>
    </div>
  );
}

const SurfaceDot = (props) => {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill={chart.series} stroke={chart.surface} strokeWidth={2} />;
};

/** Single-series trend: 2px line, ~10% area wash, crosshair + tooltip, endpoint labeled. */
export function TrendChart({ data, valueLabel = "applications", height = 240 }) {
  const lastIndex = data.length - 1;
  return (
    <div role="img" aria-label={`Trend of ${valueLabel} over the last ${data.length} days`}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="trendWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.series} stopOpacity={0.18} />
              <stop offset="100%" stopColor={chart.series} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis
            dataKey="label"
            {...axisProps}
            interval="preserveStartEnd"
            minTickGap={28}
            tickMargin={8}
          />
          <YAxis {...axisProps} axisLine={false} allowDecimals={false} tickFormatter={formatCount} width={48} />
          <Tooltip
            cursor={{ stroke: chart.textMuted, strokeWidth: 1 }}
            content={<TooltipBox formatValue={(value) => `${value} ${value === 1 ? valueLabel.replace(/s$/, "") : valueLabel}`} />}
          />
          <Area
            type="linear"
            dataKey="count"
            stroke={chart.series}
            strokeWidth={2}
            fill="url(#trendWash)"
            dot={false}
            activeDot={<SurfaceDot />}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="count"
              content={({ x, y, value, index }) => index === lastIndex ? (
                <text x={x} y={y - 10} textAnchor="end" fill={chart.textSecondary} fontSize={12} fontWeight={600}>
                  {value}
                </text>
              ) : null}
            />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Horizontal bars for one series across named categories. Bars <=20px thick,
 * 4px rounded data-end, value at the tip. Rows may override `color` (e.g. an
 * emphasis/de-emphasis split).
 */
export function HorizontalBars({ data, valueKey = "value", labelKey = "label", formatValue = (v) => v, tooltipValue, max, ariaLabel }) {
  const rowHeight = 36;
  const height = Math.max(120, data.length * rowHeight + 16);
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, max ?? "dataMax"]} />
          <YAxis
            type="category"
            dataKey={labelKey}
            {...axisProps}
            axisLine={{ stroke: chart.baseline }}
            tick={{ ...axisProps.tick, fill: chart.textSecondary }}
            width={120}
            tickFormatter={(value) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.06)" }}
            content={<TooltipBox formatValue={tooltipValue || formatValue} />}
          />
          <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            {data.map((row, index) => (
              <Cell key={index} fill={row.color || chart.series} />
            ))}
            <LabelList
              dataKey={valueKey}
              position="right"
              formatter={formatValue}
              style={{ fill: chart.textSecondary, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Columns for the ordered score tiers; each column takes its tier's ramp step. */
export function TierColumns({ data, height = 220, ariaLabel }) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis
            dataKey="label"
            {...axisProps}
            tick={({ x, y, payload }) => {
              const row = data.find((item) => item.label === payload.value);
              return (
                <g transform={`translate(${x},${y + 10})`}>
                  <text textAnchor="middle" fill={chart.textSecondary} fontSize={12}>{payload.value}</text>
                  <text textAnchor="middle" y={15} fill={chart.textMuted} fontSize={11}>{row?.range}</text>
                </g>
              );
            }}
            height={40}
            interval={0}
          />
          <YAxis {...axisProps} axisLine={false} allowDecimals={false} tickFormatter={formatCount} width={48} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.06)" }}
            content={
              <TooltipBox
                formatLabel={(label, row) => `${label} match · score ${row.range}`}
                formatValue={(value, row) => `${value} candidate${value === 1 ? "" : "s"}${row.share != null ? ` · ${row.share}%` : ""}`}
              />
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            {data.map((row) => <Cell key={row.key} fill={row.color} />)}
            <LabelList dataKey="value" position="top" style={{ fill: chart.textSecondary, fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
