// Moteurs de détection embarqués : ClamAV (clamd + freshclam officiels) et YARA (yara64/yarac64 officiels).
// Téléchargés depuis GitHub (releases officielles), vérifiés (SHA-256 publié par GitHub OU signature Authenticode valide), jamais exécutés sans vérification.
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const axios = require('axios');
const { spawn } = require('child_process');
const cfg = require('../config');
const { run, ps, readJson, writeJson, log, sleep, isWin } = require('./util');

const DIR = cfg.ENGINES, CLAM_DIR = path.join(DIR, 'clamav'), YARA_DIR = path.join(DIR, 'yara'), DB = path.join(CLAM_DIR, 'db');
const ST = path.join(cfg.STATE, 'engines.json'); const UA = { 'User-Agent': 'WiseCybersecurity/' + cfg.APP_VERSION, Accept: 'application/vnd.github+json' };
const state = () => readJson(ST, { clam: null, yara: null }); const saveState = (s) => writeJson(ST, s);

// ───────── fonctions pures (testées) ─────────
function pickAsset(release, re) {
  const a = ((release && release.assets) || []).find(x => re.test(x.name)); if (!a) return null;
  const d = String(a.digest || ''); return { name: a.name, url: a.browser_download_url, size: a.size, sha256: d.startsWith('sha256:') ? d.slice(7).toLowerCase() : null, tag: release.tag_name };
}
function findExe(dir, name, depth = 4) {
  try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isFile() && e.name.toLowerCase() === name.toLowerCase()) return p; }
    if (depth > 0) for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) { const r = findExe(path.join(dir, e.name), name, depth - 1); if (r) return r; } } catch {}
  return null;
}
// Découpe un fichier YARA : imports + règles (même logique que le serveur)
function splitRules(src) {
  src = String(src).replace(/^\uFEFF/, '').replace(/^[ \t]*include[ \t]+"[^"]*"[ \t]*\r?$/gm, '');
  const imports = []; for (const m of src.matchAll(/^[ \t]*import[ \t]+"(\w+)"/gm)) if (!imports.includes(m[1])) imports.push(m[1]);
  src = src.replace(/^[ \t]*import[ \t]+"\w+"[ \t]*\r?$/gm, '');
  const hs = [...src.matchAll(/^[ \t]*(?:(?:private|global)[ \t]+)*rule[ \t]+(\w+)/gm)]; const blocks = [];
  hs.forEach((h, i) => { const body = src.slice(h.index, i + 1 < hs.length ? hs[i + 1].index : src.length).trim(); if (body.includes('{') && body.includes('condition')) blocks.push({ name: h[1], text: body }); });
  return { imports, blocks };
}
function assemble(imports, blocks) { // texte final + plage de lignes de chaque règle (pour relier une erreur de compilation à sa règle)
  const head = imports.map(i => `import "${i}"`); let line = head.length + 1; const parts = [...head]; const ranges = [];
  for (const b of blocks) { const n = b.text.split('\n').length; ranges.push({ name: b.name, start: line + 1, end: line + n }); parts.push('', b.text); line += n + 1; }
  return { text: parts.join('\n') + '\n', ranges };
}
function errorLines(stderr) { const s = new Set(); for (const m of String(stderr).matchAll(/\((\d+)\):\s*error/gi)) s.add(+m[1]); return [...s]; }
// Compile tout ; retire les règles fautives (erreur → ligne → règle) et recommence ; au-delà de 40 tours, validation règle par règle.
async function compileTolerant(imports, blocks, compile, { maxIter = 40, onProgress = () => {} } = {}) {
  let cur = blocks.slice(); const dropped = [];
  for (let it = 0; it < maxIter; it++) {
    const a = assemble(imports, cur); const r = await compile(a.text); onProgress(it, cur.length);
    if (r.ok) return { ok: true, text: a.text, kept: cur.length, dropped };
    const lines = errorLines(r.stderr); const bad = new Set();
    for (const l of lines) { const g = a.ranges.find(x => l >= x.start && l <= x.end); if (g) bad.add(g.name); }
    if (!bad.size) break;
    cur = cur.filter(b => { if (bad.has(b.name)) { dropped.push(b.name); return false; } return true; });
    if (!cur.length) return { ok: false, text: '', kept: 0, dropped, error: 'aucune règle valide' };
  }
  const good = []; // repli : validation individuelle
  for (let i = 0; i < cur.length; i++) { const a = assemble(imports, [cur[i]]); const r = await compile(a.text); if (r.ok) good.push(cur[i]); else dropped.push(cur[i].name); if (i % 25 === 0) onProgress(i, cur.length); }
  if (!good.length) return { ok: false, text: '', kept: 0, dropped, error: 'aucune règle valide' };
  const a = assemble(imports, good); const r = await compile(a.text); return r.ok ? { ok: true, text: a.text, kept: good.length, dropped } : { ok: false, text: '', kept: 0, dropped, error: String(r.stderr).slice(0, 300) };
}
// Règle « simple » (chaînes texte + any/all of them) = seule forme que le moteur YARA-lite intégré sait évaluer exactement
function isSimpleRule(text) {
  const m = text.match(/\{([\s\S]*)\}\s*$/); if (!m) return null; const body = m[1];
  const c = body.match(/\bcondition:\s*([\s\S]*)$/); const s = body.match(/\bstrings:\s*([\s\S]*?)\bcondition:/); if (!c || !s) return null;
  const cm = c[1].trim().match(/^(any|all) of them$/i); if (!cm) return null; const strs = [];
  for (const l of s[1].split(/\r?\n/)) { const t = l.trim(); if (!t) continue; const x = t.match(/^\$\w*\s*=\s*"([^"\\]{6,})"(?:\s+ascii)?$/); if (!x) return null; strs.push(x[1]); }
  return strs.length ? { strs, all: cm[1].toLowerCase() === 'all' } : null;
}
function parseClamVersion(out) { const m = String(out).match(/ClamAV\s+([\d.]+(?:-\w+)?)(?:\/(\d+)\/(.+))?/); return m ? { engine: m[1], db: m[2] ? +m[2] : null, dbDate: m[3] ? m[3].trim() : null } : null; }
function parseInstream(resp) { const t = String(resp).replace(/\0/g, '').trim(); if (/FOUND$/.test(t)) return { found: true, name: t.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '') }; if (/OK$/.test(t)) return { found: false }; return { found: false, error: t.slice(0, 120) || 'réponse vide' }; }
function freshclamProgress(chunk, prev) { // → {pct 0-100, msg}
  const s = String(chunk); let idx = prev.idx || 0; const f = s.match(/\b(main|daily|bytecode)\b/i); if (f) idx = ['main', 'daily', 'bytecode'].indexOf(f[1].toLowerCase());
  const all = [...s.matchAll(/(\d{1,3})(?:\.\d)?%/g)]; const p = all.length ? Math.min(100, +all[all.length - 1][1]) : (prev.p || 0);
  const msg = (s.split(/[\r\n]+/).filter(x => x.trim()).pop() || '').trim().slice(0, 140); return { idx, p, pct: Math.min(99, ((idx + p / 100) / 3) * 100), msg };
}

// ───────── installation vérifiée ─────────
async function latest(repo, re) {
  const { data } = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`, { headers: UA, timeout: 30000 });
  const a = pickAsset(data, re); if (!a) throw new Error('Aucun fichier Windows x64 dans la dernière version de ' + repo); return a;
}
async function download(url, dest, onPct, ctx) {
  const res = await axios.get(url, { responseType: 'stream', headers: { 'User-Agent': UA['User-Agent'] }, timeout: 0, maxRedirects: 6 });
  const total = +res.headers['content-length'] || 0; let got = 0; const h = crypto.createHash('sha256'); const out = fs.createWriteStream(dest);
  await new Promise((ok, ko) => { res.data.on('data', c => { h.update(c); got += c.length; if (total) onPct(got / total); if (ctx && ctx.isCancelled()) res.data.destroy(new Error('annulé')); });
    res.data.on('error', ko); out.on('error', ko); out.on('finish', ok); res.data.pipe(out); });
  return h.digest('hex');
}
async function authenticode(exe, mustContain) {
  const r = await ps("$s=Get-AuthenticodeSignature -LiteralPath ($env:WISE_ARG|ConvertFrom-Json); [pscustomobject]@{st=[string]$s.Status;sub=[string]$s.SignerCertificate.Subject}|ConvertTo-Json -Compress", { arg: exe });
  try { const j = JSON.parse(r.out); return j.st === 'Valid' && new RegExp(mustContain, 'i').test(j.sub); } catch { return false; }
}
const SPECS = {
  clam: { repo: 'Cisco-Talos/clamav', re: /win\.x64\.zip$/i, dir: CLAM_DIR, exes: ['clamscan.exe', 'clamd.exe', 'freshclam.exe'], signer: 'Cisco' },
  yara: { repo: 'VirusTotal/yara', re: /win64\.zip$/i, dir: YARA_DIR, exes: ['yara64.exe', 'yarac64.exe'], signer: 'VirusTotal|Google' }
};
async function install(kind, ctx) {
  if (!isWin) throw new Error('Windows uniquement'); const sp = SPECS[kind]; if (!sp) throw new Error('moteur inconnu');
  ctx.progress(2, 'Recherche de la dernière version officielle…'); const a = await latest(sp.repo, sp.re);
  const zip = path.join(cfg.TMP, a.name); ctx.progress(4, `Téléchargement ${a.name}…`);
  const got = await download(a.url, zip, f => ctx.progress(4 + f * 56, `Téléchargement ${a.name} — ${Math.round(f * 100)} %`), ctx);
  if (ctx.isCancelled()) { try { fs.unlinkSync(zip); } catch {} return; }
  let verified = null;
  if (a.sha256) { if (a.sha256 !== got) { try { fs.unlinkSync(zip); } catch {} throw new Error('Empreinte SHA-256 différente de celle publiée par GitHub : fichier rejeté'); } verified = 'sha256'; }
  ctx.progress(62, 'Extraction…'); try { fs.rmSync(sp.dir, { recursive: true, force: true }); } catch {} fs.mkdirSync(sp.dir, { recursive: true });
  const ex = await ps("$a=$env:WISE_ARG|ConvertFrom-Json; Expand-Archive -LiteralPath $a.zip -DestinationPath $a.dest -Force", { arg: { zip, dest: sp.dir }, timeout: 300000 });
  try { fs.unlinkSync(zip); } catch {} const exes = sp.exes.map(n => findExe(sp.dir, n)); if (exes.some(x => !x)) throw new Error('Archive inattendue (' + sp.exes.filter((n, i) => !exes[i]).join(', ') + ' introuvable) ' + ex.err.slice(0, 120));
  if (!verified) { ctx.progress(70, 'Vérification de la signature numérique…'); if (await authenticode(exes[0], sp.signer)) verified = 'authenticode'; }
  if (!verified) { try { fs.rmSync(sp.dir, { recursive: true, force: true }); } catch {} throw new Error("Intégrité invérifiable (ni empreinte SHA-256 publiée, ni signature valide) : installation refusée"); }
  const s = state(); s[kind] = { dir: path.dirname(exes[0]), tag: a.tag, verified, installedAt: new Date().toISOString() }; saveState(s); log('engine', `${kind} ${a.tag} installé (${verified})`);
  if (kind === 'clam') writeClamConf();
  ctx.progress(kind === 'clam' ? 75 : 85, 'Installé');
  return { tag: a.tag, verified };
}
const st = (k) => state()[k];
const exeOf = (kind, name) => { const s = st(kind); return s ? path.join(s.dir, name) : null; };
const has = (kind, name) => { const e = exeOf(kind, name); return !!e && fs.existsSync(e); };

// ───────── ClamAV ─────────
function writeClamConf() {
  fs.mkdirSync(DB, { recursive: true }); const q = (p) => p.replace(/\\/g, '\\');
  fs.writeFileSync(path.join(CLAM_DIR, 'freshclam.conf'), `DatabaseDirectory ${DB}\nDatabaseMirror database.clamav.net\nUpdateLogFile ${path.join(cfg.LOGS, 'freshclam.log')}\nScriptedUpdates yes\nCompress no\n`);
  fs.writeFileSync(path.join(CLAM_DIR, 'clamd.conf'), `DatabaseDirectory ${DB}\nLogFile ${path.join(cfg.LOGS, 'clamd.log')}\nLogTime yes\nTCPSocket ${cfg.CLAM_PORT}\nTCPAddr 127.0.0.1\nMaxThreads 4\nMaxQueue 100\nReadTimeout 60\nStreamMaxLength 100M\nMaxFileSize 100M\nMaxScanSize 300M\nScanPE yes\nScanOLE2 yes\nScanPDF yes\nScanArchive yes\nScanHTML yes\nHeuristicAlerts yes\nExitOnOOM yes\nConcurrentDatabaseReload yes\n`);
}
let clamProc = null, clamReady = false, clamErr = null, clamStarting = false;
const dbPresent = () => { try { return fs.readdirSync(DB).some(f => /\.(cvd|cld)$/i.test(f)); } catch { return false; } };
function clamCmd(cmd, timeout = 8000) {
  return new Promise(res => { const s = net.connect(cfg.CLAM_PORT, '127.0.0.1'); let out = ''; s.setTimeout(timeout);
    s.on('connect', () => s.write('z' + cmd + '\0')); s.on('data', d => { out += d; if (out.includes('\0')) s.end(); }); s.on('end', () => res(out.replace(/\0/g, '').trim())); s.on('timeout', () => { s.destroy(); res(null); }); s.on('error', () => res(null)); });
}
async function clamUpdate(ctx) {
  const fc = exeOf('clam', 'freshclam.exe'); if (!fc || !fs.existsSync(fc)) throw new Error('ClamAV non installé'); writeClamConf();
  return new Promise((resolve, reject) => {
    const p = spawn(fc, ['--config-file=' + path.join(CLAM_DIR, 'freshclam.conf'), '--stdout'], { windowsHide: true }); let tail = '', prev = { idx: 0, p: 0 }; ctx.progress(76, 'Connexion au miroir ClamAV…');
    const on = (d) => { const s = String(d); tail = (tail + s).slice(-1500); prev = freshclamProgress(s, prev); ctx.progress(76 + prev.pct * 0.23, prev.msg || 'Mise à jour de la base ClamAV…'); if (ctx.isCancelled()) p.kill(); };
    p.stdout.on('data', on); p.stderr.on('data', on); p.on('error', reject);
    p.on('exit', async (code) => {
      if (/cool-?down|429|403|rate/i.test(tail) && code !== 0) return reject(new Error('Miroir ClamAV : limite de débit atteinte (cool-down). Réessayez dans quelques heures.'));
      if (code === 0 || code === 1) { if (clamReady) await clamCmd('RELOAD'); ctx.progress(100, 'Base ClamAV à jour'); resolve({ ok: true }); } else reject(new Error('freshclam code ' + code + ' — ' + tail.split(/[\r\n]+/).filter(Boolean).slice(-2).join(' | ')));
    });
  });
}
async function clamStart() {
  if (clamReady || clamStarting) return { ok: clamReady }; const cd = exeOf('clam', 'clamd.exe'); if (!cd || !fs.existsSync(cd)) return { ok: false, error: 'ClamAV non installé' };
  if (!dbPresent()) return { ok: false, error: 'Base ClamAV absente : lancez la mise à jour' };
  clamStarting = true; clamErr = null; writeClamConf();
  clamProc = spawn(cd, ['--config-file=' + path.join(CLAM_DIR, 'clamd.conf')], { windowsHide: true, stdio: 'ignore' }); let exited = false;
  clamProc.on('exit', (c) => { exited = true; clamReady = false; clamProc = null; if (c) clamErr = 'clamd arrêté (code ' + c + ') — mémoire insuffisante ? voir logs\\clamd.log'; }); clamProc.on('error', (e) => { exited = true; clamErr = e.message; });
  for (let i = 0; i < 120 && !exited; i++) { await sleep(2000); if ((await clamCmd('PING', 3000)) === 'PONG') { clamReady = true; break; } }
  clamStarting = false; if (!clamReady && !clamErr) clamErr = 'clamd ne répond pas (chargement trop long)'; return { ok: clamReady, error: clamErr };
}
async function clamStop() { if (clamReady) await clamCmd('SHUTDOWN', 4000); await sleep(300); if (clamProc) { try { clamProc.kill(); } catch {} } clamProc = null; clamReady = false; return { ok: true }; }
function clamScanFile(file, timeout = 120000) {
  return new Promise(res => {
    if (!clamReady) return res({ found: false, error: 'clamd arrêté' }); const s = net.connect(cfg.CLAM_PORT, '127.0.0.1'); let out = '', done = false; s.setTimeout(timeout);
    const fin = (r) => { if (!done) { done = true; try { s.destroy(); } catch {} res(r); } };
    s.on('connect', () => { s.write('zINSTREAM\0'); const rs = fs.createReadStream(file, { highWaterMark: 65536 });
      rs.on('data', c => { const l = Buffer.alloc(4); l.writeUInt32BE(c.length); if (!s.write(Buffer.concat([l, c]))) { rs.pause(); s.once('drain', () => rs.resume()); } });
      rs.on('end', () => s.write(Buffer.alloc(4))); rs.on('error', () => fin({ found: false, error: 'lecture' })); });
    s.on('data', d => { out += d; if (out.includes('\0')) fin(parseInstream(out)); }); s.on('timeout', () => fin({ found: false, error: 'délai' })); s.on('error', () => fin({ found: false, error: 'connexion' })); s.on('end', () => fin(parseInstream(out)));
  });
}
async function clamStatus() {
  const s = st('clam'); const o = { installed: !!s && has('clam', 'clamd.exe'), tag: s && s.tag, verified: s && s.verified, dbPresent: dbPresent(), running: !!clamProc || clamReady, ready: clamReady, starting: clamStarting, error: clamErr };
  if (o.installed && o.dbPresent) { const r = await run(exeOf('clam', 'clamscan.exe'), ['--version'], { timeout: 15000 }); const v = parseClamVersion(r.out); if (v) Object.assign(o, v); } return o;
}

// ───────── YARA ─────────
const RULES_SRC = path.join(cfg.SIGS, 'custom_rules.yar'), RULES_BIN = path.join(cfg.SIGS, 'custom_rules.yarc'); let yaraInfo = readJson(path.join(cfg.STATE, 'yara_build.json'), { rules: 0, skipped: 0, built: null });
async function yaraRebuild(ctx) {
  if (!has('yara', 'yarac64.exe') || !fs.existsSync(RULES_SRC)) return { mode: 'lite' }; const { imports, blocks } = splitRules(fs.readFileSync(RULES_SRC, 'utf8')); if (!blocks.length) return { mode: 'lite' };
  const yc = exeOf('yara', 'yarac64.exe'); const tmpSrc = path.join(cfg.TMP, 'rules_build.yar'); let n = 0;
  const compile = async (text) => { fs.writeFileSync(tmpSrc, text); const r = await run(yc, ['-w', tmpSrc, RULES_BIN + '.new'], { timeout: 300000 }); return { ok: r.ok, stderr: r.err + r.out }; };
  const r = await compileTolerant(imports, blocks, compile, { onProgress: (i, k) => ctx && ctx.progress(Math.min(95, 20 + i * 2), `Compilation YARA… (${k} règles)`) });
  try { fs.unlinkSync(tmpSrc); } catch {}
  if (!r.ok) { yaraInfo = { rules: 0, skipped: blocks.length, built: null, error: r.error }; writeJson(path.join(cfg.STATE, 'yara_build.json'), yaraInfo); return { mode: 'lite', error: r.error }; }
  fs.renameSync(RULES_BIN + '.new', RULES_BIN); yaraInfo = { rules: r.kept, skipped: r.dropped.length, built: new Date().toISOString() }; writeJson(path.join(cfg.STATE, 'yara_build.json'), yaraInfo); log('yara', `compilé : ${r.kept} règles, ${r.dropped.length} écartées`); return { mode: 'full', ...yaraInfo };
}
const yaraReady = () => has('yara', 'yara64.exe') && fs.existsSync(RULES_BIN);
async function yaraScanFile(file) {
  if (!yaraReady()) return null; const r = await run(exeOf('yara', 'yara64.exe'), ['-C', '-w', '-a', '15', RULES_BIN, file], { timeout: 30000 });
  const hit = r.out.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0]; return hit ? 'YARA.' + hit.split(/\s+/)[0] : null;
}
const yaraStatus = () => { const s = st('yara'); return { installed: !!s && has('yara', 'yara64.exe'), tag: s && s.tag, verified: s && s.verified, compiled: fs.existsSync(RULES_BIN), ...yaraInfo }; };

// ───────── global ─────────
async function status() { return { clam: await clamStatus(), yara: yaraStatus() }; }
async function uninstall(kind) { if (kind === 'clam') await clamStop(); const sp = SPECS[kind]; if (!sp) return { ok: false }; try { fs.rmSync(sp.dir, { recursive: true, force: true }); } catch {} const s = state(); s[kind] = null; saveState(s); return { ok: true }; }
module.exports = { install, clamUpdate, clamStart, clamStop, clamScanFile, clamReady: () => clamReady, clamStatus, yaraRebuild, yaraReady, yaraScanFile, yaraStatus, status, uninstall,
  _t: { pickAsset, findExe, splitRules, assemble, errorLines, compileTolerant, isSimpleRule, parseClamVersion, parseInstream, freshclamProgress }, splitRules, isSimpleRule };
