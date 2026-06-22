"use client";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import TickerAutocomplete from "@/components/finance/TickerAutocomplete";
import LinkedNumberField from "@/components/finance/LinkedNumberField";
import { Field, Num, Two, Section, inputStyle, labelStyle } from "./sheetUI";

// The shared "Your finances" facts — assets/liabilities, portfolio holdings and
// 529s. These edit the global snapshot (same across every scenario), so on
// mobile they live in the Your-finances overlay rather than the per-scenario
// "Scenario plan" sheet. Touch-friendly twin of LeftPanel's `variant="finances"`.
export default function MobileFinancesSections() {
  const { snapshot, profile, updateNestedSnapshot } = useFinancialStore();
  const kids = profile.children;
  const [openId, setOpenId] = useState<string | null>("assets");
  const [newInv, setNewInv] = useState({ symbol: "", name: "", shares: "", ret: "7", retLinked: true });
  const sec = (id: string) => ({ openId, setOpenId, id });

  return (
    <>
      {/* ── Assets & Liabilities ── */}
      <Section title="Assets & Liabilities" accent={C.teal} {...sec("assets")}>
        <Field label="Cash Savings"><Num prefix="$" step={1000} value={snapshot.liquid_assets.cash_savings} onChange={v => updateNestedSnapshot("liquid_assets", { cash_savings: v })} /></Field>
        <Two>
          <Field label="401(k)"><Num prefix="$" step={1000} value={snapshot.retirement_assets.k401} onChange={v => updateNestedSnapshot("retirement_assets", { k401: v })} /></Field>
          <Field label="Roth IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.roth_ira} onChange={v => updateNestedSnapshot("retirement_assets", { roth_ira: v })} /></Field>
        </Two>
        <Field label="Traditional IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.traditional_ira} onChange={v => updateNestedSnapshot("retirement_assets", { traditional_ira: v })} /></Field>
        <Two>
          <Field label="Mortgage Balance"><Num prefix="$" step={1000} value={snapshot.liabilities.mortgage_balance} onChange={v => updateNestedSnapshot("liabilities", { mortgage_balance: v })} /></Field>
          <Field label="Consumer Debt"><Num prefix="$" step={500} value={snapshot.liabilities.consumer_debt} onChange={v => updateNestedSnapshot("liabilities", { consumer_debt: v })} /></Field>
        </Two>
      </Section>

      {/* ── Portfolio Holdings ── */}
      <Section title="Portfolio Holdings" accent="#c4784e" {...sec("holdings")}>
        {(snapshot.other_investments || []).map((inv, idx) => (
          <div key={inv.id || idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: C.bgCard, border: `1px solid ${C.borderSoft}`, marginBottom: 8 }}>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{inv.symbol}</div><div style={{ fontSize: 11, color: C.inkSoft }}>{inv.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })} sh</div></div>
            <button onClick={() => { const a = [...(snapshot.other_investments || [])]; a.splice(idx, 1); updateNestedSnapshot("other_investments", a as any); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}><Trash2 size={16} /></button>
          </div>
        ))}
        <div style={{ marginTop: 4 }}>
          <TickerAutocomplete placeholder="Search ticker or company" value={newInv.symbol} inputStyle={inputStyle}
            onChange={v => setNewInv(prev => ({ ...prev, symbol: v }))}
            onSelect={r => setNewInv(prev => ({ ...prev, symbol: r.symbol, name: r.name }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div><span style={labelStyle}>Shares</span>
            <input type="number" inputMode="decimal" placeholder="0" value={newInv.shares} onChange={e => setNewInv({ ...newInv, shares: e.target.value })} style={inputStyle} /></div>
          <div><span style={labelStyle}>Expected Return %</span>
            <LinkedNumberField variant="mobile" step={0.5}
              linked={newInv.retLinked}
              displayValue={newInv.retLinked ? 7 : (parseFloat(newInv.ret) || 0)}
              onOverride={() => setNewInv(p => ({ ...p, retLinked: false, ret: "7" }))}
              onChange={v => setNewInv(p => ({ ...p, ret: String(v), retLinked: false }))}
              onRelink={() => setNewInv(p => ({ ...p, retLinked: true, ret: "7" }))} /></div>
        </div>
        <button onClick={() => {
          const sh = parseFloat(newInv.shares);
          if (newInv.symbol && sh) {
            const ret = newInv.retLinked ? 7 : (newInv.ret ? parseFloat(newInv.ret) : 7);
            const inv = { id: Date.now().toString(), name: newInv.name || newInv.symbol, symbol: newInv.symbol, shares: sh, cost_basis: 0, current_price: 0, expected_return: ret };
            updateNestedSnapshot("other_investments", [...(snapshot.other_investments || []), inv] as any);
            setNewInv({ symbol: "", name: "", shares: "", ret: "7", retLinked: true });
          }
        }} style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.warmLight}`, background: C.warmWash, color: C.warm, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> Add Holding
        </button>
      </Section>

      {/* ── Education (529) — only relevant with kids ── */}
      {kids.length > 0 && (
      <Section title="Education (529)" accent={C.teal} {...sec("edu")}>
        {(snapshot.education_assets?.accounts || []).map((acc, idx) => (
          <div key={acc.id || idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input value={acc.name} onChange={e => { const a = [...(snapshot.education_assets.accounts || [])]; a[idx] = { ...acc, name: e.target.value }; updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ ...inputStyle, flex: 1 }} />
            <input type="number" inputMode="decimal" value={acc.balance} onChange={e => { const a = [...(snapshot.education_assets.accounts || [])]; a[idx] = { ...acc, balance: +e.target.value }; updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ ...inputStyle, width: 120, textAlign: "right" }} />
            <button onClick={() => { const a = (snapshot.education_assets.accounts || []).filter((_, i) => i !== idx); updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}><Trash2 size={16} /></button>
          </div>
        ))}
        <button onClick={() => { const a = [...(snapshot.education_assets.accounts || []), { id: crypto.randomUUID(), name: "New 529", balance: 0 }]; updateNestedSnapshot("education_assets", { accounts: a }); }}
          style={{ marginTop: 4, width: "100%", padding: "12px", borderRadius: 10, border: `1px dashed ${C.border}`, background: C.bgCard, color: C.inkSoft, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> Add 529 Account
        </button>
      </Section>
      )}
    </>
  );
}
