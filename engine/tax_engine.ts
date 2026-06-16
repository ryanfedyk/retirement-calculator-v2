export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';
export type StateCode = 'CA' | 'WA' | 'TX' | 'NY' | 'NONE';

export interface TaxInput {
  filingStatus:          FilingStatus;
  state:                 StateCode;
  grossIncome:           number;  // W2 wages + RSUs + bonuses — FICA base (before 401k deduction)
  preTaxDeductions?:     number;  // 401k, HSA — reduces income tax BUT NOT FICA
  ficaExemptIncome?:     number;  // Rental/passive — ordinary income tax, NO FICA
  itemizedDeductions?:   number;  // Federal itemized total (mortgage interest + SALT cap)
  nyItemizedDeductions?: number;  // NY state itemized (mortgage interest, no SALT cap)
  longTermCapitalGains:  number;
  shortTermCapitalGains: number;
}

export interface TaxOutput {
  federalIncomeTax:      number;
  stateIncomeTax:        number;
  ficaTax:               number;
  capitalGainsTax:       number;
  totalTax:              number;
  effectiveRate:         number;  // totalTax / totalIncome (display)
  ordinaryEffectiveRate: number;  // (fed + FICA + state) / ordinaryIncome — use for salary net-down
  marginalRate:          number;  // marginal rate on next $1 of ordinary W2 income
  netIncome:             number;
}

// ── Federal Income Tax Brackets 2025 ─────────────────────────────────────────

const FEDERAL_BRACKETS_2025: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: 11_925,   rate: 0.10 },
    { limit: 48_475,   rate: 0.12 },
    { limit: 103_350,  rate: 0.22 },
    { limit: 197_300,  rate: 0.24 },
    { limit: 250_525,  rate: 0.32 },
    { limit: 626_350,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { limit: 23_850,   rate: 0.10 },
    { limit: 96_950,   rate: 0.12 },
    { limit: 206_700,  rate: 0.22 },
    { limit: 394_600,  rate: 0.24 },
    { limit: 501_050,  rate: 0.32 },
    { limit: 751_600,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { limit: 11_925,   rate: 0.10 },
    { limit: 48_475,   rate: 0.12 },
    { limit: 103_350,  rate: 0.22 },
    { limit: 197_300,  rate: 0.24 },
    { limit: 250_525,  rate: 0.32 },
    { limit: 375_800,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  head_household: [
    { limit: 17_000,   rate: 0.10 },
    { limit: 64_850,   rate: 0.12 },
    { limit: 103_350,  rate: 0.22 },
    { limit: 197_300,  rate: 0.24 },
    { limit: 250_525,  rate: 0.32 },
    { limit: 626_350,  rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single:           15_000,
  married_joint:    30_000,
  married_separate: 15_000,
  head_household:   22_500,
};

// ── Federal LTCG Brackets 2025 ────────────────────────────────────────────────

const LTCG_BRACKETS_2025: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single:           [{ limit: 48_350,  rate: 0 }, { limit: 533_400,  rate: 0.15 }, { limit: Infinity, rate: 0.20 }],
  married_joint:    [{ limit: 96_700,  rate: 0 }, { limit: 600_050,  rate: 0.15 }, { limit: Infinity, rate: 0.20 }],
  married_separate: [{ limit: 48_350,  rate: 0 }, { limit: 300_000,  rate: 0.15 }, { limit: Infinity, rate: 0.20 }],
  head_household:   [{ limit: 64_750,  rate: 0 }, { limit: 566_700,  rate: 0.15 }, { limit: Infinity, rate: 0.20 }],
};

const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single:           200_000,
  married_joint:    250_000,
  married_separate: 125_000,
  head_household:   200_000,
};

// ── NY State Income Tax Brackets 2024 ────────────────────────────────────────

const NY_STATE_BRACKETS: Record<'single' | 'married_joint', { limit: number; rate: number }[]> = {
  single: [
    { limit: 8_500,      rate: 0.04   },
    { limit: 11_700,     rate: 0.045  },
    { limit: 13_900,     rate: 0.0525 },
    { limit: 80_650,     rate: 0.0585 },
    { limit: 215_400,    rate: 0.0625 },
    { limit: 1_077_550,  rate: 0.0685 },
    { limit: 5_000_000,  rate: 0.0965 },
    { limit: 25_000_000, rate: 0.103  },
    { limit: Infinity,   rate: 0.109  },
  ],
  married_joint: [
    { limit: 17_150,     rate: 0.04   },
    { limit: 23_600,     rate: 0.045  },
    { limit: 27_900,     rate: 0.0525 },
    { limit: 161_550,    rate: 0.0585 },
    { limit: 323_200,    rate: 0.0625 },
    { limit: 2_155_350,  rate: 0.0685 },
    { limit: 5_000_000,  rate: 0.0965 },
    { limit: 25_000_000, rate: 0.103  },
    { limit: Infinity,   rate: 0.109  },
  ],
};

const NY_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single:           8_000,
  married_joint:    16_050,
  married_separate: 8_000,
  head_household:   11_200,
};

const NYC_BRACKETS: Record<'single' | 'married_joint', { limit: number; rate: number }[]> = {
  single:        [{ limit: 12_000, rate: 0.03078 }, { limit: 25_000, rate: 0.03762 }, { limit: 50_000, rate: 0.03819 }, { limit: Infinity, rate: 0.03876 }],
  married_joint: [{ limit: 21_600, rate: 0.03078 }, { limit: 45_000, rate: 0.03762 }, { limit: 90_000, rate: 0.03819 }, { limit: Infinity, rate: 0.03876 }],
};

// ── CA State Income Tax 2024 ──────────────────────────────────────────────────

const CA_BRACKETS_2024 = [
  { limit: 10_412,   rate: 0.01  },
  { limit: 24_684,   rate: 0.02  },
  { limit: 38_959,   rate: 0.04  },
  { limit: 54_081,   rate: 0.06  },
  { limit: 68_350,   rate: 0.08  },
  { limit: 349_137,  rate: 0.093 },
  { limit: 418_961,  rate: 0.103 },
  { limit: 698_271,  rate: 0.113 },
  { limit: Infinity, rate: 0.123 },
];

// ── Bracket math helper ───────────────────────────────────────────────────────

function applyBrackets(amount: number, brackets: { limit: number; rate: number }[]): number {
  let tax = 0, prev = 0;
  for (const b of brackets) {
    const width   = b.limit - prev;
    const taxable = Math.min(Math.max(0, amount - prev), width);
    tax += taxable * b.rate;
    prev = b.limit;
    if (amount <= b.limit) break;
  }
  return tax;
}

// ── Core calculator ──────────────────────────────────────────────────────────

const _calculateTaxRaw = (input: TaxInput): Omit<TaxOutput, 'marginalRate'> => {
  const { filingStatus, grossIncome, longTermCapitalGains, shortTermCapitalGains } = input;
  const preTaxDeductions   = input.preTaxDeductions   ?? 0; // 401k etc — reduces income tax NOT FICA
  const ficaExemptIncome   = input.ficaExemptIncome   ?? 0; // rental — ordinary tax, no FICA
  const itemizedFed        = input.itemizedDeductions  ?? 0;
  const itemizedNY         = input.nyItemizedDeductions ?? 0;

  // ── Total ordinary income (all sources) ───────────────────────────────────
  // Note: preTaxDeductions come out BEFORE income tax, but NOT before FICA
  const totalOrdinaryGross = grossIncome + ficaExemptIncome + shortTermCapitalGains;
  const totalOrdinaryTaxable = Math.max(0, totalOrdinaryGross - preTaxDeductions);

  // ── Federal income tax ────────────────────────────────────────────────────
  const fedStdDeduction  = STANDARD_DEDUCTION_2025[filingStatus];
  const fedDeduction     = Math.max(fedStdDeduction, itemizedFed);
  const taxableOrdinary  = Math.max(0, totalOrdinaryTaxable - fedDeduction);
  const federalIncomeTax = applyBrackets(taxableOrdinary, FEDERAL_BRACKETS_2025[filingStatus]);

  // ── FICA — W2 only, NOT reduced by 401k, NOT on rental/passive ───────────
  const SS_WAGE_BASE = 176_100;
  const ficaWages    = Math.max(0, grossIncome); // full W2 gross, no 401k reduction
  const ssTax        = Math.min(ficaWages, SS_WAGE_BASE) * 0.062;
  const medTax       = ficaWages * 0.0145;
  const addMedTax    = Math.max(0, ficaWages - NIIT_THRESHOLD[filingStatus]) * 0.009;
  const ficaTax      = ssTax + medTax + addMedTax;

  // ── Federal LTCG (stacked on ordinary taxable income) ────────────────────
  const ltcgBrackets = LTCG_BRACKETS_2025[filingStatus];
  let capitalGainsTax = 0;
  let incomeStack     = taxableOrdinary;
  let remaining       = longTermCapitalGains;

  const z = ltcgBrackets[0].limit;
  if (incomeStack < z)   { const at0  = Math.min(remaining, z - incomeStack); remaining -= at0; incomeStack += at0; }
  const f = ltcgBrackets[1].limit;
  if (remaining > 0 && incomeStack < f) { const at15 = Math.min(remaining, f - incomeStack); capitalGainsTax += at15 * 0.15; remaining -= at15; incomeStack += at15; }
  if (remaining > 0)    { capitalGainsTax += remaining * 0.20; }

  // NIIT 3.8%
  const magi       = totalOrdinaryGross + longTermCapitalGains;
  const niitExcess = Math.max(0, magi - NIIT_THRESHOLD[filingStatus]);
  capitalGainsTax += Math.min(longTermCapitalGains + shortTermCapitalGains, niitExcess) * 0.038;

  // ── State income tax ──────────────────────────────────────────────────────
  let stateIncomeTax = 0;

  if (input.state === 'NY') {
    const nyTotalIncome = totalOrdinaryTaxable + longTermCapitalGains; // NY taxes LTCG as ordinary
    const nyKey: 'single' | 'married_joint' = filingStatus === 'married_joint' ? 'married_joint' : 'single';
    const nyDeduction = Math.max(NY_STANDARD_DEDUCTION[filingStatus], itemizedNY);
    const nyTaxable   = Math.max(0, nyTotalIncome - nyDeduction);
    stateIncomeTax += applyBrackets(nyTaxable, NY_STATE_BRACKETS[nyKey]);
    stateIncomeTax += applyBrackets(nyTaxable, NYC_BRACKETS[nyKey]);
  }

  if (input.state === 'CA') {
    const caSD       = filingStatus === 'married_joint' ? 10_726 : 5_363;
    const caTaxable  = Math.max(0, totalOrdinaryTaxable + longTermCapitalGains - caSD);
    const caBrackets = filingStatus === 'married_joint'
      ? CA_BRACKETS_2024.map(b => ({ limit: b.limit * 2, rate: b.rate }))
      : CA_BRACKETS_2024;
    stateIncomeTax += applyBrackets(caTaxable, caBrackets);
    if (caTaxable > 1_000_000) stateIncomeTax += (caTaxable - 1_000_000) * 0.01;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalTax = federalIncomeTax + ficaTax + capitalGainsTax + stateIncomeTax;
  const ordinaryTax = federalIncomeTax + ficaTax + stateIncomeTax;
  const ordinaryEffectiveRate = totalOrdinaryGross > 0
    ? Math.min(0.75, ordinaryTax / totalOrdinaryGross)
    : 0;

  return {
    federalIncomeTax,
    stateIncomeTax,
    ficaTax,
    capitalGainsTax,
    totalTax,
    effectiveRate:         magi > 0 ? totalTax / magi : 0,
    ordinaryEffectiveRate,
    netIncome:             magi - totalTax,
  };
};

export const calculateTax = (input: TaxInput): TaxOutput => {
  const base = _calculateTaxRaw(input);
  // Marginal rate: impact of $100 more of ordinary W2 gross income
  const plusOne      = _calculateTaxRaw({ ...input, grossIncome: input.grossIncome + 100 });
  const marginalRate = (plusOne.totalTax - base.totalTax) / 100;
  return { ...base, marginalRate };
};

export const calculateMarginalRate = (input: TaxInput): number =>
  calculateTax(input).marginalRate;
