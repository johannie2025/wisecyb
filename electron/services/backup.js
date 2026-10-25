// Sauvegardes avant toute modification : export .reg, copies de fichiers, XML de tâches. Restauration en un clic.
const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { run, readJson, writeJson, log } = require('./util');
const ROOT = path.join(cfg.BACKUP, 'sets');
const okKey = (k) => /^(HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER|HKEY_CLASSES_ROOT|HKLM|HKCU)\\[^"<>|*?]{3,1000}$/i.test(k);
function begin(label) { const id = new Date().toISOString().replace(/[:.]/g, '-') + '_' + Math.random().toString(36).slice(2, 6); const dir = path.join(ROOT, id); fs.mkdirSync(dir, { recursive: true });
  const set = { id, label, date: new Date().toISOString(), dir, items: [], _n: 0 }; return set; }
async function exportKey(set, key) {
  if (!okKey(key)) return false; if (set.items.some(i => i.type === 'reg' && i.key.toLowerCase() === key.toLowerCase())) return true;
  const file = path.join(set.dir, `reg${++set._n}.reg`); const r = await run('reg', ['export', key, file, '/y']); if (!r.ok || !fs.existsSync(file)) return false;
  set.items.push({ type: 'reg', key, file }); return true;
}
function copyFile(set, src, label) { try { const dst = path.join(set.dir, `f${++set._n}_` + path.basename(src)); fs.copyFileSync(src, dst); set.items.push({ type: 'file', original: src, file: dst, label }); return true; } catch { return false; } }
function addText(set, name, text, meta = {}) { const f = path.join(set.dir, `t${++set._n}_` + name.replace(/[^\w.\-]/g, '_')); fs.writeFileSync(f, text); set.items.push({ type: 'text', file: f, name, ...meta }); return f; }
function moveFile(set, src, label) { try { const dst = path.join(set.dir, `m${++set._n}_` + path.basename(src)); try { fs.renameSync(src, dst); } catch { fs.copyFileSync(src, dst); fs.unlinkSync(src); } set.items.push({ type: 'file', original: src, file: dst, label }); return true; } catch { return false; } }
function commit(set) { if (!set.items.length) { try { fs.rmSync(set.dir, { recursive: true, force: true }); } catch {} return null; } const { dir, _n, ...m } = set; writeJson(path.join(set.dir, 'manifest.json'), m); return set.id; }
function list() { try { return fs.readdirSync(ROOT).map(d => readJson(path.join(ROOT, d, 'manifest.json'), null)).filter(Boolean).map(m => ({ id: m.id, label: m.label, date: m.date, count: m.items.length })).sort((a, b) => b.date.localeCompare(a.date)); } catch { return []; } }
async function restore(id) {
  if (!/^[\w\-]+$/.test(id)) return { ok: false, error: 'ID' }; const m = readJson(path.join(ROOT, id, 'manifest.json'), null); if (!m) return { ok: false, error: 'INTROUVABLE' }; let n = 0, fail = 0;
  for (const it of m.items) {
    if (it.type === 'reg') { const r = await run('reg', ['import', it.file]); r.ok ? n++ : fail++; }
    else if (it.type === 'file') { try { fs.mkdirSync(path.dirname(it.original), { recursive: true }); fs.copyFileSync(it.file, it.original); n++; } catch { fail++; } }
  }
  log('backup', `restore ${id}: ${n} ok, ${fail} échecs`); return { ok: true, restored: n, failed: fail };
}
function remove(id) { if (!/^[\w\-]+$/.test(id)) return false; try { fs.rmSync(path.join(ROOT, id), { recursive: true, force: true }); return true; } catch { return false; } }
module.exports = { begin, exportKey, copyFile, moveFile, addText, commit, list, restore, remove, okKey };
