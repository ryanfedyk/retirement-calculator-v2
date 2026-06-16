"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { buildSeasons, seasonsSignature, currentSeasonIndex, type Season } from "@/lib/seasons";

export type SeasonSource = "building" | "gemini" | "fallback";

/**
 * Returns the macro-seasons derived from the live retirement model.
 * - Year ranges/structure are built deterministically (always correct).
 * - Names/taglines/actions are enriched by Gemini when a key is configured,
 *   re-fetched only when the timeline shape changes.
 */
export function useMacroSeasons() {
  const config = useFinancialStore(s => s.config);

  const baseSeasons = useMemo(() => buildSeasons(config), [config]);
  const signature   = useMemo(() => seasonsSignature(config), [config]);

  const [seasons, setSeasons] = useState<Season[]>(baseSeasons);
  const [source,  setSource]  = useState<SeasonSource>("building");
  const cache = useRef<Map<string, Season[]>>(new Map());

  useEffect(() => {
    // Always start from the freshly-built structure (keeps year ranges correct).
    const cached = cache.current.get(signature);
    if (cached) { setSeasons(cached); setSource("gemini"); return; }

    setSeasons(baseSeasons);
    setSource("building");

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seasons: baseSeasons }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.source === "gemini" && Array.isArray(data.seasons)) {
          cache.current.set(signature, data.seasons);
          setSeasons(data.seasons);
          setSource("gemini");
        } else {
          setSeasons(baseSeasons);
          setSource("fallback");
        }
      } catch {
        if (!cancelled) { setSeasons(baseSeasons); setSource("fallback"); }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const currentIndex = currentSeasonIndex(seasons);
  return { seasons, currentIndex, source };
}
