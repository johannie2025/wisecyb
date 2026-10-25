// Gestionnaire de démarrage : clés Run, dossiers Démarrage, tâches planifiées (ouverture de session/démarrage), services automatiques tiers.
// Activer/désactiver utilise le mécanisme natif de Windows (StartupApproved) : réversible et identique au Gestionnaire des tâches.
const path = require('path');
const { run, ps, psJson } = require('./util');
const backup = require('./backup');
const registry = require('./registry');

const APPR = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved';
const GATHER = `
function En($ap,$n){ try{ $b=(Get-ItemProperty -LiteralPath $ap -ErrorAction Stop).$n; if($b -is [byte[]] -and ($b[0] -band 1) -eq 1){return $false} }catch{}; return $true }
$o=New-Object System.Collections.ArrayList
$runs=@(@{k='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run';ap='HKCU:\\${APPR}\\Run';s='user'},@{k='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run';ap='HKLM:\\${APPR}\\Run';s='machine'},@{k='HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run';ap='HKLM:\\${APPR}\\Run32';s='machine32'})
foreach($r in $runs){ $k=Get-Item -LiteralPath $r.k; if($k){ $k.GetValueNames() | ForEach-Object { [void]$o.Add(@{t='run';s=$r.s;key=$k.Name;name=$_;cmd=[string]$k.GetValue($_);on=(En $r.ap $_)}) } } }
$sh=New-Object -ComObject WScript.Shell
foreach($f in @(@{d=[Environment]::GetFolderPath('Startup');s='user';ap='HKCU:\\${APPR}\\StartupFolder'},@{d=[Environment]::GetFolderPath('CommonStartup');s='machine';ap='HKLM:\\${APPR}\\StartupFolder'})){
  Get-ChildItem -LiteralPath $f.d -File | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object { $c=$_.FullName; if($_.Extension -eq '.lnk'){ $c=$sh.CreateShortcut($_.FullName).TargetPath } ; [void]$o.Add(@{t='folder';s=$f.s;key=$_.FullName;name=$_.Name;cmd=[string]$c;on=(En $f.ap $_.Name)}) } }
Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\\Microsoft\\*' -and ($_.Triggers | Where-Object { $_.CimClass.CimClassName -in 'MSFT_TaskLogonTrigger','MSFT_TaskBootTrigger' }) } | ForEach-Object { $a=$_.Actions | Select-Object -First 1; [void]$o.Add(@{t='task';s='machine';key=$_.TaskPath;name=$_.TaskName;cmd=([string]$a.Execute+' '+[string]$a.Arguments).Trim();on=($_.State -ne 'Disabled')}) }
Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' -and $_.PathName -and $_.PathName -notmatch 'Windows\\\\(system32|SysWOW64)|Windows Defender|\\\\Microsoft' } | ForEach-Object { [void]$o.Add(@{t='service';s='machine';key=$_.Name;name=$_.DisplayName;cmd=[string]$_.PathName;on=$true}) }
$o | ConvertTo-Json -Compress -Depth 3`;
let last = new Map();
async function publishers(paths) {
  const rows = await psJson("$p=@($env:WISE_ARG|ConvertFrom-Json); $p | ForEach-Object { [pscustomobject]@{p=$_;c=[string](Get-Item -LiteralPath $_).VersionInfo.CompanyName} } | ConvertTo-Json -Compress", { arg: paths }); return Object.fromEntries(rows.map(r => [r.p, r.c]));
}
async function list() {
  const rows = await psJson(GATHER, { timeout: 120000 }); const exes = [...new Set(rows.map(r => registry.extractPath(r.cmd)).filter(Boolean))]; const pub = exes.length ? await publishers(exes) : {};
  const out = rows.map((r, i) => { const exe = registry.extractPath(r.cmd); return { id: 's' + (i + 1), type: r.t, scope: r.s, key: r.key, name: r.name, command: r.cmd, publisher: (exe && pub[exe]) || '', enabled: !!r.on, advanced: r.t === 'service' }; });
  last = new Map(out.map(o => [o.id, o])); return out;
}
const apprPath = (e) => { const hive = e.scope === 'user' ? 'HKCU' : 'HKLM'; const sub = e.type === 'folder' ? 'StartupFolder' : e.scope === 'machine32' ? 'Run32' : 'Run'; return `${hive}:\\${APPR}\\${sub}`; };
async function toggle(id, on) {
  const e = last.get(id); if (!e) return { ok: false, error: 'Entrée introuvable : actualisez la liste' };
  if (e.type === 'run' || e.type === 'folder') return ps("$a=$env:WISE_ARG|ConvertFrom-Json; if(-not (Test-Path -LiteralPath $a.p)){ New-Item -Path $a.p -Force | Out-Null }; $b=if($a.on){[byte[]](2,0,0,0,0,0,0,0,0,0,0,0)}else{[byte[]](3,0,0,0,0,0,0,0,0,0,0,0)}; Set-ItemProperty -LiteralPath $a.p -Name $a.n -Value $b -Type Binary -ErrorAction Stop", { arg: { p: apprPath(e), n: e.name, on: !!on } }).then(r => ({ ok: r.ok && !r.err }));
  if (e.type === 'task') return ps("$a=$env:WISE_ARG|ConvertFrom-Json; if($a.on){Enable-ScheduledTask -TaskPath $a.p -TaskName $a.n -ErrorAction Stop|Out-Null}else{Disable-ScheduledTask -TaskPath $a.p -TaskName $a.n -ErrorAction Stop|Out-Null}", { arg: { p: e.key, n: e.name, on: !!on } }).then(r => ({ ok: r.ok && !r.err }));
  if (e.type === 'service') return ps("$a=$env:WISE_ARG|ConvertFrom-Json; Set-Service -Name $a.n -StartupType $(if($a.on){'Automatic'}else{'Disabled'}) -ErrorAction Stop", { arg: { n: e.key, on: !!on } }).then(r => ({ ok: r.ok && !r.err }));
  return { ok: false };
}
async function remove(id) {
  const e = last.get(id); if (!e) return { ok: false, error: 'Entrée introuvable' }; const set = backup.begin('Suppression d\'un élément de démarrage');
  if (e.type === 'run') { await backup.exportKey(set, e.key); const r = await run('reg', ['delete', e.key, '/v', e.name, '/f']); backup.commit(set); return { ok: r.ok }; }
  if (e.type === 'folder') { const ok = backup.moveFile(set, e.key, e.name); backup.commit(set); return { ok }; }
  if (e.type === 'task') { const x = await ps("$a=$env:WISE_ARG|ConvertFrom-Json; Export-ScheduledTask -TaskPath $a.p -TaskName $a.n", { arg: { p: e.key, n: e.name } }); if (x.out.trim()) backup.addText(set, e.name + '.xml', x.out); const r = await ps("$a=$env:WISE_ARG|ConvertFrom-Json; Unregister-ScheduledTask -TaskPath $a.p -TaskName $a.n -Confirm:$false -ErrorAction Stop", { arg: { p: e.key, n: e.name } }); backup.commit(set); return { ok: r.ok && !r.err }; }
  return { ok: false, error: 'Les services ne peuvent être que désactivés' };
}
module.exports = { list, toggle, remove, apprPath };
