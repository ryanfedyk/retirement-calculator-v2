// Renders a Digest to an email-safe HTML document (inline styles, 600px, no
// external CSS/JS) and a plain-text fallback. Designed to match the app's
// "Garden Morning Light" palette (config/colors.ts) — light, airy, majority
// white, forest-green ink, teal hero, warm terracotta accents, and NO alarm red
// (a down day reads warm, not dangerous). Editorial voice: a serif masthead and
// headlines over the app's sans body, a pull-quote lede, and a featured
// milestone, so it reads like a morning dispatch, not a spreadsheet.

import { usd, type Digest } from "@/lib/digest/buildDigest";

// ── Palette (mirrors config/colors.ts) ──────────────────────────────────────
const BG = "#fbfdfd", HEADER = "#f5faf8", CARD = "#ffffff";
const INK = "#1a2e25", INK_MID = "#3d5e52", INK_SOFT = "#6a8e82", INK_FAINT = "#a7c4bc";
const BORDER = "#e7eeeb", BORDER_SOFT = "#f1f6f4";
const TEAL = "#3a9e87", TEAL_DK = "#2a7a68", TEAL_WASH = "#e2f2ee";
const WARM = "#c4784e", WARM_WASH = "#fdf3ec";
const UP = TEAL_DK, DOWN = WARM; // warm, never red

const SANS = "ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (f: number) => `${f >= 0 ? "+" : "−"}${(Math.abs(f) * 100).toFixed(1)}%`;

function moveLine(d: Digest): { text: string; color: string } {
  const { dayChange, dayChangePct } = d.portfolio;
  if (dayChange == null || dayChangePct == null) return { text: "market move unavailable today", color: INK_SOFT };
  const up = dayChange >= 0;
  return { text: `${up ? "▲" : "▼"} ${usd(dayChange)} (${pct(dayChangePct)}) today`, color: up ? UP : DOWN };
}

const kicker = (t: string) =>
  `<div style="font:700 11px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${TEAL_DK}">${esc(t)}</div>`;

const bullets = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
  items.map((i) => `
    <tr>
      <td width="16" valign="top" style="font:400 14px/1.6 ${SANS};color:${TEAL}">•</td>
      <td style="font:400 14px/1.6 ${SANS};color:${INK_MID};padding-bottom:7px">${esc(i)}</td>
    </tr>`).join("") + `</table>`;

const sectionPad = "padding:0 32px";
// Every table-level chunk MUST be a <tr> — stray divs between rows get reparented
// out of the table by email/browser renderers (which scrambles the order).
const row = (inner: string, pad = sectionPad) => `<tr><td style="${pad}">${inner}</td></tr>`;
const ruleRow = `<tr><td style="${sectionPad}"><div style="height:1px;background:${BORDER};margin:26px 0"></div></td></tr>`;

export function renderDigestHtml(d: Digest, opts: { appUrl?: string } = {}): string {
  const mv = moveLine(d);
  const feat = d.milestones[0] ?? null;
  const more = d.milestones.slice(1, 3);
  const actions = d.framing.actions.length ? `<div style="height:12px"></div>${bullets(d.framing.actions)}` : "";
  const footerLink = opts.appUrl ? `<a href="${esc(opts.appUrl)}" style="color:${TEAL_DK};text-decoration:none;font-weight:600">Open your plan →</a> · ` : "";

  const rows: string[] = [];

  // Masthead
  rows.push(`<tr><td style="background:${HEADER};border-bottom:1px solid ${BORDER};padding:22px 32px 20px">
      <div style="font:400 11px/1 ${SANS};letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT}">${esc(d.dateLabel)} · Weekday dispatch</div>
      <div style="height:8px"></div>
      <div style="font:600 26px/1.05 ${SERIF};color:${INK};letter-spacing:.01em">The Morning Glide</div>
      <div style="height:6px"></div>
      <div style="height:3px;width:44px;background:${TEAL}"></div>
    </td></tr>`);

  // Editorial lede
  rows.push(row(`<div style="font:400 18px/1.5 ${SERIF};color:${INK}">${d.greetingName ? `${esc(d.greetingName)}, ` : ""}${esc(d.editorial)}</div>`, "padding:24px 32px 0"));

  // Featured milestone
  if (feat) rows.push(row(`
      <div style="margin-top:22px;background:${WARM_WASH};border:1px solid ${BORDER};border-left:4px solid ${WARM};border-radius:12px;padding:18px 20px">
        ${kicker("Milestone")}
        <div style="height:8px"></div>
        <div style="font:600 21px/1.25 ${SERIF};color:${INK}">${esc(feat.headline)}</div>
        <div style="height:7px"></div>
        <div style="font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(feat.note)}</div>
      </div>`));

  rows.push(ruleRow);

  // The number
  rows.push(row(`
      ${kicker("The number")}
      <div style="height:10px"></div>
      <div style="font:600 30px/1 ${SERIF};color:${INK}">${usd(d.portfolio.investable)}<span style="font:400 13px/1 ${SANS};color:${INK_SOFT}"> investable</span></div>
      <div style="height:7px"></div>
      <div style="font:600 14px/1.4 ${SANS};color:${mv.color}">${esc(mv.text)}</div>
      <div style="margin-top:5px;font:400 12px/1.5 ${SANS};color:${INK_SOFT}">Net worth ${usd(d.portfolio.netWorth)}${d.portfolio.concentratedSymbol ? ` · ${Math.round(d.portfolio.concentrationPct * 100)}% in ${esc(d.portfolio.concentratedSymbol)}` : ""}</div>`));

  // The plan — reassurance that the money still works, plus the Monte Carlo
  // odds (with day-over-day change) and the upside.
  const healthColor = d.plan.health === "on-track" ? TEAL_DK : WARM;
  const mcPct = Math.round(d.monteCarlo.successRate * 100);
  const dpt = d.monteCarlo.deltaPts;
  const mcDelta = dpt == null ? `<span style="color:${INK_FAINT}">· first read</span>`
    : Math.abs(dpt) < 0.1 ? `<span style="color:${INK_SOFT}">· flat vs. yesterday</span>`
    : `<span style="color:${dpt > 0 ? UP : DOWN};font-weight:600">· ${dpt > 0 ? "▲" : "▼"} ${Math.abs(dpt).toFixed(1)} pts vs. yesterday</span>`;
  rows.push(ruleRow);
  rows.push(row(`
      ${kicker("The plan")}
      <div style="height:10px"></div>
      <div style="font:600 17px/1.3 ${SERIF};color:${healthColor}">${esc(d.plan.headline)}</div>
      <div style="height:7px"></div>
      <div style="font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(d.plan.reassurance)}</div>
      <div style="margin-top:12px;font:400 13px/1.5 ${SANS};color:${INK_SOFT}">
        <span style="font-weight:700;color:${INK}">${mcPct}%</span> Monte Carlo odds of funding the plan to 100 ${mcDelta}
      </div>
      ${d.upside ? `
      <div style="margin-top:14px;background:${TEAL_WASH};border-radius:12px;padding:14px 16px">
        ${kicker("Upside")}
        <div style="height:6px"></div>
        <div style="font:400 14px/1.6 ${SANS};color:${INK}">${esc(d.upside.note)}</div>
      </div>` : ""}`));

  // Also worth marking
  if (more.length) {
    rows.push(ruleRow);
    rows.push(row(`
      ${kicker("Also worth marking")}
      <div style="height:12px"></div>
      ${more.map((m) => `
        <div style="margin-bottom:12px">
          <div style="font:600 15px/1.3 ${SERIF};color:${INK}">${esc(m.headline)}</div>
          <div style="font:400 13px/1.55 ${SANS};color:${INK_SOFT};margin-top:2px">${esc(m.note)}</div>
        </div>`).join("")}`));
  }

  rows.push(ruleRow);

  // Framing
  rows.push(row(`
      ${kicker("Framing for today")}
      <div style="height:10px"></div>
      <div style="font:600 17px/1.3 ${SERIF};color:${INK}">${esc(d.framing.seasonName)}${d.framing.seasonLabel ? ` <span style="font:400 13px/1 ${SANS};color:${INK_SOFT}">· ${esc(d.framing.seasonLabel)}</span>` : ""}</div>
      ${d.framing.tagline ? `<div style="margin-top:7px;font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(d.framing.tagline)}</div>` : ""}
      ${d.framing.permission ? `<div style="margin-top:12px;padding:4px 0 4px 14px;border-left:3px solid ${TEAL};font:italic 400 15px/1.5 ${SERIF};color:${INK_MID}">${esc(d.framing.permission)}</div>` : ""}
      ${actions}`));

  // Where you are
  if (d.phaseAlert) {
    rows.push(ruleRow);
    rows.push(row(`
      ${kicker("Where you are")}
      <div style="height:10px"></div>
      <div style="background:${TEAL_WASH};border-radius:12px;padding:14px 16px;font:400 14px/1.6 ${SANS};color:${INK}">
        <strong style="color:${TEAL_DK}">Next up: ${esc(d.phaseAlert.next)}</strong> — ${d.phaseAlert.monthsAway === 0 ? "starting now" : `~${d.phaseAlert.monthsAway} month${d.phaseAlert.monthsAway === 1 ? "" : "s"} out`} (${d.phaseAlert.startYear}). ${esc(d.phaseAlert.whatChanges)}
      </div>`));
  }

  rows.push(ruleRow);
  rows.push(row(`${kicker("Keep in mind")}<div style="height:12px"></div>${bullets(d.keepInMind)}`));
  rows.push(ruleRow);
  rows.push(row(`${kicker("Your holdings")}<div style="height:12px"></div>${bullets(d.holdingsNotes)}`));
  rows.push(ruleRow);
  rows.push(row(`${kicker("Seasonal")}<div style="height:10px"></div><div style="font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(d.seasonalNote)}</div>`));

  // Footer
  rows.push(row(`<div style="border-top:1px solid ${BORDER};padding-top:16px;font:400 12px/1.6 ${SANS};color:${INK_FAINT}">${footerLink}A morning note from your own plan. Not financial advice.</div>`, "padding:28px 32px 28px"));

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${BG};padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${CARD};border:1px solid ${BORDER};border-radius:18px;overflow:hidden">
    ${rows.join("\n")}
  </table>
</body></html>`;
}

export function renderDigestText(d: Digest): string {
  const mv = moveLine(d);
  const L: string[] = [];
  L.push(`THE MORNING GLIDE — ${d.dateLabel}`);
  L.push("");
  L.push(`${d.greetingName ? `${d.greetingName}, ` : ""}${d.editorial}`);
  if (d.milestones[0]) { L.push(""); L.push(`★ MILESTONE: ${d.milestones[0].headline}`); L.push(`  ${d.milestones[0].note}`); }
  L.push("");
  L.push(`THE NUMBER: ${usd(d.portfolio.investable)} investable · ${mv.text}`);
  L.push(`Net worth ${usd(d.portfolio.netWorth)}${d.portfolio.concentratedSymbol ? ` · ${Math.round(d.portfolio.concentrationPct * 100)}% in ${d.portfolio.concentratedSymbol}` : ""}`);
  L.push("");
  L.push(`THE PLAN: ${d.plan.headline} ${d.plan.reassurance}`);
  {
    const dpt = d.monteCarlo.deltaPts;
    const delta = dpt == null ? "(first read)" : Math.abs(dpt) < 0.1 ? "(flat vs. yesterday)" : `(${dpt > 0 ? "+" : "−"}${Math.abs(dpt).toFixed(1)} pts vs. yesterday)`;
    L.push(`Monte Carlo odds of funding to 100: ${Math.round(d.monteCarlo.successRate * 100)}% ${delta}`);
  }
  if (d.upside) { L.push(""); L.push(`UPSIDE: ${d.upside.note}`); }
  for (const m of d.milestones.slice(1, 3)) { L.push(""); L.push(`• ${m.headline} — ${m.note}`); }
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
