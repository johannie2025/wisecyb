const axios = require('axios');
const path = require('path');
const { execFileSync } = require('child_process');
const { machineIdSync } = require('node-machine-id');
const cfg = require('../config');
const { readJson, writeJson } = require('./util');
const FILE = path.join(cfg.STATE, 'license.json'); const REG = 'HKLM\\SOFTWARE\\WiseCybersecurity';
const FORMAT = /^WISE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
let _hw = null; const hwid = () => _hw || (_hw = machineIdSync(true));
const regGet = () => { try { const o = execFileSync('reg', ['query', REG, '/v', 'fr'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); const m = o.match(/REG_SZ\s+(\d+)/); return m ? +m[1] : null; } catch { return null; } };
const regSet = (v) => { try { execFileSync('reg', ['add', REG, '/v', 'fr', '/t', 'REG_SZ', '/d', String(v), '/f'], { windowsHide: true, stdio: 'ignore' }); } catch {} };
let cache = null, cacheT = 0;
// Début d'essai stocké à 2 endroits (fichier + registre) : on garde la date la plus ancienne. Retour d'horloge détecté via lastSeen.
function state() {
  if (cache && Date.now() - cacheT < 60000) return cache;
  let s = readJson(FILE, null); const r = regGet(); const n = Date.now();
  if (!s) s = { firstRun: r || n, license: null, expiresAt: null, activated: false, lastCheck: 0, lastSeen: 0 };
  if (r && r < s.firstRun) s.firstRun = r; if (!r) regSet(s.firstRun);
  const prev = s.lastSeen || 0; const eff = n < prev - 86400000 ? prev : n; s.lastSeen = Math.max(prev, n); writeJson(FILE, s);
  cache = { ...s, _now: eff }; cacheT = n; return cache;
}
const invalidate = () => { cache = null; };
function status() {
  const s = state(); const now = s._now;
  if (s.activated && s.expiresAt) { const days = Math.ceil((s.expiresAt - now) / 86400000); return { mode: days > 0 ? 'licensed' : 'expired', daysLeft: Math.max(days, 0), license: s.license, hwid: hwid(), full: days > 0 }; }
  const trial = cfg.TRIAL_DAYS - Math.floor((now - s.firstRun) / 86400000);
  return { mode: trial > 0 ? 'trial' : 'expired', daysLeft: Math.max(trial, 0), license: null, hwid: hwid(), full: trial > 0 };
}
async function activate(key) {
  key = String(key || '').trim().toUpperCase(); if (!FORMAT.test(key)) return { ok: false, error: 'FORMAT' };
  try {
    const { data } = await axios.post(cfg.API + '/license/verify', { license: key, hwid: hwid() }, { timeout: 15000 });
    if (!data.valid) return { ok: false, error: data.reason || 'INVALID' };
    const s = readJson(FILE, {}); Object.assign(s, { license: key, activated: true, expiresAt: new Date(data.expires_at).getTime(), lastCheck: Date.now() }); writeJson(FILE, s); invalidate();
    return { ok: true, status: status() };
  } catch (e) { return { ok: false, error: e.response && e.response.status === 429 ? 'RATE_LIMIT' : 'NETWORK' }; }
}
async function revalidate() {
  const s = readJson(FILE, {}); if (!s.activated || !s.license) return status();
  try {
    const { data } = await axios.post(cfg.API + '/license/verify', { license: s.license, hwid: hwid() }, { timeout: 15000 });
    if (data.valid) { s.expiresAt = new Date(data.expires_at).getTime(); s.lastCheck = Date.now(); } else { s.activated = false; s.expiresAt = null; }
    writeJson(FILE, s); invalidate();
  } catch {}
  return status();
}
module.exports = { status, activate, revalidate, hwid };
