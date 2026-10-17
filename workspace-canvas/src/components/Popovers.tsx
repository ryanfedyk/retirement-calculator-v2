import { useEffect, useRef, useState } from 'react';
import { autoSources, CORPUS, corpusById } from '../engine/classify';
import { mutate, setTool, useApp, type Tool } from '../state/store';
import { addCorpus, addLink, addSampleRef, generateRef } from '../lib/actions';
import { artFor } from '../lib/color';
import { AppIcon, Icon } from './Icon';

const SAMPLE_REFS = [{ p: 'quiet mono minimal', n: 'Quiet mono' }, { p: 'bold neon geometric', n: 'Bold neon' }, { p: 'soft pastel gentle', n: 'Soft pastel' }];
let sampleArt: { url: string }[] | null = null;

export function Popover({ kind, onClose, pickFile }: { kind: Tool; onClose: () => void; pickFile: (k: 'image' | 'source') => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!ref.current?.contains(t) && !t.closest('.toolbar')) onClose(); };
    document.addEventListener('pointerdown', down, true); return () => document.removeEventListener('pointerdown', down, true);
  }, [onClose]);
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
  return (
    <div ref={ref} className="pop" role="dialog" aria-label={kind === 'source' ? 'Sources' : kind === 'image' ? 'Reference image' : kind === 'generate' ? 'Generate an image' : 'Add from your Workspace'} onKeyDown={onKey} onPointerDown={e => e.stopPropagation()}>
      {kind === 'source' && <SourcePop onClose={onClose} pickFile={pickFile} />}
      {kind === 'at' && <AtPop onClose={onClose} />}
      {kind === 'image' && <ImagePop onClose={onClose} pickFile={pickFile} />}
      {kind === 'generate' && <GenPop onClose={onClose} />}
    </div>
  );
}

function SourcePop({ onClose, pickFile }: { onClose: () => void; pickFile: (k: 'image' | 'source') => void }) {
  const S = useApp(s => s.S)!;
  const autos = autoSources(S);
  const [link, setLink] = useState('');
  return <>
    <h4><Icon name="auto_awesome" className="sm" />Auto-added sources <span className="count">{autos.length}</span></h4>
    <div className="muted-t" style={{ marginTop: -6 }}>Pulled from your Workspace because they match this canvas, and re-ranked as it changes. They shape the draft lightly. Remove any that don’t belong, or put one on the canvas to give it full weight.</div>
    <div data-testid="auto-sources">
      {autos.length ? autos.map(a => (
        <div className="row" key={a.id}><AppIcon kind={a.kind} />
          <div className="rt"><b>{a.title}</b><small>{a.app} · {a.best}</small></div>
          <button className="ibtn sm" onClick={() => addCorpus(a.id)} aria-label={`Put ${a.title} on the canvas`} title="Put on the canvas"><Icon name="add_circle" /></button>
          <button className="ibtn sm" onClick={() => mutate(st => { st.pruned.push(a.id); }, { ids: ['auto:' + a.id], cause: 'auto-source', label: 'Removed auto-added source', immediate: true })} aria-label={`Remove ${a.title}`} title="Remove"><Icon name="close" /></button>
        </div>)) : <div className="muted-t">Nothing yet. Add a few notes and related items from your Workspace gather here.</div>}
    </div>
    {S.pruned.length > 0 && <button className="btn text sm" style={{ alignSelf: 'flex-start' }} onClick={() => mutate(st => { st.pruned = []; }, { ids: null, cause: 'auto-source', label: 'Restored removed sources', immediate: true })}>Restore {S.pruned.length} removed</button>}
    <h4><Icon name="add_link" className="sm" />Add a source</h4>
    <form className="field" onSubmit={e => { e.preventDefault(); if (link.trim()) { addLink(link.trim()); onClose(); } }}>
      <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="Paste a link" aria-label="Link" />
      <button className="btn tonal sm" type="submit">Add</button>
    </form>
    <div className="chips">
      <button onClick={() => pickFile('source')}><Icon name="upload_file" />Upload a file</button>
      <button onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('wc:pop', { detail: 'at' })), 0); }}><Icon name="alternate_email" />Find in Workspace</button>
    </div>
  </>;
}

function AtPop({ onClose }: { onClose: () => void }) {
  const S = useApp(s => s.S)!;
  const [q, setQ] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inp.current?.focus(), 20); }, []);
  const on = new Set(S.seeds.filter(s => s.srcId).map(s => s.srcId));
  const ql = q.toLowerCase().trim();
  const items = CORPUS.filter(c => !on.has(c.id) && (!ql || (c.title + ' ' + c.text + ' ' + c.app).toLowerCase().includes(ql)));
  return <>
    <h4><Icon name="alternate_email" className="sm" />Add from your Workspace</h4>
    <div className="field"><input ref={inp} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search email, meetings, files and chats" aria-label="Search Workspace"
      onKeyDown={e => { if (e.key === 'Enter' && items[0]) { addCorpus(items[0].id); onClose(); } }} /></div>
    <div role="list">
      {items.length ? items.map(c => (
        <button key={c.id} role="listitem" className="row pick" data-corpus={c.id} onClick={() => { addCorpus(c.id); onClose(); }}>
          <AppIcon kind={c.kind} /><span className="rt"><b>{c.title}</b><small>{c.app} · {c.meta}</small></span></button>
      )) : <div className="muted-t">No matches. Try another word.</div>}
    </div>
    <div className="muted-t">Sample Workspace data for the prototype.</div>
  </>;
}

function ImagePop({ onClose, pickFile }: { onClose: () => void; pickFile: (k: 'image' | 'source') => void }) {
  sampleArt ||= SAMPLE_REFS.map(r => artFor(r.p));
  return <>
    <h4><Icon name="image" className="sm" />Reference image</h4>
    <div className="muted-t" style={{ marginTop: -6 }}>Add a picture of a look you like. The draft picks up its colors, mood and cover art. You can also paste or drop images straight onto the canvas.</div>
    <button className="btn tonal" onClick={() => pickFile('image')}><Icon name="upload" />Upload an image</button>
    <h4>Or try a sample</h4>
    <div className="samples">{SAMPLE_REFS.map((r, i) => (
      <button key={r.n} aria-label={`Sample look: ${r.n}`} onClick={() => { addSampleRef(r.p, r.n); onClose(); }}><img alt="" src={sampleArt![i].url} /></button>))}</div>
  </>;
}

function GenPop({ onClose }: { onClose: () => void }) {
  const ai = useApp(s => s.aiMode);
  const [v, setV] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inp.current?.focus(), 20); }, []);
  return <>
    <h4><Icon name="auto_awesome" className="sm" />Generate an image</h4>
    <form className="field" onSubmit={e => { e.preventDefault(); if (v.trim()) { onClose(); setTool('select'); generateRef(v.trim()); } }}>
      <input ref={inp} value={v} onChange={e => setV(e.target.value)} placeholder="Describe the look, like “calm ocean gradient”" aria-label="Image prompt" />
      <button className="btn filled sm" type="submit">Generate</button>
    </form>
    <div className="chips">{['calm ocean gradient', 'warm sunset glow', 'deep night sky', 'fresh forest green', 'gold and charcoal'].map(t => (
      <button key={t} type="button" onClick={() => { setV(t); inp.current?.focus(); }}>{t}</button>))}</div>
    <div className="muted-t">Placed on the canvas as a reference image. {ai === 'claude' ? 'Claude draws abstract art from your words.' : 'Without an API key, the prototype draws a stand-in from your words.'}</div>
  </>;
}

export { corpusById };
