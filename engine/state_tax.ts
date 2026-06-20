// ── State income tax (2024–2025 brackets) ────────────────────────────────────
//
// Progressive bracket tables for all 50 states + DC, used by the tax engine to
// model state income tax for whichever state the user selects.
//
// IMPORTANT — this is a planning model, not tax advice. Notes/simplifications:
//   • Figures are 2024/2025 rates & thresholds; review/update annually.
//   • married_separate and head_household are mapped to the single schedule.
//   • Capital gains are taxed as ordinary income at the state level (true for
//     most states). Federal LTCG is handled separately in the federal engine.
//   • Local/municipal income taxes are omitted EXCEPT NYC (handled in the
//     federal engine's NY path) and an approximate flat add-on for MD counties.
//   • States with no wage income tax return 0 (AK, FL, NH, NV, SD, TN, TX, WA,
//     WY). NH taxes only interest/dividends (being phased out) — treated as 0.

export type StateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI'
  | 'WY' | 'NONE';

export interface StateBracket { limit: number; rate: number }
interface StateSpec {
  name: string;
  single: StateBracket[];
  joint:  StateBracket[];
  stdSingle: number;
  stdJoint:  number;
  localFlat?: number; // approximate flat local add-on (e.g. MD counties)
  surtaxOver?: number;
  surtaxRate?: number;
}

const FLAT = (rate: number): StateBracket[] => [{ limit: Infinity, rate }];
// Most states set the MFJ schedule to exactly double the single thresholds.
const dbl = (b: StateBracket[]): StateBracket[] =>
  b.map(x => ({ limit: x.limit === Infinity ? Infinity : x.limit * 2, rate: x.rate }));

// Human-readable list for UI dropdowns (incl. the no-tax states).
export const STATE_OPTIONS: [StateCode, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['NONE', 'No State Tax'],
];

// Federal standard deduction (2025) — used by states that conform to it.
const FED_STD_S = 15_000;
const FED_STD_J = 30_000;

// Only states with a wage income tax need an entry. CA & NY are handled by the
// federal engine's dedicated paths and are intentionally omitted here.
const STATE_TAX: Partial<Record<StateCode, StateSpec>> = {
  AL: { name: 'Alabama', single: [{ limit: 500, rate: 0.02 }, { limit: 3_000, rate: 0.04 }, { limit: Infinity, rate: 0.05 }], joint: [{ limit: 1_000, rate: 0.02 }, { limit: 6_000, rate: 0.04 }, { limit: Infinity, rate: 0.05 }], stdSingle: 3_000, stdJoint: 8_500 },
  AZ: { name: 'Arizona', single: FLAT(0.025), joint: FLAT(0.025), stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  AR: { name: 'Arkansas', single: [{ limit: 4_400, rate: 0.02 }, { limit: 8_800, rate: 0.03 }, { limit: Infinity, rate: 0.039 }], joint: [{ limit: 4_400, rate: 0.02 }, { limit: 8_800, rate: 0.03 }, { limit: Infinity, rate: 0.039 }], stdSingle: 2_340, stdJoint: 4_680 },
  CO: { name: 'Colorado', single: FLAT(0.044), joint: FLAT(0.044), stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  CT: { name: 'Connecticut', single: [{ limit: 10_000, rate: 0.03 }, { limit: 50_000, rate: 0.05 }, { limit: 100_000, rate: 0.055 }, { limit: 200_000, rate: 0.06 }, { limit: 250_000, rate: 0.065 }, { limit: 500_000, rate: 0.069 }, { limit: Infinity, rate: 0.0699 }], joint: [{ limit: 20_000, rate: 0.03 }, { limit: 100_000, rate: 0.05 }, { limit: 200_000, rate: 0.055 }, { limit: 400_000, rate: 0.06 }, { limit: 500_000, rate: 0.065 }, { limit: 1_000_000, rate: 0.069 }, { limit: Infinity, rate: 0.0699 }], stdSingle: 0, stdJoint: 0 },
  DE: { name: 'Delaware', single: [{ limit: 2_000, rate: 0 }, { limit: 5_000, rate: 0.022 }, { limit: 10_000, rate: 0.039 }, { limit: 20_000, rate: 0.048 }, { limit: 25_000, rate: 0.052 }, { limit: 60_000, rate: 0.0555 }, { limit: Infinity, rate: 0.066 }], joint: [{ limit: 2_000, rate: 0 }, { limit: 5_000, rate: 0.022 }, { limit: 10_000, rate: 0.039 }, { limit: 20_000, rate: 0.048 }, { limit: 25_000, rate: 0.052 }, { limit: 60_000, rate: 0.0555 }, { limit: Infinity, rate: 0.066 }], stdSingle: 3_250, stdJoint: 6_500 },
  DC: { name: 'District of Columbia', single: [{ limit: 10_000, rate: 0.04 }, { limit: 40_000, rate: 0.06 }, { limit: 60_000, rate: 0.065 }, { limit: 250_000, rate: 0.085 }, { limit: 500_000, rate: 0.0925 }, { limit: 1_000_000, rate: 0.0975 }, { limit: Infinity, rate: 0.1075 }], joint: [{ limit: 10_000, rate: 0.04 }, { limit: 40_000, rate: 0.06 }, { limit: 60_000, rate: 0.065 }, { limit: 250_000, rate: 0.085 }, { limit: 500_000, rate: 0.0925 }, { limit: 1_000_000, rate: 0.0975 }, { limit: Infinity, rate: 0.1075 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  GA: { name: 'Georgia', single: FLAT(0.0539), joint: FLAT(0.0539), stdSingle: 12_000, stdJoint: 24_000 },
  HI: { name: 'Hawaii', single: [{ limit: 2_400, rate: 0.014 }, { limit: 4_800, rate: 0.032 }, { limit: 9_600, rate: 0.055 }, { limit: 14_400, rate: 0.064 }, { limit: 19_200, rate: 0.068 }, { limit: 24_000, rate: 0.072 }, { limit: 36_000, rate: 0.076 }, { limit: 48_000, rate: 0.079 }, { limit: 150_000, rate: 0.0825 }, { limit: 175_000, rate: 0.09 }, { limit: 200_000, rate: 0.10 }, { limit: Infinity, rate: 0.11 }], joint: dbl([{ limit: 2_400, rate: 0.014 }, { limit: 4_800, rate: 0.032 }, { limit: 9_600, rate: 0.055 }, { limit: 14_400, rate: 0.064 }, { limit: 19_200, rate: 0.068 }, { limit: 24_000, rate: 0.072 }, { limit: 36_000, rate: 0.076 }, { limit: 48_000, rate: 0.079 }, { limit: 150_000, rate: 0.0825 }, { limit: 175_000, rate: 0.09 }, { limit: 200_000, rate: 0.10 }, { limit: Infinity, rate: 0.11 }]), stdSingle: 2_200, stdJoint: 4_400 },
  ID: { name: 'Idaho', single: FLAT(0.058), joint: FLAT(0.058), stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  IL: { name: 'Illinois', single: FLAT(0.0495), joint: FLAT(0.0495), stdSingle: 2_775, stdJoint: 5_550 },
  IN: { name: 'Indiana', single: FLAT(0.0305), joint: FLAT(0.0305), stdSingle: 1_000, stdJoint: 2_000 },
  IA: { name: 'Iowa', single: FLAT(0.038), joint: FLAT(0.038), stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  KS: { name: 'Kansas', single: [{ limit: 23_000, rate: 0.052 }, { limit: Infinity, rate: 0.0558 }], joint: [{ limit: 46_000, rate: 0.052 }, { limit: Infinity, rate: 0.0558 }], stdSingle: 3_605, stdJoint: 8_240 },
  KY: { name: 'Kentucky', single: FLAT(0.04), joint: FLAT(0.04), stdSingle: 3_160, stdJoint: 6_320 },
  LA: { name: 'Louisiana', single: FLAT(0.03), joint: FLAT(0.03), stdSingle: 12_500, stdJoint: 25_000 },
  ME: { name: 'Maine', single: [{ limit: 26_050, rate: 0.058 }, { limit: 61_600, rate: 0.0675 }, { limit: Infinity, rate: 0.0715 }], joint: [{ limit: 52_100, rate: 0.058 }, { limit: 123_250, rate: 0.0675 }, { limit: Infinity, rate: 0.0715 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  MD: { name: 'Maryland', single: [{ limit: 1_000, rate: 0.02 }, { limit: 2_000, rate: 0.03 }, { limit: 3_000, rate: 0.04 }, { limit: 100_000, rate: 0.0475 }, { limit: 125_000, rate: 0.05 }, { limit: 150_000, rate: 0.0525 }, { limit: 250_000, rate: 0.055 }, { limit: Infinity, rate: 0.0575 }], joint: [{ limit: 1_000, rate: 0.02 }, { limit: 2_000, rate: 0.03 }, { limit: 3_000, rate: 0.04 }, { limit: 150_000, rate: 0.0475 }, { limit: 175_000, rate: 0.05 }, { limit: 225_000, rate: 0.0525 }, { limit: 300_000, rate: 0.055 }, { limit: Infinity, rate: 0.0575 }], stdSingle: 2_550, stdJoint: 5_150, localFlat: 0.0275 },
  MA: { name: 'Massachusetts', single: FLAT(0.05), joint: FLAT(0.05), stdSingle: 4_400, stdJoint: 8_800, surtaxOver: 1_000_000, surtaxRate: 0.04 },
  MI: { name: 'Michigan', single: FLAT(0.0425), joint: FLAT(0.0425), stdSingle: 5_600, stdJoint: 11_200 },
  MN: { name: 'Minnesota', single: [{ limit: 31_690, rate: 0.0535 }, { limit: 104_090, rate: 0.068 }, { limit: 193_240, rate: 0.0785 }, { limit: Infinity, rate: 0.0985 }], joint: [{ limit: 46_330, rate: 0.0535 }, { limit: 184_040, rate: 0.068 }, { limit: 321_450, rate: 0.0785 }, { limit: Infinity, rate: 0.0985 }], stdSingle: 14_575, stdJoint: 29_150 },
  MS: { name: 'Mississippi', single: [{ limit: 10_000, rate: 0 }, { limit: Infinity, rate: 0.047 }], joint: [{ limit: 10_000, rate: 0 }, { limit: Infinity, rate: 0.047 }], stdSingle: 2_300, stdJoint: 4_600 },
  MO: { name: 'Missouri', single: [{ limit: 1_300, rate: 0 }, { limit: 2_600, rate: 0.02 }, { limit: 3_900, rate: 0.025 }, { limit: 5_200, rate: 0.03 }, { limit: 6_500, rate: 0.035 }, { limit: 7_800, rate: 0.04 }, { limit: 9_100, rate: 0.045 }, { limit: Infinity, rate: 0.048 }], joint: [{ limit: 1_300, rate: 0 }, { limit: 2_600, rate: 0.02 }, { limit: 3_900, rate: 0.025 }, { limit: 5_200, rate: 0.03 }, { limit: 6_500, rate: 0.035 }, { limit: 7_800, rate: 0.04 }, { limit: 9_100, rate: 0.045 }, { limit: Infinity, rate: 0.048 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  MT: { name: 'Montana', single: [{ limit: 20_500, rate: 0.047 }, { limit: Infinity, rate: 0.059 }], joint: [{ limit: 41_000, rate: 0.047 }, { limit: Infinity, rate: 0.059 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  NE: { name: 'Nebraska', single: [{ limit: 3_700, rate: 0.0246 }, { limit: 22_170, rate: 0.0351 }, { limit: 35_730, rate: 0.0501 }, { limit: Infinity, rate: 0.0584 }], joint: [{ limit: 7_390, rate: 0.0246 }, { limit: 44_350, rate: 0.0351 }, { limit: 71_460, rate: 0.0501 }, { limit: Infinity, rate: 0.0584 }], stdSingle: 7_900, stdJoint: 15_800 },
  NJ: { name: 'New Jersey', single: [{ limit: 20_000, rate: 0.014 }, { limit: 35_000, rate: 0.0175 }, { limit: 40_000, rate: 0.035 }, { limit: 75_000, rate: 0.05525 }, { limit: 500_000, rate: 0.0637 }, { limit: 1_000_000, rate: 0.0897 }, { limit: Infinity, rate: 0.1075 }], joint: [{ limit: 20_000, rate: 0.014 }, { limit: 50_000, rate: 0.0175 }, { limit: 70_000, rate: 0.0245 }, { limit: 80_000, rate: 0.035 }, { limit: 150_000, rate: 0.05525 }, { limit: 500_000, rate: 0.0637 }, { limit: 1_000_000, rate: 0.0897 }, { limit: Infinity, rate: 0.1075 }], stdSingle: 0, stdJoint: 0 },
  NM: { name: 'New Mexico', single: [{ limit: 5_500, rate: 0.017 }, { limit: 11_000, rate: 0.032 }, { limit: 16_000, rate: 0.047 }, { limit: 210_000, rate: 0.049 }, { limit: Infinity, rate: 0.059 }], joint: [{ limit: 8_000, rate: 0.017 }, { limit: 16_000, rate: 0.032 }, { limit: 24_000, rate: 0.047 }, { limit: 315_000, rate: 0.049 }, { limit: Infinity, rate: 0.059 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  NC: { name: 'North Carolina', single: FLAT(0.0425), joint: FLAT(0.0425), stdSingle: 12_750, stdJoint: 25_500 },
  ND: { name: 'North Dakota', single: [{ limit: 44_725, rate: 0 }, { limit: 225_975, rate: 0.0195 }, { limit: Infinity, rate: 0.025 }], joint: [{ limit: 74_750, rate: 0 }, { limit: 275_100, rate: 0.0195 }, { limit: Infinity, rate: 0.025 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  OH: { name: 'Ohio', single: [{ limit: 26_050, rate: 0 }, { limit: 100_000, rate: 0.0275 }, { limit: Infinity, rate: 0.035 }], joint: [{ limit: 26_050, rate: 0 }, { limit: 100_000, rate: 0.0275 }, { limit: Infinity, rate: 0.035 }], stdSingle: 0, stdJoint: 0 },
  OK: { name: 'Oklahoma', single: [{ limit: 1_000, rate: 0.0025 }, { limit: 2_500, rate: 0.0075 }, { limit: 3_750, rate: 0.0175 }, { limit: 4_900, rate: 0.0275 }, { limit: 7_200, rate: 0.0375 }, { limit: Infinity, rate: 0.0475 }], joint: [{ limit: 2_000, rate: 0.0025 }, { limit: 5_000, rate: 0.0075 }, { limit: 7_500, rate: 0.0175 }, { limit: 9_800, rate: 0.0275 }, { limit: 12_200, rate: 0.0375 }, { limit: Infinity, rate: 0.0475 }], stdSingle: 6_350, stdJoint: 12_700 },
  OR: { name: 'Oregon', single: [{ limit: 4_300, rate: 0.0475 }, { limit: 10_750, rate: 0.0675 }, { limit: 125_000, rate: 0.0875 }, { limit: Infinity, rate: 0.099 }], joint: [{ limit: 8_600, rate: 0.0475 }, { limit: 21_500, rate: 0.0675 }, { limit: 250_000, rate: 0.0875 }, { limit: Infinity, rate: 0.099 }], stdSingle: 2_745, stdJoint: 5_495 },
  PA: { name: 'Pennsylvania', single: FLAT(0.0307), joint: FLAT(0.0307), stdSingle: 0, stdJoint: 0 },
  RI: { name: 'Rhode Island', single: [{ limit: 73_450, rate: 0.0375 }, { limit: 166_950, rate: 0.0475 }, { limit: Infinity, rate: 0.0599 }], joint: [{ limit: 73_450, rate: 0.0375 }, { limit: 166_950, rate: 0.0475 }, { limit: Infinity, rate: 0.0599 }], stdSingle: 10_550, stdJoint: 21_150 },
  SC: { name: 'South Carolina', single: [{ limit: 3_460, rate: 0 }, { limit: 17_330, rate: 0.03 }, { limit: Infinity, rate: 0.064 }], joint: [{ limit: 3_460, rate: 0 }, { limit: 17_330, rate: 0.03 }, { limit: Infinity, rate: 0.064 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  UT: { name: 'Utah', single: FLAT(0.0455), joint: FLAT(0.0455), stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  VT: { name: 'Vermont', single: [{ limit: 45_400, rate: 0.0335 }, { limit: 110_050, rate: 0.066 }, { limit: 229_550, rate: 0.076 }, { limit: Infinity, rate: 0.0875 }], joint: [{ limit: 75_850, rate: 0.0335 }, { limit: 183_400, rate: 0.066 }, { limit: 279_450, rate: 0.076 }, { limit: Infinity, rate: 0.0875 }], stdSingle: FED_STD_S, stdJoint: FED_STD_J },
  VA: { name: 'Virginia', single: [{ limit: 3_000, rate: 0.02 }, { limit: 5_000, rate: 0.03 }, { limit: 17_000, rate: 0.05 }, { limit: Infinity, rate: 0.0575 }], joint: [{ limit: 3_000, rate: 0.02 }, { limit: 5_000, rate: 0.03 }, { limit: 17_000, rate: 0.05 }, { limit: Infinity, rate: 0.0575 }], stdSingle: 8_500, stdJoint: 17_000 },
  WV: { name: 'West Virginia', single: [{ limit: 10_000, rate: 0.0236 }, { limit: 25_000, rate: 0.0315 }, { limit: 40_000, rate: 0.0354 }, { limit: 60_000, rate: 0.0472 }, { limit: Infinity, rate: 0.0512 }], joint: [{ limit: 10_000, rate: 0.0236 }, { limit: 25_000, rate: 0.0315 }, { limit: 40_000, rate: 0.0354 }, { limit: 60_000, rate: 0.0472 }, { limit: Infinity, rate: 0.0512 }], stdSingle: 0, stdJoint: 0 },
  WI: { name: 'Wisconsin', single: [{ limit: 14_320, rate: 0.035 }, { limit: 28_640, rate: 0.044 }, { limit: 315_310, rate: 0.053 }, { limit: Infinity, rate: 0.0765 }], joint: [{ limit: 19_090, rate: 0.035 }, { limit: 38_190, rate: 0.044 }, { limit: 420_420, rate: 0.053 }, { limit: Infinity, rate: 0.0765 }], stdSingle: 12_760, stdJoint: 23_620 },
};

function applyBrackets(amount: number, brackets: StateBracket[]): number {
  let tax = 0, prev = 0;
  for (const b of brackets) {
    if (amount <= prev) break;
    const taxable = Math.min(amount, b.limit) - prev;
    tax += taxable * b.rate;
    prev = b.limit;
  }
  return tax;
}

/**
 * State income tax for the given taxable base (ordinary income + capital gains,
 * which states tax as ordinary). `base` is pre-state-deduction. CA and NY are
 * handled by the federal engine's dedicated paths and aren't computed here.
 */
export function calculateStateTax(
  state: StateCode,
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_household',
  base: number,
): number {
  const spec = STATE_TAX[state];
  if (!spec) return 0; // no-tax states, CA/NY (handled elsewhere), or NONE
  const joint = filingStatus === 'married_joint';
  const brackets = joint ? spec.joint : spec.single;
  const std = joint ? spec.stdJoint : spec.stdSingle;
  const taxable = Math.max(0, base - std);

  let tax = applyBrackets(taxable, brackets);
  if (spec.localFlat) tax += taxable * spec.localFlat;
  if (spec.surtaxOver && spec.surtaxRate && taxable > spec.surtaxOver) {
    tax += (taxable - spec.surtaxOver) * spec.surtaxRate;
  }
  return tax;
}
