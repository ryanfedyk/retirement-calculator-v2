"use client";
import { useEffect, useRef } from "react";

interface Layer {
  /** Whether this surface is currently open. */
  open: boolean;
  /** Close this surface. */
  close: () => void;
}

/**
 * Make the browser Back button step back through the app's in-memory navigation
 * instead of leaving the site. The app navigates by state (hub ↔ scenario, plus
 * the Finances / Settings overlays) rather than URLs, so without this Back would
 * unload the page.
 *
 * Each open surface is mirrored as a history entry; pressing Back pops the
 * top-most open surface. Closing a surface from within the app (a button, Esc,
 * the breadcrumb) pops its matching entry so the history stack stays balanced.
 *
 * `layers` must be ordered top-most first — the surface Back should close first.
 */
export function useBrowserBackNav({ enabled, layers }: { enabled: boolean; layers: Layer[] }) {
  // Latest layers for the popstate handler (which is registered once).
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const depth = layers.filter((l) => l.open).length;
  const prevDepth = useRef(0);
  const selfPop = useRef(false); // we triggered history.back() ourselves
  const fromPop = useRef(false); // the in-flight close originated from a Back press

  // Back pressed → close the top-most open surface.
  useEffect(() => {
    if (!enabled) return;
    const onPop = () => {
      if (selfPop.current) { selfPop.current = false; return; } // our own back(): ignore
      const top = layersRef.current.find((l) => l.open);
      if (top) { fromPop.current = true; top.close(); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);

  // Keep the history stack in sync with how many surfaces are open.
  useEffect(() => {
    if (!enabled) { prevDepth.current = depth; return; }
    if (depth > prevDepth.current) {
      // A surface opened — add a history entry so Back has something to pop.
      window.history.pushState({ taperNav: depth }, "");
    } else if (depth < prevDepth.current) {
      // A surface closed. If Back caused it, the entry is already gone; otherwise
      // we closed it in-app, so pop our matching entry (guarded so popstate noops).
      if (fromPop.current) fromPop.current = false;
      else { selfPop.current = true; window.history.back(); }
    }
    prevDepth.current = depth;
  }, [depth, enabled]);
}
