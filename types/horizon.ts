export interface MonthCell {
  year: number;
  month: number; // 0-indexed
  label: string;
  status: "past" | "current" | "future";
  phaseId: number;
  childMilestones: ChildMilestone[];
}

export interface ChildMilestone {
  childName: string;
  age: number;
  note: string;
}

export interface AdventureBlueprint {
  id: string;
  concept: string;
  category: AdventureCategory;
  commitment: CommitmentLevel;
  whenToStart: WhenToStart;
  depthScore: 1 | 2 | 3;
  whyFactor: string;
  microDoseAction: string;
  tags: string[];
  pinnedNote?: string;
}

export type AdventureCategory =
  | "Immersive Travel"
  | "Creative Mastery"
  | "Endurance/Active"
  | "Slow Living";

export type CommitmentLevel = "Micro-Prototype" | "Macro-Adventure";
export type WhenToStart = "Now" | "Phase 2+" | "Post-Retirement";

export interface LifeEvent {
  childName: string;
  label: string;
  shortLabel: string;
  icon: string;
  year: number;
  month: number; // 0-indexed
  age: number;
  note: string;
  monthsAway: number;
}

export interface ReclaimedTimeEntry {
  phase: number;
  hoursPerWeekTarget: number;
  weeksSaved: number;
  totalHoursSaved: number;
}

export interface UserConfig {
  retirementDate: string;
  corporateStartDate: string;
  childrenBirthDates: { name: string; birthDate: string }[];
  avgHoursPerWeek: number;
  corporateTheaterHours: number;
  savedBlueprints: AdventureBlueprint[];
}
