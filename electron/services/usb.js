const fs = require('fs');
const path = require('path');
const { run, ps, log } = require('./util');
const shield = require('./shield');
const settings = require('./settings');
let known = new Set(); let emit = () => {};
const IGNORE = /^(System Volume Information|\$RECYCLE\.BIN|Recovery)$/i;
const LNK_BAD = /(cmd|wscript|cscript|powershell|mshta|rundll32|regsvr32)\.exe$/i;
async function drives() { const r = await ps('Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" | Select-Object DeviceID,VolumeName,Size | ConvertTo-Json'); try { const j = JSON.parse(r.out || 'null'); return Array.isArray(j) ? j : j ? [j] : []; } catch { return []; } }
const lnkTarget = async (f) => (await ps(`(New-Object -ComObject WScript.Shell).CreateShortcut('${f.replace(/'/g, "''")}').TargetPath`)).out.trim();
// Désinfection : supprime autorun.inf et faux raccourcis (.lnk pointant vers cmd/wscript/… ou doublon d'un dossier), réaffiche dossiers/fichiers cachés, puis analyse tout
async function disinfect(letter) {
  if (!/^[A-Z]:$/.test(letter)) return { ok: false }; const root = letter + '\\'; const out = { removed: [], unhidden: 0, threats: 0, files: 0 };
  let entries = []; try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return { ok: false, error: 'UNREADABLE' }; }
  const names = new Set(entries.map(e => e.name.toLowerCase()));
  for (const e of entries) {
    const p = path.join(root, e.name);
    if (/^autorun\.inf$/i.test(e.name)) { await run('attrib', ['-h', '-s', '-r', p]); try { fs.unlinkSync(p); out.removed.push(e.name); } catch {} continue; }
    if (e.isFile() && /\.lnk$/i.test(e.name)) { const base = e.name.replace(/\.lnk$/i, '').toLowerCase(); const t = await lnkTarget(p); if (names.has(base) && entries.find(x => x.isDirectory() && x.name.toLowerCase() === base) || LNK_BAD.test(t)) { await shield.forceQuarantine(p, 'Heur.USBShortcutVirus', 'usb'); out.removed.push(e.name); } }
  }
  for (const e of fs.readdirSync(root, { withFileTypes: true })) { if (IGNORE.test(e.name)) continue; const p = path.join(root, e.name); await run('attrib', ['-h', '-s', '-r', p, ...(e.isDirectory() ? ['/d'] : [])]); if (e.isDirectory()) await run('attrib', ['-h', '-s', '-r', p + '\\*', '/s', '/d']); out.unhidden++; }
  const r = await shield.scanPath(root); out.threats = r.found; out.files = r.total; log('usb', letter + ' ' + JSON.stringify(out)); return { ok: true, ...out };
}
function start(e) {
  emit = e; setInterval(async () => {
    const now = await drives(); const ids = new Set(now.map(d => d.DeviceID));
    for (const d of now) if (!known.has(d.DeviceID)) { emit('usb:inserted', d); if (settings.get().usbAuto) { const r = await disinfect(d.DeviceID); emit('usb:done', { drive: d.DeviceID, ...r }); } }
    known = ids;
  }, 5000);
}
module.exports = { start, disinfect, drives };
