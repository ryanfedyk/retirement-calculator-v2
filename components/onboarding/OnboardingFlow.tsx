"use client";
import { useState } from "react";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFinancialStore } from "@/store/useFinancialStore";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Streamlined onboarding — collects only the essentials needed to render a
 * meaningful dashboard: name, birth year, target retirement date, and current
 * savings. Everything else uses sensible defaults the user can refine later.
 */
export default function OnboardingFlow() {
  const { user } = useAuth();
  const { updateProfile, updateConfig, updateCareerPath, updateNestedSnapshot } = useFinancialStore();

  const [name, setName] = useState(user?.displayName ?? "");
  const [birthYear, setBirthYear] = useState<string>(String(CURRENT_YEAR - 40));
  const [retYear, setRetYear] = useState<string>(String(CURRENT_YEAR + 10));
  const [retMonth, setRetMonth] = useState<number>(0);
  const [savings, setSavings] = useState<string>("");

  const by = Number(birthYear);
  const ry = Number(retYear);
  const valid =
    name.trim().length > 0 &&
    by >= 1920 && by <= CURRENT_YEAR &&
    ry >= CURRENT_YEAR && ry <= CURRENT_YEAR + 60;

  const finish = () => {
    if (!valid) return;
    updateProfile({
      name: name.trim(),
      birthYear: by,
      retirementYear: ry,
      retirementMonth: retMonth,
      onboarded: true,
    });
    updateConfig({ birth_year: by });
    updateCareerPath({ exit_year: ry });
    updateNestedSnapshot("liquid_assets", { cash_savings: Math.max(0, Number(savings) || 0) });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
    color: C.inkSoft, marginBottom: 6, display: "block",
  };
  const fieldStyle: React.CSSProperties = {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.ink, outline: "none",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: C.bg }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 3, height: 30, borderRadius: 2, background: C.teal }} />
          <div style={{ color: C.ink, fontSize: 14, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Horizon
          </div>
        </div>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 600, marginTop: 18, marginBottom: 6 }}>
          Let’s chart your horizon
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 14, marginBottom: 26 }}>
          Just a few essentials to get you started. You can refine everything later.
        </p>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: `0 1px 3px ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>What should we call you?</label>
              <input style={fieldStyle} type="text" placeholder="Your name" value={name}
                     onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Birth year</label>
              <input style={fieldStyle} type="number" inputMode="numeric" placeholder="1985"
                     min={1920} max={CURRENT_YEAR} value={birthYear}
                     onChange={(e) => setBirthYear(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Target retirement date</label>
              <div style={{ display: "flex", gap: 10 }}>
                <select style={{ ...fieldStyle, flex: 1.4 }} value={retMonth}
                        onChange={(e) => setRetMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <input style={{ ...fieldStyle, flex: 1 }} type="number" inputMode="numeric"
                       min={CURRENT_YEAR} max={CURRENT_YEAR + 60} value={retYear}
                       onChange={(e) => setRetYear(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Current total savings <span style={{ textTransform: "none", color: C.inkFaint, fontWeight: 400 }}>(optional)</span></label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, ...fieldStyle, padding: "0 13px" }}>
                <span style={{ color: C.inkFaint, fontSize: 14 }}>$</span>
                <input style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.ink, fontSize: 14, padding: "11px 0" }}
                       type="number" inputMode="numeric" placeholder="50,000" value={savings}
                       onChange={(e) => setSavings(e.target.value)} />
              </div>
            </div>

            <button
              onClick={finish}
              disabled={!valid}
              style={{
                width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 8,
                padding: "13px 0", fontSize: 14, fontWeight: 600,
                cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.55, marginTop: 4,
              }}
            >
              Enter Horizon →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
