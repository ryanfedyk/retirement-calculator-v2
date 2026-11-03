// Renders a Digest to an email-safe HTML document (inline styles, 600px, no
// external CSS/JS) and a plain-text fallback. Matches the app's "Garden Morning
// Light" palette — light/airy, forest-green ink, teal hero, warm terracotta, NO
// alarm red. Information architecture, top to bottom: a scannable ROUNDUP of
// what's new, then THE MONEY (value + plan odds + upside), THE MARKET & MONTHS
// AHEAD (a synthesis), WHERE YOU ARE (one consolidated life/career block), and a
// THOUGHT FOR THE DAY. Each theme lives in exactly one section, so nothing
// repeats across the email.

import { usd, type Digest } from "@/lib/digest/buildDigest";

// ── Palette (mirrors config/colors.ts) ──────────────────────────────────────
const BG = "#fbfdfd", HEADER = "#f5faf8", CARD = "#ffffff";
const INK = "#1a2e25", INK_MID = "#3d5e52", INK_SOFT = "#6a8e82", INK_FAINT = "#a7c4bc";
const BORDER = "#e7eeeb";
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
      <td style="font:400 14px/1.6 ${SANS};color:${INK_MID};padding-bottom:7px">${i}</td>
    </tr>`).join("") + `</table>`;

const sectionPad = "padding:0 32px";
// Every table-level chunk MUST be a <tr> — stray divs between rows get reparented
// out of the table by email/browser renderers (which scrambles the order).
const row = (inner: string, pad = sectionPad) => `<tr><td style="${pad}">${inner}</td></tr>`;
const ruleRow = `<tr><td style="${sectionPad}"><div style="height:1px;background:${BORDER};margin:24px 0"></div></td></tr>`;

export function renderDigestHtml(d: Digest, opts: { appUrl?: string } = {}): string {
  const mv = moveLine(d);
  const feat = d.milestones[0] ?? null;
  const footerLink = opts.appUrl ? `<a href="${esc(opts.appUrl)}" style="color:${TEAL_DK};text-decoration:none;font-weight:600">Open your plan →</a> · ` : "";

  const mcPct = Math.round(d.monteCarlo.successRate * 100);
  const dpt = d.monteCarlo.deltaPts;
  const mcDelta = dpt == null ? `<span style="color:${INK_FAINT}">· first read</span>`
    : Math.abs(dpt) < 0.1 ? `<span style="color:${INK_SOFT}">· flat vs. yesterday</span>`
    : `<span style="color:${dpt > 0 ? UP : DOWN};font-weight:600">· ${dpt > 0 ? "▲" : "▼"} ${Math.abs(dpt).toFixed(1)} pts vs. yesterday</span>`;
  const healthColor = d.plan.health === "on-track" ? TEAL_DK : WARM;

  const moversLine = d.portfolio.movers.length
    ? `<div style="margin-top:8px;font:400 12px/1.5 ${SANS};color:${INK_SOFT}">Movers: ${d.portfolio.movers.slice(0, 3).map((m) => `${esc(m.symbol)} ${m.changePct >= 0 ? "+" : ""}${(m.changePct * 100).toFixed(1)}%`).join(" · ")}</div>`
    : "";

  const idxLine = d.marketContext.indices.filter((i) => i.symbol !== "^TNX" && i.changePct != null)
    .map((i) => `${esc(i.label)} <span style="color:${i.changePct! >= 0 ? UP : DOWN}">${pct(i.changePct!)}</span>`).join(" &nbsp;·&nbsp; ");

  const rows: string[] = [];

  // ── Masthead ────────────────────────────────────────────────────────────────
  rows.push(`<tr><td style="background:${HEADER};border-bottom:1px solid ${BORDER};padding:22px 32px 20px">
      <div style="font:400 11px/1 ${SANS};letter-spacing:.2em;text-transform:uppercase;color:${INK_SOFT}">${esc(d.dateLabel)} · Weekday dispatch</div>
      <div style="height:8px"></div>
      <div style="font:600 26px/1.05 ${SERIF};color:${INK};letter-spacing:.01em">The Morning Glide</div>
      <div style="height:6px"></div>
      <div style="height:3px;width:44px;background:${TEAL}"></div>
    </td></tr>`);

  // ── Lede + the roundup (what's new, scannable) ──────────────────────────────
  rows.push(row(`<div style="font:400 18px/1.5 ${SERIF};color:${INK}">${d.greetingName ? `${esc(d.greetingName)}, ` : ""}${esc(d.editorial)}</div>`, "padding:24px 32px 0"));
  rows.push(row(`<div style="height:18px"></div>${kicker("The roundup")}<div style="height:12px"></div>${bullets(d.roundup.map(esc))}`));

  // ── The money — value, day move, plan odds, upside (one section) ─────────────
  rows.push(ruleRow);
  rows.push(row(`
      ${kicker("The money")}
      <div style="height:10px"></div>
      <div style="font:600 30px/1 ${SERIF};color:${INK}">${usd(d.portfolio.investable)}<span style="font:400 13px/1 ${SANS};color:${INK_SOFT}"> investable</span></div>
      <div style="height:7px"></div>
      <div style="font:600 14px/1.4 ${SANS};color:${mv.color}">${esc(mv.text)}</div>
      <div style="margin-top:5px;font:400 12px/1.5 ${SANS};color:${INK_SOFT}">Net worth ${usd(d.portfolio.netWorth)}${d.portfolio.concentratedSymbol ? ` · ${Math.round(d.portfolio.concentrationPct * 100)}% in ${esc(d.portfolio.concentratedSymbol)}` : ""}</div>
      ${moversLine}
      <div style="height:16px"></div>
      <div style="font:600 16px/1.3 ${SERIF};color:${healthColor}">${esc(d.plan.headline)}</div>
      <div style="height:6px"></div>
      <div style="font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(d.plan.reassurance)}</div>
      <div style="margin-top:10px;font:400 13px/1.5 ${SANS};color:${INK_SOFT}"><span style="font-weight:700;color:${INK}">${mcPct}%</span> Monte Carlo odds of funding the plan to 100 ${mcDelta}</div>
      ${d.upside ? `
      <div style="margin-top:14px;background:${TEAL_WASH};border-radius:12px;padding:14px 16px">
        ${kicker("Upside")}<div style="height:6px"></div>
        <div style="font:400 14px/1.6 ${SANS};color:${INK}">${esc(d.upside.note)}</div>
      </div>` : ""}`));

  // ── The market & the months ahead (synthesis) ───────────────────────────────
  rows.push(ruleRow);
  rows.push(row(`
      ${kicker("The market & the months ahead")}
      <div style="height:10px"></div>
      ${idxLine ? `<div style="font:600 13px/1.5 ${SANS};color:${INK_MID};margin-bottom:8px">${idxLine}</div>` : ""}
      <div style="font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(d.marketOutlook)}</div>`));

  // ── Where you are — one consolidated life/career block ──────────────────────
  rows.push(ruleRow);
  const phaseBlock = d.phaseAlert ? `
      <div style="margin-top:14px;background:${TEAL_WASH};border-radius:12px;padding:12px 15px;font:400 13px/1.55 ${SANS};color:${INK}">
        <strong style="color:${TEAL_DK}">Next up: ${esc(d.phaseAlert.next)}</strong> — ${d.phaseAlert.monthsAway === 0 ? "starting now" : `~${d.phaseAlert.monthsAway} month${d.phaseAlert.monthsAway === 1 ? "" : "s"} out`} (${d.phaseAlert.startYear}). ${esc(d.phaseAlert.whatChanges)}
      </div>` : "";
  const milestoneBlock = feat ? `
      <div style="margin-top:14px;background:${WARM_WASH};border:1px solid ${BORDER};border-left:4px solid ${WARM};border-radius:12px;padding:16px 18px">
        ${kicker("Milestone")}<div style="height:7px"></div>
        <div style="font:600 19px/1.25 ${SERIF};color:${INK}">${esc(feat.headline)}</div>
        <div style="height:6px"></div>
        <div style="font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(feat.note)}</div>
      </div>` : "";
  const actions = d.framing.actions.length ? `<div style="height:14px"></div>${bullets(d.framing.actions.map(esc))}` : "";
  rows.push(row(`
      ${kicker("Where you are")}
      <div style="height:10px"></div>
      <div style="font:600 17px/1.3 ${SERIF};color:${INK}">${esc(d.framing.seasonName)}${d.framing.seasonLabel ? ` <span style="font:400 13px/1 ${SANS};color:${INK_SOFT}">· ${esc(d.framing.seasonLabel)}</span>` : ""}</div>
      ${d.framing.tagline ? `<div style="margin-top:7px;font:400 14px/1.6 ${SANS};color:${INK_MID}">${esc(d.framing.tagline)}</div>` : ""}
      ${d.framing.permission ? `<div style="margin-top:12px;padding:4px 0 4px 14px;border-left:3px solid ${TEAL};font:italic 400 15px/1.5 ${SERIF};color:${INK_MID}">${esc(d.framing.permission)}</div>` : ""}
      ${milestoneBlock}
      ${phaseBlock}
      ${actions}`));

  // ── Thought for the day ─────────────────────────────────────────────────────
  rows.push(ruleRow);
  rows.push(row(`
      ${kicker("Thought for the day")}
      <div style="height:12px"></div>
      <div style="font:italic 400 18px/1.5 ${SERIF};color:${INK}">“${esc(d.motivation.quote)}”</div>
      ${d.motivation.attribution ? `<div style="margin-top:8px;font:400 12px/1 ${SANS};letter-spacing:.04em;color:${INK_SOFT}">— ${esc(d.motivation.attribution)}</div>` : ""}`));

  // ── Footer ──────────────────────────────────────────────────────────────────
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
  const dpt = d.monteCarlo.deltaPts;
  const delta = dpt == null ? "(first read)" : Math.abs(dpt) < 0.1 ? "(flat vs. yesterday)" : `(${dpt > 0 ? "+" : "−"}${Math.abs(dpt).toFixed(1)} pts vs. yesterday)`;
  const L: string[] = [];
  L.push(`THE MORNING GLIDE — ${d.dateLabel}`);
  L.push("");
  L.push(`${d.greetingName ? `${d.greetingName}, ` : ""}${d.editorial}`);
  L.push("");
  L.push("THE ROUNDUP:");
  for (const r of d.roundup) L.push(`  • ${r}`);
  L.push("");
  L.push(`THE MONEY: ${usd(d.portfolio.investable)} investable · ${mv.text}`);
  L.push(`Net worth ${usd(d.portfolio.netWorth)}${d.portfolio.concentratedSymbol ? ` · ${Math.round(d.portfolio.concentrationPct * 100)}% in ${d.portfolio.concentratedSymbol}` : ""}`);
  L.push(`${d.plan.headline} ${d.plan.reassurance}`);
  L.push(`Monte Carlo odds of funding to 100: ${Math.round(d.monteCarlo.successRate * 100)}% ${delta}`);
  if (d.upside) L.push(`Upside: ${d.upside.note}`);
  L.push("");
  const idx = d.marketContext.indices.filter((i) => i.symbol !== "^TNX" && i.changePct != null).map((i) => `${i.label} ${pct(i.changePct!)}`).join(", ");
  L.push("THE MARKET & THE MONTHS AHEAD:");
  if (idx) L.push(`  ${idx}`);
  L.push(`  ${d.marketOutlook}`);
  L.push("");
  L.push(`WHERE YOU ARE: ${d.framing.seasonName}${d.framing.seasonLabel ? ` (${d.framing.seasonLabel})` : ""}`);
  if (d.framing.tagline) L.push(d.framing.tagline);
  if (d.framing.permission) L.push(`"${d.framing.permission}"`);
  if (d.milestones[0]) L.push(`★ ${d.milestones[0].headline} — ${d.milestones[0].note}`);
  if (d.phaseAlert) L.push(`Next up: ${d.phaseAlert.next} (${d.phaseAlert.startYear}, ~${d.phaseAlert.monthsAway}mo) — ${d.phaseAlert.whatChanges}`);
  for (const a of d.framing.actions) L.push(`  - ${a}`);
  L.push("");
  L.push(`THOUGHT FOR THE DAY: "${d.motivation.quote}"${d.motivation.attribution ? ` — ${d.motivation.attribution}` : ""}`);
  return L.join("\n");
}
