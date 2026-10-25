// VPN : OpenVPN + serveurs bénévoles VPNGate. Kill switch IPv4+IPv6, bascule automatique vers un autre serveur en cas d'échec, surveillance de la connexion.
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const cfg = require('../config');
const { ps, run, log, sleep } = require('./util');
const OVPN_CANDIDATES = ['C:\\Program Files\\OpenVPN\\bin\\openvpn.exe', 'C:\\Program Files (x86)\\OpenVPN\\bin\\openvpn.exe'];

// ───── IPv4 : complément d'un ensemble de plages exclues (calcul du kill switch) ─────
const toInt = ip => ip.split('.').reduce((a, o) => a * 256 + (+o), 0); const toIp = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
const cidr = (ip, bits) => { const s = toInt(ip); return [s, s + 2 ** (32 - bits) - 1]; };
function complement(excl) {
  excl = [...excl].sort((a, b) => a[0] - b[0]); const out = []; let cur = 0;
  for (const [s, e] of excl) { if (s > cur) out.push([cur, s - 1]); cur = Math.max(cur, e + 1); }
  if (cur <= 0xFFFFFFFF) out.push([cur, 0xFFFFFFFF]); return out.map(([a, b]) => toIp(a) + '-' + toIp(b));
}
function killSwitchRanges(serverIp) {
  const ex = [cidr('10.0.0.0', 8), cidr('127.0.0.0', 8), cidr('169.254.0.0', 16), cidr('172.16.0.0', 12), cidr('192.168.0.0', 16), cidr('224.0.0.0', 4), [toInt(serverIp), toInt(serverIp)], [0xFFFFFFFF, 0xFFFFFFFF]];
  return complement(ex).filter(r => /^[\d.]+-[\d.]+$/.test(r));
}
// Score de tri des serveurs VPNGate : fiabilité (score) pondérée par latence/débit ; élimine les entrées incohérentes
function parseGateLine(l) {
  if (!l || l[0] === '*' || l[0] === '#') return null; const c = l.split(','); if (c.length < 15) return null; if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(c[1])) return null;
  const score = +c[2], ping = +c[3], speed = +c[4]; if (!Number.isFinite(score) || !Number.isFinite(ping) || !Number.isFinite(speed) || ping <= 0) return null;
  return { host: c[0] || c[1], ip: c[1], score, ping, speed, country: c[5] || '?', cc: (c[6] || '').toUpperCase(), sessions: +c[7] || 0, uptime: +c[8] || 0, config: c[14] };
}
function rankServers(lines, excludeIps = []) {
  const excl = new Set(excludeIps); const out = [];
  for (const l of lines) { const s = parseGateLine(l); if (s && !excl.has(s.ip)) out.push(s); }
  return out.sort((a, b) => (b.score / Math.max(b.ping, 1)) - (a.score / Math.max(a.ping, 1)));
}
// Retire du .ovpn tout ce qui exécuterait du code côté client (défense en profondeur ; --script-security 0 l'interdit déjà au niveau du process)
const SCRUB = /^\s*(script-security|up|down|plugin|route-up|tls-verify|ipchange|learn-address|client-connect|client-disconnect|up-restart)\b.*$/gim;
function sanitizeConfig(txt) { return String(txt).replace(SCRUB, '').replace(/^\s*up\s+\S+.*$/gim, ''); }
function parseOvpnLog(s) {
  if (/AUTH_FAILED/i.test(s)) return { event: 'error', msg: 'Authentification refusée par le serveur' };
  if (/TLS[ _]Error|TLS handshake failed/i.test(s)) return { event: 'error', msg: 'Échec de la négociation TLS (serveur indisponible)' };
  if (/RESOLVE.*Could not resolve/i.test(s)) return { event: 'error', msg: 'Nom de serveur introuvable' };
  if (/Connection reset|Network is unreachable/i.test(s)) return { event: 'error', msg: 'Réseau inaccessible' };
  if (/Initialization Sequence Completed/i.test(s)) return { event: 'connected' };
  if (/Inactivity timeout/i.test(s)) return { event: 'error', msg: "Délai d'inactivité dépassé" };
  return null;
}

// ───── état ─────
let proc = null, emit = () => {}, cur = null, ks = false, health = null, reconnecting = false, wantConnected = false, lastList = [];
const exe = () => OVPN_CANDIDATES.find(p => fs.existsSync(p)) || null;
const installed = () => !!exe();
async function install() { return run('winget', ['install', '-e', '--id', 'OpenVPNTechnologies.OpenVPN', '--silent', '--accept-source-agreements', '--accept-package-agreements'], { timeout: 900000 }); }
async function servers(excludeIps = []) {
  const { data } = await axios.get('https://www.vpngate.net/api/iphone/', { timeout: 25000, responseType: 'text' });
  const list = rankServers(String(data).split('\n'), excludeIps); lastList = list; return list;
}
async function list() { return (await servers()).map(({ config, ...s }) => s); }
async function killSwitch(on, serverIp) {
  await ps("Remove-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch*' -ErrorAction SilentlyContinue");
  if (!on) { ks = false; emit('vpn:ks', false); return; }
  const adapters = await ps("@(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty InterfaceAlias) -join '|'");
  const names = (adapters.out || '').trim().split('|').filter(Boolean); if (!names.length) { ks = false; return; }
  const ranges = killSwitchRanges(serverIp); const nameArg = names.map(n => `'${n.replace(/'/g, "''")}'`).join(',');
  await ps(`New-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch_v4' -Direction Outbound -Action Block -InterfaceAlias @(${nameArg}) -RemoteAddress @('${ranges.join("','")}') -Profile Any | Out-Null`);
  await ps(`New-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch_v6' -Direction Outbound -Action Block -InterfaceAlias @(${nameArg}) -RemoteAddress '::/0' -Profile Any | Out-Null`); // IPv4-only VPN : tout IPv6 bloqué (évite une fuite)
  ks = true; emit('vpn:ks', true);
}
function spawnOvpn(serverSel, withKs, ctx) {
  return new Promise((resolve) => {
    const p = exe(); if (!p) return resolve({ ok: false, error: 'OpenVPN non installé' });
    const dir = path.join(cfg.BASE, 'vpn'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, 'current.ovpn');
    fs.writeFileSync(f, sanitizeConfig(Buffer.from(serverSel.config, 'base64').toString('utf8')));
    let settled = false; const to = setTimeout(() => { if (!settled) { settled = true; try { proc && proc.kill(); } catch {} resolve({ ok: false, error: 'Délai de connexion dépassé (20 s)' }); } }, 20000);
    emit('vpn:state', { state: 'connecting', server: serverSel.ip, country: serverSel.country });
    proc = spawn(p, ['--config', f, '--connect-retry-max', '1', '--connect-timeout', '15', '--script-security', '0', '--pull-filter', 'ignore', 'route-ipv6', '--pull-filter', 'ignore', 'ifconfig-ipv6'], { windowsHide: true });
    const onData = async (d) => {
      const ev = parseOvpnLog(String(d)); if (!ev) return;
      if (ev.event === 'connected' && !settled) { settled = true; clearTimeout(to); if (withKs) await killSwitch(true, serverSel.ip);
        cur = serverSel; health = Date.now(); emit('vpn:state', { state: 'connected', server: serverSel.ip, country: serverSel.country, killSwitch: ks }); resolve({ ok: true }); }
      else if (ev.event === 'error' && !settled) { settled = true; clearTimeout(to); resolve({ ok: false, error: ev.msg }); }
    };
    proc.stdout.on('data', onData); proc.stderr.on('data', onData);
    proc.on('exit', () => { const was = cur; proc = null; cur = null; health = null; if (!settled) { settled = true; clearTimeout(to); resolve({ ok: false, error: 'OpenVPN arrêté prématurément' }); }
      else if (wantConnected && !reconnecting) { emit('vpn:state', { state: 'reconnecting' }); reconnect(was, ctx); } else emit('vpn:state', { state: ks ? 'blocked' : 'disconnected', killSwitch: ks }); });
  });
}
// Essaie plusieurs serveurs d'affilée (le choisi, puis des repli classés) : robustesse face à un serveur bénévole hors service
async function connect(ipSel, withKs, ctx = { progress() {} }) {
  wantConnected = true; await stopProc();
  let list = lastList.length ? lastList : await servers(); let chosen = list.find(x => x.ip === ipSel);
  const fallbacks = list.filter(x => x.ip !== ipSel).slice(0, 4); const tryList = chosen ? [chosen, ...fallbacks] : (list.length ? list.slice(0, 5) : []);
  if (!tryList.length) return { ok: false, error: 'Aucun serveur VPNGate disponible' };
  for (let i = 0; i < tryList.length; i++) { ctx.progress((i / tryList.length) * 90, `Connexion à ${tryList[i].country} (${tryList[i].ip})…`);
    const r = await spawnOvpn(tryList[i], withKs, ctx); if (r.ok) { ctx.progress(100, 'Connecté'); return { ok: true, server: tryList[i] }; } log('vpn', `${tryList[i].ip} échoué : ${r.error}`); }
  wantConnected = false; return { ok: false, error: 'Tous les serveurs essayés ont échoué' };
}
async function reconnect(prevServer, ctx = { progress() {} }) {
  if (reconnecting || !wantConnected) return; reconnecting = true;
  try { for (let attempt = 0; attempt < 3 && wantConnected; attempt++) { await sleep(2000 * (attempt + 1));
      const list = await servers([prevServer && prevServer.ip].filter(Boolean)).catch(() => lastList); if (!list.length) continue;
      const r = await spawnOvpn(list[0], ks, ctx); if (r.ok) break; } }
  finally { reconnecting = false; }
}
async function stopProc() { if (proc) { proc.removeAllListeners('exit'); try { proc.kill(); } catch {} proc = null; } cur = null; health = null; }
async function disconnect(clean = true) { wantConnected = false; await stopProc(); if (clean) await killSwitch(false); emit('vpn:state', { state: 'disconnected' }); return { ok: true }; }
const restoreNetwork = () => killSwitch(false).then(() => { wantConnected = false; emit('vpn:state', { state: 'disconnected' }); return { ok: true }; });
function status() { return { connected: !!cur, server: cur ? cur.ip : null, country: cur ? cur.country : null, killSwitch: ks, reconnecting }; }
module.exports = { list, connect, disconnect, restoreNetwork, installed, install, status, init: (e) => { emit = e; killSwitch(false); },
  _complement: complement, _cidr: cidr, _rankServers: rankServers, _parseGateLine: parseGateLine, _sanitizeConfig: sanitizeConfig, _parseOvpnLog: parseOvpnLog, _killSwitchRanges: killSwitchRanges };
