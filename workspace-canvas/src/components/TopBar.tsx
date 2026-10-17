import { useRef, useState } from 'react';
import { useApp, goHome, undo, redo, goEntry, canUndo, canRedo, mutate } from '../state/store';
import { useDraft } from '../draft/pipeline';
import { analyze } from '../engine/analyze';
import { openInApp } from '../lib/actions';
import { Icon } from './Icon';
import { Menu } from './Menu';
import { toggleTheme } from './App';

export function TopBar() {
  const S = useApp(s => s.S)!;
  const H = useApp(s => s.H);
  const status = useApp(s => s.status);
  const out = useDraft(s => s.outline);
  const chip = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const deck = out?.format === 'deck';
  const idx = H.entries.findIndex(e => e.id === H.cur);
  const cur = H.entries[idx];
  const inferred = menu ? analyze({ ...S, format: 'auto' }).format : 'doc';
  const fmtLabel = deck ? 'Deck' : 'Doc';
  const setFormat = (f: 'auto' | 'doc' | 'deck') => mutate(st => { st.format = f; }, { ids: null, cause: 'format', label: f === 'auto' ? 'Format: auto' : `Format: ${f}`, immediate: true });

  return (
    <header className="topbar">
      <button className="ibtn" onClick={goHome} aria-label="Back to start" title="Back to start"><Icon name="arrow_back" /></button>
      <div className="tb-title" title={out?.title}>{out?.title || 'Untitled'}</div>
      <button ref={chip} className="fmt-chip" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}
        title={S.format === 'auto' ? 'Inferred from your seeds. Tap to change.' : 'Chosen by you'} data-testid="format-chip">
        <span className="mk">Making:</span> <b>{fmtLabel}</b>{S.format === 'auto' && <span className="muted-t">· Auto</span>}<Icon name="arrow_drop_down" />
      </button>
      {menu && chip.current && (
        <Menu anchor={chip.current} label="What you’re making" header="Making" onClose={() => setMenu(false)} items={[
          { key: 'auto', label: 'Auto', icon: <Icon name="auto_awesome" className="sm" />, note: inferred === 'deck' ? 'deck from your seeds' : 'doc from your seeds', checked: S.format === 'auto', onSelect: () => setFormat('auto') },
          { key: 'doc', label: 'Doc', icon: <Icon name="description" className="sm" />, checked: S.format === 'doc', onSelect: () => setFormat('doc') },
          { key: 'deck', label: 'Deck', icon: <Icon name="slideshow" className="sm" />, checked: S.format === 'deck', onSelect: () => setFormat('deck') },
          { key: 'sheet', label: 'Sheet', icon: <Icon name="table_chart" className="sm" />, note: 'coming later', disabled: true },
        ]} />
      )}
      <div className="hist" role="group" aria-label="History">
        <button className="ibtn" onClick={undo} disabled={!canUndo()} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="undo" /></button>
        <input type="range" min={0} max={Math.max(0, H.entries.length - 1)} value={Math.max(0, idx)} aria-label="History scrubber"
          aria-valuetext={cur ? `Version ${idx + 1} of ${H.entries.length}: ${cur.label}` : ''} title={cur?.label}
          onChange={e => { const e2 = H.entries[+e.target.value]; if (e2) goEntry(e2.id); }} />
        <button className="ibtn" onClick={redo} disabled={!canRedo()} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="redo" /></button>
        <span className="hl">{cur ? `${idx + 1} of ${H.entries.length}` : ''}</span>
      </div>
      <div className={`status ${status.busy ? 'busy' : ''} ${status.quiet ? 'quiet' : ''}`} data-testid="status">
        <span className="dot" aria-hidden="true" />
        <span className="txt">{status.text}</span>
        {status.undo && <button className="undo-l" onClick={undo}>Undo</button>}
      </div>
      <span className="proto-tag top">Concept prototype · sample data</span>
      <button className="ibtn" onClick={toggleTheme} aria-label="Switch light or dark theme" title="Light or dark theme"><Icon name="contrast" /></button>
      <button className="btn filled open-in" onClick={openInApp} data-testid="open-in" aria-label={deck ? 'Open in Slides' : 'Open in Docs'}><span className="long">{deck ? 'Open in Slides' : 'Open in Docs'}</span><span className="short">Open</span></button>
    </header>
  );
}
