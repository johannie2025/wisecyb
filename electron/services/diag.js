// Diagnostic de la mise à jour : teste chaque maillon et dit où ça casse.
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const crypto = require('crypto');
const cfg = require('../config');
const upd = require('./updater');
const { run, sleep } = require('./util');
async function run_(ctx) {
  const steps = []; const add = (name, ok, detail, fix) => { steps.push({ name, ok, detail, fix: fix || null }); ctx.progress((steps.length / 7) * 100, name); };
  const host = new URL(cfg.API).hostname;
  try { const a = await dns.lookup(host); add('Résolution DNS', true, `${host} → ${a.address}`); } catch (e) { add('Résolution DNS', false, e.code || e.message, 'Vérifiez Internet / DNS / VPN.'); return steps; }
  let ping = null; try { const r = await upd.http.get('/ping'); ping = r.data; add('API joignable (/ping)', !!(ping && ping.ok), ping && ping.ok ? `HTTP ${r.status} · version serveur ${ping.version || 'aucune'} · ${ping.hashes} hashes` : 'Réponse inattendue'); }
  catch (e) { const x = upd.explain(e); add('API joignable (/ping)', false, x.code + ' — ' + x.hint, x.hint); return steps; }
  if (ping && Math.abs(Date.parse(ping.time) - Date.now()) > 5 * 60000) add('Horloge du PC', false, `Écart de ${Math.round(Math.abs(Date.parse(ping.time) - Date.now()) / 60000)} min avec le serveur`, 'Synchronisez l\'heure Windows.'); else add('Horloge du PC', true, 'Synchronisée');
  let bundle = null; try { const r = await upd.http.get('/threats/updates', { params: { current_version: '0.0.0' } }); bundle = r.data; add('Téléchargement du bundle', !!(bundle && (bundle.version || bundle.up_to_date)), bundle && bundle.version ? `v${bundle.version} · ${(JSON.stringify(bundle).length / 1024).toFixed(0)} Ko` : 'Aucune version publiée côté serveur', 'Publiez une version dans le panneau admin (« Publier maintenant »).'); }
  catch (e) { const x = upd.explain(e); add('Téléchargement du bundle', false, x.hint, x.hint); return steps; }
  if (bundle && bundle.version) { let ok = false; try { ok = upd.verify({ ...bundle, pups: bundle.pups || '' }); } catch {} add('Signature', ok, cfg.PUBKEY ? (ok ? 'Valide' : 'Invalide — PUBKEY ≠ clé du serveur') : 'Non vérifiée (PUBKEY vide dans config.js — déconseillé en production)', ok ? null : 'Alignez PUBKEY (client) et sign_sk (serveur).'); } else add('Signature', true, 'Rien à vérifier');
  const probe = path.join(cfg.SIGS, '.wise_probe_' + crypto.randomBytes(3).toString('hex')); let wok = false, det = '';
  try { fs.writeFileSync(probe + '.tmp', 'WISE-DIAG'); fs.renameSync(probe + '.tmp', probe); await sleep(1500); wok = fs.existsSync(probe) && fs.readFileSync(probe, 'utf8') === 'WISE-DIAG'; det = wok ? 'Écriture/renommage/relecture OK dans ' + cfg.SIGS : 'Le fichier a disparu : supprimé par un antivirus ?'; } catch (e) { det = e.code + ' ' + e.message; } try { fs.unlinkSync(probe); } catch {}
  add('Écriture sur le disque', wok, det, 'Ouvrez Sécurité Windows → Historique de protection et restaurez/autorisez les fichiers WiseCybersecurity, ou lancez l\'application en administrateur.');
  const pr = process.env.HTTPS_PROXY || process.env.https_proxy; add('Proxy système', true, pr ? 'Proxy détecté : ' + pr : 'Aucun proxy d\'environnement');
  return steps;
}
module.exports = { run: run_ };
