"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NW_COLOR = C.teal;
const FI_COLOR = "#7a6da8";

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

/** "2026-07" → "Jul '26" */
function ymLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} '${String(y).slice(2)}`;
}
/** "Aug 2029" → 2029.58 (fractional year, for plotting the FI date on an axis) */
function fiFrac(fiDate: string | null): number | null {
  if (!fiDate) return null;
  const [mon, yr] = fiDate.split(" ");
  const mi = MONTHS.indexOf(mon.slice(0, 3));
  const y = Number(yr);
  if (mi < 0 || !y) return null;
  return y + mi / 12;
}
/** Whole-month distance between two "Mon YYYY" dates (b − a). */
function monthsBetween(a: string, b: string): number | null {
  const fa = fiFrac(a), fb = fiFrac(b);
  if (fa == null || fb == null) return null;
  return Math.round((fb - fa) * 12);
}

/**
 * Plan history — a monthly trail of the primary plan: net worth actuals (area,
 * left axis) and the projected FI date (line, right axis) together, so you can
 * watch your wealth climb and your FI target drift over time. Populated by the
 * monthly auto-snapshot; shows a gentle placeholder until enough points exist.
 */
export default function PlanHistory({ hideUntilTrend = false }: { hideUntilTrend?: boolean } = {}) {
  const history = useFinancialStore((s) => s.planHistory);

  const data = useMemo(
    () => history.map((p) => ({
      label: ymLabel(p.ym),
      netWorth: p.netWorth,
      fiFrac: fiFrac(p.fiDate),
      fiDate: p.fiDate,
    })),
    [history],
  );

  // FI axis padded a little beyond the observed range so drift is visible.
  const fiDomain = useMemo<[number, number] | undefined>(() => {
    const vals = data.map((d) => d.fiFrac).filter((v): v is number => v != null);
    if (!vals.length) return undefined;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return [Math.floor(lo) - 0.25, Math.ceil(hi) + 0.25];
  }, [data]);

  const latest = history[history.length - 1];
  const first = history[0];

  // Drift of the projected FI date since the first recorded snapshot.
  const drift = useMemo(() => {
    if (!first?.fiDate || !latest?.fiDate || history.length < 2) return null;
    const d = monthsBetween(first.fiDate, latest.fiDate);
    if (d == null) return null;
    return { months: d, since: ymLabel(first.ym) };
  }, [first, latest, history.length]);

  const Header = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <TrendingUp size={14} color={C.teal} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.ink }}>
        Plan history
      </span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.inkFaint, background: C.bg, borderRadius: 5, padding: "2px 7px" }}>
        monthly
      </span>
    </div>
  );

  const shell: React.CSSProperties = {
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16,
  };

  // On surfaces that only want the chart once a trend exists (e.g. the main
  // trajectory view), render nothing until there are ≥ 2 points.
  if (hideUntilTrend && history.length < 2) return null;

  // Nothing recorded yet (brand-new user) or exactly one snapshot: show a
  // friendly placeholder rather than an empty chart.
  if (history.length < 2) {
    return (
      <div style={shell}>
        {Header}
        <p style={{ fontSize: 12, lineHeight: 1.5, color: C.inkSoft, margin: 0 }}>
          {history.length === 0 ? (
            <>Taper takes a monthly snapshot of your net worth and projected FI date. Your first one is being recorded now — check back next month to see the trend build.</>
          ) : (
            <>First snapshot recorded ({ymLabel(first.ym)}): net worth <b style={{ color: C.ink }}>{fmtUsd(latest.netWorth)}</b>, projected FI <b style={{ color: C.ink }}>{latest.fiDate ?? "not reached"}</b>. The trend line appears once next month is captured.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <div style={shell}>
      {Header}

      {/* Headline: current net worth + FI date and how it has drifted. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: C.inkSoft }}>
          Net worth <b style={{ color: C.ink, fontSize: 13 }}>{fmtUsd(latest.netWorth)}</b>
        </span>
        <span style={{ fontSize: 12, color: C.inkSoft }}>
          Projected FI <b style={{ color: C.ink, fontSize: 13 }}>{latest.fiDate ?? "not reached"}</b>
          {drift && drift.months !== 0 && (
            <span style={{ marginLeft: 6, fontWeight: 700, color: drift.months < 0 ? C.teal : C.warm }}>
              {drift.months < 0 ? `▲ ${Math.abs(drift.months)} mo earlier` : `▼ ${drift.months} mo later`} since {drift.since}
            </span>
          )}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.inkFaint }} minTickGap={20} />
          <YAxis yAxisId="nw" tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 10, fill: C.inkFaint }} width={44} />
          <YAxis yAxisId="fi" orientation="right" domain={fiDomain} allowDecimals={false}
            tickFormatter={(v) => String(Math.round(v))} tick={{ fontSize: 10, fill: FI_COLOR }} width={34} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
            formatter={((value: number, name: string, entry: { payload?: { fiDate?: string | null } }) =>
              name === "Projected FI"
                ? [entry?.payload?.fiDate ?? "not reached", name]
                : [fmtM(Number(value)), name]) as never}
          />
          <Area yAxisId="nw" type="monotone" dataKey="netWorth" name="Net worth" stroke={NW_COLOR} fill={`${NW_COLOR}22`} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line yAxisId="fi" type="stepAfter" dataKey="fiFrac" name="Projected FI" stroke={FI_COLOR} strokeWidth={2} dot={{ r: 2, fill: FI_COLOR }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6 }}>
        <LegendDot color={NW_COLOR} label="Net worth" />
        <LegendDot color={FI_COLOR} label="Projected FI date" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: C.inkSoft }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}
