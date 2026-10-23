// VPN via OpenVPN + serveurs bénévoles VPNGate (même source que WiseVPN Gate). Kill switch = règle pare-feu sur les cartes physiques.
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('../config');
const { ps, run } = require('./util');
const OVPN = ['C:\\Program Files\\OpenVPN\\bin\\openvpn.exe', 'C:\\Program Files (x86)\\OpenVPN\\bin\\openvpn.exe'];
const toInt = ip => ip.split('.').reduce((a, o) => a * 256 + (+o), 0); const toIp = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
const cidr = (ip, bits) => { const s = toInt(ip); return [s, s + 2 ** (32 - bits) - 1]; };
function complement(excl) { excl = [...excl].sort((a, b) => a[0] - b[0]); const out = []; let cur = 0; for (const [s, e] of excl) { if (s > cur) out.push([cur, s - 1]); cur = Math.max(cur, e + 1); } if (cur <= 0xFFFFFFFF) out.push([cur, 0xFFFFFFFF]); return out.map(([a, b]) => toIp(a) + '-' + toIp(b)); }
let proc = null, emit = () => {}, server = null, ks = false;
const exe = () => OVPN.find(p => fs.existsSync(p)) || null;
const installed = () => !!exe();
async function install() { return run('winget', ['install', '-e', '--id', 'OpenVPNTechnologies.OpenVPN', '--silent', '--accept-source-agreements', '--accept-package-agreements'], { timeout: 900000 }); }
async function servers() {
  const { data } = await axios.get('https://www.vpngate.net/api/iphone/', { timeout: 25000, responseType: 'text' }); const out = [];
  for (const l of String(data).split('\n')) { if (!l || l[0] === '*' || l[0] === '#') continue; const c = l.split(','); if (c.length < 15 || !/^\d+\.\d+\.\d+\.\d+$/.test(c[1])) continue; out.push({ host: c[0], ip: c[1], score: +c[2], ping: +c[3], speed: +c[4], country: c[5], cc: c[6], config: c[14] }); }
  return out.sort((a, b) => b.score - a.score).slice(0, 40).map(({ config, ...s }) => ({ ...s, _c: config }));
}
let cacheList = [];
async function list() { cacheList = await servers(); return cacheList.map(({ _c, ...s }) => s); }
async function killSwitch(on, ip) {
  if (!on) { await ps("Remove-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch' -ErrorAction SilentlyContinue"); ks = false; return; }
  const ex = [cidr('10.0.0.0', 8), cidr('127.0.0.0', 8), cidr('169.254.0.0', 16), cidr('172.16.0.0', 12), cidr('192.168.0.0', 16), cidr('224.0.0.0', 4), [toInt(ip), toInt(ip)], [0xFFFFFFFF, 0xFFFFFFFF]];
  const ranges = complement(ex).filter(r => /^[\d.]+-[\d.]+$/.test(r));
  await ps(`$a=@(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty Name); if($a.Count){ New-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch' -Direction Outbound -Action Block -InterfaceAlias $a -RemoteAddress @('${ranges.join("','")}') | Out-Null }`); ks = true;
}
async function connect(ipSel, withKs) {
  const p = exe(); if (!p) return { ok: false, error: 'NO_OPENVPN' }; const s = cacheList.find(x => x.ip === ipSel); if (!s) return { ok: false, error: 'UNKNOWN_SERVER' };
  await disconnect(false); const dir = path.join(cfg.BASE, 'vpn'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, 'current.ovpn');
  fs.writeFileSync(f, Buffer.from(s._c, 'base64').toString('utf8').replace(/^\s*(script-security|up|down|plugin|route-up|tls-verify|ipchange|learn-address|client-connect|client-disconnect)\b.*$/gim, '')); // retire toute directive exécutant des scripts
  server = s.ip; emit('vpn:state', { state: 'connecting', server: s.ip, country: s.country });
  proc = spawn(p, ['--config', f, '--connect-retry-max', '3', '--script-security', '0'], { windowsHide: true });
  proc.stdout.on('data', async d => { if (String(d).includes('Initialization Sequence Completed')) { if (withKs) await killSwitch(true, s.ip); emit('vpn:state', { state: 'connected', server: s.ip, country: s.country, killSwitch: ks }); } });
  proc.on('exit', () => { proc = null; emit('vpn:state', { state: ks ? 'blocked' : 'disconnected', killSwitch: ks }); });
  return { ok: true };
}
async function disconnect(clean = true) { if (proc) { proc.removeAllListeners('exit'); proc.kill(); proc = null; } if (clean) await killSwitch(false); emit('vpn:state', { state: 'disconnected' }); return { ok: true }; }
const restoreNetwork = () => killSwitch(false).then(() => { emit('vpn:state', { state: 'disconnected' }); return { ok: true }; });
module.exports = { list, connect, disconnect, restoreNetwork, installed, install, init: (e) => { emit = e; killSwitch(false); }, _complement: complement, _cidr: cidr };
