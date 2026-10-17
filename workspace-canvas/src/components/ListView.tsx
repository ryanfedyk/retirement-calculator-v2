import { useState } from 'react';
import { CARD_LABEL, deleteSeed, mutate, setSeedText, setStatus, useApp } from '../state/store';
import { groupsOf, spatialRank, isLabelNote } from '../engine/analyze';
import { lineKind, srcInfo } from '../engine/classify';
import { place, cardSize } from '../lib/actions';
import { Icon, TYPE_ICON } from './Icon';
import { traceCard } from '../draft/trace';

/** The same seeds as an outline. Order here is the board's reading order; moving a row swaps positions on the board. */
export function ListView() {
  const S = useApp(s => s.S)!;
  const [add, setAdd] = useState('');
  const rank = spatialRank(S.seeds);
  const groups = groupsOf(S.seeds);
  const items = S.seeds.filter(s => s.type !== 'edits').sort((a, b) => rank[a.id] - rank[b.id]);
  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex(x => x.id === id); const j = i + dir; if (j < 0 || j >= items.length) return;
    const a = items[i], b = items[j];
    mutate(st => { const A = st.seeds.find(x => x.id === a.id)!, B = st.seeds.find(x => x.id === b.id)!; [A.x, B.x] = [B.x, A.x]; [A.y, B.y] = [B.y, A.y]; }, { ids: [a.id, b.id], cause: 'order', label: 'Reordered', immediate: true });
  };
  return (
    <div className="listv">
      <div className="list-wrap" role="list" aria-label="Seeds as a list">
        {items.map(s => {
          const isText = ['note', 'direction', 'assumption', 'format'].includes(s.type);
          let body: React.ReactNode;
          if (isText) body = <textarea rows={Math.max(1, (s.text || '').split('\n').length)} value={s.text || ''} aria-label={CARD_LABEL[s.type]} onChange={e => setSeedText(s.id, e.target.value)} />;
          else if (s.type === 'reference') body = <div className="ltxt">{s.generated ? `“${s.prompt}”` : s.name || 'Reference image'}<small>{s.generated ? 'Generated image' : 'Reference image'}</small></div>;
          else { const info = srcInfo(s); body = <div className="ltxt">{info.title}<small>{info.app}{info.meta ? ' · ' + info.meta : ''}</small></div>; }
          return (
            <div key={s.id} role="listitem" className={`lrow ${s.status === 'muted' ? 'muted' : ''} ${s.status === 'must' ? 'must' : ''} ${groups[s.id] ? 'grouped' : ''}`}
              onMouseEnter={() => traceCard(s.id)} onMouseLeave={() => traceCard(null)}>
              <span className="lic" title={CARD_LABEL[s.type]}><Icon name={isLabelNote(s) ? 'label' : TYPE_ICON[s.type]} className="sm" /></span>
              {body}
              <div className="lt">
                <button className="ibtn sm" onClick={() => move(s.id, -1)} aria-label="Move up"><Icon name="arrow_upward" /></button>
                <button className="ibtn sm" onClick={() => move(s.id, 1)} aria-label="Move down"><Icon name="arrow_downward" /></button>
                <button className="ibtn sm" onClick={() => setStatus(s.id, 'must')} aria-pressed={s.status === 'must'} aria-label="Must use"><Icon name="star" fill={s.status === 'must'} /></button>
                <button className="ibtn sm" onClick={() => setStatus(s.id, 'muted')} aria-pressed={s.status === 'muted'} aria-label="Mute"><Icon name={s.status === 'muted' ? 'visibility_off' : 'visibility'} /></button>
                <button className="ibtn sm" onClick={() => deleteSeed(s.id)} aria-label="Delete"><Icon name="delete" /></button>
              </div>
            </div>
          );
        })}
        <label className="ladd"><Icon name="add" className="sm" />
          <input value={add} onChange={e => setAdd(e.target.value)} placeholder="Add a line and press Enter" aria-label="Add a line"
            onKeyDown={e => {
              if (e.key !== 'Enter' || !add.trim()) return;
              const v = add.trim(); const maxY = Math.max(40, ...S.seeds.map(s => s.y + cardSize(s).h)); const k = lineKind(v);
              const minX = Math.min(80, ...S.seeds.map(s => s.x));
              place({ type: k === 'empty' ? 'note' : k, text: v, x: minX, y: maxY + 24 }, { label: 'Added ' + CARD_LABEL[k === 'empty' ? 'note' : k].toLowerCase() });
              setAdd('');
            }} />
        </label>
      </div>
    </div>
  );
}
