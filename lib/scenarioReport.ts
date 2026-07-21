// ── Scenario → plain-text report ─────────────────────────────────────────────
//
// Serializes a saved scenario (balance sheet + assumptions) AND the methodology
// the engine uses into a single self-contained, plain-text/Markdown document.
// The intent: paste it into an LLM (or hand it to an advisor) to independently
// re-derive and cross-check the numbers. Every formula below mirrors what
// `engine/calculator.ts` actually does, with the scenario's own parameters
// substituted in, so the math is auditable rather than a black box.

import {
  runSimulationConverged,
  findIndependencePoint,
  findCashflowFiPoint,
  IRS_401K,
  type FinancialSnapshot,
  type SimulationConfiguration,
  type TrajectoryPoint,
} from "@/engine/calculator";
import { runMonteCarlo, findMonteCarloFiYears } from "@/engine/montecarlo";
import { estimateMonthlySocialSecurity } from "@/engine/social_security";

const usd = (n: number) =>
  n < 0
    ? `-$${Math.abs(Math.round(n)).toLocaleString("en-US")}`
    : `$${Math.round(n).toLocaleString("en-US")}`;
const usd0 = (n: number) => usd(n);
const pct = (n: number) => `${n}%`;

/** A real (today's-dollar) rate from a nominal one, per the Fisher relation. */
const toReal = (nominalPct: number, inflationPct: number) =>
  ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ScenarioReportInput {
  scenarioName: string;
  snapshot: FinancialSnapshot;
  config: SimulationConfiguration;
  liveGoogPrice?: number;
  /** Run Monte Carlo (slower) and include the success-rate section. Default true. */
  includeMonteCarlo?: boolean;
  /** Monte Carlo simulations for the main risk section (default 2500). Also caps the
   *  per-year confidence-scan runs. Lower it in tests for speed. */
  monteCarloRuns?: number;
  /** ISO date string for the report header (the engine forbids Date.now()). */
  generatedAt?: string;
}

export function buildScenarioReport(input: ScenarioReportInput): string {
  const { scenarioName, snapshot, config } = input;
  const live = input.liveGoogPrice ?? 0;
  const ma = config.market_assumptions;
  const sp = config.spending;
  const ip = config.income_profile;
  const ta = config.tax_assumptions;
  const cp = config.career_path;
  const infl = ma.inflation_rate || 0;

  const trajectory = runSimulationConverged(snapshot, config, live);
  const fi = findIndependencePoint(trajectory);            // Rule-of-25 crossing (reference)
  const fiSurvival = findCashflowFiPoint(snapshot, config, live, trajectory); // headline FI (cash-flow survival)
  const today = trajectory[0];
  const last = trajectory[trajectory.length - 1];
  const thisYear = input.generatedAt
    ? new Date(input.generatedAt).getUTCFullYear()
    : (cp.exit_year - 1); // fall back to a deterministic anchor
  const birthYear = config.birth_year || 1980;
  const startAge = thisYear - birthYear;

  // Retirement point (first month in the RETIRED phase) for a snapshot there.
  const retirePoint = trajectory.find((p) => p.currentPhase === "RETIRED");

  const L: string[] = [];
  const p = (s = "") => L.push(s);

  // ── Header ────────────────────────────────────────────────────────────────
  p(`# Retirement plan: "${scenarioName}"`);
  p();
  p(
    `Inputs, equations, and results of a monthly retirement projection (present → age 100). ` +
      `**All figures in today's (real) dollars unless noted.**`,
  );
  p();
  p(
    `> LLM: re-derive the headline results (FI number, FI date, ending net worth) from the ` +
      `inputs and formulas below, and flag any divergence from "Results" or any assumption that looks wrong.`,
  );
  p();

  // ── 1. Who ──────────────────────────────────────────────────────────────────
  p(`## 1. Household`);
  p();
  p(`- Current age (primary): **${startAge}** (birth year ${birthYear})`);
  p(`- Filing status: **${ta.filing_status}**`);
  p(`- State of residence: **${ta.state_of_residence}**`);
  if (ip.use_partner_income) {
    const pby = ip.partner_birth_year;
    p(`- Partner: yes${pby ? ` (born ${pby}, age ${thisYear - pby})` : ""}`);
  } else {
    p(`- Partner: no`);
  }
  const kids = config.children ?? [];
  if (kids.length) {
    p(
      `- Children (${kids.length}): birth years ${kids
        .map((k) => k.birthYear)
        .join(", ")}`,
    );
  }
  p(`- W-4 allowances claimed: ${ta.w4_allowances ?? 0} (each shields $4,300 of income-taxable wages)`);
  p();

  // ── 2. Balance sheet ────────────────────────────────────────────────────────
  const la = snapshot.liquid_assets;
  const ra = snapshot.retirement_assets;
  const liab = snapshot.liabilities;
  const taxableStart = la.vanguard_bridge + la.cash_savings;
  const tradStart = ra.k401 + ra.traditional_ira;
  const eduStart = (snapshot.education_assets.accounts || []).reduce(
    (s, a) => s + a.balance,
    0,
  );
  // The concentrated employer position (config.concentrated_symbol) is counted by
  // the engine under `googValue` — which also includes vested RSU shares held via
  // share_counts, OUTSIDE other_investments. List it as its own line and filter it
  // out of the generic-holdings loop so the itemization ties to the engine's
  // aggregate exactly (no missing shares, no double-count).
  const concSym = config.use_equity_comp ? (config.concentrated_symbol ?? "").toUpperCase() : "";
  const isConc = (s: string) => concSym !== "" && (s ?? "").toUpperCase() === concSym;
  const otherInv = (snapshot.other_investments ?? []).filter((i) => !isConc(i.symbol));
  // Concentrated position at AS-ENTERED (today) values so the table ties to the
  // reconciliation exactly: portfolio-held concentrated shares + out-of-portfolio
  // RSU shares (share_counts), priced at the live/last-known quote — the same
  // seeding the engine uses at month 0.
  const concShares = (snapshot.other_investments ?? []).filter((i) => isConc(i.symbol)).reduce((s, i) => s + i.shares, 0)
    + (snapshot.share_counts?.google_shares ?? 0);
  const concPrice = live > 0 ? live : (snapshot.share_counts?.live_stock_price || 175);
  const concValue = concShares * concPrice;

  p(`## 2. Starting balance sheet (today's dollars)`);
  p();
  p(`| Bucket | Value | Tax treatment on withdrawal |`);
  p(`|---|--:|---|`);
  p(`| Taxable brokerage + cash | ${usd(taxableStart)} | LTCG on embedded gains only |`);
  p(`| Traditional 401(k)/IRA | ${usd(tradStart)} | ordinary income (fully taxed) |`);
  p(`| Roth IRA | ${usd(ra.roth_ira)} | tax-free |`);
  if (concValue > 0) {
    p(`| Concentrated equity: ${concSym || "employer stock"} | ${usd(concValue)} | vested shares (portfolio + RSU grants); LTCG on embedded gains |`);
  }
  p(`| 529 (education) | ${usd(eduStart)} | education-only; excluded from net worth's FI assets |`);
  if (otherInv.length) {
    for (const inv of otherInv) {
      p(
        `| Holding: ${inv.symbol} (${inv.shares} sh) | ${usd(
          inv.shares * inv.current_price,
        )} | LTCG on gain over basis ${usd(inv.shares * inv.cost_basis)} |`,
      );
    }
  }
  const isRent = sp.housing_type === "rent";
  const propertyValue = liab.property_value ?? 0;
  if (isRent) {
    p(`| Housing | Renter | rent is a perpetual expense (no mortgage balance) |`);
  } else {
    p(`| Mortgage balance | ${usd(-liab.mortgage_balance)} | ${pct(liab.mortgage_interest_rate || 3.5)} fixed (0/blank ⇒ 3.5% default) |`);
    if (propertyValue > 0) {
      p(`| Home / building value | ${usd(propertyValue)} | equity (value − mortgage = ${usd(propertyValue - liab.mortgage_balance)}) counts in net worth; NOT a spendable/FI asset |`);
    }
  }
  if (liab.consumer_debt) p(`| Consumer debt | ${usd(-liab.consumer_debt)} | paid down when cash > $50k |`);
  p();
  p(
    propertyValue > 0
      ? `**Net worth today: ${usd(today?.totalNetWorth ?? 0)}** — this headline figure ` +
          `*excludes* the home and its mortgage, so it reads in the same "investable ` +
          `money" terms as everything else. Reported separately: home equity ` +
          `${usd(today?.homeEquity ?? 0)} (building value ${usd(propertyValue)} − mortgage), ` +
          `so **net worth including the home is ${usd(today?.netWorthWithHome ?? 0)}**. ` +
          `Home equity is not a spendable/FI asset. Consumer debt is netted out.`
      : `**Net worth today: ${usd(today?.totalNetWorth ?? 0)}.** Note: the mortgage ` +
          `is *excluded* from net worth (no home value entered, so the offsetting ` +
          `asset isn't tracked), but consumer debt is netted out.`,
  );
  p();
  // Reconciliation — the AS-ENTERED table lines sum exactly to these totals (every
  // asset shown, including the concentrated position's out-of-portfolio RSU shares
  // that an earlier report omitted). A separate note reconciles these as-entered
  // values to the engine's month-0 record, which is one month into the projection.
  const otherHoldingsRaw = otherInv.reduce((s, i) => s + i.shares * i.current_price, 0);
  const debt = liab.consumer_debt || 0;
  const rawGross = taxableStart + tradStart + ra.roth_ira + concValue + otherHoldingsRaw;
  const rawNet = rawGross + eduStart - debt;
  const engMortgage = Math.round((today?.totalLiabilities ?? 0) - debt); // real mortgage at engine month-0 (used in FI number)
  p(`**Reconciliation — the table above ties out exactly (as-entered / today).**`);
  p(`- Gross investable = cash+taxable ${usd(taxableStart)} + traditional ${usd(tradStart)} + Roth ${usd(ra.roth_ira)}${concValue > 0 ? ` + concentrated equity ${usd(concValue)}` : ""}${otherHoldingsRaw > 0 ? ` + other holdings ${usd(otherHoldingsRaw)}` : ""} = **${usd(rawGross)}**.`);
  p(`- Net worth (excl. home) = gross investable + 529 (${usd(eduStart)}) − consumer debt (${usd(debt)}) = **${usd(rawNet)}**.`);
  p(`- **Valuation date:** the above are as-entered (today) and tie to the table exactly. The engine's month-0 record (used in §9–10 & Monte Carlo) is one month in — a month of growth, contributions/vesting, and a mortgage payment — so runs slightly higher: net worth **${usd(rawNet)}** vs **${usd(today?.totalNetWorth ?? 0)}**; FI-number mortgage **${usd(engMortgage)}** vs as-entered **${usd(liab.mortgage_balance)}**. A timing convention, not a discrepancy.`);
  p(`- 529 is a household asset but excluded from spendable/FI assets; home equity (if any) reported separately above and also excluded.`);
  p();

  // ── 3. Assumptions ──────────────────────────────────────────────────────────
  p(`## 3. Economic & market assumptions`);
  p();
  p(`| Parameter | Nominal | Real (÷ inflation) |`);
  p(`|---|--:|--:|`);
  p(`| Inflation (CPI) | ${pct(infl)} | — |`);
  p(`| Diversified market return | ${pct(ma.market_return_rate)} | ${pct(round1(toReal(ma.market_return_rate, infl)))} |`);
  p(`| Volatility drag (subtracted before growth) | ${pct(ma.volatility_drag)} | — |`);
  p(`| Concentrated/employer stock growth | ${pct(ma.goog_growth_rate)} | ${pct(round1(toReal(ma.goog_growth_rate, infl)))} |`);
  p(`| Salary growth (raises) | ${pct(ip.income_growth_rate || 0)} | ${pct(round1(toReal(ip.income_growth_rate || 0, infl)))} |`);
  p(`| Taxable-account dividend tax drag | ${pct(ma.taxable_dividend_drag ?? 0.4)} | — |`);
  p(`| Healthcare inflation *above* CPI (real) | — | ${pct(ma.healthcare_inflation_premium ?? 2)} |`);
  p(`| Monte Carlo return volatility (σ) | ${pct(ma.return_volatility ?? 15)} | — |`);
  p();
  p(`**Real-rate conversion (Fisher):** \`real = (1 + nominal) / (1 + inflation) − 1\`.`);
  p(
    `The entire projection runs in today's dollars, so growth is applied at the ` +
      `*real* rate. Tax thresholds and deductions are correspondingly held constant ` +
      `in **real** dollars — a simplifying assumption that tax law stays inflation- ` +
      `indexed and the real tax structure is unchanged (so there's no phantom bracket ` +
      `creep). It does NOT mean the literal 2025 nominal brackets apply in future years.`,
  );
  p();
  p(`**Monthly compounding:** an annual rate \`r\` (as a %) becomes a monthly factor`);
  p("```");
  p(`monthly = (1 + r/100)^(1/12) − 1`);
  p("```");
  p(
    `(Note: this is true compounding, **not** \`r/12\`. Each asset bucket is ` +
      `multiplied by \`(1 + monthly)\` every month.)`,
  );
  p();
  p(`Per-bucket monthly real growth actually applied:`);
  const eff = Math.max(0, ma.market_return_rate - ma.volatility_drag);
  const effReal = toReal(eff, infl);
  const taxableReal = effReal - (ma.taxable_dividend_drag ?? 0.4);
  p(
    `- Diversified market return net of drag: \`max(0, ${ma.market_return_rate} − ${ma.volatility_drag}) = ${round1(eff)}%\` nominal → \`${round1(effReal)}%\` real.`,
  );
  p(`- Traditional 401(k)/IRA, Roth, 529 grow at that real market rate.`);
  p(`- Taxable brokerage grows at the real market rate **minus** the ${pct(ma.taxable_dividend_drag ?? 0.4)} dividend drag → \`${round1(taxableReal)}%\` real.`);
  p();

  // ── 4. Career & income path ──────────────────────────────────────────────────
  const sabbEnd = cp.exit_year + (cp.use_sabbatical ? cp.sabbatical_duration : 0);
  const jumpEnd = sabbEnd + (cp.use_jump ? cp.jump_duration : 0);
  const bridgeEnd = jumpEnd + (cp.use_bridge ? cp.bridge_duration : 0);
  p(`## 4. Career path & income`);
  p();
  p(`- Primary gross salary today: ${usd(ip.gross_annual_salary)}/yr, target bonus ${pct(ip.target_bonus_rate || 0)}.`);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const exitWhen = (cp.exit_month ?? 0) > 0 ? `${MONTHS[cp.exit_month!]} ${cp.exit_year}` : `${cp.exit_year}`;
  p(`- Exit from primary job: **${exitWhen}** (age ${cp.exit_year - birthYear}). Salary, bonus (paid March), and RSU vesting accrue through the exit month, so timing the exit just after a March bonus/vest captures it.`);
  if (cp.use_sabbatical) p(`- Sabbatical: ${cp.exit_year}–${sabbEnd} (no earned income).`);
  if (cp.use_jump) p(`- "Jump" job: ${sabbEnd}–${jumpEnd} at ${usd(ip.jump_gross_annual)}/yr, bonus ${pct(ip.jump_bonus_rate || 0)}.`);
  if (cp.use_bridge) p(`- Bridge job: ${jumpEnd}–${bridgeEnd} at ${usd(ip.bridge_gross_annual)}/yr.`);
  p(`- Full retirement (no earned income) from **${bridgeEnd}** onward.`);
  if (ip.monthly_rental_income) p(`- Rental income: ${usd(ip.monthly_rental_income)}/mo, growing ${pct(ip.rental_income_growth_rate ?? 3)}/yr nominal (FICA-exempt, ordinary income tax).`);
  if (ip.monthly_parttime_income) p(`- Part-time income: ${usd(ip.monthly_parttime_income)}/mo (W-2, taxed with FICA).`);
  if (ip.use_partner_income && ip.partner_gross_annual_salary)
    p(`- Partner salary: ${usd(ip.partner_gross_annual_salary)}/yr until ${ip.partner_retirement_year ?? "—"}.`);
  p();
  // Company equity / RSUs (opt-in; a shared fact across scenarios).
  if (config.use_equity_comp) {
    const sym = config.concentrated_symbol || "company stock";
    const vy = ip.vesting_years ?? 4;
    p(`- **Company equity / RSUs (${sym}):**`);
    if (ip.initial_unvested_shares) p(`  - Currently-unvested grant: ${ip.initial_unvested_shares.toLocaleString()} shares, vesting linearly over ${vy} years.`);
    if (ip.annual_equity_grant) p(`  - Annual refresher: ${usd(ip.annual_equity_grant)} granted each **March**, vesting over ${vy} years (cohorts stack); vested shares are taxed at the marginal rate (sell-to-cover) and added to the ${sym} position.`);
    p(`  - ${sym} grows at its own ${pct(ma.goog_growth_rate)} nominal rate (separate from the diversified portfolio).`);
    const dv = config.divestment_strategy;
    if (dv?.type === "progressive") p(`  - Divestment: progressive sell-down ${dv.start_year}–${dv.end_year}, realizing long-term gains into cash.`);
    else if (dv?.type === "immediate") p(`  - Divestment: sell the entire position at exit (${cp.exit_year}).`);
    else p(`  - Divestment: none (hold the concentrated position).`);
  }
  const matchRate = ip.employer_match_rate_pct ?? 0;
  const matchLine = matchRate > 0
    ? ` Employer 401(k) match: ${matchRate}% of ${(ip.employer_match_limit_pct ?? 0) > 0 ? `the first ${ip.employer_match_limit_pct}% of salary you contribute` : "all your contributions"}, added on top (not taxable income) and capped so deferral + match ≤ ${usd(IRS_401K.totalAdditions)} (IRS 415(c) combined limit).`
    : "";
  p(`Salary_t = base × (1 + real_raise)^t, real_raise = Fisher(${pct(ip.income_growth_rate || 0)}). Contributions while working: ${usd(ip.annual_401k_contribution ?? IRS_401K.employeeLimit)} pre-tax 401(k) (cuts income tax not FICA; ${IRS_401K.year} cap ${usd(IRS_401K.employeeLimit)} +${usd(IRS_401K.catchup)} at ${IRS_401K.catchupAge}+) + ${usd(ip.annual_backdoor_roth ?? 7500)}/yr backdoor Roth.${matchLine}`);
  p();

  // ── 5. Spending ───────────────────────────────────────────────────────────────
  p(`## 5. Spending (today's dollars)`);
  p();
  p(`- Core lifestyle: **${usd(sp.monthly_lifestyle)}/mo** (${usd(sp.monthly_lifestyle * 12)}/yr).`);
  if (config.children?.length && sp.use_empty_nest !== false) {
    const enSpend = sp.empty_nest_linked !== false ? sp.monthly_lifestyle * 0.85 : (sp.empty_nest_monthly_spend ?? sp.monthly_lifestyle * 0.85);
    p(`- Empty-nest spend from ${sp.empty_nest_year ?? "—"}: ${usd(enSpend)}/mo (${sp.empty_nest_linked !== false ? "−15% of lifestyle" : "custom"}).`);
  }
  p(`- Self-paid healthcare: ${usd(sp.healthcare_premium)}/mo (treat as **total** healthcare spend — premiums, deductibles, dental, vision — not just premium; they're not modeled as separate lines), rising at CPI + ${pct(ma.healthcare_inflation_premium ?? 2)} real/yr. $0 while employer-covered; pre-65 self-paid cost floored at 50% of the unsubsidized premium (a user-side assumption, not an ACA rule).`);
  if (isRent) {
    p(`- Rent: ${usd(sp.mortgage_payment)}/mo — a **perpetual** real expense (rises with inflation, never ends, no balance to amortize).`);
  } else {
    p(`- Mortgage payment: ${usd(sp.mortgage_payment)}/mo (nominal; deflated to real over time since it's a fixed contract). It ends at payoff, and the **remaining balance is added to the FI number** (see §9).`);
  }
  if (!isRent && (sp.sell_home_year ?? 0) > 0 && (liab.property_value ?? 0) > 0) {
    p(`- **Home sale in ${sp.sell_home_year}:** proceeds = value ${usd(liab.property_value ?? 0)} − mortgage − ~6% costs − 15% cap-gains tax (gain over basis ${usd(liab.property_cost_basis ?? liab.property_value ?? 0)} less §121 $500k/$250k) → spendable cash. Mortgage clears, rental stops, housing → rent ${usd(sp.rent_after_sale ?? 0)}/mo thereafter.`);
  }
  if (sp.ltc_annual_cost) p(`- Long-term care: ${usd(sp.ltc_annual_cost)}/yr for ${sp.ltc_years ?? 3} years starting age ${sp.ltc_start_age ?? 80}.`);
  if (config.life_events?.length) {
    p(`- One-off life events:`);
    for (const ev of config.life_events) p(`  - ${ev.year}: ${ev.name} — ${usd(ev.cost)}${ev.name.toLowerCase().includes("college") ? " (paid from 529 first)" : ""}`);
  }
  p();

  // ── 6. Taxes ──────────────────────────────────────────────────────────────────
  p(`## 6. Taxes`);
  p();
  p(`Taxes use 2025 federal brackets, FICA, NIIT, and the resident state's brackets. Key pieces:`);
  p();
  p(`- **Federal ordinary:** 2025 ${ta.filing_status} brackets (10/12/22/24/32/35/37%) after the standard deduction (or itemized: mortgage interest on ≤$750k debt + $10k SALT${ta.itemized_deductions ? ` + ${usd(ta.itemized_deductions)}` : ""}).`);
  p(`- **FICA:** 6.2% SS to $176,100 + 1.45% Medicare + 0.9% over threshold; W-2 wages only.`);
  p(`- **State tax: ${ta.state_of_residence}**${ta.state_of_residence === "NY" ? " — NY State brackets + NYC resident tax (~3.08–3.88%); gains taxed as ordinary" : ta.state_of_residence === "CA" ? " — CA brackets + 1% >$1M surcharge; gains taxed as ordinary" : " — state brackets; gains taxed as ordinary; local taxes omitted outside NYC/MD"}.`);
  p(`- **NIIT:** 3.8% on net investment income above the MAGI threshold (${ta.filing_status === "married_joint" ? "$250,000" : "$200,000"}).`);
  p(`- **Long-term capital gains:** 0/15/20% federal by income; embedded gains haircut at a 15% midpoint for the FI "spendable assets" test.`);
  p(`- The model distinguishes the **effective rate** (used to net down steady salary/rental) from the **marginal rate** (used for bonuses, RSU vesting, and the emergency-withdrawal rate = min(55%, marginal + 5%)).`);
  p();

  // ── 7. Social Security ────────────────────────────────────────────────────────
  if (config.social_security) {
    const ss = config.social_security;
    const claimAge = ss.start_age;
    const yearsWorked = cp.exit_year - (birthYear + 22);
    const estPrimary = ss.social_security_linked !== false
      ? estimateMonthlySocialSecurity(ip.gross_annual_salary, claimAge, yearsWorked)
      : ss.monthly_amount;
    p(`## 7. Social Security`);
    p();
    p(`- Claim age: **${claimAge}** (Full Retirement Age = 67).`);
    p(`- Primary benefit: ${ss.social_security_linked !== false ? `estimated **${usd(estPrimary)}/mo**` : `manual **${usd(ss.monthly_amount)}/mo**`}.`);
    if (ip.use_partner_income) {
      const pb = ss.partner_ss_linked !== false ? estimateMonthlySocialSecurity(ip.partner_gross_annual_salary || 0, claimAge) : (ss.partner_monthly_amount || 0);
      p(`- Partner benefit: ${usd(pb)}/mo, starting when the partner reaches ${claimAge}.`);
    }
    p();
    p(`PIA estimate (from salary, as a proxy for the SSA's 35-year indexed average):`);
    p("```");
    p(`AIME   = min(salary, 176100) / 12 × min(1, yearsWorked/35)   [yearsWorked ≈ ${Math.max(0, yearsWorked)}]`);
    p(`PIA    = 0.90 × min(AIME, 1226)`);
    p(`       + 0.32 × (min(AIME, 7391) − 1226)`);
    p(`       + 0.15 × max(0, AIME − 7391)`);
    p(`benefit = PIA × claim_factor   (FRA=67; +8%/yr delayed to 70; reduced if earlier)`);
    p("```");
    p(`Up to 85% of benefits are federally taxable (graduated by provisional income); the resident state's SS treatment is applied separately.`);
    p();
  }

  // ── 8. Withdrawals, RMDs, healthcare subsidies, survivor ──────────────────────
  p(`## 8. Retirement mechanics`);
  p();
  p(`- **Withdrawal waterfall** (cash flow negative): (1) taxable — concentrated then diversified, taxing only the embedded gain at the stacked **LTCG** rate (0/15/20% + NIIT/state, *not* the ordinary rate); (2) traditional — ordinary income (flat 30% assumed, monthly drawdown only); (3) Roth last. Simple/conservative ordering, **not** tax-optimized (no strategic Roth-conversion/bracket management). The 30% here is distinct from the §9 spendable haircut, which uses the ~8–15% *effective* rate on the year's actual need.`);
  const rmdStart = birthYear >= 1960 ? 75 : 73;
  p(`- **RMDs:** from age ${rmdStart} (SECURE 2.0), each year withdraws \`traditional_balance ÷ IRS_Uniform_Lifetime_divisor(age)\`, taxed as ordinary income; net proceeds move to cash.`);
  p(`- **Medicare/IRMAA:** at age ${config.medicare?.start_age ?? 65}, premiums of ${usd(config.medicare?.monthly_premium ?? 185)}/mo per adult apply, plus an IRMAA surcharge driven by MAGI from two years prior.`);
  if (config.tax_optimization?.enable_aca_optimization ?? true)
    p(`- **ACA subsidy** (pre-Medicare): premium capped at an ARPA-style % of the **coverage year's own MAGI** (the correct basis), solved by fixed-point iteration since MAGI↔withdrawals are circular — which fixes the first-retirement-year subsidy a prior-year proxy would deny. FPL household size = ${ta.filing_status === "married_joint" ? 2 : 1} adult(s) + ${kids.filter((k) => thisYear - k.birthYear < 22).length} kid(s), tapering as they age out. Net cost floored at 50% of the unsubsidized premium (a user-side assumption, not an ACA rule).`);
  if (config.tax_optimization?.enable_roth_conversion ?? true)
    p(`- **Roth conversions:** during a low-income sabbatical, traditional balances are converted up to the ${usd(config.tax_optimization?.roth_conversion_target_bracket ?? 206700)} taxable-income ceiling, paying tax now from cash.`);
  if (ta.filing_status === "married_joint" && (config.mortality?.first_death_age ?? 0) > 0) {
    p(`- **Survivor transition:** at primary age ${config.mortality!.first_death_age}, the household files single, keeps the larger SS benefit, and spends ${Math.round((config.mortality?.survivor_spending_factor ?? 0.75) * 100)}% of the couple's amount.`);
  }
  p();

  // ── 9. The FI test ────────────────────────────────────────────────────────────
  p(`## 9. Financial-independence test (the headline)`);
  p();
  p(`**Headline FI = cash-flow survival, not the Rule of 25.** For each candidate month, retire fully and run the actual cash-flow to age 100 (mortgage-until-payoff, healthcare growth, college, taxes, RMDs; offset by SS/rental as they start); the earliest month whose balances never deplete is the FI date. This matters because real spending is non-level. The **FI Number (Rule of 25)** below is a *reference heuristic only* (drives the Progress bar), not the pass/fail test.`);
  p();
  p(`**FI Number (Rule of 25 / 4% SWR), plus housing:**`);
  p("```");
  p(`annual_need   = (lifestyle_monthly + self_paid_healthcare_monthly${isRent ? " + rent_monthly" : ""}) × 12`);
  p(`passive_net   = (rental_net + social_security_net) × 12`);
  p(`net_need      = max(0, annual_need − passive_net)`);
  p(`FI_number     = net_need / 0.04 ${isRent ? "" : "+ remaining_mortgage_balance"}   (25 × net_need${isRent ? "" : ", plus the lump to clear the mortgage"})`);
  p("```");
  p(isRent
    ? `Renter: rent is a permanent expense, capitalized into the FI number at 25× (inside \`annual_need\`); no mortgage balance to add.`
    : `The finite mortgage **payment** is not ×25; instead the remaining **balance** is added as a payoff lump (shrinks to $0 as it amortizes, and the payment then drops out of expenses).`);
  p();
  p(`**Estimated spendable value** (reference metric only — the FI test above computes tax exactly year by year). A rough valuation of tax-deferred/illiquid assets, not a precise after-tax figure:`);
  p("```");
  p(`spendable ≈ cash + roth + traditional × (1 − eff_withdrawal_rate)`);
  p(`          + taxable_holdings − 0.15 × embedded_unrealized_gains`);
  p("```");
  p(`\`eff_withdrawal_rate\` = effective (~8–15%) rate on the year's need, not marginal. \`embedded_gains\` summed per-lot from each holding's basis (a $0-basis lot ⇒ full 15% haircut). The traditional term is an estimate under one withdrawal path, not a market value.`);
  p(`The Rule-of-25 crossing (\`spendable ≥ FI_number\`, durable) is reported below as a reference point, but the **headline FI date is the cash-flow-survival month** described above.`);
  p();

  // ── 10. Results ───────────────────────────────────────────────────────────────
  p(`## 10. Results (computed by this engine)`);
  p();
  if (today) {
    const netNeedToday = Math.max(0, today.annualExpenseNeed - today.annualPassiveIncome);
    const housingAdd = Math.round(today.swrTarget - netNeedToday / 0.04); // ≈ remaining mortgage (0 for renters)
    p(`- **FI Number today:** ${usd(today.swrTarget)}  (= 25 × net annual need of ${usd(netNeedToday)}${housingAdd > 1 ? ` + ${usd(housingAdd)} to clear the mortgage` : ""})`);
    p(`  - annual expense need: ${usd(today.annualExpenseNeed)}; passive income (net): ${usd(today.annualPassiveIncome)}`);
    p(`- **Spendable assets today:** ${usd(today.investableAfterTax)} (gross investable ${usd(today.investableAssets)})`);
    p(`- **Net worth today:** ${usd(today.totalNetWorth)}`);
  }
  if (fiSurvival) {
    p(`- **Financial independence (cash-flow survival): ${fiSurvival.date}** (age ${Number((fiSurvival.date.match(/\d{4}/) || [])[0]) - birthYear}) — the earliest month you could fully retire and still fund every modeled expense to age 100.`);
  } else {
    p(`- **Financial independence: NOT reached by age 100** — no month lets you fully retire without depleting before age 100 under these assumptions.`);
  }
  if (fi) {
    p(`  - Reference (Rule of 25): spendable durably clears the FI number in **${fi.date}** (${usd(fi.investableAfterTax)} ≥ ${usd(fi.swrTarget)}). This is the heuristic, not the headline test above.`);
  } else {
    p(`  - Reference (Rule of 25): spendable assets never durably reach the FI number within the horizon.`);
  }
  if (retirePoint) {
    p(`- **At full retirement (${retirePoint.date}):** net worth ${usd(retirePoint.totalNetWorth)}, spendable ${usd(retirePoint.investableAfterTax)}, annual need ${usd(retirePoint.annualExpenseNeed)}.`);
  }
  if (last) {
    p(`- **End of horizon (${last.date}, age ${startAge + Math.round(last.monthIndex / 12)}):** net worth ${usd(last.totalNetWorth)}, spendable ${usd(last.investableAfterTax)}.`);
  }
  p();

  // Trajectory sample — every 5 years.
  p(`### Net-worth trajectory (5-year samples, today's dollars)`);
  p();
  p(`| Year | Age | Phase | Net worth | Spendable | FI number | Independent? |`);
  p(`|---|--:|---|--:|--:|--:|:--:|`);
  for (const ptn of trajectory) {
    if (ptn.monthIndex % 60 !== 0) continue;
    const yr = Number((ptn.date.match(/\d{4}/) || [])[0]);
    p(
      `| ${ptn.date} | ${yr - birthYear} | ${ptn.currentPhase} | ${usd0(ptn.totalNetWorth)} | ${usd0(ptn.investableAfterTax)} | ${usd0(ptn.swrTarget)} | ${ptn.isIndependent ? "✓" : "—"} |`,
    );
  }
  p();

  // ── 11. Monte Carlo ───────────────────────────────────────────────────────────
  if (input.includeMonteCarlo ?? true) {
    const mc = runMonteCarlo(snapshot, config, live, { runs: input.monteCarloRuns ?? 2500 });
    p(`## 11. Sequence-of-returns risk (Monte Carlo)`);
    p();
    const geoTarget = toReal(Math.max(0, ma.market_return_rate - ma.volatility_drag), infl);
    const sig = (ma.return_volatility ?? 15) / 100;
    const arithMean = geoTarget + (sig * sig / 2) * 100;
    p(`${mc.runs} lifetime sims, returns randomized from **today** to age 100 (so accumulation-phase sequence risk is included). Annual real return ~ Normal(mean ${round1(arithMean)}%, σ ${ma.return_volatility ?? 15}%), the mean set to \`geo_target ${round1(geoTarget)}% + σ²/2\` so paths compound to ~the deterministic geometric rate. This σ²/2 calibration is *approximate* (exact only for lognormal, not annual-normal draws with cash flows), so the deterministic path lands near, not exactly on, the MC median. "Success" = actual account balances never deplete in retirement (same test as the deterministic FI date).`);
    p();
    const failures = Math.round((1 - mc.successRate) * mc.runs);
    const lastBand = mc.bands[mc.bands.length - 1];
    if (failures === 0) {
      p(`- **No failures in ${mc.runs} sims** — but 0/${mc.runs} isn't proof of zero risk: consistent with a true failure rate up to ~${(300 / mc.runs).toFixed(2)}% (95% CI, rule of three).`);
    } else {
      p(`- **${failures} of ${mc.runs} simulations failed** to fund the plan to age 100 — a ${((1 - mc.successRate) * 100).toFixed(1)}% failure rate (${(mc.successRate * 100).toFixed(1)}% success).`);
    }
    p(`- Ending net worth across paths: 10th pct ${usd(lastBand?.p10 ?? 0)} · median ${usd(lastBand?.p50 ?? 0)} · 90th pct ${usd(lastBand?.p90 ?? 0)}.`);
    p(`- Median ending spendable assets: ${usd(mc.medianFinalNetWorth)}.`);
    p();

    // Confidence-graded FI dates: the earliest retirement year that survives 90 /
    // 95 / 99% of simulated market paths, alongside the deterministic (median-path)
    // date. This answers "how sure am I?", not just "does the base case work?".
    const fiConf = findMonteCarloFiYears(snapshot, config, live, { runsPerYear: Math.min(250, input.monteCarloRuns ?? 250) });
    const seN = (100 * Math.sqrt(0.25 / Math.max(1, fiConf.runsPerYear))).toFixed(1); // worst-case SE
    p(`**Confidence-graded FI date** — earliest full-retirement year whose success rate meets each probability (${fiConf.runsPerYear} sims/year, ±~${seN} pts). Read the actual rates, not just the thresholds:`);
    p("```");
    p(`base case (deterministic median path): ${fiConf.baseYear ?? "not reached"}`);
    for (const t of fiConf.thresholds) {
      p(`earliest year with ≥${Math.round(t.p * 100)}% success: ${t.year ?? "not within horizon"}`);
    }
    if (fiConf.scanned.length) {
      p(``);
      p(`actual success rate by exit year (retire at the START of that year):`);
      for (const s of fiConf.scanned) p(`  ${s.year}: ${(s.successRate * 100).toFixed(1)}%`);
    }
    p("```");
    p(`Higher-confidence dates survive worse return *sequences*, so land later; the base→95% gap is the cost of sequence risk. **Caveat:** near 99% these are noisy at ${fiConf.runsPerYear} sims/year — for a decision, re-run boundary years at ≥10,000 sims.`);
    p();
  }

  // ── 12. Sensitivity to the key decision variables ────────────────────────────
  // Re-run the SAME deterministic cash-flow FI test with one assumption stressed at
  // a time, so the reader sees which variables actually move the retirement date.
  // findCashflowFiPoint is deterministic (no Monte Carlo), so each row is cheap.
  {
    p(`## 12. Sensitivity — what actually moves the FI date`);
    p();
    const baseFiYr = fiSurvival ? Number(fiSurvival.date.split(" ")[1]) : null;
    p(`Each row re-runs the deterministic FI test with ONE assumption stressed (else fixed), showing which variables the **${fiSurvival?.date ?? "FI"}** date depends on. Pair with the Monte Carlo confidence dates for sequence risk.`);
    p();
    p(`| Stressed assumption | FI date | vs base |`);
    p(`|---|---|---|`);
    const crashPrice = (live > 0 ? live : (snapshot.share_counts?.live_stock_price || 175)) * 0.5;
    const clone = () => structuredClone(config);
    const row = (label: string, pt: TrajectoryPoint | undefined) => {
      const yr = pt ? Number(pt.date.split(" ")[1]) : null;
      const vs = baseFiYr == null || yr == null ? "—" : yr === baseFiYr ? "same" : `${yr - baseFiYr > 0 ? "+" : ""}${yr - baseFiYr} yr`;
      p(`| ${label} | ${pt ? pt.date : "not reached by 100"} | ${vs} |`);
    };
    row(`Base case`, fiSurvival ?? undefined);
    if (config.use_equity_comp && concValue > 0) {
      row(`${concSym || "GOOG"} grows at the market rate (${pct(ma.market_return_rate)}), not ${pct(ma.goog_growth_rate)}`,
        findCashflowFiPoint(snapshot, { ...clone(), market_assumptions: { ...ma, goog_growth_rate: ma.market_return_rate } }, live) ?? undefined);
      row(`${concSym || "GOOG"} grows at just 4% nominal (severe underperformance)`,
        findCashflowFiPoint(snapshot, { ...clone(), market_assumptions: { ...ma, goog_growth_rate: 4 } }, live) ?? undefined);
      row(`${concSym || "GOOG"} drops 50% today`,
        findCashflowFiPoint(snapshot, clone(), crashPrice) ?? undefined);
    }
    if ((ip.monthly_rental_income ?? 0) > 0) {
      row(`Rental income lost entirely`,
        findCashflowFiPoint(snapshot, { ...clone(), income_profile: { ...ip, monthly_rental_income: 0 } }, live) ?? undefined);
    }
    row(`Healthcare +50% (${usd(Math.round(sp.healthcare_premium * 1.5))}/mo)`,
      findCashflowFiPoint(snapshot, { ...clone(), spending: { ...sp, healthcare_premium: sp.healthcare_premium * 1.5 } }, live) ?? undefined);
    const ss = config.social_security;
    const baseSS = ss ? (ss.social_security_linked !== false ? estimateMonthlySocialSecurity(ip.gross_annual_salary, ss.start_age) : (ss.monthly_amount || 0)) : 0;
    if (ss && baseSS > 0) {
      row(`Social Security cut 25% (${usd(Math.round(baseSS * 0.75))}/mo)`,
        findCashflowFiPoint(snapshot, { ...clone(), social_security: { ...ss, social_security_linked: false, monthly_amount: Math.round(baseSS * 0.75) } }, live) ?? undefined);
    }
    p();
    p(`Small shift ⇒ robust to that variable; large shift or "not reached" ⇒ a dependency to de-risk. The crash row is a "50% lower **today**" proxy — a crash timed at retirement is worse and left to the Monte Carlo.`);
    p();
  }

  // ── 13. Known simplifications ─────────────────────────────────────────────────
  p(`## 13. Known simplifications (worth scrutinizing)`);
  p();
  p(`- Social Security estimated from current salary as a proxy for the 35-year indexed average (override available).`);
  p(`- Tax brackets & contribution limits held constant in **real** dollars (assumed to track inflation), not frozen at nominal values.`);
  p(propertyValue > 0
    ? `- Home equity kept OUT of headline net worth and spendable/FI assets (reported separately); it isn't liquid.`
    : `- No home value entered, so the mortgage is excluded from net worth.`);
  p(`- Tax rates computed per-year, not per-lot. Survivor transition (if enabled) uses the primary's age/claim clock. GOOG modeled with its own return, uncorrelated with the diversified draw.`);
  p();
  p(`---`);
  p(`*Generated by Taper. Figures are planning estimates, not financial advice.*`);

  return L.join("\n");
}
