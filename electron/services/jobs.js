// Tâches longues : progression temps réel (événement 'job'), annulation, une seule instance par clé.
let emit = () => {}; const running = new Map();
const init = (e) => { emit = e; };
async function run(key, fn) {
  if (running.has(key)) return { ok: false, error: 'BUSY' };
  let last = 0; const ctx = { cancelled: false, isCancelled: () => ctx.cancelled,
    progress(pct, msg, data) { const n = Date.now(); if (n - last < 90 && pct < 100) return; last = n; emit('job', { key, state: 'progress', pct: Math.max(0, Math.min(100, Math.round(pct * 10) / 10)), msg, data }); } };
  running.set(key, ctx); emit('job', { key, state: 'start', pct: 0 });
  try { const result = await fn(ctx); const c = ctx.cancelled; emit('job', { key, state: c ? 'cancelled' : 'done', pct: 100, result }); return { ok: true, cancelled: c, result }; }
  catch (e) { emit('job', { key, state: 'error', msg: e.message }); return { ok: false, error: e.message }; }
  finally { running.delete(key); }
}
const cancel = (key) => { const c = running.get(key); if (c) { c.cancelled = true; return true; } return false; };
const isRunning = (key) => running.has(key);
module.exports = { init, run, cancel, isRunning };
