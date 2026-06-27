"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Answers } from "@/lib/partnerAlignment";

/**
 * Partner alignment answers — "you" and "partner" expectation sets. Persisted
 * locally so the conversation sticks around; the partner's side can also arrive
 * via a shared link (see PartnerAlignment).
 */
export const usePartnerStore = create<{
  you: Answers;
  partner: Answers;
  setYou: (id: string, v: string | number) => void;
  setPartner: (id: string, v: string | number) => void;
  loadPartner: (a: Answers) => void;
  clear: () => void;
}>()(
  persist(
    (set) => ({
      you: {},
      partner: {},
      setYou: (id, v) => set((s) => ({ you: { ...s.you, [id]: v } })),
      setPartner: (id, v) => set((s) => ({ partner: { ...s.partner, [id]: v } })),
      loadPartner: (a) => set({ partner: a }),
      clear: () => set({ you: {}, partner: {} }),
    }),
    { name: "horizon-partner", storage: createJSONStorage(() => localStorage) },
  ),
);
