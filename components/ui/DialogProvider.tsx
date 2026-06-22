"use client";
/**
 * In-app confirm / prompt dialogs — replaces the browser's window.confirm and
 * window.prompt with styled, promise-based modals so every dialog feels part of
 * the app. Use via useConfirm() / usePrompt().
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { C } from "@/config/colors";

interface ConfirmOpts { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
interface PromptOpts { title: string; message?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string }

interface DialogValue {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
}

const DialogContext = createContext<DialogValue | null>(null);

type State =
  | { kind: "confirm"; opts: ConfirmOpts }
  | { kind: "prompt"; opts: PromptOpts; value: string }
  | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const close = (result: unknown) => { resolver.current?.(result); resolver.current = null; setState(null); };

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => {
    resolver.current = resolve as (v: unknown) => void;
    setState({ kind: "confirm", opts });
  }), []);

  const prompt = useCallback((opts: PromptOpts) => new Promise<string | null>((resolve) => {
    resolver.current = resolve as (v: unknown) => void;
    setState({ kind: "prompt", opts, value: opts.defaultValue ?? "" });
  }), []);

  const isPrompt = state?.kind === "prompt";
  const opts = state?.opts;
  const danger = state?.kind === "confirm" && state.opts.danger;
  const accent = danger ? C.warm : C.teal;

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {state && (
        <div
          onMouseDown={() => close(isPrompt ? null : false)}
          style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(20,30,26,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "dlgFade 0.15s ease" }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true"
            style={{ width: "100%", maxWidth: 380, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: "0 16px 48px rgba(0,0,0,0.25)", animation: "dlgPop 0.18s ease" }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{opts?.title}</div>
            {opts?.message && <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-line" }}>{opts.message}</div>}

            {isPrompt && (
              <input
                autoFocus
                value={state.value}
                placeholder={state.opts.placeholder}
                onChange={(e) => setState({ ...state, value: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") close(state.value.trim() || null); if (e.key === "Escape") close(null); }}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 9, padding: "11px 13px", fontSize: 14, color: C.ink, background: C.bg, outline: "none" }}
              />
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => close(isPrompt ? null : false)}
                style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {state.kind === "confirm" ? (state.opts.cancelLabel ?? "Cancel") : "Cancel"}
              </button>
              <button
                onClick={() => close(isPrompt ? (state.value.trim() || null) : true)}
                style={{ background: accent, color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {state.kind === "confirm" ? (state.opts.confirmLabel ?? "Confirm") : (state.opts.confirmLabel ?? "Save")}
              </button>
            </div>
          </div>
          <style>{`@keyframes dlgFade{from{opacity:0}to{opacity:1}}@keyframes dlgPop{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}`}</style>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function useDialog(): DialogValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
export const useConfirm = () => useDialog().confirm;
export const usePrompt = () => useDialog().prompt;
