const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');
const cfg = require('../config');
const { readJson, writeJson, log } = require('./util');
const VFILE = path.join(cfg.SIGS, 'version.json');
let notify = () => {}; let busy = false;
const info = () => readJson(VFILE, { version: '0.0.0', lastSync: null, rules: 0, hashes: 0, domains: 0 });
const atomic = (f, d) => { const t = f + '.tmp'; fs.writeFileSync(t, d); fs.renameSync(t, f); };
const count = (s) => (s || '').split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
const sha = (s) => crypto.createHash('sha256').update(s || '', 'utf8').digest('hex');
// Message signé : version \n sha256(yara) \n sha256(hashes) \n sha256(domains)
function verify(d) {
  if (!cfg.PUBKEY) { log('warn', 'PUBKEY vide : signature non vérifiée'); return true; }
  try {
    const msg = Buffer.from([d.version, sha(d.yara), sha(d.hashes), sha(d.domains)].join('\n'));
    const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(cfg.PUBKEY, 'base64')]), format: 'der', type: 'spki' });
    return crypto.verify(null, msg, key, Buffer.from(d.sig || '', 'base64'));
  } catch { return false; }
}
function apply(data) {
  if (!verify(data)) throw new Error('BAD_SIGNATURE');
  if (typeof data.yara === 'string') atomic(path.join(cfg.SIGS, 'custom_rules.yar'), data.yara);
  if (typeof data.hashes === 'string') atomic(path.join(cfg.SIGS, 'malware_hashes.ndb'), data.hashes);
  if (typeof data.domains === 'string') atomic(path.join(cfg.SIGS, 'blocklist.txt'), data.domains);
  const i = { version: data.version, lastSync: new Date().toISOString(), rules: (data.yara || '').split(/\brule\s+\w+/).length - 1, hashes: count(data.hashes), domains: count(data.domains) };
  writeJson(VFILE, i); log('update', 'DB -> ' + i.version); require('./shield').reloadSignatures(); return i;
}
async function check() {
  if (busy) return { ok: false, error: 'BUSY' }; busy = true; notify('update:progress', { step: 'check', pct: 10 });
  try {
    const { data } = await axios.get(cfg.API + '/threats/updates', { params: { current_version: info().version }, timeout: 30000 });
    if (data.up_to_date) { const i = info(); i.lastSync = new Date().toISOString(); writeJson(VFILE, i); notify('update:done', i); return { ok: true, upToDate: true, info: i }; }
    notify('update:progress', { step: 'verify', pct: 60 }); const i = apply(data); notify('update:progress', { step: 'apply', pct: 100 }); notify('update:done', i);
    return { ok: true, upToDate: false, info: i };
  } catch (e) { notify('update:error', { message: e.message }); return { ok: false, error: e.message }; } finally { busy = false; }
}
// Import manuel : bundle signé (.json) ; .ndb/.yar bruts acceptés seulement si aucune clé publique n'est configurée
function importLocal(file) {
  try {
    const name = path.basename(file).toLowerCase(); const txt = fs.readFileSync(file, 'utf8');
    if (name.endsWith('.json')) return { ok: true, info: apply(JSON.parse(txt)) };
    if (cfg.PUBKEY) return { ok: false, error: 'UNSIGNED_REFUSED' };
    if (name.endsWith('.ndb')) atomic(path.join(cfg.SIGS, 'malware_hashes.ndb'), txt); else if (name.endsWith('.yar')) atomic(path.join(cfg.SIGS, 'custom_rules.yar'), txt); else return { ok: false, error: 'UNSUPPORTED' };
    const i = info(); i.lastSync = new Date().toISOString(); i.hashes = count(fs.existsSync(path.join(cfg.SIGS, 'malware_hashes.ndb')) ? fs.readFileSync(path.join(cfg.SIGS, 'malware_hashes.ndb'), 'utf8') : ''); writeJson(VFILE, i); require('./shield').reloadSignatures(); return { ok: true, info: i };
  } catch (e) { return { ok: false, error: e.message }; }
}
function start(emit) { notify = emit; cron.schedule(cfg.UPDATE_CRON, () => check()); setTimeout(() => check(), 8000); }
module.exports = { start, check, info, importLocal, _verify: verify };
