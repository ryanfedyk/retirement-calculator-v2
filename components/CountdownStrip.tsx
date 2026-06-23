"use client";
import { useState, useEffect } from "react";
import { C } from "@/config/colors";
import { useRetirementDate } from "@/hooks/useRetirementDate";

function useCountdown() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { retirementDate: ret } = useRetirementDate();
  const now   = new Date();
  const ms    = Math.max(0, ret.getTime() - now.getTime());
  const total = Math.floor(ms / 1000);
  const days  = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins  = Math.floor((total % 3600) / 60);
  const secs  = total % 60;

  const months = Math.max(0,
    (ret.getFullYear() - now.getFullYear()) * 12 + (ret.getMonth() - now.getMonth()));

  const quarters = (() => {
    let q = 0;
    for (let y = now.getFullYear(); y <= ret.getFullYear(); y++)
      for (const m of [0, 3, 6, 9]) {
        const d = new Date(y, m, 1);
        if (d > now && d < ret) q++;
      }
    return q;
  })();

  const summers = (() => {
    let s = 0;
    for (let y = now.getFullYear(); y <= ret.getFullYear(); y++) {
      const d = new Date(y, 5, 1);
      if (d > now && d < ret) s++;
    }
    return s;
  })();

  return { days, hours, mins, secs, months, quarters, summers };
}

export default function CountdownStrip({ right }: { right?: React.ReactNode }) {
  const { days, hours, mins, secs, months, quarters, summers } = useCountdown();

  const pad = (n: number, len = 2) => String(n).padStart(len, "0");

  return (
    <div style={{
      background: C.bgHeader,
      borderBottom: `1px solid ${C.border}`,
      padding: "7px 32px",
      display: "flex",
      alignItems: "center",
      gap: 20,
    }}>
      <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center gap-5">
        {/* Live */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          {([
            [pad(days, 4), "d"],
            [pad(hours), "h"],
            [pad(mins), "m"],
            [pad(secs), "s"],
          ] as const).map(([v, u], i) => (
            <span key={u} style={{ display: "flex", alignItems: "baseline", marginRight: i < 3 ? 8 : 0 }}>
              <span suppressHydrationWarning style={{ color: C.inkMid, fontSize: 13, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                {v}
              </span>
              <span style={{ color: C.inkFaint, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: 1 }}>
                {u}
              </span>
            </span>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 14, background: C.border, flexShrink: 0 }} />

        {/* Months / quarters / summers */}
        {([
          [months,   "months"],
          [quarters, "quarters"],
          [summers,  "summers"],
        ] as const).map(([n, label], i, arr) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span suppressHydrationWarning style={{ color: C.inkMid, fontSize: 13, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
              {n}
            </span>
            <span style={{ color: C.inkFaint, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {label}
            </span>
            {i < arr.length - 1 && (
              <span style={{ color: C.border, marginLeft: 8 }}>·</span>
            )}
          </div>
        ))}

        {/* Optional right-aligned slot (e.g. the portfolio price ticker) */}
        {right && <div style={{ marginLeft: "auto", minWidth: 0 }}>{right}</div>}
      </div>
    </div>
  );
}
