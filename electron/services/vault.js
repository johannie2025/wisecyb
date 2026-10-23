// Gestionnaire de mots de passe : AES-256-GCM, clé dérivée du mot de passe maître par scrypt. 100 % local, verrouillage auto 5 min.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const leak = require('./leak');
const F = path.join(cfg.BASE, 'vault.wv');
let key = null, data = null, salt = null, timer = null;
const derive = (pw, s) => crypto.scryptSync(String(pw), s, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const exists = () => fs.existsSync(F);
const touch = () => { clearTimeout(timer); timer = setTimeout(lock, 5 * 60 * 1000); };
function save() {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(JSON.stringify(data), 'utf8'), c.final()]);
  const t = F + '.tmp'; fs.writeFileSync(t, JSON.stringify({ v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), d: enc.toString('base64') })); fs.renameSync(t, F);
}
function create(pw) {
  if (exists()) return { ok: false, error: 'EXISTS' }; if (String(pw).length < 8) return { ok: false, error: 'WEAK' };
  salt = crypto.randomBytes(16); key = derive(pw, salt); data = { items: [] }; save(); touch(); return { ok: true };
}
function unlock(pw) {
  try {
    const f = JSON.parse(fs.readFileSync(F, 'utf8')); const s = Buffer.from(f.salt, 'base64'); const k = derive(pw, s);
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(f.iv, 'base64')); d.setAuthTag(Buffer.from(f.tag, 'base64'));
    data = JSON.parse(Buffer.concat([d.update(Buffer.from(f.d, 'base64')), d.final()]).toString('utf8')); key = k; salt = s; touch(); return { ok: true };
  } catch { return { ok: false, error: 'BAD_PASSWORD' }; }
}
function lock() { key = null; data = null; clearTimeout(timer); return { ok: true }; }
const need = () => { if (!data) throw new Error('LOCKED'); touch(); };
const state = () => ({ exists: exists(), unlocked: !!data });
const list = () => { need(); return data.items.map(({ secret, ...r }) => r); };
const reveal = (id) => { need(); const i = data.items.find(x => x.id === id); return i ? i.secret : null; };
function upsert(it) {
  need(); const clean = { id: it.id || crypto.randomUUID(), type: ['login', 'card', 'id', 'note'].includes(it.type) ? it.type : 'login', title: String(it.title || '').slice(0, 120), username: String(it.username || '').slice(0, 200), secret: String(it.secret || '').slice(0, 2000), url: String(it.url || '').slice(0, 300), notes: String(it.notes || '').slice(0, 2000) };
  const i = data.items.findIndex(x => x.id === clean.id); if (i >= 0) data.items[i] = clean; else data.items.push(clean); save(); return { ok: true, id: clean.id };
}
const remove = (id) => { need(); data.items = data.items.filter(x => x.id !== id); save(); return { ok: true }; };
function generate(len = 20, o = {}) {
  len = Math.min(64, Math.max(8, len | 0)); const sets = [['abcdefghijkmnopqrstuvwxyz', true], ['ABCDEFGHJKLMNPQRSTUVWXYZ', true], ['23456789', o.digits !== false], ['!@#$%^&*()-_=+[]{}', o.symbols !== false]].filter(s => s[1]).map(s => s[0]);
  const all = sets.join(''); const pick = (s) => s[crypto.randomInt(s.length)]; const out = sets.map(pick); while (out.length < len) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out.join('');
}
function strength(pw) { let c = 0; if (/[a-z]/.test(pw)) c += 26; if (/[A-Z]/.test(pw)) c += 26; if (/\d/.test(pw)) c += 10; if (/[^\w]/.test(pw)) c += 32; return Math.round(pw.length * Math.log2(c || 1)); }
async function audit() { // faibles / réutilisés / compromis (k-anonymity HIBP : seul un préfixe de 5 caractères du SHA-1 quitte le PC)
  need(); const logins = data.items.filter(i => i.type === 'login' && i.secret); const seen = {}; logins.forEach(i => (seen[i.secret] = (seen[i.secret] || 0) + 1));
  const res = []; for (const i of logins) { const p = await leak.pwned(i.secret); res.push({ id: i.id, title: i.title, weak: strength(i.secret) < 50, reused: seen[i.secret] > 1, pwned: p.ok ? p.count : null }); } return res;
}
module.exports = { state, create, unlock, lock, list, reveal, upsert, remove, generate, audit, strength };
