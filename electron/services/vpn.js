// Service VPN OpenVPN pour WiseCybersecurity Suite
// Supporte l'importation de fichiers de configuration .ovpn personnalisés (ExpressVPN, NordVPN, CyberGhost, ProtonVPN, OpenVPN perso) + VPNGate gratuit.
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('../config');
const { ps, run, log } = require('./util');

const OVPN_PATHS = [
  'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe',
  'C:\\Program Files (x86)\\OpenVPN\\bin\\openvpn.exe',
  'C:\\Program Files\\Community OpenVPN\\bin\\openvpn.exe'
];

const toInt = ip => ip.split('.').reduce((a, o) => a * 256 + (+o), 0);
const toIp = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
const cidr = (ip, bits) => { const s = toInt(ip); return [s, s + 2 ** (32 - bits) - 1]; };

function complement(excl) {
  excl = [...excl].sort((a, b) => a[0] - b[0]);
  const out = []; let cur = 0;
  for (const [s, e] of excl) {
    if (s > cur) out.push([cur, s - 1]);
    cur = Math.max(cur, e + 1);
  }
  if (cur <= 0xFFFFFFFF) out.push([cur, 0xFFFFFFFF]);
  return out.map(([a, b]) => toIp(a) + '-' + toIp(b));
}

let proc = null, emit = () => {}, serverIp = null, ks = false;
const exe = () => OVPN_PATHS.find(p => fs.existsSync(p)) || null;
const installed = () => !!exe();

async function install() {
  log('vpn', 'Installation d OpenVPN via winget...');
  return run('winget', ['install', '-e', '--id', 'OpenVPNTechnologies.OpenVPN', '--silent', '--accept-source-agreements', '--accept-package-agreements'], { timeout: 900000 });
}

async function killSwitch(on, ip) {
  if (!on) {
    await ps("Remove-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch' -ErrorAction SilentlyContinue");
    ks = false;
    return;
  }
  const targetIp = ip || '0.0.0.0';
  const ex = [cidr('10.0.0.0', 8), cidr('127.0.0.0', 8), cidr('169.254.0.0', 16), cidr('172.16.0.0', 12), cidr('192.168.0.0', 16), cidr('224.0.0.0', 4), [toInt(targetIp), toInt(targetIp)], [0xFFFFFFFF, 0xFFFFFFFF]];
  const ranges = complement(ex).filter(r => /^[\d.]+-[\d.]+$/.test(r));
  await ps(`$a=@(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty Name); if($a.Count){ New-NetFirewallRule -DisplayName 'WiseCyb_KillSwitch' -Direction Outbound -Action Block -InterfaceAlias $a -RemoteAddress @('${ranges.join("','")}') | Out-Null }`);
  ks = true;
}

// Serveurs VPNGate gratuits
async function fetchVpnGateServers() {
  try {
    const { data } = await axios.get('https://www.vpngate.net/api/iphone/', { timeout: 20000, responseType: 'text' });
    const out = [];
    for (const l of String(data).split('\n')) {
      if (!l || l[0] === '*' || l[0] === '#') continue;
      const c = l.split(',');
      if (c.length < 15 || !/^\d+\.\d+\.\d+\.\d+$/.test(c[1])) continue;
      out.push({ id: 'vpngate_' + c[1], host: c[0], ip: c[1], score: +c[2], ping: +c[3], speed: +c[4], country: c[5], cc: c[6], config: c[14], source: 'VPNGate' });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 50);
  } catch (e) {
    log('vpn_error', 'Erreur récupération VPNGate: ' + e.message);
    return [];
  }
}

let cacheList = [];

async function list() {
  const vpngate = await fetchVpnGateServers();
  const customDir = path.join(cfg.BASE, 'vpn_configs');
  const custom = [];
  if (fs.existsSync(customDir)) {
    for (const file of fs.readdirSync(customDir)) {
      if (file.endsWith('.ovpn')) {
        custom.push({ id: 'custom_' + file, host: file.replace('.ovpn', ''), ip: 'Custom', country: 'Fichier Local (.ovpn)', speed: 100000000, ping: 5, source: 'Custom', file: path.join(customDir, file) });
      }
    }
  }
  cacheList = [...custom, ...vpngate];
  return cacheList.map(({ config, ...s }) => s);
}

async function importConfig(filePath) {
  if (!fs.existsSync(filePath) || !filePath.endsWith('.ovpn')) return { ok: false, error: 'INVALID_FILE' };
  const customDir = path.join(cfg.BASE, 'vpn_configs');
  fs.mkdirSync(customDir, { recursive: true });
  const fileName = path.basename(filePath);
  const dest = path.join(customDir, fileName);
  fs.copyFileSync(filePath, dest);
  log('vpn', 'Fichier .ovpn importé : ' + fileName);
  return { ok: true, name: fileName };
}

async function connect(targetId, withKs = true, authUser = '', authPass = '') {
  const openvpnBin = exe();
  if (!openvpnBin) return { ok: false, error: 'NO_OPENVPN_BINARY' };

  let targetServer = cacheList.find(x => x.id === targetId || x.ip === targetId);
  if (!targetServer && cacheList.length > 0) targetServer = cacheList[0];
  if (!targetServer) return { ok: false, error: 'NO_SERVER_SELECTED' };

  await disconnect(false);

  const dir = path.join(cfg.BASE, 'vpn');
  fs.mkdirSync(dir, { recursive: true });
  const ovpnConfigPath = path.join(dir, 'active_session.ovpn');

  if (targetServer.source === 'Custom' && targetServer.file) {
    let content = fs.readFileSync(targetServer.file, 'utf8');
    content = content.replace(/^\s*(script-security|up|down|plugin|route-up|tls-verify|ipchange|learn-address|client-connect|client-disconnect)\b.*$/gim, '');
    fs.writeFileSync(ovpnConfigPath, content);
  } else if (targetServer.config) {
    let content = Buffer.from(targetServer.config, 'base64').toString('utf8');
    content = content.replace(/^\s*(script-security|up|down|plugin|route-up|tls-verify|ipchange|learn-address|client-connect|client-disconnect)\b.*$/gim, '');
    fs.writeFileSync(ovpnConfigPath, content);
  } else {
    return { ok: false, error: 'INVALID_CONFIG' };
  }

  const args = ['--config', ovpnConfigPath, '--connect-retry-max', '3', '--script-security', '1'];

  if (authUser && authPass) {
    const authFile = path.join(dir, 'auth.txt');
    fs.writeFileSync(authFile, `${authUser}\n${authPass}\n`);
    args.push('--auth-user-pass', authFile);
  }

  serverIp = targetServer.ip;
  emit('vpn:state', { state: 'connecting', server: targetServer.host || targetServer.ip, country: targetServer.country });

  proc = spawn(openvpnBin, args, { windowsHide: true });

  proc.stdout.on('data', async d => {
    const str = String(d);
    if (str.includes('Initialization Sequence Completed')) {
      if (withKs && serverIp !== 'Custom') await killSwitch(true, serverIp);
      emit('vpn:state', { state: 'connected', server: targetServer.host || targetServer.ip, country: targetServer.country, killSwitch: ks });
      log('vpn', 'VPN Connecté avec succès à ' + targetServer.country);
    }
  });

  proc.stderr.on('data', d => {
    log('vpn_error', 'OpenVPN log: ' + String(d));
  });

  proc.on('exit', (code) => {
    proc = null;
    emit('vpn:state', { state: ks ? 'blocked' : 'disconnected', killSwitch: ks, exitCode: code });
    log('vpn', 'OpenVPN terminé avec le code ' + code);
  });

  return { ok: true };
}

async function disconnect(clean = true) {
  if (proc) {
    proc.removeAllListeners('exit');
    proc.kill('SIGTERM');
    proc = null;
  }
  if (clean) await killSwitch(false);
  emit('vpn:state', { state: 'disconnected' });
  log('vpn', 'VPN Déconnecté');
  return { ok: true };
}

const restoreNetwork = () => killSwitch(false).then(() => {
  emit('vpn:state', { state: 'disconnected' });
  return { ok: true };
});

module.exports = {
  list,
  connect,
  disconnect,
  restoreNetwork,
  installed,
  install,
  importConfig,
  init: (e) => { emit = e; killSwitch(false); },
  _complement: complement,
  _cidr: cidr
};
