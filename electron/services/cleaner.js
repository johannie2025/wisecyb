// Nettoyeur type CCleaner : Windows, navigateurs, applications. Seuls les identifiants de catégories viennent de l'interface ; les chemins sont définis ici.
const fs = require('fs');
const path = require('path');
const { run, ps, psJson, expandEnv } = require('./util');
const fsu = require('./fsutil');

const CHROMIUM = [
  ['chrome', 'Google Chrome', '%LOCALAPPDATA%\\Google\\Chrome\\User Data', 'chrome.exe'], ['edge', 'Microsoft Edge', '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data', 'msedge.exe'],
  ['brave', 'Brave', '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data', 'brave.exe'], ['vivaldi', 'Vivaldi', '%LOCALAPPDATA%\\Vivaldi\\User Data', 'vivaldi.exe'],
  ['opera', 'Opera', '%APPDATA%\\Opera Software\\Opera Stable', 'opera.exe', true], ['operagx', 'Opera GX', '%APPDATA%\\Opera Software\\Opera GX Stable', 'opera.exe', true]
];
const CACHE_DIRS = ['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'Service Worker\\CacheStorage', 'Service Worker\\ScriptCache', 'Network\\Cache'];
const COOKIE_FILES = ['Cookies', 'Cookies-journal', 'Network\\Cookies', 'Network\\Cookies-journal'];
const HIST_FILES = ['History', 'History-journal', 'Visited Links', 'Top Sites', 'Top Sites-journal', 'Shortcuts', 'Shortcuts-journal', 'Favicons', 'Favicons-journal'];

function profiles(root, single) { // dossiers de profil d'un navigateur Chromium
  if (single) return fsu.exists(root) ? [root] : [];
  try { return fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && /^(Default|Profile \d+|Guest Profile)$/.test(e.name)).map(e => path.join(root, e.name)); } catch { return []; }
}
const T = (p) => ({ p, kind: 'contents' }); const F = (p) => ({ p, kind: 'file' }); const G = (dir, re) => ({ p: dir, kind: 'glob', re });
// Construit la liste des catégories pour l'environnement donné (testable)
function categories(env = process.env) {
  const E = (s) => expandEnv(s, env); const cats = []; const add = (c) => cats.push({ def: false, procs: [], ...c });
  const W = 'Windows';
  add({ id: 'win.tempUser', group: W, label: 'Fichiers temporaires (utilisateur)', def: true, items: [T(E('%TEMP%'))] });
  add({ id: 'win.tempSys', group: W, label: 'Fichiers temporaires (système)', def: true, items: [T(E('%WINDIR%\\Temp'))] });
  add({ id: 'win.thumbs', group: W, label: 'Cache des miniatures et icônes', def: true, items: [G(E('%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer'), /^(thumbcache|iconcache).*\.db$/i)] });
  add({ id: 'win.recent', group: W, label: 'Documents récents et listes de raccourcis', def: true, items: [G(E('%APPDATA%\\Microsoft\\Windows\\Recent'), /\.lnk$/i), T(E('%APPDATA%\\Microsoft\\Windows\\Recent\\AutomaticDestinations')), T(E('%APPDATA%\\Microsoft\\Windows\\Recent\\CustomDestinations'))] });
  add({ id: 'win.logs', group: W, label: 'Journaux et rapports d\'erreurs Windows', def: true, items: [T(E('%LOCALAPPDATA%\\CrashDumps')), T(E('%WINDIR%\\Minidump')), T(E('%PROGRAMDATA%\\Microsoft\\Windows\\WER\\ReportArchive')), T(E('%PROGRAMDATA%\\Microsoft\\Windows\\WER\\ReportQueue')), F(E('%WINDIR%\\MEMORY.DMP')), G(E('%WINDIR%\\Logs\\CBS'), /\.(log|cab)$/i)] });
  add({ id: 'win.wu', group: W, label: 'Cache de Windows Update (téléchargements)', def: true, svc: 'wuauserv', items: [T(E('%WINDIR%\\SoftwareDistribution\\Download'))] });
  add({ id: 'win.do', group: W, label: 'Cache d\'optimisation de livraison', def: true, items: [T(E('%PROGRAMDATA%\\Microsoft\\Windows\\DeliveryOptimization\\Cache'))] });
  add({ id: 'win.prefetch', group: W, label: 'Prefetch (ralentit légèrement le prochain démarrage)', warn: true, items: [G(E('%WINDIR%\\Prefetch'), /\.pf$/i)] });
  add({ id: 'win.recycle', group: W, label: 'Corbeille', def: true, special: 'recycle', items: [] });
  add({ id: 'win.dns', group: W, label: 'Cache DNS', def: true, special: 'dns', noSize: true, items: [] });
  add({ id: 'win.clip', group: W, label: 'Presse-papiers', special: 'clip', noSize: true, items: [] });
  add({ id: 'win.evt', group: W, label: 'Journaux d\'événements Windows (efface l\'historique de diagnostic)', warn: true, special: 'evt', noSize: true, items: [] });
  for (const [id, name, root, exe, single] of CHROMIUM) {
    const rootP = E(root); if (!fsu.exists(rootP)) continue; const prof = profiles(rootP, single);
    const topCache = single ? [] : ['ShaderCache', 'GrShaderCache', 'GraphiteDawnCache'].map(d => T(path.join(rootP, d)));
    add({ id: `br.${id}.cache`, group: name, label: 'Cache', def: true, procs: [exe], items: [...prof.flatMap(p => CACHE_DIRS.map(d => T(path.join(p, d)))), ...topCache] });
    add({ id: `br.${id}.history`, group: name, label: 'Historique de navigation et miniatures', def: true, procs: [exe], items: prof.flatMap(p => HIST_FILES.map(f => F(path.join(p, f)))) });
    add({ id: `br.${id}.cookies`, group: name, label: 'Cookies (vous déconnecte des sites)', warn: true, procs: [exe], items: prof.flatMap(p => COOKIE_FILES.map(f => F(path.join(p, f)))) });
  }
  const ffRoam = E('%APPDATA%\\Mozilla\\Firefox\\Profiles'), ffLoc = E('%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles');
  if (fsu.exists(ffRoam) || fsu.exists(ffLoc)) {
    const sub = (b) => { try { return fs.readdirSync(b, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(b, e.name)); } catch { return []; } };
    add({ id: 'br.firefox.cache', group: 'Mozilla Firefox', label: 'Cache', def: true, procs: ['firefox.exe'], items: sub(ffLoc).flatMap(p => ['cache2', 'startupCache', 'thumbnails'].map(d => T(path.join(p, d)))) });
    add({ id: 'br.firefox.cookies', group: 'Mozilla Firefox', label: 'Cookies (vous déconnecte des sites)', warn: true, procs: ['firefox.exe'], items: sub(ffRoam).flatMap(p => ['cookies.sqlite', 'cookies.sqlite-wal', 'cookies.sqlite-shm'].map(f => F(path.join(p, f)))) });
  }
  const A = 'Applications';
  const app = (id, label, procs, ...dirs) => { const items = dirs.map(d => T(E(d))); if (items.some(i => fsu.exists(i.p))) add({ id, group: A, label, def: true, procs, items }); };
  app('app.discord', 'Discord (cache)', ['Discord.exe'], '%APPDATA%\\discord\\Cache', '%APPDATA%\\discord\\Code Cache', '%APPDATA%\\discord\\GPUCache');
  app('app.teams', 'Microsoft Teams (cache)', ['Teams.exe', 'ms-teams.exe'], '%APPDATA%\\Microsoft\\Teams\\Cache', '%APPDATA%\\Microsoft\\Teams\\blob_storage', '%APPDATA%\\Microsoft\\Teams\\GPUCache', '%APPDATA%\\Microsoft\\Teams\\tmp');
  app('app.slack', 'Slack (cache)', ['slack.exe'], '%APPDATA%\\Slack\\Cache', '%APPDATA%\\Slack\\Code Cache', '%APPDATA%\\Slack\\GPUCache');
  app('app.spotify', 'Spotify (cache audio)', ['Spotify.exe'], '%LOCALAPPDATA%\\Spotify\\Data', '%LOCALAPPDATA%\\Spotify\\Storage');
  app('app.vscode', 'Visual Studio Code (cache)', ['Code.exe'], '%APPDATA%\\Code\\Cache', '%APPDATA%\\Code\\CachedData', '%APPDATA%\\Code\\Code Cache', '%APPDATA%\\Code\\GPUCache');
  app('app.steam', 'Steam (cache web)', ['steam.exe'], '%LOCALAPPDATA%\\Steam\\htmlcache');
  app('app.npm', 'Cache npm', [], '%LOCALAPPDATA%\\npm-cache');
  return cats.filter(c => c.special || c.items.length);
}
async function sizeItems(items, cancelled) {
  let bytes = 0, files = 0;
  for (const it of items) {
    if (cancelled()) break;
    if (it.kind === 'glob') { let es = []; try { es = fs.readdirSync(it.p); } catch {} for (const n of es) if (it.re.test(n)) { try { const s = fs.statSync(path.join(it.p, n)); if (s.isFile()) { bytes += s.size; files++; } } catch {} } }
    else { const r = await fsu.dirSize(it.p, { cancelled }); bytes += r.bytes; files += r.files; }
  }
  return { bytes, files };
}
async function runningProcs() { const r = await run('tasklist', ['/fo', 'csv', '/nh']); return new Set(r.out.split('\n').map(l => (l.split('","')[0] || '').replace(/"/g, '').toLowerCase()).filter(Boolean)); }
async function analyze(ctx) {
  const cats = categories(); const running = await runningProcs(); const out = [];
  for (let i = 0; i < cats.length; i++) {
    if (ctx.isCancelled()) break; const c = cats[i]; ctx.progress((i / cats.length) * 100, `Analyse : ${c.group} — ${c.label}`); let bytes = 0, files = 0;
    if (c.special === 'recycle') { const r = await ps("(New-Object -ComObject Shell.Application).NameSpace(0xA).Items() | ForEach-Object { $_.ExtendedProperty('Size') } | Measure-Object -Sum | Select-Object -ExpandProperty Sum"); bytes = parseInt(r.out.trim(), 10) || 0; }
    else if (!c.special) ({ bytes, files } = await sizeItems(c.items, ctx.isCancelled));
    out.push({ id: c.id, group: c.group, label: c.label, bytes, files, def: c.def, warn: !!c.warn, noSize: !!c.noSize, running: c.procs.filter(p => running.has(p.toLowerCase())) });
  }
  return out;
}
async function delItems(items, cancelled) {
  let freed = 0, files = 0, failed = 0;
  for (const it of items) {
    if (cancelled()) break; let r = { freed: 0, files: 0, failed: 0 };
    if (it.kind === 'contents') r = await fsu.emptyDir(it.p, { cancelled });
    else if (it.kind === 'file') r = await fsu.removePath(it.p);
    else if (it.kind === 'glob') { let es = []; try { es = fs.readdirSync(it.p); } catch {} for (const n of es) if (it.re.test(n)) { const x = await fsu.removePath(path.join(it.p, n)); r.freed += x.freed; r.files += x.files; r.failed += x.failed; } }
    freed += r.freed; files += r.files; failed += r.failed;
  }
  return { freed, files, failed };
}
async function clean(ids, opts, ctx) {
  const all = categories(); const sel = all.filter(c => ids.includes(c.id)); const res = []; let freed = 0, files = 0, failed = 0;
  if (opts && opts.closeBrowsers) { const procs = [...new Set(sel.flatMap(c => c.procs))]; for (const p of procs) await run('taskkill', ['/IM', p, '/F']); }
  for (let i = 0; i < sel.length; i++) {
    if (ctx.isCancelled()) break; const c = sel[i]; ctx.progress((i / sel.length) * 100, `Nettoyage : ${c.group} — ${c.label}`); let r = { freed: 0, files: 0, failed: 0 };
    let svcWas = false; if (c.svc) { const q = await run('sc', ['query', c.svc]); svcWas = /RUNNING/.test(q.out); if (svcWas) await run('net', ['stop', c.svc]); }
    if (c.special === 'recycle') { const before = (await ps("(New-Object -ComObject Shell.Application).NameSpace(0xA).Items() | ForEach-Object { $_.ExtendedProperty('Size') } | Measure-Object -Sum | Select-Object -ExpandProperty Sum")).out; await ps('Clear-RecycleBin -Force'); r.freed = parseInt(before.trim(), 10) || 0; }
    else if (c.special === 'dns') await run('ipconfig', ['/flushdns']);
    else if (c.special === 'clip') await run('cmd', ['/c', 'echo off | clip']);
    else if (c.special === 'evt') await ps('wevtutil el | ForEach-Object { wevtutil cl $_ }', { timeout: 180000 });
    else r = await delItems(c.items, ctx.isCancelled);
    if (svcWas) await run('net', ['start', c.svc]);
    freed += r.freed; files += r.files; failed += r.failed; res.push({ id: c.id, label: c.label, freed: r.freed, files: r.files, failed: r.failed });
  }
  ctx.progress(100, 'Nettoyage terminé'); return { freed, files, failed, items: res };
}
module.exports = { categories, analyze, clean, runningProcs };
