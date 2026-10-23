// Détection de stalkerwares / keyloggers commerciaux connus (processus en cours + programmes installés). Rapport seulement : l'utilisateur décide de désinstaller.
const { run, ps } = require('./util');
const NAMES = ['flexispy', 'mspy', 'hoverwatch', 'spyera', 'spyrix', 'refog', 'ardamax', 'kidlogger', 'webwatcher', 'elite keylogger', 'perfect keylogger', 'spyboss', 'revealer keylogger', 'actual keylogger', 'spytector', 'all in one keylogger', 'realtime-spy', 'spector pro', 'pc pandora', 'teensafe', 'mobistealth', 'cocospy', 'snoopza', 'spyagent', 'keylogger'];
async function scan() {
  const found = []; const tl = await run('tasklist', ['/fo', 'csv', '/nh']);
  tl.out.split('\n').forEach(l => { const n = (l.split('","')[0] || '').replace(/"/g, '').toLowerCase(); if (n && NAMES.some(k => n.includes(k.replace(/ /g, '')))) found.push({ kind: 'process', name: n }); });
  const r = await ps(`Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object DisplayName | Select-Object -ExpandProperty DisplayName`);
  r.out.split('\n').map(s => s.trim()).filter(Boolean).forEach(n => { if (NAMES.some(k => n.toLowerCase().includes(k))) found.push({ kind: 'installed', name: n }); });
  return found;
}
module.exports = { scan };
