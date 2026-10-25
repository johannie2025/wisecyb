const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile, execFileSync } = require('child_process');
const cfg = require('../config');
const isWin = process.platform === 'win32';
for (const d of [cfg.BASE, cfg.SIGS, cfg.QUAR, cfg.LOGS, cfg.STATE, cfg.ENGINES, cfg.BACKUP, cfg.TMP]) { try { fs.mkdirSync(d, { recursive: true }); } catch {} }

const stripBom = (s) => String(s || '').replace(/^\uFEFF/, '');
const readJson = (f, def) => { try { return JSON.parse(stripBom(fs.readFileSync(f, 'utf8'))); } catch { return def; } };
const writeJson = (f, o) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o, null, 2)); fs.renameSync(t, f); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fmtBytes = (b) => { b = +b || 0; const u = ['o', 'Ko', 'Mo', 'Go', 'To']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return b.toFixed(i ? 1 : 0) + ' ' + u[i]; };
const hashFile = (file, algo = 'sha256') => new Promise((res, rej) => { const h = crypto.createHash(algo); const s = fs.createReadStream(file); s.on('data', c => h.update(c)); s.on('end', () => res(h.digest('hex'))); s.on('error', rej); });

const run = (cmd, args = [], opts = {}) => new Promise(res => execFile(cmd, args, { windowsHide: true, timeout: 60000, maxBuffer: 32 * 1024 * 1024, ...opts }, (e, so, se) => res({ ok: !e, out: stripBom(so), err: stripBom(se) || (e && e.message) || '', code: e ? (e.code === undefined ? 1 : e.code) : 0 })));

// PowerShell : script encodé (UTF-16LE base64) ou fichier .ps1 si trop long ; données utilisateur passées par $env:WISE_ARG (JSON) = aucune injection possible.
const PRE = "[Console]::OutputEncoding=[Text.Encoding]::UTF8;$OutputEncoding=[Text.Encoding]::UTF8;$ProgressPreference='SilentlyContinue';$ErrorActionPreference='SilentlyContinue';\n";
const psArgs = (script) => {
  const full = PRE + script; const base = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];
  if (full.length < 6000) return { args: [...base, '-EncodedCommand', Buffer.from(full, 'utf16le').toString('base64')] };
  const f = path.join(cfg.TMP, 'ps_' + crypto.randomBytes(6).toString('hex') + '.ps1'); fs.writeFileSync(f, '\uFEFF' + full, 'utf8'); return { args: [...base, '-File', f], cleanup: () => fs.unlink(f, () => {}) };
};
async function ps(script, { arg, timeout = 120000, env } = {}) {
  if (!isWin) return { ok: false, out: '', err: 'powershell indisponible (hors Windows)', code: 1 };
  const { args, cleanup } = psArgs(script);
  try { return await run('powershell.exe', args, { timeout, env: { ...process.env, ...(env || {}), ...(arg !== undefined ? { WISE_ARG: JSON.stringify(arg) } : {}) } }); } finally { cleanup && cleanup(); }
}
const parseJsonList = (out) => { const t = stripBom(out).trim(); if (!t) return []; try { const j = JSON.parse(t); return Array.isArray(j) ? j : j === null ? [] : [j]; } catch { return []; } };
const psJson = async (script, o) => parseJsonList((await ps(script, o)).out);

function log(type, msg) {
  try { const f = path.join(cfg.LOGS, 'events.log'); try { if (fs.statSync(f).size > 5 * 1024 * 1024) fs.renameSync(f, f + '.old'); } catch {}
    fs.appendFileSync(f, JSON.stringify({ t: new Date().toISOString(), type, msg: String(msg).slice(0, 2000) }) + '\n'); } catch {}
}
const killByPath = (file) => ps("$p=($env:WISE_ARG|ConvertFrom-Json); Get-Process | Where-Object { $_.Path -eq $p } | Stop-Process -Force", { arg: String(file) });
const expandEnv = (s, env = process.env) => String(s).replace(/%([^%]+)%/g, (m, k) => { const key = Object.keys(env).find(x => x.toLowerCase() === k.toLowerCase()); return key ? env[key] : m; });
const isAdminSync = () => { if (!isWin) return false; try { execFileSync('net', ['session'], { stdio: 'ignore', windowsHide: true }); return true; } catch { return false; } };
module.exports = { isWin, readJson, writeJson, hashFile, run, ps, psJson, parseJsonList, log, killByPath, sleep, fmtBytes, expandEnv, stripBom, isAdminSync };
