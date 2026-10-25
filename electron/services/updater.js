const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');
const cfg = require('../config');
const jobs = require('./jobs');
const { readJson, writeJson, log } = require('./util');
const VFILE = path.join(cfg.SIGS, 'version.json'); const PUPS = path.join(cfg.SIGS, 'pups.txt');
let notify = () => {};
const info = () => readJson(VFILE, { version: '0.0.0', lastSync: null, lastError: null, rules: 0, hashes: 0, domains: 0, pups: 0 });
const atomic = (f, d) => { const t = f + '.tmp'; fs.writeFileSync(t, d); fs.renameSync(t, f); };
const count = (s) => (s || '').split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
const sha = (s) => crypto.createHash('sha256').update(s || '', 'utf8').digest('hex');
const http = axios.create({ baseURL: cfg.API, timeout: 45000, headers: { 'User-Agent': 'WiseCybersecurity/' + cfg.APP_VERSION, 'Accept-Encoding': 'gzip' } });

// Message signé : version \n sha256(yara) \n sha256(hashes) \n sha256(domains) \n sha256(pups)
const signedMessage = (d) => Buffer.from([d.version, sha(d.yara), sha(d.hashes), sha(d.domains), sha(d.pups)].join('\n'));
function verify(d) {
  if (!cfg.PUBKEY) return true;
  try { const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(cfg.PUBKEY, 'base64')]), format: 'der', type: 'spki' });
    return crypto.verify(null, signedMessage(d), key, Buffer.from(d.sig || '', 'base64')); } catch { return false; }
}
// Traduit une erreur technique en cause probable + action
function explain(e) {
  const code = e && (e.code || (e.response && e.response.status)); const m = String((e && e.message) || e);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return { code: 'DNS', hint: "Pas d'accès à Internet ou DNS bloqué (serveur wise.alwaysdata.net introuvable)." };
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ECONNABORTED') return { code: 'NET', hint: 'Serveur injoignable ou pare-feu/antivirus qui bloque la connexion sortante.' };
  if (code === 404) return { code: 'HTTP404', hint: "Route introuvable : le fichier .htaccess du dossier api/ n'a pas été envoyé sur le serveur (fichier caché)." };
  if (code === 500 || code === 502) return { code: 'HTTP500', hint: 'Erreur PHP/MySQL côté serveur : migrations SQL non importées ou config.php incorrect.' };
  if (code === 429) return { code: 'HTTP429', hint: 'Trop de requêtes : réessayez dans quelques minutes.' };
  if (/BAD_SIGNATURE/.test(m)) return { code: 'SIG', hint: "Signature invalide : la clé publique du client (PUBKEY) ne correspond pas à la clé secrète du serveur (sign_sk)." };
  if (/EPERM|EACCES|ENOENT|EBUSY/.test(String(code) + m)) return { code: 'DISK', hint: "Écriture impossible dans ProgramData\\WiseCybersecurity : droits insuffisants, ou un antivirus (dont Windows Defender) a supprimé/bloqué le fichier. Vérifiez la quarantaine de Sécurité Windows." };
  return { code: 'OTHER', hint: m.slice(0, 200) };
}
function apply(data) {
  data.pups = data.pups || ''; if (!verify(data)) throw new Error('BAD_SIGNATURE');
  if (typeof data.yara === 'string') atomic(path.join(cfg.SIGS, 'custom_rules.yar'), data.yara);
  if (typeof data.hashes === 'string') atomic(path.join(cfg.SIGS, 'malware_hashes.ndb'), data.hashes);
  if (typeof data.domains === 'string') atomic(path.join(cfg.SIGS, 'blocklist.txt'), data.domains);
  atomic(PUPS, data.pups);
  const i = { version: data.version, lastSync: new Date().toISOString(), lastError: null, rules: (data.yara || '').split(/^\s*(?:(?:private|global)\s+)*rule\s+\w+/m).length - 1, hashes: count(data.hashes), domains: count(data.domains), pups: count(data.pups) };
  writeJson(VFILE, i); log('update', 'DB -> ' + i.version); return i;
}
const fail = (e) => { const x = explain(e); const i = info(); i.lastError = { at: new Date().toISOString(), ...x }; try { writeJson(VFILE, i); } catch {} log('update-error', x.code + ' ' + (e.message || e)); return x; };

// Liste d'IP Talos (signée séparément) → pare-feu
async function updateIps(ctx, force) {
  const s = require('./settings').get(); if (!s.talosIps) return { skipped: true };
  const { data } = await http.get('/threats/ips'); if (!data || !data.ips) return { skipped: true };
  if (cfg.PUBKEY) { const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(cfg.PUBKEY, 'base64')]), format: 'der', type: 'spki' });
    if (!crypto.verify(null, Buffer.from(['IPS', data.version, sha(data.ips)].join('\n')), key, Buffer.from(data.sig || '', 'base64'))) throw new Error('BAD_SIGNATURE (IP)'); }
  const fw = require('./firewall'); const cur = fw.ipBlocklistInfo(); if (!force && cur.applied && cur.version === data.version) return { skipped: true, same: true };
  const r = await fw.applyIpBlocklist(data.ips.split('\n'), { progress: (p, m) => ctx.progress(88 + p * 0.1, m) }, await fw.protectedIps());
  if (r.ok) writeJson(path.join(cfg.STATE, 'talos.json'), { ...fw.ipBlocklistInfo(), version: data.version }); return r;
}
async function doCheck(ctx, force) {
  ctx.progress(8, 'Connexion au serveur de signatures…'); const cur = force ? '0.0.0' : info().version;
  const { data } = await http.get('/threats/updates', { params: { current_version: cur } });
  if (!data || typeof data !== 'object') throw Object.assign(new Error('Réponse invalide (HTML reçu ?)'), { code: 500 });
  let res;
  if (data.up_to_date) { const i = info(); i.lastSync = new Date().toISOString(); i.lastError = null; writeJson(VFILE, i); ctx.progress(85, 'Base déjà à jour'); res = { upToDate: true, info: i }; }
  else {
    ctx.progress(35, `Téléchargement v${data.version}…`); await new Promise(r => setTimeout(r, 150)); ctx.progress(55, 'Vérification de la signature…'); const i = apply(data);
    ctx.progress(70, 'Rechargement des moteurs…'); require('./shield').reloadSignatures();
    try { const eng = require('./engines'); if (eng.yaraStatus().installed) await eng.yaraRebuild({ progress: (p, m) => ctx.progress(70 + p * 0.15, m) }); } catch (e) { log('yara', e.message); }
    res = { upToDate: false, info: i };
  }
  try { res.ips = await updateIps(ctx, false); } catch (e) { res.ipsError = explain(e).hint; log('update-ips', e.message); }
  try { const s = require('./settings').get(); if (s.clam && require('./engines').clamReady()) await require('./engines').clamUpdate({ progress() {}, isCancelled: () => false }).catch(() => {}); } catch {}
  ctx.progress(100, 'Terminé'); return res;
}
async function check(force = false) {
  const r = await jobs.run('update', async (ctx) => { try { return await doCheck(ctx, force); } catch (e) { const x = fail(e); const err = new Error(x.hint); err.explained = x; throw err; } });
  if (r.ok && r.result) notify('update:done', r.result.info); else if (!r.ok && r.error !== 'BUSY') notify('update:error', { message: r.error });
  return r.ok ? { ok: true, ...r.result } : { ok: false, error: r.error };
}
function importLocal(file) {
  try { const name = path.basename(file).toLowerCase(); const txt = fs.readFileSync(file, 'utf8');
    if (name.endsWith('.json')) { const i = apply(JSON.parse(txt)); require('./shield').reloadSignatures(); return { ok: true, info: i }; }
    if (cfg.PUBKEY) return { ok: false, error: 'Fichier non signé refusé' };
    if (name.endsWith('.ndb')) atomic(path.join(cfg.SIGS, 'malware_hashes.ndb'), txt); else if (name.endsWith('.yar')) atomic(path.join(cfg.SIGS, 'custom_rules.yar'), txt); else return { ok: false, error: 'Format non pris en charge' };
    const i = info(); i.lastSync = new Date().toISOString(); i.hashes = count(fs.existsSync(path.join(cfg.SIGS, 'malware_hashes.ndb')) ? fs.readFileSync(path.join(cfg.SIGS, 'malware_hashes.ndb'), 'utf8') : ''); writeJson(VFILE, i); require('./shield').reloadSignatures(); return { ok: true, info: i };
  } catch (e) { return { ok: false, error: explain(e).hint }; }
}
function start(emit) { notify = emit; cron.schedule(cfg.UPDATE_CRON, () => check()); setTimeout(() => check(), 6000); }
module.exports = { start, check, info, importLocal, http, verify, explain, apply, signedMessage, _verify: verify };
