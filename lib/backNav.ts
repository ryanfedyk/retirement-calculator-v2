"use client";
import { useEffect } from "react";

/**
 * A single, app-wide "browser Back" stack. The app navigates by state (overlays,
 * sheets, the Reclaim tool subpage, tabs) rather than URLs, so without this the
 * device/browser Back button would leave the site. Any component — a shell, an
 * overlay, a deep child — registers a *layer* via `useBackLayer`; pressing Back
 * closes the top-most open layer (highest `order`), and closing a layer in-app
 * keeps the history stack balanced. One controller, one popstate listener, so
 * registrations from anywhere in the tree compose without fighting each other.
 */
type Layer = { order: number; open: boolean; close: () => void };
const layers = new Map<string, Layer>();

let prevDepth = 0;
let pendingSelfPops = 0; // history.back() calls we made ourselves — ignore that many popstates
let fromPop = false;     // the in-flight close came from a Back press (entry already gone)
let installed = false;

const depth = () => {
  let d = 0;
  for (const l of layers.values()) if (l.open) d++;
  return d;
};

const topOpen = (): Layer | undefined => {
  let top: Layer | undefined;
  for (const l of layers.values()) if (l.open && (!top || l.order > top.order)) top = l;
  return top;
};

function onPop() {
  if (pendingSelfPops > 0) { pendingSelfPops--; return; } // our own back(): ignore
  const t = topOpen();
  if (t) { fromPop = true; t.close(); }
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", onPop);
}

// Keep the history stack in sync with how many layers are open. Called after any
// layer registers, changes, or unregisters. Per-effect granularity means each
// call sees a ±1 delta in practice; multiple single-step closes in quick
// succession each queue their own back() (counted by `pendingSelfPops`).
function sync() {
  if (typeof window === "undefined") return;
  const d = depth();
  if (d > prevDepth) {
    for (let i = prevDepth; i < d; i++) window.history.pushState({ taperNav: i + 1 }, "");
  } else if (d < prevDepth) {
    if (fromPop) fromPop = false;                       // Back caused it — the entry is already gone
    else { pendingSelfPops++; window.history.back(); }  // closed in-app — pop our matching entry
  }
  prevDepth = d;
}

/**
 * Register one Back layer. `open` mirrors whether the surface is showing; `close`
 * dismisses it. `order` sets nesting — a higher order closes before a lower one
 * (innermost overlays high, tabs/destinations low). Safe to call unconditionally
 * with a stable `key`; a layer that is never `open` simply never contributes.
 */
export function useBackLayer(key: string, order: number, open: boolean, close: () => void) {
  useEffect(() => {
    install();
    layers.set(key, { order, open, close });
    sync();
    return () => { layers.delete(key); sync(); };
    // `close` is intentionally excluded — re-running on its identity would churn
    // the history stack every render. The Map always holds the latest `close`
    // for the current `open` state, which is what the popstate handler reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, order, open]);
}
