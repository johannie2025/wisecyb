const path = require('path');
const cfg = require('../config');
const { readJson, writeJson } = require('./util');
const F = path.join(cfg.STATE, 'settings.json');
const DEF = { lang: 'fr', ransom: true, cfa: false, usbAuto: true, web: false, cam: false, mic: false, scheduled: true, gaming: true, exclusions: [], hibpKey: '', clam: false, talosIps: true, defenderMode: 'off', autoClean: false };
const get = () => ({ ...DEF, ...readJson(F, {}) });
const BOOL = ['ransom', 'cfa', 'usbAuto', 'web', 'cam', 'mic', 'scheduled', 'gaming', 'clam', 'talosIps', 'autoClean'];
function set(patch) {
  const p = { ...patch };
  if (p.exclusions) p.exclusions = p.exclusions.filter(x => typeof x === 'string' && /^[A-Za-z]:\\/.test(x)).slice(0, 200);
  if (p.lang && !['fr', 'es', 'en'].includes(p.lang)) delete p.lang;
  if (p.defenderMode && !['off', 'replace'].includes(p.defenderMode)) delete p.defenderMode;
  if (p.hibpKey !== undefined) p.hibpKey = String(p.hibpKey).slice(0, 100);
  for (const k of BOOL) if (k in p) p[k] = !!p[k];
  const s = { ...get(), ...p }; writeJson(F, s); return s;
}
module.exports = { get, set };
