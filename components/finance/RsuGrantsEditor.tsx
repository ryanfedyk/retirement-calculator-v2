"use client";
import { Trash2, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";

// Dated RSU grants editor. Each grant vests in equal monthly slivers from its own
// grant date (no cliff), so the projection tracks your real vest calendar instead
// of "N years from today". Enter the TOTAL shares originally granted — the engine
// only vests the portion still ahead of today (already-vested shares are in your
// holdings). Shared by the desktop (LeftPanel) and mobile finances editors so the
// two can't drift. Writes to the baseline income_profile, which flows to every
// scenario.
type Grant = { id: string; grant_date: string; shares: number; vesting_years: number };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 9px", borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.bgCard, color: C.ink, fontSize: 13, boxSizing: "border-box",
};

export default function RsuGrantsEditor() {
  const { baseline, updateBaseline } = useFinancialStore();
  const grants: Grant[] = baseline.income_profile.rsu_grants ?? [];
  const defaultVy = baseline.income_profile.vesting_years || 4;

  const write = (next: Grant[]) => updateBaseline("income_profile", { rsu_grants: next });
  const patch = (idx: number, p: Partial<Grant>) => write(grants.map((g, i) => (i === idx ? { ...g, ...p } : g)));
  const add = () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    write([...grants, { id: crypto.randomUUID(), grant_date: ym, shares: 0, vesting_years: defaultVy }]);
  };
  const remove = (idx: number) => write(grants.filter((_, i) => i !== idx));

  const label: React.CSSProperties = { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint, marginBottom: 3 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {grants.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* header row (desktop-ish; wraps fine on narrow) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 28px", gap: 7, alignItems: "end" }}>
            <div style={label}>Grant date</div>
            <div style={label}>Total shares</div>
            <div style={label}>Vest yrs</div>
            <div />
          </div>
          {grants.map((g, idx) => (
            <div key={g.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 28px", gap: 7, alignItems: "center" }}>
              <input type="month" value={g.grant_date} onChange={e => patch(idx, { grant_date: e.target.value })} style={inputStyle} />
              <input type="number" inputMode="numeric" min={0} placeholder="shares" value={g.shares || ""} onChange={e => patch(idx, { shares: +e.target.value || 0 })} style={{ ...inputStyle, textAlign: "right" }} />
              <input type="number" inputMode="decimal" min={0} step={0.5} value={g.vesting_years || ""} onChange={e => patch(idx, { vesting_years: +e.target.value || 0 })} style={{ ...inputStyle, textAlign: "right" }} />
              <button onClick={() => remove(idx)} aria-label="Remove grant"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "transparent", borderRadius: 6, color: C.inkFaint, cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button onClick={add}
        style={{ width: "100%", padding: "10px", borderRadius: 9, border: `1px dashed ${C.border}`, background: C.bgCard, color: C.inkSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={14} /> Add grant
      </button>
      <p style={{ fontSize: 10, color: C.inkFaint, lineHeight: 1.5, margin: 0 }}>
        Enter the <strong>total</strong> shares each grant awarded and the date it was granted; each vests in equal monthly amounts over its vest years. The plan counts only shares still ahead of today — already-vested shares belong in your holdings above.
      </p>
    </div>
  );
}
