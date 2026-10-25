// Détecteur de PUP / adwares / détournements de navigateur, à la AdwCleaner. Collecte en PowerShell, classification en JS (testable), sauvegarde avant nettoyage.
const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { run, ps, psJson, expandEnv, readJson } = require('./util');
const backup = require('./backup');

const BUILTIN_PUP = ['mindspark', 'searchprotect', 'conduit', 'babylon', 'mywebsearch', 'ask toolbar', 'delta search', 'qone8', 'coupon', 'optimizer pro', 'pc optimizer', 'driver booster free', 'systweak', 'wajam', 'crossrider', 'superfish', 'browser air', 'spigot', 'iminent', 'vopackage', 'websteroids', 'snap.do', 'default tab', 'searchify', 'coupon printer', 'savesense', 'webdiscover', 'bundlore', 'advancedmac', 'macbooster', 'systemcare'];
const BUILTIN_DOMAINS = ['search.myway.com', 'search.conduit.com', 'isearch.omiga-plus.com', 'feed.snapdo.com', 'searchresults.verizon.com', 'trovi.com', 'delta-search.com', 'safefinder.com', 'websearch.com', 'searchprotectapp.com'];
function loadPups() { try { const l = fs.readFileSync(path.join(cfg.SIGS, 'pups.txt'), 'utf8').split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean); return [...new Set([...BUILTIN_PUP, ...l])]; } catch { return BUILTIN_PUP; } }
const matchesPup = (s, list) => { const t = String(s || '').toLowerCase(); return list.find(k => t.includes(k)) || null; }

// ───── navigateurs : page d'accueil / nouvel onglet / moteur de recherche ─────
const CHROMIUM = [['chrome', 'Google Chrome', '%LOCALAPPDATA%\\Google\\Chrome\\User Data'], ['edge', 'Microsoft Edge', '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data'], ['brave', 'Brave', '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data']];
const LEGIT_SEARCH = /^https?:\/\/([\w.-]*\.)?(google|bing|duckduckgo|yahoo|ecosia|qwant|startpage|brave)\.[a-z.]+/i;
const LEGIT_HOME = /^(https?:\/\/([\w.-]*\.)?(google|bing|msn|microsoft)\.[a-z.]+.*|chrome:\/\/newtab\/?|edge:\/\/newtab\/?|about:blank)$/i;
function profiles(root) { try { return fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && /^(Default|Profile \d+)$/.test(e.name)).map(e => path.join(root, e.name)); } catch { return []; } }
function readJsonSafe(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
// Analyse Preferences/Secure Preferences d'un profil Chromium. Pur (testable avec des objets injectés).
function analyzeChromiumPrefs(prefs) {
  const out = []; if (!prefs) return out;
  const home = prefs.homepage; if (home && typeof home === 'string' && !LEGIT_HOME.test(home)) out.push({ type: 'home', value: home });
  const ntp = prefs.session && prefs.session.startup_urls; if (Array.isArray(ntp)) for (const u of ntp) if (typeof u === 'string' && !LEGIT_HOME.test(u)) out.push({ type: 'startup_url', value: u });
  const engines = (prefs.default_search_provider_data && prefs.default_search_provider_data.template_url_data) || null;
  if (engines && engines.url && !LEGIT_SEARCH.test(String(engines.url).replace('{searchTerms}', 'x'))) out.push({ type: 'search', value: engines.short_name || engines.url });
  const exts = (prefs.extensions && prefs.extensions.settings) || {}; for (const [id, e] of Object.entries(exts)) { if (!e || e.state === 0) continue; const name = (e.manifest && e.manifest.name) || id;
    if (!e.from_webstore && e.manifest && e.manifest.permissions && e.manifest.permissions.some(p => p === '<all_urls>' || p === 'webRequest' || p === 'proxy')) out.push({ type: 'extension', value: name, id, risky: true }); }
  return out;
}
async function scanBrowsers() {
  const issues = [];
  for (const [id, label, root] of CHROMIUM) { const r = expandEnv(root); if (!fs.existsSync(r)) continue;
    for (const p of profiles(r)) { const prefFile = fs.existsSync(path.join(p, 'Secure Preferences')) ? 'Secure Preferences' : 'Preferences'; const prefs = readJsonSafe(path.join(p, prefFile));
      for (const f of analyzeChromiumPrefs(prefs)) issues.push({ browser: label, profile: path.basename(p), file: path.join(p, prefFile), ...f }); } }
  return issues;
}

// ───── fichier hosts détourné ─────
async function scanHosts() {
  const file = 'C:\\Windows\\System32\\drivers\\etc\\hosts'; let txt = ''; try { txt = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const out = []; for (const l of txt.split(/\r?\n/)) { const t = l.trim(); if (!t || t[0] === '#') continue; const m = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s+(\S+)/); if (!m) continue;
    const domain = m[2].toLowerCase(); if (domain === 'localhost') continue;
    if (['windowsupdate.com', 'microsoft.com', 'avast.com', 'avg.com', 'kaspersky.com', 'eset.com', 'bitdefender.com', 'norton.com', 'mcafee.com'].some(d => domain.includes(d))) out.push({ domain, ip: m[1], line: t, reason: 'Détourne un service de sécurité ou de mise à jour' });
    else if (m[1] !== '127.0.0.1' && m[1] !== '0.0.0.0' && m[1] !== '::1') out.push({ domain, ip: m[1], line: t, reason: 'Redirection suspecte vers une IP externe' }); }
  return out;
}

// ───── proxy détourné ─────
async function scanProxy() {
  const r = await psJson("Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer,AutoConfigURL | ConvertTo-Json -Compress");
  const s = r[0]; if (!s || !s.ProxyEnable) return null; return { server: s.ProxyServer || '', pac: s.AutoConfigURL || '' };
}

// ───── programmes / tâches / services correspondant à des mots-clés PUP ─────
const GATHER = `
$o=New-Object System.Collections.ArrayList
foreach($r in 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'){
  Get-ChildItem $r | ForEach-Object { $p=Get-ItemProperty -LiteralPath $_.PSPath; if($p.DisplayName){ [void]$o.Add(@{k='app';key=$_.Name;name=[string]$p.DisplayName;publisher=[string]$p.Publisher;uninst=[string]$p.UninstallString}) } } }
Get-ScheduledTask | ForEach-Object { $a=$_.Actions|Select-Object -First 1; [void]$o.Add(@{k='task';key=$_.TaskPath;name=$_.TaskName;cmd=([string]$a.Execute+' '+[string]$a.Arguments)}) }
Get-CimInstance Win32_Service | Where-Object { $_.PathName } | ForEach-Object { [void]$o.Add(@{k='svc';key=$_.Name;name=[string]$_.DisplayName;cmd=[string]$_.PathName}) }
try { Get-CimInstance -Namespace root/subscription -ClassName __EventFilter -ErrorAction Stop | ForEach-Object { [void]$o.Add(@{k='wmi';key=$_.Name;name=[string]$_.Name;cmd=[string]$_.Query}) } } catch {}
$o | ConvertTo-Json -Compress -Depth 3`;
function classifyPup(rows, pupList) {
  const out = [];
  for (const r of rows) { const hay = [r.name, r.publisher, r.cmd, r.uninst].filter(Boolean).join(' ');
    const m = matchesPup(hay, pupList); if (!m) continue;
    out.push({ kind: r.k, key: r.key, name: r.name || r.key, matched: m, cmd: r.cmd || r.uninst || '' }); }
  return out.map((o, i) => ({ id: 'a' + (i + 1), ...o }));
}
let lastPup = new Map(), lastBrowser = new Map();
async function scan(ctx) {
  const pupList = loadPups(); ctx.progress(5, 'Analyse des navigateurs…'); const browser = await scanBrowsers(); lastBrowser = new Map(browser.map((b, i) => [`b${i + 1}`, b]));
  ctx.progress(30, 'Vérification du fichier hosts…'); const hosts = await scanHosts();
  ctx.progress(45, 'Vérification du proxy…'); const proxy = await scanProxy();
  ctx.progress(55, 'Recherche de programmes, tâches et services indésirables…'); const rows = await psJson(GATHER, { timeout: 180000 });
  ctx.progress(90, 'Classification…'); const pups = classifyPup(rows, pupList); lastPup = new Map(pups.map(p => [p.id, p]));
  ctx.progress(100, 'Terminé'); return { browser: browser.map((b, i) => ({ id: `b${i + 1}`, ...b })), hosts, proxy, pups };
}
async function fixBrowser(ids) {
  const items = ids.map(id => lastBrowser.get(id)).filter(Boolean); if (!items.length) return { fixed: 0, failed: 0, backup: null };
  const set = backup.begin('Détournement de navigateur'); const files = new Set(items.map(i => i.file)); for (const f of files) backup.copyFile(set, f, f);
  let fixed = 0, failed = 0;
  for (const f of files) { try { const j = readJsonSafe(f); if (!j) { failed++; continue; }
      const related = items.filter(i => i.file === f);
      for (const it of related) { if (it.type === 'home') delete j.homepage; if (it.type === 'startup_url' && j.session) j.session.startup_urls = []; if (it.type === 'search' && j.default_search_provider_data) delete j.default_search_provider_data.template_url_data;
        if (it.type === 'extension' && j.extensions && j.extensions.settings && j.extensions.settings[it.id]) j.extensions.settings[it.id].state = 0; }
      fs.writeFileSync(f, JSON.stringify(j)); fixed += related.length; } catch { failed++; } }
  const bid = backup.commit(set); items.forEach(i => lastBrowser.delete(i.id)); return { fixed, failed, backup: bid, note: 'Fermez et rouvrez le navigateur pour voir les changements.' };
}
async function fixHosts(lines) {
  const file = 'C:\\Windows\\System32\\drivers\\etc\\hosts'; const set = backup.begin('Fichier hosts'); backup.copyFile(set, file, file);
  let txt; try { txt = fs.readFileSync(file, 'utf8'); } catch { return { ok: false }; }
  const rm = new Set(lines); const out = txt.split(/\r?\n/).filter(l => !rm.has(l.trim())).join('\r\n');
  fs.writeFileSync(file, out); const bid = backup.commit(set); return { ok: true, removed: lines.length, backup: bid };
}
async function fixProxy() {
  const set = backup.begin('Détournement de proxy'); await backup.exportKey(set, 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings');
  const r = await ps("Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0; Remove-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name AutoConfigURL -ErrorAction SilentlyContinue");
  const bid = backup.commit(set); return { ok: r.ok, backup: bid };
}
async function fixPup(ids) {
  const items = ids.map(id => lastPup.get(id)).filter(Boolean); if (!items.length) return { fixed: 0, failed: 0 };
  let fixed = 0, failed = 0;
  for (const it of items) {
    let r; if (it.kind === 'task') r = await ps(`Unregister-ScheduledTask -TaskPath $env:WISE_ARG -TaskName '${String(it.name).replace(/'/g, "''")}' -Confirm:$false -ErrorAction Stop`, { arg: it.key });
    else if (it.kind === 'svc') r = await ps(`Stop-Service -Name $env:WISE_ARG -Force -ErrorAction SilentlyContinue; Set-Service -Name $env:WISE_ARG -StartupType Disabled -ErrorAction Stop`, { arg: it.key });
    else if (it.kind === 'wmi') r = await ps(`Get-CimInstance -Namespace root/subscription -ClassName __EventFilter | Where-Object Name -eq $env:WISE_ARG | Remove-CimInstance -ErrorAction Stop`, { arg: it.key });
    else if (it.kind === 'app') { const c = require('./uninstaller'); const res = await c.uninstallOne(it.key, true); r = { ok: res.ok }; }
    if (r && r.ok) { fixed++; lastPup.delete(it.id); } else failed++;
  }
  return { fixed, failed };
}
module.exports = { scan, fixBrowser, fixHosts, fixProxy, fixPup, loadPups, matchesPup, analyzeChromiumPrefs, classifyPup, _legit: { search: LEGIT_SEARCH, home: LEGIT_HOME } };
