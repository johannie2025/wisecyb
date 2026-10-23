const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { run, readJson, writeJson } = require('./util');
const F = path.join(cfg.STATE, 'devices.json');
async function info() {
  const r = await run('netsh', ['wlan', 'show', 'interfaces']); const g = (re) => (r.out.match(re) || [])[1]; const trim = s => (s || '').trim();
  const ssid = trim(g(/^\s*SSID\s*:\s*(.+)$/m)); const auth = trim(g(/(?:Authentication|Authentification|Autenticaci[oó]n)\s*:\s*(.+)/i)); const sig = parseInt(g(/Signal\s*:\s*(\d+)%/i), 10) || null;
  if (!ssid) return { connected: false };
  let level = 'ok'; if (/open|ouvert|abierta/i.test(auth) || /wep/i.test(auth)) level = 'critical'; else if (/WPA-Personal|WPA-Enterprise|^WPA$/i.test(auth)) level = 'weak'; else if (/WPA3/i.test(auth)) level = 'best';
  return { connected: true, ssid, auth, signal: sig, level };
}
async function devices() {
  const r = await run('arp', ['-a']); const cur = {};
  r.out.split('\n').forEach(l => { const m = l.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})\s+(\w+)/i); if (m && /dynamic|dynamique|din/i.test(m[3]) && !/^(22[4-9]|23\d|255)\./.test(m[1])) cur[m[2].toLowerCase()] = m[1]; });
  const known = readJson(F, null); const first = known === null; const k = known || {}; const fresh = [];
  for (const [mac, ip] of Object.entries(cur)) if (!k[mac]) { if (!first) fresh.push({ mac, ip }); k[mac] = ip; }
  writeJson(F, k); return { devices: Object.entries(cur).map(([mac, ip]) => ({ mac, ip })), fresh };
}
module.exports = { info, devices };
