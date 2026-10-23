// Tests exécutables hors Windows : node tests/logic.test.js
process.env.PROGRAMDATA = process.env.PROGRAMDATA || require('os').tmpdir();
const assert = require('assert'); const crypto = require('crypto'); const path = require('path');
const S = path.join(__dirname, '../electron/services'); const cfg = require('../electron/config');
let n = 0; const ok = (name, fn) => { try { const r = fn(); if (r && r.then) return r.then(() => { n++; console.log('✓', name); }); n++; console.log('✓', name); } catch (e) { console.error('✗', name, e.message); process.exitCode = 1; } };
(async () => {
  const vault = require(S + '/vault'); const vpn = require(S + '/vpn'); const priv = require(S + '/privacy'); const upd = require(S + '/updater'); const rb = require(S + '/rollback');
  ok('coffre : création, verrou, mauvais mot de passe, déverrouillage', () => { try { require('fs').unlinkSync(path.join(cfg.BASE, 'vault.wv')); } catch {}
    assert(vault.create('motdepasse-solide').ok); vault.upsert({ title: 'Site', username: 'u', secret: 'S3cret!' }); vault.lock(); assert(!vault.unlock('faux').ok); assert(vault.unlock('motdepasse-solide').ok); const i = vault.list()[0]; assert.strictEqual(vault.reveal(i.id), 'S3cret!'); assert(!('secret' in i)); });
  ok('générateur : longueur et diversité', () => { const p = vault.generate(24); assert.strictEqual(p.length, 24); assert(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /\W/.test(p)); });
  ok('kill switch : le complément exclut LAN + serveur', () => { const ip = '5.6.7.8'; const ex = [vpn._cidr('10.0.0.0', 8), vpn._cidr('192.168.0.0', 16), [5 * 2 ** 24 + 6 * 65536 + 7 * 256 + 8, 5 * 2 ** 24 + 6 * 65536 + 7 * 256 + 8]]; const r = vpn._complement(ex); assert(r[0].startsWith('0.0.0.0-')); assert(!r.some(x => x.includes('10.1.1.1'))); assert(r.every(x => /^\d+\.\d+\.\d+\.\d+-\d+\.\d+\.\d+\.\d+$/.test(x))); });
  ok('anti-phishing : verdicts', () => { assert.strictEqual(priv.checkUrl('https://www.paypal.com/signin').verdict, 'ok'); assert.strictEqual(priv.checkUrl('https://www.amazon.co.uk').verdict, 'ok'); assert.notStrictEqual(priv.checkUrl('http://paypal-secure-login.top/verify').verdict, 'ok'); assert.strictEqual(priv.checkUrl('http://192.168.1.5@evil.xyz/apple').verdict, 'dangerous'); });
  ok('mise à jour : signature Ed25519 valide / falsifiée', () => { const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'); const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32); cfg.PUBKEY = raw.toString('base64');
    const sha = s => crypto.createHash('sha256').update(s).digest('hex'); const d = { version: '1.2.3', yara: 'rule A {}', hashes: 'abc:X', domains: 'evil.com' }; d.sig = crypto.sign(null, Buffer.from([d.version, sha(d.yara), sha(d.hashes), sha(d.domains)].join('\n')), privateKey).toString('base64');
    assert(upd._verify(d)); assert(!upd._verify({ ...d, hashes: 'abc:Y' })); assert(!upd._verify({ ...d, sig: '' })); cfg.PUBKEY = ''; });
  ok('rollback : entropie texte < chiffré', () => { assert(rb.entropy(Buffer.from('hello hello hello hello')) < 4); assert(rb.entropy(crypto.randomBytes(65536)) > 7.9); });
  console.log(`\n${n} tests OK`);
})();
