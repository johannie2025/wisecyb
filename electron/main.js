const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, Notification, nativeImage } = require('electron');
const path = require('path');
const cron = require('node-cron');
const cfg = require('./config');
require('./services/util');
const settings = require('./services/settings');
const license = require('./services/license');
const updater = require('./services/updater');
const shield = require('./services/shield');
const firewall = require('./services/firewall');
const usb = require('./services/usb');
const optimizer = require('./services/optimizer');
const privacy = require('./services/privacy');
const vault = require('./services/vault');
const leak = require('./services/leak');
const rollback = require('./services/rollback');
const gaming = require('./services/gaming');
const stalker = require('./services/stalker');
const wifi = require('./services/wifi');
const vpn = require('./services/vpn');
const safemoney = require('./services/safemoney');
const autostart = require('./services/autostart');

let win, tray, quitting = false, protecting = false;
if (!app.requestSingleInstanceLock()) app.quit();
const emit = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };
const M = { threat: { fr: 'Menace bloquée', es: 'Amenaza bloqueada', en: 'Threat blocked' }, ransom: { fr: 'Comportement ransomware suspect', es: 'Comportamiento ransomware sospechoso', en: 'Suspicious ransomware behavior' }, usb: { fr: 'Clé USB désinfectée', es: 'USB desinfectado', en: 'USB drive disinfected' }, dev: { fr: 'Nouvel appareil sur le réseau', es: 'Nuevo dispositivo en la red', en: 'New device on network' } };
const notify = (k, body, force = false) => { try { if (!force && settings.get().gaming && gaming.active()) return; new Notification({ title: M[k][settings.get().lang] || M[k].en, body }).show(); } catch {} };
const gate = () => license.status().full; // modules restreints à l'expiration (le coffre de mots de passe reste lisible)

function startProtection() { // idempotent : appelé au démarrage ET après activation de licence
  if (protecting || !gate()) return; protecting = true; const s = settings.get();
  shield.start((ch, d) => { emit(ch, d); if (ch === 'threat') { notify('threat', `${d.threat}\n${d.file}`, true); tray && tray.setToolTip('WiseCybersecurity — Alerte'); } if (ch === 'ransomware') notify('ransom', d.file, true); }).catch(() => {});
  usb.start((ch, d) => { emit(ch, d); if (ch === 'usb:done') notify('usb', `${d.drive} — ${d.threats} menace(s)`); });
  gaming.start(emit); vpn.init(emit);
  cron.schedule('*/15 * * * *', () => { if (gate() && !gaming.active()) rollback.snapshot(); }); setTimeout(() => rollback.snapshot(), 60000);
  cron.schedule('0 13 * * *', async () => { if (gate() && settings.get().scheduled && !gaming.active()) for (const d of ['Downloads', 'Desktop', 'Documents']) await shield.scanPath(path.join(process.env.USERPROFILE || 'C:\\Users', d)); });
  cron.schedule('*/5 * * * *', async () => { if (!gate()) return; const w = await wifi.devices(); w.fresh.forEach(d => { emit('wifi:new', d); notify('dev', `${d.ip} (${d.mac})`); }); });
  cron.schedule('*/2 * * * *', async () => { if (gate()) (await firewall.ids()).forEach(x => emit('ids', x)); });
  if (s.web) try { privacy.applyBlocklist(); } catch {}
  if (s.cfa) privacy.cfa(true);
}
function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 820, minWidth: 1020, minHeight: 640, backgroundColor: '#05080f', title: 'WiseCybersecurity', autoHideMenuBar: true, icon: path.join(__dirname, '../assets/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (process.env.NODE_ENV === 'development') win.loadURL('http://localhost:5173'); else win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 16, height: 16 })); tray.setToolTip('WiseCybersecurity');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Ouvrir / Open / Abrir', click: () => win.show() }, { label: 'Update DB', click: () => updater.check() }, { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; app.quit(); } }])); tray.on('double-click', () => win.show());
}
app.whenReady().then(async () => {
  createWindow(); createTray(); if (process.argv.includes('--hidden')) win.hide();
  if (app.isPackaged && !(await autostart.status())) autostart.enable();
  updater.start(emit); startProtection();
  setInterval(() => license.revalidate().then(s => { emit('license', s); startProtection(); }), 6 * 3600 * 1000); license.revalidate();
});
app.on('before-quit', () => { quitting = true; vpn.disconnect(false); });

const h = (ch, fn, lic = false) => ipcMain.handle(ch, async (_e, ...a) => { if (lic && !gate()) return { ok: false, error: 'LICENSE_EXPIRED' }; try { return await fn(...a); } catch (e) { return { ok: false, error: e.message }; } });
h('app:paths', () => ({ user: process.env.USERPROFILE || 'C:\\Users' }));
h('settings:get', () => settings.get()); h('settings:set', p => { const s = settings.set(p); if ('ransom' in p) shield.setRansom(s.ransom); return s; });
h('license:status', () => license.status());
h('license:activate', async k => { const r = await license.activate(k); if (r.ok) startProtection(); return r; });
h('update:info', () => updater.info()); h('update:check', () => updater.check());
h('update:import', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Signatures', extensions: ['json', 'ndb', 'yar'] }], properties: ['openFile'] }); return r.canceled ? { ok: false } : updater.importLocal(r.filePaths[0]); });
h('shield:state', () => ({ enabled: shield.isEnabled(), stats: shield.stats, clam: shield.clamAvailable(), gaming: gaming.active() }));
h('shield:toggle', on => shield.enableRealtime(on), true);
h('scan:path', t => shield.scanPath(t, p => emit('scan:progress', p)), true);
h('scan:pick', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
h('quarantine:list', () => shield.listQuarantine()); h('quarantine:restore', id => shield.restore(id)); h('quarantine:delete', id => shield.removeQ(id));
h('rollback:snapshot', () => rollback.snapshot(), true); h('rollback:restore', () => rollback.restore(), true);
h('cfa:set', async on => { settings.set({ cfa: on }); return privacy.cfa(on); }, true);
h('fw:status', () => firewall.status()); h('fw:enable', on => firewall.setEnabled(on), true); h('fw:rules', () => firewall.listRules()); h('fw:block', r => firewall.blockApp(r), true);
h('fw:pick', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Exe', extensions: ['exe'] }], properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0]; });
h('fw:toggle', (n, on) => firewall.toggleRule(n, on), true); h('fw:remove', n => firewall.removeRule(n), true); h('fw:ids', () => firewall.ids(), true);
h('usb:list', () => usb.drives()); h('usb:disinfect', d => usb.disinfect(d), true);
h('opt:analyze', () => optimizer.analyze()); h('opt:clean', () => optimizer.clean(), true); h('opt:startup', () => optimizer.startupList()); h('opt:startup:off', i => optimizer.startupDisable(i), true);
h('opt:disks', () => optimizer.disks()); h('opt:sw', () => optimizer.softwareUpdates()); h('opt:sw:all', () => optimizer.softwareUpgradeAll(), true);
h('web:block', async on => { settings.set({ web: on }); if (on) return { ok: true, n: privacy.applyBlocklist() }; privacy.removeBlocklist(); return { ok: true }; }, true);
h('priv:webcam', async b => { settings.set({ cam: b }); return privacy.webcam(b); }, true); h('priv:mic', async b => { settings.set({ mic: b }); return privacy.mic(b); }, true);
h('url:check', u => privacy.checkUrl(u)); h('stalker:scan', () => stalker.scan(), true);
h('vault:state', () => vault.state()); h('vault:create', p => vault.create(p)); h('vault:unlock', p => vault.unlock(p)); h('vault:lock', () => vault.lock());
h('vault:list', () => vault.list()); h('vault:reveal', id => vault.reveal(id)); h('vault:save', it => vault.upsert(it)); h('vault:delete', id => vault.remove(id));
h('vault:gen', (n, o) => vault.generate(n, o)); h('vault:audit', () => vault.audit());
h('leak:pwd', p => leak.pwned(p)); h('leak:email', e => leak.email(e));
h('wifi:info', () => wifi.info(), true); h('wifi:devices', () => wifi.devices(), true);
h('vpn:installed', () => vpn.installed()); h('vpn:install', () => vpn.install(), true); h('vpn:list', () => vpn.list(), true); h('vpn:connect', (ip, ks) => vpn.connect(ip, ks), true); h('vpn:disconnect', () => vpn.disconnect()); h('vpn:restore', () => vpn.restoreNetwork());
h('safe:open', u => safemoney.open(u), true);
