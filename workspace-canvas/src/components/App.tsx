import { useEffect, useState } from 'react';
import { useApp, loadRecents, saveNow, flushCommit } from '../state/store';
import { checkAI } from '../draft/pipeline';
import { Landing } from './Landing';
import { CanvasView } from './CanvasView';
import { Overlays } from './Overlays';

export type ThemePref = 'system' | 'light' | 'dark';
const readPref = (): ThemePref => { try { return (localStorage.getItem('wc.theme') as ThemePref) || 'system'; } catch { return 'system'; } };

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref; };
    apply(); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply);
  }, [pref]);
  const cycle = () => {
    const cur = document.documentElement.dataset.theme;
    const next: ThemePref = cur === 'dark' ? 'light' : 'dark';
    setPref(next); try { localStorage.setItem('wc.theme', next); } catch { /* per-viewer convenience only */ }
  };
  return { pref, cycle };
}
// One theme controller for the whole app.
let themeApi: ReturnType<typeof useTheme> | null = null;
export const toggleTheme = () => themeApi?.cycle();

export function App() {
  const screen = useApp(s => s.screen);
  themeApi = useTheme();
  useEffect(() => {
    checkAI(); loadRecents();
    const save = () => { flushCommit(); saveNow(); };
    window.addEventListener('beforeunload', save);
    const vis = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('beforeunload', save); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return (
    <div className="app">
      {screen === 'landing' ? <Landing /> : <CanvasView />}
      <Overlays />
    </div>
  );
}
