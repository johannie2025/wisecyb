// Nettoyeur de registre : le PowerShell ne fait que LISTER ; la classification est en JS (testable) ; toute correction est précédée d'un export .reg restaurable.
const fs = require('fs');
const path = require('path');
const { run, ps, psJson, expandEnv } = require('./util');
const backup = require('./backup');

const EXT = 'exe|dll|ocx|sys|bat|cmd|com|scr|cpl|msc|lnk|ico|ttf|otf|ttc|fon|chm|hlp|vbs|js|msi|ax|drv|mui';
// Extrait le chemin de fichier d'une commande de registre. Retourne null pour ce qui n'est pas un fichier local (msiexec, GUID, rundll32 sans chemin…)
function extractPath(cmd, env = process.env) {
  if (cmd == null) return null; let s = expandEnv(String(cmd).trim(), env); if (!s) return null; s = s.replace(/^@/, '');
  let p; const q = s.match(/^"([^"]+)"/);
  if (q) p = q[1]; else { const m = s.match(new RegExp('^([A-Za-z]:\\\\.*?\\.(?:' + EXT + '))(?=$|[\\s,"/;])', 'i')); p = m ? m[1] : null; }
  if (!p) return null; p = p.replace(/,\s*-?\d+$/, '').trim(); return /^[A-Za-z]:\\/.test(p) ? p : null;
}
const FONTS = 'C:\\Windows\\Fonts';
// Classe les données brutes (collectées par PowerShell) en problèmes. `exists` est injectable pour les tests.
function classify(rows, exists = (p) => fs.existsSync(p), env = process.env) {
  const out = []; const miss = (p) => p && !exists(p);
  for (const r of rows) {
    if (r.k === 'uninst') { const ex = extractPath(r.uninst, env); if (!r.name || r.system) continue; if (ex && miss(ex) && !/\\(msiexec|rundll32)\.exe$/i.test(ex) && !(r.loc && exists(expandEnv(r.loc, env)))) out.push({ type: 'Entrée de désinstallation orpheline', detail: `${r.name} → ${ex}`, key: r.key, action: 'key' }); }
    else if (r.k === 'shared') { if (miss(extractPath(r.name, env))) out.push({ type: 'DLL partagée manquante', detail: r.name, key: r.key, value: r.name, action: 'value' }); }
    else if (r.k === 'apppath') { const ex = extractPath(r.data, env); if (miss(ex)) out.push({ type: 'Chemin d\'application invalide', detail: `${path.win32.basename(r.key)} → ${ex}`, key: r.key, action: 'key' }); }
    else if (r.k === 'run') { const ex = extractPath(r.data, env); if (miss(ex)) out.push({ type: 'Démarrage vers un fichier absent', detail: `${r.name} → ${ex}`, key: r.key, value: r.name, action: 'value' }); }
    else if (r.k === 'mui') { const n = String(r.name).replace(/\.(FriendlyAppName|ApplicationCompany)$/i, ''); const ex = extractPath(n, env); if (miss(ex)) out.push({ type: 'Cache MUI obsolète', detail: n, key: r.key, value: r.name, action: 'value' }); }
    else if (r.k === 'font') { let d = String(r.data || ''); const ex = /^[A-Za-z]:\\/.test(d) ? d : path.win32.join(FONTS, d.split('&')[0]); if (d && miss(ex)) out.push({ type: 'Police introuvable', detail: `${r.name} → ${ex}`, key: r.key, value: r.name, action: 'value' }); }
    else if (r.k === 'appcls') { const ex = extractPath(r.data, env); if (miss(ex)) out.push({ type: 'Association d\'application invalide', detail: `${path.win32.basename(r.key)} → ${ex}`, key: r.key, action: 'key' }); }
  }
  return out.map((o, i) => ({ id: 'r' + (i + 1), ...o }));
}
const GATHER = `
function V($p,$n){ try { (Get-ItemProperty -LiteralPath $p -ErrorAction Stop).$n } catch { $null } }
$o=New-Object System.Collections.ArrayList
foreach($r in 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'){
  Get-ChildItem $r | ForEach-Object { $p=Get-ItemProperty -LiteralPath $_.PSPath; if($p.DisplayName){ [void]$o.Add(@{k='uninst';key=$_.Name;name=[string]$p.DisplayName;uninst=[string]$p.UninstallString;loc=[string]$p.InstallLocation;system=[bool]($p.SystemComponent -eq 1 -or $p.ParentKeyName)}) } } }
$sd=Get-Item 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\SharedDLLs'; if($sd){ $sd.GetValueNames() | ForEach-Object { [void]$o.Add(@{k='shared';key=$sd.Name;name=$_}) } }
foreach($r in 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'){ Get-ChildItem $r | ForEach-Object { [void]$o.Add(@{k='apppath';key=$_.Name;data=[string](V $_.PSPath '(default)')}) } }
foreach($r in 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'){ $k=Get-Item $r; if($k){ $k.GetValueNames() | ForEach-Object { [void]$o.Add(@{k='run';key=$k.Name;name=$_;data=[string]$k.GetValue($_)}) } } }
$m=Get-Item 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache'; if($m){ $m.GetValueNames() | Where-Object { $_ -match '^[A-Za-z]:\\\\' } | ForEach-Object { [void]$o.Add(@{k='mui';key=$m.Name;name=$_}) } }
$f=Get-Item 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'; if($f){ $f.GetValueNames() | ForEach-Object { [void]$o.Add(@{k='font';key=$f.Name;name=$_;data=[string]$f.GetValue($_)}) } }
Get-ChildItem 'HKCU:\\Software\\Classes\\Applications' | ForEach-Object { $c=V ($_.PSPath+'\\shell\\open\\command') '(default)'; if($c){ [void]$o.Add(@{k='appcls';key=$_.Name;data=[string]$c}) } }
$o | ConvertTo-Json -Compress -Depth 3`;
let lastScan = new Map();
async function scan(ctx) {
  ctx.progress(5, 'Lecture du registre…'); const rows = await psJson(GATHER, { timeout: 240000 }); ctx.progress(70, `Vérification de ${rows.length} entrées…`);
  const issues = classify(rows); lastScan = new Map(issues.map(i => [i.id, i])); ctx.progress(100, `${issues.length} problème(s)`); return issues.map(i => ({ id: i.id, type: i.type, detail: i.detail, key: i.key }));
}
async function fix(ids, ctx) {
  const items = ids.map(id => lastScan.get(id)).filter(Boolean); if (!items.length) return { fixed: 0, failed: 0, backup: null };
  const set = backup.begin('Nettoyage du registre'); const keys = new Set(); items.forEach(i => keys.add(i.key));
  let n = 0; for (const k of keys) { ctx.progress((n++ / keys.size) * 40, 'Sauvegarde du registre…'); await backup.exportKey(set, k); }
  let fixed = 0, failed = 0; for (let i = 0; i < items.length; i++) {
    ctx.progress(40 + (i / items.length) * 60, `Correction ${i + 1}/${items.length}`); const it = items[i];
    if (!backup.okKey(it.key)) { failed++; continue; }
    const r = it.action === 'key' ? await run('reg', ['delete', it.key, '/f']) : await run('reg', ['delete', it.key, '/v', it.value, '/f']); r.ok ? fixed++ : failed++;
  }
  const id = backup.commit(set); items.forEach(i => lastScan.delete(i.id)); return { fixed, failed, backup: id };
}
module.exports = { scan, fix, classify, extractPath };
