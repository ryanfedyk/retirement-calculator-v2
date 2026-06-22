"use client";
/**
 * SelectOnFocus — when a text/number field that already has a value receives
 * focus, select its contents so the user can type over it immediately instead
 * of backspacing. Mounted once at the app root; applies everywhere.
 *
 * The select() is deferred to the next frame so it survives the caret placement
 * the browser performs on a mouse click / tap.
 */
import { useEffect } from "react";

const SELECTABLE = new Set(["text", "number", "tel", "search", "email", "url"]);

export default function SelectOnFocus() {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && SELECTABLE.has(t.type) && t.value !== "") {
        requestAnimationFrame(() => { try { t.select(); } catch { /* ignore */ } });
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  return null;
}
