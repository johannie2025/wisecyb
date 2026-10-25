const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cfg = require('../config');
const { hashFile, log, readJson, writeJson, run, ps, psJson, killByPath } = require('./util');
const fsu = require('./fsutil');
const lic = require('./license');
const settings = require('./settings');
const rollback = require('./rollback');
const engines = require('./engines');

let emit = () => {}; let watcher = null, watcher2 = null; let enabled = false; let dbGen = 0;
let hashes = new Map(); let lite = []; // lite = règles YARA « simples » évaluées sans binaire YARA
const stats = { scanned: 0, threats: 0, quarantined: 0 };
const SKIP = /(\\Windows\\|\\WiseCybersecurity\\|\\node_modules\\|\\\$Recycle\.Bin\\|\\System Volume Information\\|\\AppData\\Local\\Temp\\.*\.tmp$)/i;
const EXEC = /\.(exe|scr|dll|bat|cmd|vbs|js|jse|ps1|msi|com|pif|hta|lnk|jar|wsf|cpl|sys|ocx)$/i;
const DOCS = /\.(doc|docx|docm|xls|xlsx|xlsm|ppt|pptx|pdf|rtf|zip|rar|7z|iso|img|cab|apk|html?|svg|chm|one)$/i;
const MEDIA = /\.(mp4|mkv|avi|mov|wmv|mp3|flac|wav|jpg|jpeg|png|gif|webp|heic|bmp|ttf|otf|woff2?)$/i;
const DOUBLE = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|mp3|mp4|zip|rar)\.(exe|scr|bat|cmd|vbs|js|com|pif)$/i;
const RANSOM_EXT = /\.(locked|crypt|crypted|enc|encrypted|wncry|lockbit|ryuk|zepto|cerber)$/i;
const isExcluded = (f) => settings.get().exclusions.some(x => f.toLowerCase().startsWith(x.toLowerCase()));
const interesting = (f, size) => EXEC.test(f) || DOCS.test(f) || (!MEDIA.test(f) && size < 3 * 1024 * 1024);

let active = 0; const q = []; // 3 analyses en parallèle max
const enqueue = (fn) => new Promise(res => { q.push({ fn, res }); pump(); });
function pump() { while (active < 3 && q.length) { const { fn, res } = q.shift(); active++; fn().then(res, res).finally(() => { active--; pump(); }); } }
const clean = new Map(); const recent = new Map();

function reloadSignatures() {
  dbGen++; clean.clear(); hashes = new Map(); lite = [];
  try { for (const l of fs.readFileSync(path.join(cfg.SIGS, 'malware_hashes.ndb'), 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const [h, name] = t.split(':'); if (h && /^[a-f0-9]{32,64}$/i.test(h)) hashes.set(h.toLowerCase(), name || 'Malware.Generic'); } } catch {}
  hashes.set('275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', 'EICAR.Test'); // base minimale intégrée
  try { const { blocks } = engines.splitRules(fs.readFileSync(path.join(cfg.SIGS, 'custom_rules.yar'), 'utf8')); for (const b of blocks) { const s = engines.isSimpleRule(b.text); if (s) lite.push({ name: b.name, ...s }); } } catch {}
}
function heuristics(file) { const r = []; if (DOUBLE.test(file)) r.push('Heur.DoubleExtension'); if (RANSOM_EXT.test(file)) r.push('Heur.RansomwareExtension'); if (/autorun\.inf$/i.test(file)) r.push('Heur.Autorun'); return r; }
function liteScan(buf) { const t = buf.toString('latin1'); for (const r of lite) { const hit = r.all ? r.strs.every(s => t.includes(s)) : r.strs.some(s => t.includes(s)); if (hit) return 'YARA.' + r.name; } return null; }
async function cloudLookup(sha) { try { const { data } = await axios.post(cfg.API + '/scan/hash', { sha256: sha }, { timeout: 8000 }); return data.malicious ? (data.name || 'Cloud.Malware') : null; } catch { return null; } }

// Pipeline : empreintes locales → YARA (complet si installé, sinon « simple ») → ClamAV (clamd) → heuristiques → cloud
async function scanFile(file, { cloud = true, manual = false } = {}) {
  try {
    const st = fs.statSync(file); if (!st.isFile() || st.size > 300 * 1024 * 1024) return { clean: true, skipped: true };
    if (manual && !interesting(file, st.size)) return { clean: true, skipped: true };
    const ck = `${st.mtimeMs}:${st.size}:${dbGen}:${engines.clamReady()}`; if (clean.get(file) === ck) return { clean: true, cached: true }; stats.scanned++;
    const sha = await hashFile(file); let v = hashes.get(sha) || null, eng = v ? 'hash' : null;
    if (!v) { v = hashes.get(await hashFile(file, 'md5')) || null; if (v) eng = 'hash'; }
    const isExe = EXEC.test(file);
    if (!v && (isExe || DOCS.test(file)) && st.size < 30 * 1024 * 1024) {
      if (engines.yaraReady()) { v = await engines.yaraScanFile(file); if (v) eng = 'yara'; }
      else if (lite.length && isExe) { v = liteScan(fs.readFileSync(file)); if (v) eng = 'yara-lite'; }
    }
    if (!v && engines.clamReady() && st.size <= 100 * 1024 * 1024 && !MEDIA.test(file)) { const r = await engines.clamScanFile(file); if (r.found) { v = 'ClamAV.' + r.name; eng = 'clamav'; } }
    if (!v) { const h = heuristics(file); if (h.length) { v = h[0]; eng = 'heuristic'; } }
    if (!v && cloud && isExe) { v = await cloudLookup(sha); if (v) eng = 'cloud'; }
    if (!v) { if (clean.size > 50000) clean.clear(); clean.set(file, ck); return { clean: true, sha }; }
    return { clean: false, threat: v, sha, engine: eng };
  } catch { return { clean: true, error: true }; }
}
async function quarantine(file, threat, sha) {
  try {
    await killByPath(file); const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8); const dest = path.join(cfg.QUAR, id + '.wq');
    const buf = fs.readFileSync(file); for (let i = 0; i < buf.length; i++) buf[i] ^= 0x5a; fs.writeFileSync(dest, buf); // XOR : neutralise l'exécution
    try { fs.unlinkSync(file); } catch { fs.unlinkSync(dest); return null; }
    writeJson(path.join(cfg.QUAR, id + '.json'), { id, original: file, threat, sha, size: buf.length, date: new Date().toISOString() }); stats.quarantined++; return id;
  } catch (e) { log('error', 'quarantine ' + e.message); return null; }
}
const listQuarantine = () => { try { return fs.readdirSync(cfg.QUAR).filter(f => f.endsWith('.json')).map(f => readJson(path.join(cfg.QUAR, f), null)).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date)); } catch { return []; } };
function restore(id) { if (!/^[\w]+$/.test(id)) return false; const m = readJson(path.join(cfg.QUAR, id + '.json'), null); if (!m) return false; const b = fs.readFileSync(path.join(cfg.QUAR, id + '.wq')); for (let i = 0; i < b.length; i++) b[i] ^= 0x5a; fs.mkdirSync(path.dirname(m.original), { recursive: true }); fs.writeFileSync(m.original, b); removeQ(id); return true; }
function removeQ(id) { if (!/^[\w]+$/.test(id)) return false; for (const e of ['.wq', '.json']) try { fs.unlinkSync(path.join(cfg.QUAR, id + e)); } catch {} return true; }
async function report(file, threat, sha, source, engine) {
  stats.threats++; const id = await quarantine(file, threat, sha);
  const ev = { file, threat, sha, source, engine, quarantined: !!id, date: new Date().toISOString() }; log('threat', JSON.stringify(ev)); emit('threat', ev);
  axios.post(cfg.API + '/telemetry/alert', { hwid: lic.hwid(), type: 'threat', ...ev }, { timeout: 8000 }).catch(() => {}); return ev;
}
async function handle(file, source = 'realtime') {
  if (SKIP.test(file) || isExcluded(file)) return null; const t = Date.now(); if (recent.get(file) > t - 3000) return null; recent.set(file, t); if (recent.size > 5000) recent.clear();
  const r = await enqueue(() => scanFile(file, { manual: source === 'manual' })); if (r && !r.clean) return report(file, r.threat, r.sha, source, r.engine); return null;
}
const forceQuarantine = (file, threat, source) => report(file, threat, null, source, 'heuristic');

// ── anti-ransomware ──
let burst = [], ransomOn = true, lastAlert = 0;
function ransomWatch(file) { if (!ransomOn) return; const now = Date.now(); burst.push(now); burst = burst.filter(t => now - t < 10000);
  if ((burst.length > 40 || RANSOM_EXT.test(file)) && now - lastAlert > 30000) { lastAlert = now; rollback.freeze(true); emit('ransomware', { file, count: burst.length, date: new Date().toISOString() }); log('ransomware', file); burst = []; } }
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

// ── analyses manuelles (annulables, avec progression) ──
async function scanList(files, ctx, label = 'Analyse') {
  let done = 0, found = 0; const threats = []; const t0 = Date.now(); let idx = 0; const total = files.length;
  const worker = async () => { while (idx < total && !ctx.isCancelled()) { const f = files[idx++]; const ev = await handle(f, 'manual'); if (ev) { found++; threats.push(ev); } done++;
    if (done % 5 === 0 || done === total) { const el = (Date.now() - t0) / 1000; ctx.progress(total ? (done / total) * 100 : 100, `${label} : ${done}/${total} · ${found} menace(s) · ${path.basename(f)}`, { done, total, found, rate: Math.round(done / Math.max(el, 1)), current: f }); } } };
  await Promise.all([worker(), worker(), worker()]); return { total, scanned: done, found, threats, ms: Date.now() - t0, cancelled: ctx.isCancelled() };
}
async function scanPath(target, ctx) {
  if (typeof target !== 'string' || !/^[A-Za-z]:\\/.test(target)) throw new Error('Chemin invalide'); const files = []; let n = 0;
  for await (const f of fsu.walk(target, { cancelled: ctx.isCancelled, skip: (p) => SKIP.test(p) })) { files.push(f); if (++n % 500 === 0) ctx.progress(0, `Inventaire des fichiers… ${n}`, { done: 0, total: 0, found: 0, current: f }); }
  return scanList(files, ctx);
}
async function scanProcesses(ctx) { // exécutables des processus actifs (analyse « mémoire » au niveau fichier)
  ctx.progress(2, 'Liste des processus…'); const rows = await psJson('Get-Process | Where-Object Path | Select-Object -ExpandProperty Path -Unique | ConvertTo-Json -Compress');
  const files = rows.filter(p => typeof p === 'string' && /^[A-Za-z]:\\/.test(p) && !/\\Windows\\/i.test(p)); const r = await scanList(files, ctx, 'Processus'); return r;
}
const setRansom = (on) => (ransomOn = on);
module.exports = { start, enableRealtime, scanFile, scanPath, scanList, scanProcesses, handle, forceQuarantine, reloadSignatures, listQuarantine, restore, removeQ, setRansom, stats, isEnabled: () => enabled, SKIP, interesting, heuristics };
