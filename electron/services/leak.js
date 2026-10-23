const axios = require('axios');
const crypto = require('crypto');
const cfg = require('../config');
const settings = require('./settings');
async function pwned(password) {
  try {
    const h = crypto.createHash('sha1').update(String(password)).digest('hex').toUpperCase(); const pre = h.slice(0, 5), suf = h.slice(5);
    const { data } = await axios.get(cfg.HIBP + pre, { headers: { 'Add-Padding': 'true' }, timeout: 10000, responseType: 'text' });
    const line = String(data).split('\n').find(l => l.startsWith(suf)); return { ok: true, count: line ? parseInt(line.split(':')[1], 10) || 0 : 0 };
  } catch { return { ok: false, error: 'NETWORK' }; }
}
// Vérification d'e-mail : l'API HIBP v3 exige une clé (payante) saisie dans Paramètres
async function email(addr) {
  addr = String(addr || '').trim(); if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(addr)) return { ok: false, error: 'INVALID' };
  const k = settings.get().hibpKey; if (!k) return { ok: false, error: 'NO_KEY' };
  try {
    const r = await axios.get('https://haveibeenpwned.com/api/v3/breachedaccount/' + encodeURIComponent(addr) + '?truncateResponse=false', { headers: { 'hibp-api-key': k, 'user-agent': 'WiseCybersecurity' }, timeout: 12000, validateStatus: s => s === 200 || s === 404 });
    return { ok: true, breaches: r.status === 404 ? [] : r.data.map(b => ({ name: b.Name, date: b.BreachDate, data: b.DataClasses })) };
  } catch (e) { return { ok: false, error: e.response && e.response.status === 401 ? 'BAD_KEY' : 'NETWORK' }; }
}
module.exports = { pwned, email };
