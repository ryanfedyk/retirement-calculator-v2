// Timezone-aware scheduling for the weekday-morning send. The cron fires hourly
// on weekdays (UTC); this decides, per user, whether it's their morning in their
// own zone and the brief hasn't already gone out today.

/** User-controlled preferences (edited in Settings, synced from the client). */
export interface DigestPrefs {
  optIn: boolean;
  hour?: number;          // local hour-of-day to send (0–23), default 7
  tz?: string;            // IANA zone, e.g. "America/New_York"
  email?: string;         // recipient; falls back to the account's auth email
}

/** Server-managed send state — written ONLY by the send route (a separate field
 *  from DigestPrefs so client saves never clobber it). */
export interface DigestState {
  lastSentYmd?: string;   // local calendar day of the last send, "YYYY-MM-DD"
  lastMetrics?: { mcSuccess?: number | null; investable?: number | null; fiYear?: number | null };
}

export function localParts(now: Date, tz: string): { ymd: string; hour: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value])) as Record<string, string>;
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parseInt(parts.hour, 10) % 24; // some zones format midnight as "24"
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { ymd, hour, weekday: wd[parts.weekday] ?? 0 };
}

/** Is this user due for a brief right now? Sends once per local weekday at or
 *  after their target hour (so a delayed cron run still catches the morning). */
export function isDue(prefs: DigestPrefs | undefined | null, state: DigestState | undefined | null, now: Date): { due: boolean; ymd: string } {
  if (!prefs?.optIn) return { due: false, ymd: "" };
  const tz = prefs.tz || "America/New_York";
  const { ymd, hour, weekday } = localParts(now, tz);
  const targetHour = typeof prefs.hour === "number" ? prefs.hour : 7;
  const isWeekday = weekday >= 1 && weekday <= 5;
  const due = isWeekday && hour >= targetHour && state?.lastSentYmd !== ymd;
  return { due, ymd };
}
