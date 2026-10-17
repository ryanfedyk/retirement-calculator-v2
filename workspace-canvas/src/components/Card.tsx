import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CanvasState, Seed } from '../state/types';
import { CARD_LABEL, deleteSeed, setEditing, setSeedText, setStatus, updateSeed, useApp, select } from '../state/store';
import { highlightsFor, isSourceLike, lineKind, parseDir, srcInfo } from '../engine/classify';
import { isLabelNote, polarityOf } from '../engine/analyze';
import { shorten } from '../engine/text';
import { placeNote, revertEdit, splitNote } from '../lib/actions';
import { AppIcon, Icon, TYPE_ICON } from './Icon';
import { Menu } from './Menu';
import { traceCard } from '../draft/trace';

const TEXT_TYPES = ['note', 'direction', 'assumption', 'format'];

function autoSize(ta: HTMLTextAreaElement | null) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

export const Card = memo(function Card({ s, S, sel, traced, group }: { s: Seed; S: CanvasState; sel: boolean; traced: boolean; group?: string }) {
  const editingId = useApp(st => st.editingId);
  const images = useApp(st => st.images);
  const ta = useRef<HTMLTextAreaElement>(null);
  const tagBtn = useRef<HTMLButtonElement>(null);
  const [tagMenu, setTagMenu] = useState(false);
  const [entered] = useState(() => Date.now());
  const isText = TEXT_TYPES.includes(s.type);
  const label = isLabelNote(s);

  useLayoutEffect(() => autoSize(ta.current), [s.text, s.pg, s.w]);
  useEffect(() => {
    if (editingId === s.id && ta.current) { ta.current.focus(); const n = ta.current.value.length; ta.current.setSelectionRange(n, n); setEditing(null); }
  }, [editingId, s.id]);

  const typeLabel = s.type === 'reference' && s.generated ? 'Generated image' : label ? (polarityOf(s.text || '') ? 'Group label' : 'Label') : CARD_LABEL[s.type];
  const icon = s.type === 'reference' && s.generated ? 'auto_awesome' : label ? 'label' : TYPE_ICON[s.type];
  const w = s.pg ? undefined : s.w || undefined;

  let body: React.ReactNode = null;
  if (isText) {
    const lines = (s.text || '').split('\n').map(x => x.trim()).filter(Boolean);
    const rec: React.ReactNode[] = [];
    if (s.type === 'note' && lines.length > 1) lines.forEach((l, i) => {
      if (i === 0) return; const k = lineKind(l);
      if (k === 'direction') rec.push(<span key={i} className="d"><b>Direction</b> {shorten(l, 6)}</span>);
      else if (k === 'assumption') rec.push(<span key={i} className="a"><b>Assumption</b> {shorten(l, 6)}</span>);
      else if (k === 'format') rec.push(<span key={i} className="f"><b>Format</b> {shorten(l, 6)}</span>);
    });
    if (s.type === 'direction') {
      const d = parseDir(s.text);
      if (d.audience) rec.push(<span key="a" className="d"><b>Audience</b> {d.audience}</span>);
      if (d.length) rec.push(<span key="l" className="d"><b>Length</b> {d.length === 'short' ? 'Short' : 'Detailed'}</span>);
      if (d.tone) rec.push(<span key="t" className="d"><b>Tone</b> {d.tone}</span>);
      if (d.lead) rec.push(<span key="w" className="d"><b>Lead with</b> {d.lead}</span>);
    }
    body = <>
      {s.fromDraft && <div className="fromdraft">From the draft · more like this</div>}
      <div className="c-body">
        <textarea ref={ta} rows={1} value={s.text || ''} aria-label={`${typeLabel} text`} data-seed-input={s.id}
          placeholder={s.pg ? 'Type an idea, a few notes, or what you need. Drop a file, or press @ to add from your Workspace.' : 'Type a note'}
          onChange={e => { setSeedText(s.id, e.target.value); autoSize(e.target); }}
          onFocus={() => select(s.id)}
          onKeyDown={e => { if (e.key === 'Escape') { (e.target as HTMLTextAreaElement).blur(); e.stopPropagation(); } }} />
      </div>
      {rec.length > 0 && <div className="rec">{rec}</div>}
      {(s.pg || (s.type === 'note' && lines.length >= 3)) && <div className="c-foot">
        {s.pg && <button data-act onClick={() => placeNote(s)}><Icon name="dashboard" />Place on board</button>}
        {s.type === 'note' && lines.length >= 3 && <button data-act onClick={() => splitNote(s)}><Icon name="splitscreen_add" />Split into cards</button>}
      </div>}
    </>;
  } else if (isSourceLike(s)) {
    const info = srcInfo(s);
    const h = s.placeholder ? null : highlightsFor(S, s);
    body = <>
      <div className="src-h"><AppIcon kind={info.kind} /><div><div className="st">{info.title}</div><div className="sm">{info.app}{info.meta ? ' · ' + info.meta : ''}</div></div></div>
      <Passages s={s} h={h} text={info.text} />
      <div className="c-foot"><span className="muted-t">{s.placeholder ? 'Listed as a source' : s.status === 'muted' ? 'Muted: not used in the draft' : s.status === 'must' ? 'Must use: every passage is used' : `${h!.picked.size} highlighted passage${h!.picked.size === 1 ? '' : 's'} relevant to this canvas`}</span></div>
    </>;
  } else if (s.type === 'reference') {
    const url = s.imgId ? images[s.imgId] : null;
    const p = s.palette;
    body = <>
      <div className="ref-img">{url ? <img alt={s.generated ? `Generated: ${s.prompt}` : s.name || 'Reference image'} src={url} /> : <div className="gen" />}</div>
      <div className="rcap">{s.generated ? (url ? `“${s.prompt}”` : 'Generating…') : `${s.name || 'Reference image'} · match this look`}</div>
      {p && <div className="swatches"><i style={{ background: p.bg }} /><i style={{ background: p.accent }} /><i style={{ background: p.accent2 }} /><span style={{ marginLeft: 6 }}>Sets the draft’s look</span></div>}
    </>;
  } else if (s.type === 'edits') {
    const keys = Object.keys(S.edits);
    body = <>
      {keys.map(k => <div key={k} className="edit-row"><Icon name="edit" className="xs" /><span>Edited in draft: {S.edits[k].label}</span>
        <button className="ibtn sm" data-act onClick={() => revertEdit(k)} aria-label={`Revert edit to ${S.edits[k].label}`} title="Revert this edit"><Icon name="close" /></button></div>)}
      <div className="edits-note">Each edit holds like a pin. Canvas changes update everything else.</div>
    </>;
  }

  return (
    <div className={`card ${s.pg ? 'pg' : ''} ${label ? 'label-note' : ''} ${sel ? 'sel' : ''} ${s.status === 'muted' ? 'muted' : ''} ${s.status === 'must' ? 'must' : ''} ${traced ? 'trace' : ''} ${Date.now() - entered < 400 ? 'enter' : ''}`}
      data-card={s.id} data-type={s.type} tabIndex={-1} role="group" aria-label={`${typeLabel}${s.status === 'muted' ? ', muted' : s.status === 'must' ? ', must use' : ''}`}
      style={{ left: s.x, top: s.y, width: w }}
      onMouseEnter={() => traceCard(s.id)} onMouseLeave={() => traceCard(null)}>
      <div className="c-head">
        <button ref={tagBtn} className="ttag" data-act onClick={() => isText && setTagMenu(true)} aria-haspopup={isText ? 'menu' : undefined}
          title={isText ? 'Change the type' : undefined} aria-label={isText ? `Type: ${typeLabel}. Change type` : typeLabel}>
          <Icon name={icon} />{typeLabel}{group && <span className="group">· in {group}</span>}
        </button>
        <div className="c-tools">
          {s.type === 'edits'
            ? <button data-act onClick={() => deleteSeed(s.id)} aria-label="Revert all draft edits" title="Revert all"><Icon name="delete" /></button>
            : <>
              <button data-act onClick={() => setStatus(s.id, 'must')} aria-pressed={s.status === 'must'} aria-label="Must use" title="Must use (U)"><Icon name="star" fill={s.status === 'must'} /></button>
              <button data-act onClick={() => setStatus(s.id, 'muted')} aria-pressed={s.status === 'muted'} aria-label="Mute" title="Mute: keep it, but leave it out (M)"><Icon name={s.status === 'muted' ? 'visibility_off' : 'visibility'} /></button>
              <button data-act onClick={() => deleteSeed(s.id)} aria-label="Delete" title="Delete (Del)"><Icon name="delete" /></button>
            </>}
        </div>
      </div>
      {body}
      {tagMenu && tagBtn.current && <Menu anchor={tagBtn.current} label="Card type" header="Card type" onClose={() => setTagMenu(false)}
        items={TEXT_TYPES.map(t => ({ key: t, label: CARD_LABEL[t], icon: <Icon name={TYPE_ICON[t]} className="sm" />, checked: s.type === t,
          onSelect: () => updateSeed(s.id, { type: t as Seed['type'], lockType: true }, { cause: t, label: 'Changed card type', immediate: true }) }))} />}
    </div>
  );
});

/** Source text with the passages relevant to the canvas highlighted; fresh highlights glow. */
function Passages({ s, h, text }: { s: Seed; h: ReturnType<typeof highlightsFor> | null; text: string }) {
  const prev = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const key = h ? [...h.picked].sort().join(',') : '';
  useEffect(() => {
    if (!h) return;
    if (prev.current) { const f = new Set([...h.picked].filter(i => !prev.current!.has(i))); if (f.size) { setFresh(f); const t = setTimeout(() => setFresh(new Set()), 1400); prev.current = h.picked; return () => clearTimeout(t); } }
    prev.current = h.picked;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!h) return <div className="pass"><span className="muted-t">{text}</span></div>;
  return <div className="pass">{h.sents.map((t, i) => (h.picked.has(i) && s.status !== 'muted')
    ? <mark key={i} className={fresh.has(i) ? 'fresh' : ''}>{t}</mark> : <span key={i}>{t}</span>).reduce<React.ReactNode[]>((a, n, i) => (i ? [...a, ' ', n] : [n]), [])}</div>;
}
