export type SeedType = 'note' | 'direction' | 'source' | 'workspace' | 'reference' | 'format' | 'assumption' | 'edits';
export type SeedStatus = 'on' | 'muted' | 'must';
export type Format = 'doc' | 'deck';
export type FormatChoice = 'auto' | Format;

export interface Palette { bg: string; accent: string; accent2: string; dark: boolean }

export interface Seed {
  id: string;
  type: SeedType;
  x: number;
  y: number;
  w?: number;
  status: SeedStatus;
  text?: string;
  /** The opening "page" note shown large on a fresh canvas. */
  pg?: boolean;
  /** The user picked the tag by hand, so auto-tagging leaves it alone. */
  lockType?: boolean;
  role?: 'title';
  // sources and workspace items
  srcId?: string;
  title?: string;
  app?: string;
  kind?: string;
  meta?: string;
  placeholder?: boolean;
  // reference images
  imgId?: string;
  palette?: Palette;
  name?: string;
  generated?: boolean;
  prompt?: string;
  /** A note dragged back from the draft ("more like this"); holds the part's label. */
  fromDraft?: string;
}

/** A part of the draft held in place: pinned by the user, or edited in the draft. */
export interface Frozen {
  html: string;
  text: string;
  seeds: string[];
  /** Fingerprint of the seeds behind this part when it was frozen; a change means a possible conflict. */
  seedSig: string;
  label: string;
  format: Format;
  idx: number;
}

export interface CanvasState {
  id: string;
  created: number;
  format: FormatChoice;
  variant: number;
  scenario: number;
  seeds: Seed[];
  pruned: string[];
  pins: Record<string, Frozen>;
  edits: Record<string, Frozen>;
  /** Conflicts the user dismissed with "Keep mine", by part key -> seed fingerprint at the time. */
  acks: Record<string, string>;
  /** AI-written text for each part, by input signature. Unchanged inputs never regenerate. */
  ai: Record<string, string>;
  view: 'board' | 'list';
  pan: { x: number; y: number };
  zoom: number;
  draftMode: 'normal' | 'min' | 'max';
  draftW: number;
}

/** The parts of a canvas that history snapshots (view state like pan and zoom is not undoable). */
export type Snapshot = Pick<CanvasState, 'format' | 'variant' | 'scenario' | 'seeds' | 'pruned' | 'pins' | 'edits' | 'acks'>;

export interface HistoryEntry { id: number; parent: number; label: string; t: number; snap: string }
export interface History { entries: HistoryEntry[]; cur: number; nextId: number }

export interface CorpusItem { id: string; kind: string; app: string; title: string; meta: string; text: string }
export interface RecipeSeed extends Partial<Seed> { type: SeedType }
export interface Recipe { id: string; title: string; why: string; apps: string[]; format: Format; seeds: RecipeSeed[] }
