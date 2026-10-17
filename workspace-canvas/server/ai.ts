/*
 * The local server, as a Vite plugin: the API key is read here and never sent to the browser.
 *   GET  /api/status  -> which writer is active
 *   POST /api/draft   -> streams draft parts as text ("=== key" sections)
 *   POST /api/image   -> an SVG reference image from a prompt
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { buildUserPrompt, IMAGE_SYSTEM, SYSTEM, type DraftRequest } from './prompt';

type Env = Record<string, string | undefined>;

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>(r => { const t = setTimeout(r, ms); signal.addEventListener('abort', () => { clearTimeout(t); r(); }); });

export function sanitizeSvg(raw: string): string | null {
  const m = raw.match(/<svg[\s\S]*<\/svg>/i); if (!m) return null;
  let s = m[0];
  s = s.replace(/<(script|foreignObject|image|iframe|a)\b[\s\S]*?<\/\1>/gi, '').replace(/<(script|foreignObject|image|iframe)\b[^>]*\/>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  return s;
}

export function aiPlugin(env: Env): Plugin {
  const key = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  const fake = (env.WC_FAKE_AI || process.env.WC_FAKE_AI) === '1';
  const model = env.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
  const effort = (env.ANTHROPIC_EFFORT || process.env.ANTHROPIC_EFFORT || 'low') as 'low' | 'medium' | 'high';
  const client = key ? new Anthropic({ apiKey: key }) : null;
  const mode = client ? 'claude' : fake ? 'fake' : 'local';
  let fallbackOk = true;

  async function streamDraft(r: DraftRequest, res: ServerResponse, signal: AbortSignal) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    if (mode === 'fake') {
      // Test double: streams the skeletons back slowly so the streaming path can be exercised without a key.
      await sleep(300, signal);
      for (const b of r.blocks) {
        const text = `=== ${b.key}\n${b.md}\n`;
        for (let i = 0; i < text.length && !signal.aborted; i += 12) { res.write(text.slice(i, i + 12)); await sleep(8, signal); }
      }
      res.end(); return;
    }
    const params: any = {
      model, max_tokens: 6000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserPrompt(r) }],
      output_config: { effort },
    };
    const run = async (withFallback: boolean) => {
      const p = withFallback ? { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : params;
      const stream = client!.beta.messages.stream(p, { signal });
      for await (const ev of stream as AsyncIterable<any>) {
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') res.write(ev.delta.text);
      }
      const final: any = await stream.finalMessage();
      if (final?.stop_reason === 'refusal') res.write('\n=== __error\nThe model declined this request.\n');
    };
    try { await run(fallbackOk); }
    catch (e) {
      if (signal.aborted) { res.end(); return; }
      if (fallbackOk && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
        fallbackOk = false; // this account or SDK doesn't take server-side fallbacks; carry on without
        try { await run(false); } catch (e2) { res.write(`\n=== __error\n${(e2 as Error).message}\n`); }
      } else res.write(`\n=== __error\n${(e as Error).message}\n`);
    }
    res.end();
  }

  async function makeImage(prompt: string, signal: AbortSignal) {
    const msg: any = await client!.messages.create({
      model, max_tokens: 8000, system: IMAGE_SYSTEM, output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `Make reference art for: ${prompt}` }],
    } as any, { signal });
    const text = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    return sanitizeSvg(text);
  }

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    if (!url.startsWith('/api/')) return next();
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    try {
      if (url.startsWith('/api/status')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ai: mode !== 'local', mode, model: mode === 'claude' ? model : null })); return;
      }
      if (url.startsWith('/api/draft') && req.method === 'POST') {
        if (mode === 'local') { res.writeHead(503); res.end('No API key'); return; }
        await streamDraft(await readBody(req), res, ac.signal); return;
      }
      if (url.startsWith('/api/image') && req.method === 'POST') {
        if (mode !== 'claude') { res.writeHead(503); res.end('No API key'); return; }
        const { prompt } = await readBody(req);
        const svg = await makeImage(String(prompt || '').slice(0, 200), ac.signal);
        res.writeHead(svg ? 200 : 502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ svg })); return;
      }
      res.writeHead(404); res.end();
    } catch (e) {
      if (!res.headersSent) { res.writeHead(500); }
      res.end(ac.signal.aborted ? '' : String((e as Error).message || e));
    }
  };

  return {
    name: 'workspace-canvas-ai',
    configureServer(server) {
      server.middlewares.use(handler);
      server.httpServer?.once('listening', () => setTimeout(() => console.log(
        mode === 'claude' ? `\n  ✦ AI drafting on (${model}). Your key stays on this computer.\n`
          : mode === 'fake' ? '\n  ✦ Test mode: simulated AI streaming.\n'
            : '\n  ✦ No ANTHROPIC_API_KEY found: using the built-in local writer. Add a key to .env for AI drafting.\n'), 50));
    },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
