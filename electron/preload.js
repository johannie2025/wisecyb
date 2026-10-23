const { contextBridge, ipcRenderer } = require('electron');
const invoke = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('wise', {
  invoke,
  on: (ch, cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on(ch, fn); return () => ipcRenderer.removeListener(ch, fn); }
});
