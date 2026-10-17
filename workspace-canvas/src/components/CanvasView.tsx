import { useEffect } from 'react';
import { useApp, undo, redo, deleteSeed, setStatus, setTool, select, setEditing, closeDialog, addSeed, type Tool, setView } from '../state/store';
import { lineKind } from '../engine/classify';
import { spatialRank } from '../engine/analyze';
import { addFile, addLink, cardEl, place } from '../lib/actions';
import { TopBar } from './TopBar';
import { Board } from './Board';
import { DraftPanel } from './DraftPanel';

const isEditing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.matches('input,textarea,select') || a.isContentEditable); };

export function CanvasView() {
  const mode = useApp(s => s.S?.draftMode);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useApp.getState(); const S = st.S; if (!S) return;
      const editing = isEditing(); const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (st.dialog) { closeDialog(); return; }
        if (st.tool !== 'select') { setTool('select'); return; }
        if (S.draftMode === 'max') { setView({ draftMode: 'normal' }); return; }
        if (!editing) select(null);
        return;
      }
      if (st.dialog) return;
      if (mod && e.key.toLowerCase() === 'z' && !editing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !editing) { e.preventDefault(); redo(); return; }
      if (editing || mod || e.altKey) return;
      const k = e.key; const sel = st.selId;
      if (k === '@') { e.preventDefault(); setTool('at'); return; }
      if (sel && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); deleteSeed(sel); return; }
      if (sel && (k === 'm' || k === 'M')) { setStatus(sel, 'muted'); return; }
      if (sel && (k === 'u' || k === 'U')) { setStatus(sel, 'must'); return; }
      if (sel && k === 'Enter') { const ta = cardEl(sel)?.querySelector('textarea'); if (ta) { e.preventDefault(); setEditing(sel); } return; }
      if (k.startsWith('Arrow') && S.view === 'board') {
        const rank = spatialRank(S.seeds); const items = [...S.seeds].sort((a, b) => rank[a.id] - rank[b.id]); if (!items.length) return;
        e.preventDefault(); let i = items.findIndex(s => s.id === sel);
        i = k === 'ArrowLeft' || k === 'ArrowUp' ? Math.max(0, i - 1) : Math.min(items.length - 1, i + 1);
        select(items[i].id); cardEl(items[i].id)?.focus({ preventScroll: true }); return;
      }
      const map: Record<string, Tool> = { v: 'select', n: 'note', s: 'source', i: 'image', g: 'generate' };
      if (!sel && k.length === 1 && map[k.toLowerCase()] && S.view === 'board' && !e.shiftKey) { e.preventDefault(); setTool(map[k.toLowerCase()]); return; }
      // Typing anywhere starts a note.
      if (k.length === 1 && /\S/.test(k) && S.view === 'board') { e.preventDefault(); setTool('select'); place({ type: 'note', text: k }, { label: 'Added note', focus: true }); }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditing() || !useApp.getState().S) return;
      const items = [...(e.clipboardData?.items || [])];
      const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean) as File[];
      if (files.length) { e.preventDefault(); files.forEach(f => addFile(f)); return; }
      const t = e.clipboardData?.getData('text/plain')?.trim();
      if (t) { e.preventDefault(); if (/^https?:\/\/\S+$/.test(t)) addLink(t); else { const k = lineKind(t); place({ type: t.includes('\n') || k === 'empty' ? 'note' : k, text: t }, { label: 'Pasted note' }); } }
    };
    document.addEventListener('keydown', onKey); document.addEventListener('paste', onPaste);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); };
  }, []);
  void addSeed;
  return (
    <section className="app" aria-label="Canvas" style={{ height: '100%' }}>
      <TopBar />
      <div className={`main ${mode === 'min' ? 'min' : ''}`}>
        <Board />
        <DraftPanel />
      </div>
    </section>
  );
}
