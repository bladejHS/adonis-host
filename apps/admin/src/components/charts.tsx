"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, ComposedChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ink = "#5f6a73";
const grid = "#e6dccb";
const navy = "#0b2230";
const gold = "#c6a15b";
const fmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

const tooltipStyle = {
  contentStyle: { background: "#fffdf9", border: "1px solid #e6dccb", borderRadius: 4, fontSize: 12, boxShadow: "0 8px 24px -12px rgba(11,34,48,.25)" },
  labelStyle: { color: navy, fontWeight: 500, marginBottom: 4 },
};

export function RevenueOccupancyChart({ data }: { data: { label: string; revenue: number; occupancy: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: ink, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="r" tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${fmt.format(v / 1000)}k`} width={44} />
        <YAxis yAxisId="o" orientation="right" domain={[0, 1]} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} width={40} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, name: string) => (name === "occupancy" ? [`${Math.round(v * 100)}%`, "Ocupare"] : [`${fmt.format(v)} lei`, "Venit cazare"])}
        />
        <Bar yAxisId="r" dataKey="revenue" fill={navy} radius={[2, 2, 0, 0]} maxBarSize={44} />
        <Line yAxisId="o" dataKey="occupancy" stroke={gold} strokeWidth={2} dot={{ r: 3, fill: gold, strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function OccupancyStrip({ data }: { data: { label: string; rate: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={gold} stopOpacity={0.35} />
            <stop offset="1" stopColor={gold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide domain={[0, 1]} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${Math.round(v * 100)}%`, "Ocupare"]} />
        <Area dataKey="rate" stroke={gold} strokeWidth={1.6} fill="url(#occFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ChannelDonut({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`${fmt.format(v)} lei`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, unit = "lei" }: { data: { label: string; value: number }[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: ink, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => fmt.format(v)} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${fmt.format(v)} ${unit}`, ""]} />
        <Bar dataKey="value" fill={gold} radius={[2, 2, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SeasonalityChart({ data, marks }: { data: { label: string; occupancy: number; revenue: number }[]; marks: { label: string; name: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="seasonFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={navy} stopOpacity={0.9} />
            <stop offset="1" stopColor={navy} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
        <YAxis yAxisId="o" domain={[0, 1]} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} width={40} />
        <YAxis yAxisId="r" orientation="right" tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${fmt.format(v / 1000)}k`} width={40} />
        <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => (n === "occupancy" ? [`${Math.round(v * 100)}%`, "Ocupare"] : [`${fmt.format(v)} lei`, "Venit"])} />
        <Bar yAxisId="o" dataKey="occupancy" fill="url(#seasonFill)" radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Line yAxisId="r" dataKey="revenue" stroke={gold} strokeWidth={2} dot={false} />
        {marks.map((m) => (
          <ReferenceLine key={m.name} yAxisId="o" x={m.label} stroke={gold} strokeDasharray="3 3" label={{ value: m.name, position: "top", fill: "#7d5f27", fontSize: 10 }} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RatingBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-sm">
          <span className="text-subtle">{d.label}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-2 rounded-full bg-gold" style={{ width: `${(d.count / max) * 100}%` }} />
          </span>
          <span className="num text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
