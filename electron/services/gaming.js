// Mode Jeu / Ne pas déranger : détecte plein écran, jeu D3D, présentation (SHQueryUserNotificationState)
const { ps } = require('./util');
let on = false, timer = null;
const SCRIPT = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class WN { [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int s); }'; $s=0; [WN]::SHQueryUserNotificationState([ref]$s) | Out-Null; $s`;
function start(emit) { timer = setInterval(async () => { const r = await ps(SCRIPT); const s = parseInt(r.out.trim(), 10); const now = [2, 3, 4].includes(s); if (now !== on) { on = now; emit('gaming', { active: on }); } }, 30000); }
module.exports = { start, active: () => on };
