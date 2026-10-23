const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const cfg = require('../config');
for (const d of [cfg.BASE, cfg.SIGS, cfg.QUAR, cfg.LOGS, cfg.STATE]) { try { fs.mkdirSync(d, { recursive: true }); } catch {} }
const readJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
const writeJson = (f, o) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o, null, 2)); fs.renameSync(t, f); };
const hashFile = (file, algo = 'sha256') => new Promise((res, rej) => {
  const h = crypto.createHash(algo); const s = fs.createReadStream(file);
  s.on('data', c => h.update(c)); s.on('end', () => res(h.digest('hex'))); s.on('error', rej);
});
const run = (cmd, args, opts = {}) => new Promise(res => execFile(cmd, args, { windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024, ...opts }, (e, so, se) => res({ ok: !e, out: so || '', err: se || (e && e.message) || '' })));
const ps = (script) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
const log = (type, msg) => { try { fs.appendFileSync(require('path').join(cfg.LOGS, 'events.log'), JSON.stringify({ t: new Date().toISOString(), type, msg }) + '\n'); } catch {} };
module.exports = { readJson, writeJson, hashFile, run, ps, log };
// Arrête les processus dont l'exécutable correspond au fichier (avant mise en quarantaine)
module.exports.killByPath = (file) => module.exports.ps(`Get-Process | Where-Object { $_.Path -eq '${String(file).replace(/'/g, "''")}' } | Stop-Process -Force -ErrorAction SilentlyContinue`);
