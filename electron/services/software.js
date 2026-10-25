// Mise à jour des logiciels via winget (liste réelle + mise à jour sélective)
const { run, isWin } = require('./util');
function parseUpgrades(out) { // analyse le tableau de `winget upgrade` à partir des positions de colonnes de l'en-tête
  const lines = String(out).split(/\r?\n/).map(l => l.replace(/[\u0008]/g, '')); const di = lines.findIndex(l => /^-{5,}\s*$/.test(l.trim())); if (di < 1) return [];
  const head = lines[di - 1]; const cols = [...head.matchAll(/\S+(?: \S+)*/g)].map(m => ({ name: m[0], at: m.index })); if (cols.length < 4) return []; const rows = [];
  for (const l of lines.slice(di + 1)) { if (!l.trim() || /^\d+\s+\S+/.test(l.trim()) && /(upgrade|mise|actualiz)/i.test(l)) break; if (l.length < cols[1].at) continue;
    const g = (i) => l.slice(cols[i].at, cols[i + 1] ? cols[i + 1].at : undefined).trim(); const id = g(1); if (!/^[\w.\-+]+$/.test(id)) continue; rows.push({ name: g(0), id, version: g(2), available: g(3), source: cols[4] ? g(4) : '' }); }
  return rows;
}
async function listUpdates() { if (!isWin) return { ok: false, error: 'Windows uniquement', items: [] }; const r = await run('winget', ['upgrade', '--accept-source-agreements', '--disable-interactivity'], { timeout: 120000 });
  if (!r.out && r.err) return { ok: false, error: /not recognized|n'est pas reconnu|ENOENT/i.test(r.err) ? 'winget introuvable (installez « App Installer » depuis le Microsoft Store)' : r.err.slice(0, 160), items: [] }; return { ok: true, items: parseUpgrades(r.out) }; }
async function upgrade(ids, ctx) {
  const res = []; for (let i = 0; i < ids.length; i++) { if (ctx.isCancelled()) break; const id = ids[i]; if (!/^[\w.\-+]+$/.test(id)) { res.push({ id, ok: false }); continue; }
    ctx.progress((i / ids.length) * 100, `Mise à jour ${i + 1}/${ids.length} : ${id}`); const r = await run('winget', ['upgrade', '--id', id, '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'], { timeout: 1800000 }); res.push({ id, ok: r.ok }); }
  ctx.progress(100, 'Terminé'); return res;
}
module.exports = { listUpdates, upgrade, parseUpgrades };
