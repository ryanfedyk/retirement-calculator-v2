"use client";
import { useEffect, useState } from "react";
import { C } from "@/config/colors";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import ForecastingHub from "@/components/forecasting/ForecastingHub";
import LifeEventsFab from "@/components/forecasting/LifeEventsFab";

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1000),
  };
}

export default function MobileForecasting() {
  const { retirementDate, exitYear } = useRetirementDate();
  const { days, hours, mins, secs } = useCountdown(retirementDate);

  const months = Math.floor(days / 30.44);
  const summers = Math.max(0, exitYear - new Date().getFullYear());

  return (
    <div style={{ padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Countdown hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.tealDark}, ${C.teal})`,
        borderRadius: 24, padding: "24px 22px", color: "white",
        boxShadow: `0 10px 30px ${C.teal}40`, textAlign: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.85 }}>
          Until your exit
        </div>
        <div style={{ fontSize: 64, fontWeight: 200, letterSpacing: "-0.03em", lineHeight: 1, margin: "8px 0 2px", fontVariantNumeric: "tabular-nums" }}>
          {days.toLocaleString()}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>days to freedom</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          {[["hrs", hours], ["min", mins], ["sec", secs]].map(([l, v]) => (
            <div key={l as string} style={{ flex: 1, maxWidth: 84, background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "10px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>{String(v).padStart(2, "0")}</div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.8 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { v: months.toLocaleString(), l: "months" },
          { v: Math.ceil(months / 3).toLocaleString(), l: "quarters" },
          { v: summers.toLocaleString(), l: "summers" },
        ].map(s => (
          <div key={s.l} style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 0", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* The three tools — each launches a focused, full-screen experience */}
      <ForecastingHub />

      {/* FAB to add life events — sits above the bottom tab bar */}
      <LifeEventsFab bottomOffset={96} />
    </div>
  );
}
