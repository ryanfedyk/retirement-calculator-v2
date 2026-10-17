import { useEffect, useRef, useState } from 'react';
import { RECIPES, SIGNALS, setSignalsOff } from '../engine/classify';
import { openCanvas, useApp } from '../state/store';
import { startBlank, startRecipe, startWithFiles } from '../lib/actions';
import { AppIcon, Icon } from './Icon';
import { toggleTheme } from './App';

const readOff = (): string[] => { try { return JSON.parse(localStorage.getItem('wc.signalsOff') || '[]'); } catch { return []; } };

function timeAgo(t: number) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.round(d / 60) + ' min ago'; if (d < 86400) return Math.round(d / 3600) + ' h ago';
  return Math.round(d / 86400) + ' d ago';
}

export function Landing() {
  const recents = useApp(s => s.recents);
  const aiMode = useApp(s => s.aiMode);
  const [val, setVal] = useState('');
  const [drag, setDrag] = useState(false);
  const [off, setOff] = useState<string[]>(readOff);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setSignalsOff(off); try { localStorage.setItem('wc.signalsOff', JSON.stringify(off)); } catch { /* optional */ } }, [off]);

  return (
    <section className="landing" aria-label="Start"
      onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = [...e.dataTransfer.files]; if (f.length) startWithFiles(f); }}>
      <div className="land-wrap">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <b>Workspace Canvas</b>
          <span className="proto-tag">Concept prototype · sample data</span>
          <span className="spacer" />
          <button className="ibtn" onClick={toggleTheme} aria-label="Switch light or dark theme" title="Light or dark theme"><Icon name="contrast" /></button>
        </div>
        <h1 className="land-q">What are you making?</h1>
        <form className="ask" autoComplete="off" onSubmit={e => { e.preventDefault(); const v = val.trim(); startBlank(v ? v + '\n' : ''); }}>
          <input ref={input} value={val} onChange={e => setVal(e.target.value)} placeholder="Type an idea, a few notes, or what you need to make" aria-label="What are you making?" />
          <button className="btn filled" type="submit">Start <Icon name="arrow_forward" /></button>
        </form>
        <div className="signals" role="group" aria-label="Workspace signals used for related sources">
          <span>Using your Workspace:</span>
          {SIGNALS.map(s => {
            const on = !off.includes(s.k);
            return <button key={s.k} className="chip-f" aria-pressed={on} onClick={() => setOff(on ? [...off, s.k] : off.filter(x => x !== s.k))}>
              <Icon name={on ? 'check' : 'add'} className="xs" />{s.label}</button>;
          })}
        </div>
        <div>
          <h2 className="sec-label">Ready to start</h2>
          <div className="recipes">
            {RECIPES.map(r => (
              <button key={r.id} className="recipe" data-recipe={r.id} onClick={() => startRecipe(r.id)}>
                <h3>{r.title}</h3>
                <div className="why">{r.why}</div>
                <div className="foot">
                  <span className="apps">{r.apps.map(a => <AppIcon key={a} kind={a} />)}</span>
                  <span className="fmt"><Icon name={r.format === 'deck' ? 'slideshow' : 'description'} className="xs" />{r.format === 'deck' ? 'Deck' : 'Doc'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        {recents.length > 0 && (
          <div>
            <h2 className="sec-label">Recent canvases</h2>
            <div className="recents">
              {recents.slice(0, 8).map(r => (
                <button key={r.id} className="recent" onClick={() => openCanvas(r.id)}>
                  <div className={`mini ${r.format === 'deck' ? 'deck' : ''}`} aria-hidden="true"><i style={{ width: '70%', height: 7, background: 'var(--md-on-surface-variant)' }} /><i style={{ width: '90%' }} /><i style={{ width: '78%' }} /><i style={{ width: '55%' }} /></div>
                  <div className="rt">{r.title || 'Untitled'}</div>
                  <div className="rm"><Icon name={r.format === 'deck' ? 'slideshow' : 'description'} className="xs" />{r.format === 'deck' ? 'Deck' : 'Doc'} · {timeAgo(r.t)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="land-foot"><Icon name="info" className="sm" />
          <span>Drop files anywhere on this page to start a canvas with them as sources. Emails, meetings, files and chats here are fictional sample data.
            {aiMode === 'local' && ' AI writing is off (no API key), so drafts come from the built-in local writer.'}
            {aiMode === 'claude' && ' AI writing is on.'}</span></p>
      </div>
      {drag && <div className="land-drop">Drop to start a canvas with these files</div>}
    </section>
  );
}
