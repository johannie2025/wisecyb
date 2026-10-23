const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, ps } = require('./util');
const dirs = () => [os.tmpdir(), 'C:\\Windows\\Temp', path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Windows\\INetCache'), 'C:\\Windows\\Prefetch', 'C:\\Windows\\SoftwareDistribution\\Download'];
function sizeOf(d) { let t = 0; (function w(x) { try { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const p = path.join(x, e.name); try { e.isDirectory() ? w(p) : (t += fs.statSync(p).size); } catch {} } } catch {} })(d); return t; }
const analyze = () => { const items = dirs().map(d => ({ dir: d, bytes: sizeOf(d) })); return { items, total: items.reduce((a, b) => a + b.bytes, 0) }; };
async function clean() {
  let freed = 0;
  for (const d of dirs()) { try { for (const e of fs.readdirSync(d)) { const p = path.join(d, e); try { const s = sizeOf(p) || (fs.statSync(p).isFile() ? fs.statSync(p).size : 0); fs.rmSync(p, { recursive: true, force: true }); freed += s; } catch {} } } catch {} }
  await ps('Clear-RecycleBin -Force -ErrorAction SilentlyContinue'); return { freed };
}
const RUNKEYS = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'];
async function startupList() {
  const out = [];
  for (const k of RUNKEYS) { const r = await run('reg', ['query', k]); r.out.split('\n').forEach(l => { const m = l.trim().match(/^(.+?)\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)$/); if (m) out.push({ key: k, name: m[1], cmd: m[2] }); }); }
  return out;
}
async function startupDisable({ key, name }) { if (!RUNKEYS.includes(key) || !/^[\w .\-()]{1,80}$/.test(name)) return { ok: false }; return run('reg', ['delete', key, '/v', name, '/f']); }
async function disks() {
  const r = await ps('Get-PhysicalDisk | Select FriendlyName,MediaType,HealthStatus,OperationalStatus,Size | ConvertTo-Json'); try { const j = JSON.parse(r.out); return Array.isArray(j) ? j : [j]; } catch { return []; }
}
async function softwareUpdates() { const r = await run('winget', ['upgrade', '--accept-source-agreements']); return r.out; }
async function softwareUpgradeAll() { return run('winget', ['upgrade', '--all', '--silent', '--accept-source-agreements', '--accept-package-agreements'], { timeout: 1800000 }); }
module.exports = { analyze, clean, startupList, startupDisable, disks, softwareUpdates, softwareUpgradeAll };
