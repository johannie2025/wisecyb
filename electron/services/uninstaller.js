const { spawn } = require('child_process');
const { run, ps, psJson } = require('./util');
const backup = require('./backup');
const fs = require('fs');

const LIST = `
$o=New-Object System.Collections.ArrayList
foreach($r in 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'){
  Get-ChildItem $r | ForEach-Object { $p=Get-ItemProperty -LiteralPath $_.PSPath; if($p.DisplayName -and -not ($p.SystemComponent -eq 1) -and -not $p.ParentKeyName -and ($p.UninstallString -or $p.QuietUninstallString)){
    [void]$o.Add(@{id=$_.Name;kind='reg';name=[string]$p.DisplayName;publisher=[string]$p.Publisher;version=[string]$p.DisplayVersion;date=[string]$p.InstallDate;sizeKB=[int64]($p.EstimatedSize);loc=[string]$p.InstallLocation;quiet=[bool]$p.QuietUninstallString}) } } }
Get-AppxPackage | Where-Object { $_.NonRemovable -eq $false -and $_.IsFramework -eq $false -and $_.SignatureKind -eq 'Store' } | ForEach-Object { [void]$o.Add(@{id='appx|'+$_.PackageFullName;kind='appx';name=[string]$_.Name;publisher=([string]$_.Publisher -replace '^CN=([^,]+).*','$1');version=[string]$_.Version;date='';sizeKB=0;loc=[string]$_.InstallLocation;quiet=$true}) }
$o | ConvertTo-Json -Compress -Depth 3`;
async function list() {
  const rows = await psJson(LIST, { timeout: 120000 }); const seen = new Set();
  return rows.filter(r => { const k = (r.name + '|' + r.version).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(r => ({ ...r, date: /^\d{8}$/.test(r.date) ? `${r.date.slice(6, 8)}/${r.date.slice(4, 6)}/${r.date.slice(0, 4)}` : r.date })).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}
const okRegId = (id) => /^HKEY_(LOCAL_MACHINE|CURRENT_USER)\\.*\\Uninstall\\[^\\]+$/i.test(id);
const okAppx = (id) => /^appx\|[\w.\-~]+$/.test(id);
const fixMsi = (s) => String(s).replace(/(msiexec(?:\.exe)?\s+)\/I(\s*\{)/i, '$1/X$2'); // « Modifier » → « Désinstaller »
const withQuiet = (s) => (/msiexec/i.test(s) && !/\/q/i.test(s)) ? s + ' /qn /norestart' : s;
async function commandFor(id, silent) {
  const r = await psJson("$k=$env:WISE_ARG|ConvertFrom-Json; $p=Get-ItemProperty -LiteralPath ('Registry::'+$k); [pscustomobject]@{u=[string]$p.UninstallString;q=[string]$p.QuietUninstallString} | ConvertTo-Json -Compress", { arg: id });
  const x = r[0]; if (!x) return null; let c = silent && x.q ? x.q : x.u; if (!c) c = x.q; if (!c) return null; c = fixMsi(c); if (silent && !x.q) c = withQuiet(c); return c;
}
function execCmd(cmd) { return new Promise(res => { const p = spawn('cmd.exe', ['/d', '/s', '/c', `"${cmd}"`], { windowsVerbatimArguments: true, windowsHide: false, stdio: 'ignore' }); p.on('exit', code => res({ code })); p.on('error', e => res({ code: -1, error: e.message })); }); }
async function uninstallOne(id, silent) {
  if (okAppx(id)) { const r = await ps("Remove-AppxPackage -Package ($env:WISE_ARG|ConvertFrom-Json) -ErrorAction Stop", { arg: id.slice(5), timeout: 300000 }); return { ok: r.ok && !r.err, error: r.err.slice(0, 160) }; }
  if (!okRegId(id)) return { ok: false, error: 'Identifiant invalide' }; const c = await commandFor(id, silent); if (!c) return { ok: false, error: 'Aucune commande de désinstallation' };
  const r = await execCmd(c); return { ok: r.code === 0 || r.code === 3010, code: r.code, error: r.error };
}
async function uninstallMany(ids, silent, ctx) {
  const out = []; for (let i = 0; i < ids.length; i++) { if (ctx.isCancelled()) break; ctx.progress((i / ids.length) * 100, `Désinstallation ${i + 1}/${ids.length}…`, { id: ids[i] }); out.push({ id: ids[i], ...(await uninstallOne(ids[i], silent)) }); }
  ctx.progress(100, 'Terminé'); return out;
}
async function removeEntry(id) { if (!okRegId(id)) return { ok: false }; const set = backup.begin('Entrée de désinstallation'); await backup.exportKey(set, id); const r = await run('reg', ['delete', id, '/f']); backup.commit(set); return { ok: r.ok }; }
module.exports = { list, uninstallMany, uninstallOne, removeEntry, fixMsi, withQuiet, okRegId, okAppx };
