"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated categorical slots (navy-blue rooms, gold extras); gold is < 3:1 so charts always carry a legend + tooltip.
export const SERIES = { rooms: "#2a5aa0", other: "#c08a3e" } as const;
const GRID = "#ece9e1";
const AXIS = "#8a8d97";

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const eur = (n: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-muted-foreground">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="font-medium text-foreground">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function OccupancyChart({ data, today, height = 240 }: { data: { date: string; occupancy: number; sold: number; rooms: number }[]; today: string; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} ticks={[0, 0.25, 0.5, 0.75, 1]} />
          <Tooltip
            cursor={{ fill: "rgba(15,26,46,0.04)" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              if (!p) return null;
              return (
                <TooltipBox
                  title={`${fmtDay(p.date)}${p.date > today ? " · forecast" : p.date === today ? " · tonight" : ""}`}
                  rows={[
                    { label: "Occupancy", value: `${Math.round(p.occupancy * 100)}%`, color: SERIES.rooms },
                    { label: "Rooms sold", value: `${p.sold} / ${p.rooms}` },
                  ]}
                />
              );
            }}
          />
          <Bar isAnimationActive={false} dataKey="occupancy" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.date} fill={SERIES.rooms} fillOpacity={d.date > today ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueChart({ data, height = 260 }: { data: { date: string; rooms: number; other: number }[]; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES.rooms }} /> Rooms</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES.other }} /> Dining, spa & extras</span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickFormatter={(v) => eur(v)} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              cursor={{ fill: "rgba(15,26,46,0.04)" }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return (
                  <TooltipBox
                    title={fmtDay(p.date)}
                    rows={[
                      { label: "Rooms", value: eur(p.rooms), color: SERIES.rooms },
                      { label: "Extras", value: eur(p.other), color: SERIES.other },
                      { label: "Total", value: eur(p.rooms + p.other) },
                    ]}
                  />
                );
              }}
            />
            <Bar isAnimationActive={false} dataKey="rooms" stackId="r" fill={SERIES.rooms} maxBarSize={28} stroke="#fff" strokeWidth={1} />
            <Bar isAnimationActive={false} dataKey="other" stackId="r" fill={SERIES.other} radius={[4, 4, 0, 0]} maxBarSize={28} stroke="#fff" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
