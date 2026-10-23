const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cfg = require('../config');
const { hashFile, log, readJson, writeJson, run, ps, killByPath } = require('./util');
const lic = require('./license');
const settings = require('./settings');
const rollback = require('./rollback');

let emit = () => {}; let watcher = null, watcher2 = null; let enabled = false; let dbGen = 0;
let hashes = new Map(); let yara = [];
const stats = { scanned: 0, threats: 0, quarantined: 0 };
const SKIP = /(\\Windows\\|\\WiseCybersecurity\\|\\node_modules\\|\\\$Recycle\.Bin\\|\\System Volume Information\\|\\AppData\\Local\\Temp\\.*\.tmp$)/i;
const EXEC = /\.(exe|scr|dll|bat|cmd|vbs|js|jse|ps1|msi|com|pif|hta|lnk|jar)$/i;
const DOUBLE = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|mp3|mp4|zip|rar)\.(exe|scr|bat|cmd|vbs|js|com|pif)$/i;
const RANSOM_EXT = /\.(locked|crypt|crypted|enc|encrypted|wncry|lockbit|ryuk|zepto|cerber)$/i;
const isExcluded = (f) => settings.get().exclusions.some(x => f.toLowerCase().startsWith(x.toLowerCase()));

// ---- file d'attente (2 analyses en parallèle max) + cache des fichiers sains
let active = 0; const q = [];
const enqueue = (fn) => new Promise(res => { q.push({ fn, res }); pump(); });
function pump() { while (active < 2 && q.length) { const { fn, res } = q.shift(); active++; fn().then(res, res).finally(() => { active--; pump(); }); } }
const clean = new Map(); const recent = new Map();

function reloadSignatures() {
  dbGen++; clean.clear(); hashes = new Map(); yara = [];
  try { for (const l of fs.readFileSync(path.join(cfg.SIGS, 'malware_hashes.ndb'), 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const [h, name] = t.split(':'); if (h && /^[a-f0-9]{32,64}$/i.test(h)) hashes.set(h.toLowerCase(), name || 'Malware.Generic'); } } catch {}
  try { // YARA-lite : chaînes texte des règles (condition "any of them" ou "all of them")
    const src = fs.readFileSync(path.join(cfg.SIGS, 'custom_rules.yar'), 'utf8');
    for (const m of src.matchAll(/rule\s+(\w+)[^{]*\{([\s\S]*?)\}\s*(?=rule\s|$)/g)) { const strs = [...m[2].matchAll(/\$\w+\s*=\s*"([^"]+)"/g)].map(x => x[1]); if (strs.length) yara.push({ name: m[1], strs, all: /condition:\s*all of/.test(m[2]) }); }
  } catch {}
}
function heuristics(file) { const r = []; if (DOUBLE.test(file)) r.push('Heur.DoubleExtension'); if (RANSOM_EXT.test(file)) r.push('Heur.RansomwareExtension'); if (/autorun\.inf$/i.test(file)) r.push('Heur.Autorun'); return r; }
function yaraScan(buf) { const t = buf.toString('latin1'); for (const r of yara) { const hit = r.all ? r.strs.every(s => t.includes(s)) : r.strs.some(s => t.includes(s)); if (hit) return 'YARA.' + r.name; } return null; }
async function cloudLookup(sha) { try { const { data } = await axios.post(cfg.API + '/scan/hash', { sha256: sha }, { timeout: 8000 }); return data.malicious ? (data.name || 'Cloud.Malware') : null; } catch { return null; } }
async function scanFile(file, { cloud = true } = {}) {
  try {
    const st = fs.statSync(file); if (!st.isFile() || st.size > 300 * 1024 * 1024) return { clean: true };
    const ck = `${st.mtimeMs}:${st.size}:${dbGen}`; if (clean.get(file) === ck) return { clean: true }; stats.scanned++;
    const sha = await hashFile(file); let v = hashes.get(sha) || null; if (!v) v = hashes.get(await hashFile(file, 'md5')) || null;
    if (!v && yara.length && st.size < 20 * 1024 * 1024 && EXEC.test(file)) v = yaraScan(fs.readFileSync(file));
    if (!v) { const h = heuristics(file); if (h.length) v = h[0]; }
    if (!v && cloud && EXEC.test(file)) v = await cloudLookup(sha);
    if (!v) { if (clean.size > 50000) clean.clear(); clean.set(file, ck); return { clean: true, sha }; }
    return { clean: false, threat: v, sha };
  } catch { return { clean: true }; }
}
async function quarantine(file, threat, sha) {
  try {
    await killByPath(file); const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8); const dest = path.join(cfg.QUAR, id + '.wq');
    const buf = fs.readFileSync(file); for (let i = 0; i < buf.length; i++) buf[i] ^= 0x5a; fs.writeFileSync(dest, buf); // XOR : neutralise l'exécution
    try { fs.unlinkSync(file); } catch { fs.unlinkSync(dest); return null; }
    writeJson(path.join(cfg.QUAR, id + '.json'), { id, original: file, threat, sha, date: new Date().toISOString() }); stats.quarantined++; return id;
  } catch (e) { log('error', 'quarantine ' + e.message); return null; }
}
const listQuarantine = () => fs.readdirSync(cfg.QUAR).filter(f => f.endsWith('.json')).map(f => readJson(path.join(cfg.QUAR, f), null)).filter(Boolean);
function restore(id) { const m = readJson(path.join(cfg.QUAR, id + '.json'), null); if (!m) return false; const b = fs.readFileSync(path.join(cfg.QUAR, id + '.wq')); for (let i = 0; i < b.length; i++) b[i] ^= 0x5a; fs.mkdirSync(path.dirname(m.original), { recursive: true }); fs.writeFileSync(m.original, b); removeQ(id); return true; }
function removeQ(id) { for (const e of ['.wq', '.json']) try { fs.unlinkSync(path.join(cfg.QUAR, id + e)); } catch {} return true; }
async function report(file, threat, sha, source) {
  stats.threats++; const id = await quarantine(file, threat, sha);
  const ev = { file, threat, sha, source, quarantined: !!id, date: new Date().toISOString() }; log('threat', JSON.stringify(ev)); emit('threat', ev);
  axios.post(cfg.API + '/telemetry/alert', { hwid: lic.hwid(), type: 'threat', ...ev }, { timeout: 8000 }).catch(() => {});
}
async function handle(file, source = 'realtime') {
  if (SKIP.test(file) || isExcluded(file)) return; const t = Date.now(); if (recent.get(file) > t - 3000) return; recent.set(file, t); if (recent.size > 5000) recent.clear();
  const r = await enqueue(() => scanFile(file)); if (r && !r.clean) await report(file, r.threat, r.sha, source);
}
const forceQuarantine = (file, threat, source) => report(file, threat, null, source);

// ---- anti-ransomware : pic de modifications / extensions de chiffrement dans les dossiers sensibles
let burst = [], ransomOn = true, lastAlert = 0;
function ransomWatch(file) {
  if (!ransomOn) return; const now = Date.now(); burst.push(now); burst = burst.filter(t => now - t < 10000);
  if ((burst.length > 40 || RANSOM_EXT.test(file)) && now - lastAlert > 30000) { lastAlert = now; rollback.freeze(true); emit('ransomware', { file, count: burst.length, date: new Date().toISOString() }); log('ransomware', file); burst = []; }
}
async function start(e) {
  emit = e; reloadSignatures(); ransomOn = settings.get().ransom; await enableRealtime(true);
  const prot = ['Documents', 'Desktop', 'Pictures'].map(d => path.join(process.env.USERPROFILE || '', d)).filter(fs.existsSync);
  if (prot.length) watcher2 = chokidar.watch(prot, { ignoreInitial: true, depth: 5, ignorePermissionErrors: true }).on('all', (ev, f) => { if (['add', 'change', 'unlink'].includes(ev)) ransomWatch(f); }).on('error', () => {});
}
async function roots() { const r = await ps('Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -ExpandProperty DeviceID'); const d = r.out.split('\n').map(s => s.trim()).filter(s => /^[A-Z]:$/.test(s)).map(s => s + '\\'); return d.length ? d : ['C:\\']; }
async function enableRealtime(on) {
  enabled = on; if (watcher) { await watcher.close(); watcher = null; } if (!on) return enabled;
  watcher = chokidar.watch(await roots(), { ignoreInitial: true, ignored: p => SKIP.test(p), awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 200 }, depth: 8, ignorePermissionErrors: true, persistent: true }).on('add', f => handle(f)).on('change', f => handle(f)).on('error', () => {});
  return enabled;
}
// ClamAV optionnel (clamscan.exe dans %PROGRAMDATA%\WiseCybersecurity\clamav ou Program Files) : utilisé pour les analyses manuelles
const clamPath = () => [path.join(cfg.BASE, 'clamav', 'clamscan.exe'), 'C:\\Program Files\\ClamAV\\clamscan.exe'].find(p => fs.existsSync(p)) || null;
async function clamDir(target, onProgress) {
  const p = clamPath(); if (!p) return 0; onProgress && onProgress({ done: 0, total: 1, found: 0, current: 'ClamAV…' });
  const r = await run(p, ['-r', '--infected', '--no-summary', target], { timeout: 3600000 }); let n = 0;
  for (const m of r.out.matchAll(/^(.+): (.+) FOUND$/gm)) { await forceQuarantine(m[1], 'ClamAV.' + m[2], 'manual'); n++; } return n;
}
async function scanPath(target, onProgress) {
  if (typeof target !== 'string' || !/^[A-Za-z]:\\/.test(target)) return { total: 0, found: 0, error: 'INVALID_PATH' };
  const clamFound = await clamDir(target, onProgress); const files = [];
  (function walk(d) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p)) continue; e.isDirectory() ? walk(p) : files.push(p); } } catch {} })(target);
  let done = 0, found = clamFound;
  for (const f of files) { const b = stats.threats; await handle(f, 'manual'); if (stats.threats > b) found++; done++; if (done % 10 === 0 || done === files.length) onProgress && onProgress({ done, total: files.length, found, current: f }); }
  return { total: files.length, found };
}
module.exports = { start, enableRealtime, scanFile, scanPath, handle, forceQuarantine, reloadSignatures, listQuarantine, restore, removeQ, setRansom: (on) => (ransomOn = on), stats, isEnabled: () => enabled, clamAvailable: () => !!clamPath() };
