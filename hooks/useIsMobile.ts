"use client";
import { useEffect, useState } from "react";

/**
 * Returns true on small/touch viewports. SSR-safe (returns false until mounted
 * to avoid hydration mismatch), then resolves on the client.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
