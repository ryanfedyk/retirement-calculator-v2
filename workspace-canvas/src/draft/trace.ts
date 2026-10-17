import { create } from 'zustand';
/** Hover links between canvas cards and the draft parts they shaped. */
export const useTrace = create<{ card: string | null; block: { key: string; seeds: string[]; el: HTMLElement | null } | null }>(() => ({ card: null, block: null }));
export const traceCard = (card: string | null) => useTrace.setState({ card });
export const traceBlock = (block: { key: string; seeds: string[]; el: HTMLElement | null } | null) => useTrace.setState({ block });
