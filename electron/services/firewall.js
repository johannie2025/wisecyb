const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const cfg = require('../config');
const { run, ps, psJson, readJson, writeJson, log } = require('./util');
const PREFIX = 'WiseCyb_', TALOS_GROUP = 'WiseCyb Talos';
const TALOS_TXT = path.join(cfg.SIGS, 'talos_ips.txt'), TALOS_INFO = path.join(cfg.STATE, 'talos.json');
const safe = (s) => /^[\w\-. ]{1,60}$/.test(s);
const ipv4 = (s) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s);
const cidrOrIp = (s) => { const m = String(s).match(/^([\d.]+)(?:\/(\d{1,2}))?$/); return !!m && ipv4(m[1]) && (m[2] === undefined || +m[2] <= 32); };
const isPublic = (ip) => ipv4(ip) && !isReserved(ip);
// Adresses qu'on ne bloque JAMAIS (réseau local, loopback, multicast, CGNAT, 0.0.0.0/8…) : évite de se couper du réseau
function isReserved(ip) { const [a, b] = ip.split('.').map(Number); return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0); }
function cleanIps(list, protect = []) { const seen = new Set(), out = []; const prot = new Set(protect);
  for (let x of list) { x = String(x).trim(); if (!cidrOrIp(x) || seen.has(x)) continue; const base = x.split('/')[0]; if (isReserved(base) || prot.has(base)) continue; seen.add(x); out.push(x); } return out; }
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function status() { return psJson('Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction | ConvertTo-Json -Compress'); }
const setEnabled = (on) => run('netsh', ['advfirewall', 'set', 'allprofiles', 'state', on ? 'on' : 'off']);
async function listRules() {
  return psJson(`Get-NetFirewallRule -DisplayName 'WiseCyb_*' | Where-Object { $_.Group -ne '${TALOS_GROUP}' } | ForEach-Object { $a=$_ | Get-NetFirewallApplicationFilter; $p=$_ | Get-NetFirewallPortFilter; $r=$_ | Get-NetFirewallAddressFilter; [pscustomobject]@{Name=$_.DisplayName;Direction=[string]$_.Direction;Action=[string]$_.Action;Enabled=[string]$_.Enabled;Program=[string]$a.Program;Port=[string]$p.LocalPort;Remote=[string]$r.RemoteAddress} } | ConvertTo-Json -Compress`);
}
async function blockApp({ name, program, direction = 'out' }) {
  if (!safe(name) || !/^[A-Za-z]:\\[^"<>|*?]+\.exe$/i.test(program)) return { ok: false, error: 'INVALID' };
  const dirs = direction === 'both' ? ['in', 'out'] : [direction === 'in' ? 'in' : 'out']; const res = [];
  for (const d of dirs) res.push(await run('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${PREFIX}${name}_${d}`, `dir=${d}`, 'action=block', `program=${program}`, 'enable=yes']));
  return { ok: res.every(r => r.ok) };
}
async function removeRule(name) { if (!name.startsWith(PREFIX) || !safe(name)) return { ok: false }; return run('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${name}`]); }
async function toggleRule(name, on) { if (!name.startsWith(PREFIX) || !safe(name)) return { ok: false }; return run('netsh', ['advfirewall', 'firewall', 'set', 'rule', `name=${name}`, 'new', `enable=${on ? 'yes' : 'no'}`]); }
async function blockIp(ip) {
  ip = String(ip).trim(); if (!cidrOrIp(ip) || isReserved(ip.split('/')[0])) return { ok: false, error: 'IP privée/invalide : refusée' };
  const n = ip.replace(/[^\w]/g, '_'); const a = await run('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${PREFIX}BlockIP_${n}_in`, 'dir=in', 'action=block', `remoteip=${ip}`]);
  const b = await run('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${PREFIX}BlockIP_${n}_out`, 'dir=out', 'action=block', `remoteip=${ip}`]); return { ok: a.ok && b.ok };
}
async function blockPort(port, proto = 'TCP') {
  port = +port; proto = String(proto).toUpperCase(); if (!Number.isInteger(port) || port < 1 || port > 65535 || !['TCP', 'UDP'].includes(proto)) return { ok: false, error: 'INVALID' };
  const r = await run('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${PREFIX}BlockPort_${proto}_${port}`, 'dir=in', 'action=block', `protocol=${proto}`, `localport=${port}`]); return { ok: r.ok };
}

// ───── liste d'IP malveillantes (Cisco Talos) ─────
async function applyIpBlocklist(ips, ctx = { progress() {} }, protect = []) {
  const list = cleanIps(ips, protect); if (!list.length) return { ok: false, applied: 0, error: 'liste vide ou invalide' };
  ctx.progress(5, `Préparation de ${list.length} adresses…`); await removeIpBlocklist(true); const chunks = chunk(list, 400); let done = 0;
  for (let i = 0; i < chunks.length; i++) {
    const f = path.join(cfg.TMP, `talos_${i}.json`); fs.writeFileSync(f, JSON.stringify(chunks[i]));
    const r = await ps(`$a=$env:WISE_ARG|ConvertFrom-Json; $ips=@(Get-Content -Raw -LiteralPath $a.f|ConvertFrom-Json); foreach($d in 'Inbound','Outbound'){ New-NetFirewallRule -DisplayName ("WiseCyb_Talos_"+$a.n+"_"+$d) -Group '${TALOS_GROUP}' -Direction $d -Action Block -RemoteAddress $ips -Profile Any -ErrorAction Stop | Out-Null }`, { arg: { f, n: i + 1 }, timeout: 180000 });
    try { fs.unlinkSync(f); } catch {} if (!r.ok && r.err) { log('firewall', 'Talos chunk ' + i + ' : ' + r.err.slice(0, 200)); return { ok: false, applied: done, error: r.err.slice(0, 200) }; }
    done += chunks[i].length; ctx.progress(5 + ((i + 1) / chunks.length) * 90, `Règles pare-feu : ${done} / ${list.length} adresses`);
  }
  fs.writeFileSync(TALOS_TXT, list.join('\n')); const info = { count: done, appliedAt: new Date().toISOString(), version: (readJson(TALOS_INFO, {}).version || null) }; writeJson(TALOS_INFO, { ...readJson(TALOS_INFO, {}), ...info, applied: true });
  return { ok: true, applied: done };
}
async function removeIpBlocklist(quiet) { const r = await ps(`Remove-NetFirewallRule -Group '${TALOS_GROUP}' -ErrorAction SilentlyContinue`, { timeout: 180000 }); if (!quiet) { const i = readJson(TALOS_INFO, {}); writeJson(TALOS_INFO, { ...i, applied: false }); } return { ok: true }; }
const ipBlocklistInfo = () => ({ ...readJson(TALOS_INFO, { count: 0, applied: false, version: null, appliedAt: null }) });
const loadTalos = () => { try { return new Set(fs.readFileSync(TALOS_TXT, 'utf8').split('\n').filter(l => l && !l.includes('/'))); } catch { return new Set(); } };
async function protectedIps() { const out = []; try { out.push(...(await dns.resolve4(new URL(cfg.API).hostname))); } catch {} return out; }

// ───── ports en écoute / connexions actives ─────
const RISKY = { 21: 'FTP', 23: 'Telnet', 135: 'RPC', 139: 'NetBIOS', 445: 'SMB (partage de fichiers)', 3389: 'Bureau à distance (RDP)', 5900: 'VNC', 5985: 'WinRM', 1433: 'SQL Server', 3306: 'MySQL', 5432: 'PostgreSQL', 27017: 'MongoDB', 6379: 'Redis' };
async function listeningPorts() {
  const rows = await psJson(`$p=@{}; Get-Process | ForEach-Object { $p[[int]$_.Id]=$_ }; Get-NetTCPConnection -State Listen | ForEach-Object { $pr=$p[[int]$_.OwningProcess]; [pscustomobject]@{port=[int]$_.LocalPort;addr=[string]$_.LocalAddress;pid=[int]$_.OwningProcess;name=[string]$pr.ProcessName;path=[string]$pr.Path} } | ConvertTo-Json -Compress`);
  const seen = new Set(); return rows.filter(r => { const k = r.port + '|' + r.pid; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(r => ({ ...r, exposed: r.addr === '0.0.0.0' || r.addr === '::', risky: RISKY[r.port] || null })).sort((a, b) => (b.exposed - a.exposed) || (!!b.risky - !!a.risky) || a.port - b.port);
}
async function connections() {
  const talos = loadTalos();
  const rows = await psJson(`$p=@{}; Get-Process | ForEach-Object { $p[[int]$_.Id]=$_ }; Get-NetTCPConnection -State Established | Where-Object { $_.RemoteAddress -notmatch '^(127\\.|::1|0\\.0\\.0\\.0)' } | ForEach-Object { $pr=$p[[int]$_.OwningProcess]; [pscustomobject]@{pid=[int]$_.OwningProcess;name=[string]$pr.ProcessName;path=[string]$pr.Path;local=[int]$_.LocalPort;remote=[string]$_.RemoteAddress;rport=[int]$_.RemotePort} } | ConvertTo-Json -Compress`);
  return rows.map(r => ({ ...r, priv: ipv4(r.remote) ? isReserved(r.remote) : /^(fe80|fc|fd)/i.test(r.remote), bad: talos.has(r.remote) })).sort((a, b) => (b.bad - a.bad) || (a.priv - b.priv) || a.name.localeCompare(b.name));
}

// IDS : brute-force RDP (événement 4625), scan de ports (SYN_RECEIVED), ARP spoofing
async function ids() {
  const alerts = [];
  const rdp = await psJson(`$e=Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625;StartTime=(Get-Date).AddMinutes(-10)} | Where-Object {$_.Properties[10].Value -in 3,10}; $e | Group-Object {$_.Properties[19].Value} | Where-Object Count -ge 5 | Select-Object Name,Count | ConvertTo-Json -Compress`);
  for (const x of rdp) { alerts.push({ type: 'RDP_BRUTEFORCE', source: x.Name, count: x.Count }); if (isPublic(x.Name)) blockIp(x.Name); }
  const ns = await run('netstat', ['-n', '-p', 'tcp']); const syn = {};
  ns.out.split('\n').filter(l => l.includes('SYN_RECEIVED')).forEach(l => { const ip = (l.trim().split(/\s+/)[2] || '').split(':')[0]; syn[ip] = (syn[ip] || 0) + 1; });
  Object.entries(syn).filter(([, c]) => c >= 15).forEach(([ip, c]) => { alerts.push({ type: 'PORT_SCAN', source: ip, count: c }); if (isPublic(ip)) blockIp(ip); });
  const arp = await run('arp', ['-a']); const macs = {};
  arp.out.split('\n').forEach(l => { const m = l.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]{17})\s+\S+/i); if (m && !/^(22[4-9]|23\d|255)\./.test(m[1]) && !/^ff-ff/i.test(m[2]) && !/^01-00-5e/i.test(m[2])) (macs[m[2]] = macs[m[2]] || []).push(m[1]); });
  Object.entries(macs).filter(([, ips]) => ips.length > 2).forEach(([mac, ips]) => alerts.push({ type: 'ARP_SPOOFING', source: mac, count: ips.length }));
  return alerts;
}
module.exports = { status, setEnabled, listRules, blockApp, removeRule, toggleRule, blockIp, blockPort, ids, applyIpBlocklist, removeIpBlocklist, ipBlocklistInfo, listeningPorts, connections, protectedIps, cleanIps, isReserved, chunk, cidrOrIp };
