"use client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";
import { C } from "@/config/colors";
import type { TrajectoryPoint } from "@/engine/calculator";

interface Props {
  data:         TrajectoryPoint[];
  baselineData: TrajectoryPoint[];
  retYear:      number;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as TrajectoryPoint & { baselineNetWorth?: number };
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
    }}>
      <div style={{ color: C.inkSoft, marginBottom: 6, fontWeight: 600, letterSpacing: "0.06em", fontSize: 10 }}>
        {label}
      </div>
      <div style={{ color: C.teal, fontWeight: 700, fontSize: 14 }}>
        {fmt(p.totalNetWorth)}
        {p.isIndependent && (
          <span style={{ background: C.tealWash, color: C.tealDark, fontSize: 9, padding: "2px 6px", borderRadius: 99, marginLeft: 6, fontWeight: 600 }}>
            INDEPENDENT
          </span>
        )}
      </div>
      {p.baselineNetWorth != null && (
        <div style={{ color: C.inkSoft, fontSize: 11, marginTop: 2 }}>
          Baseline: {fmt(p.baselineNetWorth)}
        </div>
      )}
      {p.swrTarget > 0 && (
        <div style={{ color: C.inkFaint, fontSize: 10, marginTop: 4 }}>
          SWR target: {fmt(p.swrTarget)}
        </div>
      )}
    </div>
  );
};

export default function TrajectoryChart({ data, baselineData, retYear }: Props) {
  // Sample to annual data points for readability
  const annualData = data
    .filter((_, i) => i % 12 === 0)
    .map((p, i) => ({
      ...p,
      baselineNetWorth: baselineData[i * 12]?.totalNetWorth ?? 0,
    }));

  const swrTarget = data[0]?.swrTarget ?? 0;

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={annualData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.teal}  stopOpacity={0.18} />
              <stop offset="95%" stopColor={C.teal}  stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.inkFaint} stopOpacity={0.10} />
              <stop offset="95%" stopColor={C.inkFaint} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.borderSoft} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: C.inkFaint, fontSize: 10 }}
            axisLine={false} tickLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: C.inkFaint, fontSize: 10 }}
            axisLine={false} tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* SWR target line */}
          {swrTarget > 0 && (
            <ReferenceLine
              y={swrTarget}
              stroke={C.warm}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "SWR Target", position: "insideTopRight", fill: C.warm, fontSize: 9 }}
            />
          )}
          {/* Retirement year line */}
          <ReferenceLine
            x={String(retYear)}
            stroke={C.tealDark}
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Area
            type="monotone"
            dataKey="baselineNetWorth"
            stroke={C.inkFaint}
            strokeWidth={1}
            fill="url(#baseGrad)"
            dot={false}
            name="Baseline"
          />
          <Area
            type="monotone"
            dataKey="totalNetWorth"
            stroke={C.teal}
            strokeWidth={2}
            fill="url(#nwGrad)"
            dot={false}
            name="Projected"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
