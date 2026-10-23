// Navigateur isolé : session éphémère (cookies/cache effacés à la fermeture), HTTPS uniquement, permissions refusées, captures d'écran bloquées.
const { BrowserWindow } = require('electron');
function open(url) {
  let u; try { u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); } catch { return { ok: false, error: 'INVALID' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'HTTPS_ONLY' };
  const win = new BrowserWindow({ width: 1100, height: 780, title: 'Safe Money — WiseCybersecurity', autoHideMenuBar: true, webPreferences: { partition: 'safemoney-' + Date.now(), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false, devTools: false } });
  const ses = win.webContents.session; win.setContentProtection(true); ses.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  win.webContents.setWindowOpenHandler(({ url: n }) => { try { if (new URL(n).protocol === 'https:') win.loadURL(n); } catch {} return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, n) => { if (!n.startsWith('https://')) e.preventDefault(); });
  win.on('closed', () => { ses.clearStorageData().catch(() => {}); ses.clearCache().catch(() => {}); }); win.loadURL(u.href); return { ok: true };
}
module.exports = { open };
