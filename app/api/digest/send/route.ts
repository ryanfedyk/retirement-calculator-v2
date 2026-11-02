import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminDb, adminAuth } from "@/lib/server/firebaseAdmin";
import { emailConfigured, sendDigestEmail } from "@/lib/server/email";
import { fetchQuotes } from "@/lib/quotes";
import { buildDigest } from "@/lib/digest/buildDigest";
import { renderDigestHtml, renderDigestText } from "@/lib/digest/renderEmail";
import { selectPrimaryPlan, type StoredPlanDoc } from "@/lib/digest/selectPrimaryPlan";
import { isDue, localParts, type DigestPrefs, type DigestState } from "@/lib/digest/schedule";
import { writeEditorial } from "@/lib/digest/editorial";

export const runtime = "nodejs";
export const maxDuration = 120;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retirement-calc-v2--retirement-calc-v2.us-east4.hosted.app";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("key") || "";
  const a = Buffer.from(provided), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST (cron): send the weekday brief to every opted-in user who's due in their
// own timezone. ?force=1 bypasses the schedule (for testing); ?uid=<uid> limits
// to one user. Protected by CRON_SECRET (Authorization: Bearer … or ?key=…).
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ error: "email not configured (GMAIL_USER / GMAIL_APP_PASSWORD)" }, { status: 503 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const onlyUid = url.searchParams.get("uid");
  const now = new Date();

  let db;
  try { db = adminDb(); } catch (e) {
    return NextResponse.json({ error: "admin not configured", detail: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }

  // Candidate users: a single uid, or everyone opted in.
  type UserDoc = StoredPlanDoc & { digestPrefs?: DigestPrefs; digestState?: DigestState };
  const docs: { id: string; data: () => UserDoc }[] = [];
  try {
    if (onlyUid) {
      const d = await db.collection("users").doc(onlyUid).get();
      if (d.exists) docs.push({ id: d.id, data: () => d.data() as UserDoc });
    } else {
      const snap = await db.collection("users").where("digestPrefs.optIn", "==", true).get();
      for (const d of snap.docs) docs.push({ id: d.id, data: () => d.data() as UserDoc });
    }
  } catch (e) {
    return NextResponse.json({ error: "query failed", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const results: { uid: string; status: string; detail?: string }[] = [];

  for (const doc of docs) {
    const data = doc.data();
    const prefs = data.digestPrefs;
    const sendState = data.digestState;
    const tz = prefs?.tz || "America/New_York";
    const { due, ymd: dueYmd } = isDue(prefs, sendState, now);
    const ymd = dueYmd || localParts(now, tz).ymd;
    if (!force && !due) { results.push({ uid: doc.id, status: "skipped (not due)" }); continue; }

    try {
      const plan = selectPrimaryPlan(data);
      if (!plan) { results.push({ uid: doc.id, status: "skipped (no plan)" }); continue; }
      const { config, snapshot } = plan;

      const concSym = config.use_equity_comp ? (config.concentrated_symbol ?? "").toUpperCase() : "";
      const symbols = [concSym, ...(snapshot.other_investments ?? []).map((i) => (i.symbol ?? "").toUpperCase())].filter(Boolean);
      const quotes = await fetchQuotes(symbols);
      const live = concSym ? quotes[concSym]?.price ?? 0 : 0;

      // Recipient + greeting name from the account's auth record (falling back to prefs).
      let email = prefs?.email || "";
      let displayName: string | null = null;
      try { const u = await adminAuth().getUser(doc.id); email = email || u.email || ""; displayName = u.displayName ?? null; } catch { /* no auth user */ }
      if (!email) { results.push({ uid: doc.id, status: "skipped (no recipient email)" }); continue; }

      const digest = buildDigest({
        profile: { displayName }, config, snapshot, quotes,
        liveConcentratedPrice: live, now, previous: sendState?.lastMetrics,
      });
      // Gemini writes the lede; keep the deterministic one if it's unavailable.
      const ai = await writeEditorial(digest);
      if (ai) digest.editorial = ai;

      const html = renderDigestHtml(digest, { appUrl: APP_URL });
      const text = renderDigestText(digest);
      await sendDigestEmail({ to: email, subject: `The Morning Glide — ${digest.dateLabel}`, html, text });

      // Write ONLY the server-managed send state (a separate field from the
      // user-edited digestPrefs, so a client save never clobbers it).
      await db.collection("users").doc(doc.id).set(
        { digestState: { lastSentYmd: ymd, lastMetrics: digest.metrics } },
        { merge: true },
      );
      results.push({ uid: doc.id, status: "sent" });
    } catch (e) {
      results.push({ uid: doc.id, status: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({ ok: true, now: now.toISOString(), candidates: docs.length, sent, results });
}
