"use client";
import { Trash2, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { rsuGrantSplit, type RsuGrant } from "@/engine/calculator";

// Dated RSU grants editor. Each grant vests in equal monthly tranches from its own
// grant date (no cliff), on that date's day-of-month — so entering the full date
// (incl. day) makes the "vested so far" tally exact. Enter the TOTAL shares
// originally granted; the plan only vests the portion still ahead of today
// (already-vested shares are in your holdings). Shared by the desktop (LeftPanel)
// and mobile finances editors so the two can't drift. Writes to the baseline
// income_profile, which flows to every scenario.

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 9px", borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.bgCard, color: C.ink, fontSize: 13, boxSizing: "border-box",
};

// A stored grant_date may be a legacy "YYYY-MM" (month input) or a full "YYYY-MM-DD";
// <input type="date"> needs a full date, so pad a bare month to the 1st for display.
const asFullDate = (d: string) => (d && d.length === 7 ? `${d}-01` : d);

export default function RsuGrantsEditor() {
  const { baseline, updateBaseline } = useFinancialStore();
  const grants: RsuGrant[] = baseline.income_profile.rsu_grants ?? [];
  const defaultVy = baseline.income_profile.vesting_years || 4;

  const write = (next: RsuGrant[]) => updateBaseline("income_profile", { rsu_grants: next });
  const patch = (idx: number, p: Partial<RsuGrant>) => write(grants.map((g, i) => (i === idx ? { ...g, ...p } : g)));
  const add = () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    write([...grants, { id: crypto.randomUUID(), grant_date: iso, shares: 0, vesting_years: defaultVy }]);
  };
  const remove = (idx: number) => write(grants.filter((_, i) => i !== idx));

  const label: React.CSSProperties = { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint, marginBottom: 3 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {grants.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 28px", gap: 7, alignItems: "end" }}>
            <div style={label}>Grant / vest date</div>
            <div style={label}>Total shares</div>
            <div style={label}>Vest yrs</div>
            <div />
          </div>
          {grants.map((g, idx) => {
            const { total, vested, unvested } = rsuGrantSplit(g);
            return (
              <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 28px", gap: 7, alignItems: "center" }}>
                  <input type="date" value={asFullDate(g.grant_date)} onChange={e => patch(idx, { grant_date: e.target.value })} style={inputStyle} />
                  <input type="number" inputMode="numeric" min={0} placeholder="shares" value={g.shares || ""} onChange={e => patch(idx, { shares: +e.target.value || 0 })} style={{ ...inputStyle, textAlign: "right" }} />
                  <input type="number" inputMode="decimal" min={0} step={0.5} value={g.vesting_years || ""} onChange={e => patch(idx, { vesting_years: +e.target.value || 0 })} style={{ ...inputStyle, textAlign: "right" }} />
                  <button onClick={() => remove(idx)} aria-label="Remove grant"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "transparent", borderRadius: 6, color: C.inkFaint, cursor: "pointer" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {/* Calculated split for this grant, as of today. */}
                {total > 0 && (
                  <div style={{ fontSize: 10.5, color: C.inkSoft, paddingLeft: 2 }}>
                    <span style={{ fontWeight: 700, color: C.ink }}>{vested.toLocaleString()}</span> of {total.toLocaleString()} vested
                    {" · "}
                    <span style={{ fontWeight: 700, color: C.teal }}>{unvested.toLocaleString()}</span> still to vest
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button onClick={add}
        style={{ width: "100%", padding: "10px", borderRadius: 9, border: `1px dashed ${C.border}`, background: C.bgCard, color: C.inkSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={14} /> Add grant
      </button>
      <p style={{ fontSize: 10, color: C.inkFaint, lineHeight: 1.5, margin: 0 }}>
        Enter the <strong>total</strong> shares each grant awarded and its grant date (the <strong>day</strong> is the monthly vest day). Each vests in equal monthly amounts over its vest years; the plan counts only the <strong>still-to-vest</strong> shares — already-vested ones belong in your holdings above.
      </p>
    </div>
  );
}
