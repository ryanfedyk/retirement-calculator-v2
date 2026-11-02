import { describe, it, expect } from "vitest";
import { isDue, localParts, type DigestPrefs, type DigestState } from "@/lib/digest/schedule";
import { selectPrimaryPlan } from "@/lib/digest/selectPrimaryPlan";

const prefs = (over: Partial<DigestPrefs> = {}): DigestPrefs => ({ optIn: true, hour: 7, tz: "America/New_York", ...over });
const due = (p: DigestPrefs, now: Date, state?: DigestState) => isDue(p, state ?? null, now);

describe("localParts", () => {
  it("renders a UTC instant into a zone's calendar day and hour", () => {
    // 2026-01-05 12:00Z is 07:00 EST (UTC-5), a Monday.
    const p = localParts(new Date("2026-01-05T12:00:00Z"), "America/New_York");
    expect(p.ymd).toBe("2026-01-05");
    expect(p.hour).toBe(7);
    expect(p.weekday).toBe(1); // Monday
  });
});

describe("isDue — weekday-morning schedule in the user's own zone", () => {
  it("is due on a weekday at the target hour when not yet sent today", () => {
    const r = due(prefs(), new Date("2026-01-05T12:00:00Z")); // Mon 07:00 ET
    expect(r.due).toBe(true);
    expect(r.ymd).toBe("2026-01-05");
  });
  it("stays due after the target hour (a late cron run still catches the morning)", () => {
    expect(due(prefs(), new Date("2026-01-05T15:00:00Z")).due).toBe(true); // Mon 10:00 ET
  });
  it("is NOT due before the target hour", () => {
    expect(due(prefs(), new Date("2026-01-05T10:00:00Z")).due).toBe(false); // Mon 05:00 ET
  });
  it("is NOT due on the weekend", () => {
    expect(due(prefs(), new Date("2026-01-03T12:00:00Z")).due).toBe(false); // Saturday
  });
  it("is NOT due again once already sent today", () => {
    expect(due(prefs(), new Date("2026-01-05T13:00:00Z"), { lastSentYmd: "2026-01-05" }).due).toBe(false);
  });
  it("is NOT due when opted out", () => {
    expect(due(prefs({ optIn: false }), new Date("2026-01-05T12:00:00Z")).due).toBe(false);
  });
});

describe("selectPrimaryPlan", () => {
  const snapshot = { other_investments: [] } as any;
  it("uses the PRIMARY scenario's config, not the active mirror", () => {
    const doc = {
      snapshot,
      config: { tag: "active-mirror" } as any,
      scenarios: [{ id: "a", config: { tag: "A" } as any }, { id: "b", config: { tag: "B" } as any }],
      primaryScenarioId: "b",
    };
    expect((selectPrimaryPlan(doc)!.config as any).tag).toBe("B");
  });
  it("falls back to the active-config mirror when scenarios are absent", () => {
    expect((selectPrimaryPlan({ snapshot, config: { tag: "mirror" } as any })!.config as any).tag).toBe("mirror");
  });
  it("returns null when there's no usable config", () => {
    expect(selectPrimaryPlan({ snapshot } as any)).toBeNull();
  });
});
