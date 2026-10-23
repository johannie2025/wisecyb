const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { ps, run } = require('./util');
const S = '# >>> WiseCybersecurity BEGIN', E = '# <<< WiseCybersecurity END'; const HOSTS = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const DEFAULT_BLOCK = ['secure-login-paypal-verify.com', 'free-bitcoin-gen.xyz', 'apple-id-verify-support.top'];
const strip = (h) => h.replace(new RegExp(S + '[\\s\\S]*?' + E + '\\r?\\n?', 'g'), '');
function loadList() { try { const l = fs.readFileSync(path.join(cfg.SIGS, 'blocklist.txt'), 'utf8').split('\n').map(x => x.trim()).filter(Boolean); if (l.length) return l; } catch {} return DEFAULT_BLOCK; }
function applyBlocklist() {
  const d = [...new Set(loadList().map(x => x.toLowerCase()).filter(x => /^[a-z0-9.-]{3,253}$/.test(x)))];
  fs.writeFileSync(HOSTS, strip(fs.readFileSync(HOSTS, 'utf8')) + '\r\n' + S + '\r\n' + d.map(x => `0.0.0.0 ${x}\r\n0.0.0.0 www.${x}`).join('\r\n') + '\r\n' + E + '\r\n'); run('ipconfig', ['/flushdns']); return d.length;
}
const removeBlocklist = () => { fs.writeFileSync(HOSTS, strip(fs.readFileSync(HOSTS, 'utf8'))); run('ipconfig', ['/flushdns']); };
const setDevice = (cls, on) => ['Camera', 'AudioEndpoint'].includes(cls) ? ps(`Get-PnpDevice -Class ${cls} -ErrorAction SilentlyContinue | ${on ? 'Enable' : 'Disable'}-PnpDevice -Confirm:$false`) : { ok: false };
const cfa = (on) => ps(`Set-MpPreference -EnableControlledFolderAccess ${on ? 'Enabled' : 'Disabled'}`); // Dossiers protégés Windows Defender
const BR = { paypal: 1, apple: 1, microsoft: 1, google: 1, facebook: 1, instagram: 1, whatsapp: 1, netflix: 1, amazon: 1, binance: 1, moneygram: 1, westernunion: 1, mastercard: 1, orange: 1, mtn: 1 };
const BADTLD = /\.(zip|top|xyz|click|loan|work|gq|tk|ml|cf|ga|icu|rest|monster|cfd)$/;
function checkUrl(input) {
  let u; try { u = new URL(/^https?:\/\//i.test(input) ? input : 'http://' + input); } catch { return { ok: false, error: 'INVALID' }; }
  const h = u.hostname.toLowerCase(); const r = []; let s = 0; const add = (n, p) => { r.push(n); s += p; };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) add('IP_HOST', 3); if (h.includes('xn--')) add('PUNYCODE', 3); if (h.split('.').length > 4) add('MANY_SUBDOMAINS', 1);
  if (BADTLD.test(h)) add('SUSPICIOUS_TLD', 2); if (u.protocol !== 'https:') add('NO_HTTPS', 1); if (u.username) add('USERINFO', 3);
  for (const b of Object.keys(BR)) if (h.includes(b) && !new RegExp(`(^|\\.)${b}\\.(com|net|org|co\\.[a-z]{2}|[a-z]{2})$`).test(h)) { add('BRAND_LOOKALIKE:' + b, 3); break; }
  if (/-(login|verify|secure|update|account|support|wallet)[-.]/.test(h)) add('PHISH_KEYWORDS', 2);
  if (loadList().includes(h)) add('IN_BLOCKLIST', 5);
  return { ok: true, host: h, score: s, reasons: r, verdict: s >= 5 ? 'dangerous' : s >= 2 ? 'suspicious' : 'ok' };
}
module.exports = { applyBlocklist, removeBlocklist, webcam: b => setDevice('Camera', !b), mic: b => setDevice('AudioEndpoint', !b), cfa, checkUrl };
