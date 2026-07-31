import { describe, it, expect } from "vitest";
import { buildArcLifeEvents, mortgagePayoffMonths } from "@/lib/arcLifeEvents";

describe("mortgagePayoffMonths", () => {
  it("amortizes a fixed-payment mortgage", () => {
    // $100k at 6%/yr, $1,000/mo → ~139 months.
    expect(mortgagePayoffMonths(100_000, 6, 1_000)).toBe(139);
  });
  it("returns null when the payment never covers the interest", () => {
    // $100k at 6%/yr → $500/mo interest; a $400 payment never pays down.
    expect(mortgagePayoffMonths(100_000, 6, 400)).toBeNull();
  });
  it("returns null for nothing owed", () => {
    expect(mortgagePayoffMonths(0, 6, 1_000)).toBeNull();
  });
});

describe("buildArcLifeEvents", () => {
  it("keeps only events within (exitAge, horizonAge], sorted by age", () => {
    const evts = buildArcLifeEvents({
      birthYear: 1980, exitAge: 50, horizonAge: 90, nowYear: 2026,
      children: [{ name: "Maya Chen", birthDate: "2012-05-01" }], // college @ parent 50 (excluded), grad @ 54
      emptyNestYear: 2035,                 // age 55
      socialSecurityStartAge: 67,
      medicareStartAge: 65,
      oneOffs: [{ year: 2045, name: "Kitchen renovation" }], // age 65
    });
    const ages = evts.map((e) => e.age);
    // College begins at exactly the exit age (50) is excluded; graduation (54) stays.
    expect(ages).not.toContain(50);
    expect(ages).toContain(54);
    // sorted ascending
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
    // graduation label + real year present
    const grad = evts.find((e) => e.label.includes("graduates"));
    expect(grad).toBeTruthy();
    expect(grad!.year).toBe(1980 + 54);
    // the milestones we expect all landed
    expect(evts.some((e) => e.label === "Empty nest" && e.age === 55)).toBe(true);
    expect(evts.some((e) => e.label === "Medicare starts" && e.age === 65)).toBe(true);
    expect(evts.some((e) => e.label === "Social Security" && e.age === 67)).toBe(true);
  });

  it("skips the mortgage payoff marker for renters", () => {
    const evts = buildArcLifeEvents({
      birthYear: 1980, exitAge: 50, horizonAge: 90, nowYear: 2026,
      mortgage: { balance: 300_000, annualRatePct: 3.5, monthlyPayment: 3_000, isRent: true },
    });
    expect(evts.some((e) => e.label === "Mortgage paid off")).toBe(false);
  });
});
