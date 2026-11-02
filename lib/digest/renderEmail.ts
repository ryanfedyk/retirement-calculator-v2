// Renders a Digest to an email-safe HTML document (inline styles, 600px, system
// fonts — no external CSS/JS, so it survives Gmail/Outlook) and a plain-text
// fallback. Pure string building; no DOM.

import { usd, type Digest } from "@/lib/digest/buildDigest";

const INK = "#1f2a27", MUTED = "#5c6b66", LINE = "#e3e9e6";
const TEAL = "#2a7a68", TEAL_DK = "#1e4a3e", WASH = "#f3f7f5";
const UP = "#2a7a68", DOWN = "#c0492b";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (f: number) => `${f >= 0 ? "+" : "−"}${(Math.abs(f) * 100).toFixed(1)}%`;

function moveLine(d: Digest): { text: string; color: string } {
  const { dayChange, dayChangePct } = d.portfolio;
  if (dayChange == null || dayChangePct == null) return { text: "Market move unavailable today", color: MUTED };
  const up = dayChange >= 0;
  return { text: `${up ? "▲" : "▼"} ${usd(dayChange)} (${pct(dayChangePct)}) on priced holdings`, color: up ? UP : DOWN };
}

export function renderDigestHtml(d: Digest, opts: { appUrl?: string } = {}): string {
  const mv = moveLine(d);
  const hi = d.greetingName ? `Good morning, ${esc(d.greetingName)}` : "Good morning";
  const section = (title: string, body: string) => `
    <tr><td style="padding:22px 28px 0 28px">
      <div style="font:600 12px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${TEAL}">${esc(title)}</div>
      <div style="height:10px"></div>${body}
    </td></tr>`;
  const bullets = (items: string[]) =>
    `<ul style="margin:0;padding-left:18px;color:${INK};font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">` +
    items.map((i) => `<li style="margin:0 0 6px">${esc(i)}</li>`).join("") + `</ul>`;

  const phase = d.phaseAlert
    ? `<div style="margin-top:4px;padding:12px 14px;background:${WASH};border:1px solid ${LINE};border-radius:10px;font:400 14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">
         <strong>Next up: ${esc(d.phaseAlert.next)}</strong> — ${d.phaseAlert.monthsAway === 0 ? "starting now" : `~${d.phaseAlert.monthsAway} month${d.phaseAlert.monthsAway === 1 ? "" : "s"} out`} (${d.phaseAlert.startYear}). ${esc(d.phaseAlert.whatChanges)}
       </div>` : "";

  const actions = d.framing.actions.length
    ? `<div style="height:10px"></div>${bullets(d.framing.actions)}` : "";

  const footerLink = opts.appUrl
    ? `<a href="${esc(opts.appUrl)}" style="color:${TEAL};text-decoration:none">Open your plan →</a>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#eef2f0;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${TEAL_DK};padding:22px 28px">
      <div style="font:700 18px/1.2 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff">${hi}</div>
      <div style="font:400 13px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#b8d6cc;margin-top:4px">${esc(d.dateLabel)} · your daily brief</div>
    </td></tr>

    ${section("Portfolio", `
      <div style="font:700 26px/1.1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">${usd(d.portfolio.investable)}<span style="font:400 13px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED}"> investable</span></div>
      <div style="margin-top:4px;font:600 14px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${mv.color}">${esc(mv.text)}</div>
      <div style="margin-top:4px;font:400 12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED}">Net worth ${usd(d.portfolio.netWorth)}${d.portfolio.concentratedSymbol ? ` · ${Math.round(d.portfolio.concentrationPct * 100)}% in ${esc(d.portfolio.concentratedSymbol)}` : ""}</div>`)}

    ${section("Framing for today", `
      <div style="font:700 15px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEAL_DK}">${esc(d.framing.seasonName)}${d.framing.seasonLabel ? ` <span style="font-weight:400;color:${MUTED}">· ${esc(d.framing.seasonLabel)}</span>` : ""}</div>
      ${d.framing.tagline ? `<div style="margin-top:6px;font:400 14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">${esc(d.framing.tagline)}</div>` : ""}
      ${d.framing.permission ? `<div style="margin-top:8px;padding-left:12px;border-left:3px solid ${TEAL};font:italic 400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED}">${esc(d.framing.permission)}</div>` : ""}
      ${actions}`)}

    ${phase ? section("Where you are", phase) : ""}

    ${section("Keep in mind", bullets(d.keepInMind))}

    ${section("Your holdings", bullets(d.holdingsNotes))}

    ${section("Seasonal", `<div style="font:400 14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">${esc(d.seasonalNote)}</div>`)}

    <tr><td style="padding:24px 28px 26px">
      <div style="border-top:1px solid ${LINE};padding-top:14px;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED}">
        ${footerLink}${footerLink ? " · " : ""}A daily note from your own plan. Not financial advice.
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function renderDigestText(d: Digest): string {
  const mv = moveLine(d);
  const L: string[] = [];
  L.push(`${d.greetingName ? `Good morning, ${d.greetingName}` : "Good morning"} — ${d.dateLabel}`);
  L.push("");
  L.push(`PORTFOLIO: ${usd(d.portfolio.investable)} investable · ${mv.text}`);
  L.push(`Net worth ${usd(d.portfolio.netWorth)}${d.portfolio.concentratedSymbol ? ` · ${Math.round(d.portfolio.concentrationPct * 100)}% in ${d.portfolio.concentratedSymbol}` : ""}`);
  L.push("");
  L.push(`FRAMING: ${d.framing.seasonName}${d.framing.seasonLabel ? ` (${d.framing.seasonLabel})` : ""}`);
  if (d.framing.tagline) L.push(d.framing.tagline);
  if (d.framing.permission) L.push(`"${d.framing.permission}"`);
  for (const a of d.framing.actions) L.push(`  - ${a}`);
  if (d.phaseAlert) { L.push(""); L.push(`NEXT UP: ${d.phaseAlert.next} (${d.phaseAlert.startYear}, ~${d.phaseAlert.monthsAway}mo) — ${d.phaseAlert.whatChanges}`); }
  L.push("");
  L.push("KEEP IN MIND:");
  for (const k of d.keepInMind) L.push(`  - ${k}`);
  L.push("");
  L.push("HOLDINGS:");
  for (const h of d.holdingsNotes) L.push(`  - ${h}`);
  L.push("");
  L.push(`SEASONAL: ${d.seasonalNote}`);
  return L.join("\n");
}
