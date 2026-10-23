const path = require('path');
const cfg = require('../config');
const { readJson, writeJson } = require('./util');
const F = path.join(cfg.STATE, 'settings.json');
const DEF = { lang: 'fr', ransom: true, cfa: false, usbAuto: true, web: false, cam: false, mic: false, scheduled: true, gaming: true, exclusions: [], hibpKey: '' };
const get = () => ({ ...DEF, ...readJson(F, {}) });
function set(patch) {
  const p = { ...patch };
  if (p.exclusions) p.exclusions = p.exclusions.filter(x => typeof x === 'string' && /^[A-Za-z]:\\/.test(x)).slice(0, 200);
  if (p.lang && !['fr', 'es', 'en'].includes(p.lang)) delete p.lang;
  const s = { ...get(), ...p }; writeJson(F, s); return s;
}
module.exports = { get, set };
