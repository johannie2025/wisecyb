const { run, ps } = require('./util');
const PREFIX = 'WiseCyb_';
const safe = (s) => /^[\w\-. ]{1,60}$/.test(s);
const safeIp = (s) => /^[0-9a-fA-F:.,\/ -]{1,200}$/.test(s) || s === 'Any';
const isPublic = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !/^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
async function status() {
  const r = await ps('Get-NetFirewallProfile | Select Name,Enabled,DefaultInboundAction,DefaultOutboundAction | ConvertTo-Json');
  try { const j = JSON.parse(r.out); return Array.isArray(j) ? j : [j]; } catch { return []; }
}
async function setEnabled(on) { return run('netsh', ['advfirewall', 'set', 'allprofiles', 'state', on ? 'on' : 'off']); }
async function listRules() {
  const r = await ps(`Get-NetFirewallRule -DisplayName '${PREFIX}*' | ForEach-Object { $a=$_ | Get-NetFirewallApplicationFilter; [pscustomobject]@{Name=$_.DisplayName;Direction=[string]$_.Direction;Action=[string]$_.Action;Enabled=[string]$_.Enabled;Program=$a.Program} } | ConvertTo-Json`);
  try { const j = JSON.parse(r.out); return Array.isArray(j) ? j : j ? [j] : []; } catch { return []; }
}
async function blockApp({ name, program, direction = 'out' }) {
  if (!safe(name) || !/^[A-Za-z]:\\[^"<>|*?]+\.exe$/i.test(program)) return { ok: false, error: 'INVALID' };
  const dirs = direction === 'both' ? ['in', 'out'] : [direction === 'in' ? 'in' : 'out']; const res = [];
  for (const d of dirs) res.push(await run('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${PREFIX}${name}_${d}`, `dir=${d}`, 'action=block', `program=${program}`, 'enable=yes']));
  return { ok: res.every(r => r.ok) };
}
async function removeRule(name) { if (!name.startsWith(PREFIX) || !safe(name)) return { ok: false }; return run('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${name}`]); }
async function toggleRule(name, on) { if (!name.startsWith(PREFIX) || !safe(name)) return { ok: false }; return run('netsh', ['advfirewall', 'firewall', 'set', 'rule', `name=${name}`, 'new', `enable=${on ? 'yes' : 'no'}`]); }
async function blockIp(ip) { if (!safeIp(ip)) return { ok: false }; return run('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${PREFIX}BlockIP_${ip.replace(/[^\w]/g, '_')}`, 'dir=in', 'action=block', `remoteip=${ip}`]); }

// IDS : brute-force RDP (event 4625), scan de ports (nombre de connexions SYN_RECEIVED), ARP spoofing (doublons MAC)
async function ids() {
  const alerts = [];
  const rdp = await ps(`$e=Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625;StartTime=(Get-Date).AddMinutes(-10)} -ErrorAction SilentlyContinue | Where-Object {$_.Properties[10].Value -in 3,10}; ($e | Group-Object {$_.Properties[19].Value} | Where-Object Count -ge 5 | Select Name,Count | ConvertTo-Json)`);
  try { const j = JSON.parse(rdp.out || 'null'); (Array.isArray(j) ? j : j ? [j] : []).forEach(x => { alerts.push({ type: 'RDP_BRUTEFORCE', source: x.Name, count: x.Count }); if (isPublic(x.Name)) blockIp(x.Name); }); } catch {}
  const ns = await run('netstat', ['-n', '-p', 'tcp']); const syn = {};
  ns.out.split('\n').filter(l => l.includes('SYN_RECEIVED')).forEach(l => { const ip = (l.trim().split(/\s+/)[2] || '').split(':')[0]; syn[ip] = (syn[ip] || 0) + 1; });
  Object.entries(syn).filter(([, c]) => c >= 15).forEach(([ip, c]) => { alerts.push({ type: 'PORT_SCAN', source: ip, count: c }); if (isPublic(ip)) blockIp(ip); });
  const arp = await run('arp', ['-a']); const macs = {};
  arp.out.split('\n').forEach(l => { const m = l.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]{17})\s+dynamic/i); if (m) (macs[m[2]] = macs[m[2]] || []).push(m[1]); });
  Object.entries(macs).filter(([, ips]) => ips.length > 2).forEach(([mac, ips]) => alerts.push({ type: 'ARP_SPOOFING', source: mac, count: ips.length }));
  return alerts;
}
module.exports = { status, setEnabled, listRules, blockApp, removeRule, toggleRule, blockIp, ids };
