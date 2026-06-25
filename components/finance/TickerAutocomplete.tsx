"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { C } from "@/config/colors";

export interface TickerResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

const DEFAULT_INPUT: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`,
  borderRadius: 5, padding: "5px 8px", fontSize: 12, color: C.ink,
  background: C.bg, outline: "none",
};

/**
 * Ticker input with live symbol autocomplete. As the user types, it queries
 * /api/search and shows a dropdown of matching stocks/ETFs/funds to pick from.
 * Reused by both the desktop and mobile "Add Holding" forms — pass `inputStyle`
 * to match the surrounding form's look.
 */
export default function TickerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Ticker",
  inputStyle,
  autoFocus,
}: {
  value: string;
  onChange: (symbol: string) => void;
  /** Fires when the user picks a suggestion — gives you the company name too. */
  onSelect?: (result: TickerResult) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  autoFocus?: boolean;
}) {
  const [results, setResults]     = useState<TickerResult[]>([]);
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // The suggestion list renders through a portal with fixed positioning so it's
  // never clipped by a scrolling/`overflow:hidden` ancestor (e.g. the scenario
  // sidebar's accordion cards). These track where to anchor it.
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);
  // Suppress the search that would otherwise fire right after a pick (the value
  // change from selecting shouldn't reopen the menu).
  const skipNext = useRef(false);
  // Only auto-open the suggestions while the input is actually focused — so a
  // pre-filled value (e.g. an existing ticker when its card mounts) never pops
  // the dropdown open on its own.
  const focused = useRef(false);

  // Debounced search on the typed value.
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.trim();
    if (!q) { setResults([]); setOpen(false); return; }

    let active = true;
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results?: TickerResult[] };
        if (!active) return;
        setResults(data.results ?? []);
        setHighlight(-1);
        setOpen(focused.current && (data.results ?? []).length > 0);
      } catch {
        if (active) { setResults([]); setOpen(false); }
      }
    }, 200);

    return () => { active = false; clearTimeout(t); };
  }, [value]);

  // Close when clicking outside (either the input wrapper or the portaled menu).
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Anchor the portaled menu under the input, and keep it there while the page
  // (or the sidebar) scrolls or the window resizes.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, results.length]);

  const pick = useCallback((r: TickerResult) => {
    skipNext.current = true;
    onChange(r.symbol);
    onSelect?.(r);
    setOpen(false);
    setResults([]);
    setHighlight(-1);
  }, [onChange, onSelect]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown")      { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); pick(results[highlight]); }
    else if (e.key === "Escape")    { setOpen(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        onChange={e => onChange(e.target.value.toUpperCase())}
        onFocus={() => { focused.current = true; if (results.length > 0) setOpen(true); }}
        onBlur={() => { focused.current = false; }}
        onKeyDown={onKeyDown}
        style={inputStyle ?? DEFAULT_INPUT}
      />
      {open && results.length > 0 && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 1000,
            background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8,
            boxShadow: "0 8px 24px rgba(26,46,37,0.14)", overflow: "hidden", maxHeight: 240, overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={`${r.symbol}-${i}`}
              type="button"
              // mousedown (not click) so it fires before the input's blur.
              onMouseDown={e => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: "flex", alignItems: "baseline", gap: 8, width: "100%", textAlign: "left",
                padding: "7px 10px", border: "none", cursor: "pointer",
                background: i === highlight ? C.tealWash : "transparent",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{r.symbol}</span>
              <span style={{ fontSize: 11, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{r.name}</span>
              {r.exchange && <span style={{ fontSize: 9, color: C.inkFaint, flexShrink: 0 }}>{r.exchange}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
