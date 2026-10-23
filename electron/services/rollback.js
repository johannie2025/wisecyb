// Anti-ransomware "rollback" : instantanés incrémentaux des dossiers sensibles (Documents/Bureau/Images) + restauration.
// Un fichier dont l'entropie bondit (signe de chiffrement) n'écrase jamais la bonne copie.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const cfg = require('../config');
const { readJson, writeJson, log } = require('./util');
const IDX = path.join(cfg.ROLLBACK, 'index.json'); const MAX_FILE = 20 * 1024 * 1024; const MAX_TOTAL = 2 * 1024 ** 3;
const COMPRESSED = /\.(zip|rar|7z|gz|jpg|jpeg|png|mp3|mp4|mkv|docx|xlsx|pptx|pdf|webp|heic)$/i;
let frozen = false, running = false;
const dirs = () => ['Documents', 'Desktop', 'Pictures'].map(d => path.join(process.env.USERPROFILE || '', d));
function entropy(buf) { if (!buf.length) return 0; const c = new Array(256).fill(0); for (const b of buf) c[b]++; let e = 0; for (const n of c) if (n) { const p = n / buf.length; e -= p * Math.log2(p); } return e; }
async function head(file) { const fh = await fsp.open(file, 'r'); try { const b = Buffer.alloc(65536); const { bytesRead } = await fh.read(b, 0, 65536, 0); return b.subarray(0, bytesRead); } finally { await fh.close(); } }
async function* walk(d, depth = 0) { let es = []; try { es = await fsp.readdir(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) { if (depth < 5) yield* walk(p, depth + 1); } else yield p; } }
async function snapshot() {
  if (frozen || running) return { ok: false, error: frozen ? 'FROZEN' : 'BUSY' }; running = true; let added = 0, skipped = 0;
  try {
    await fsp.mkdir(cfg.ROLLBACK, { recursive: true }); const idx = readJson(IDX, { files: {}, bytes: 0 });
    for (const root of dirs()) for await (const f of walk(root)) {
      if (frozen) break;
      try {
        const st = await fsp.stat(f); if (st.size > MAX_FILE || !st.size || idx.bytes + st.size > MAX_TOTAL) continue; const prev = idx.files[f];
        if (prev && prev.mtime === st.mtimeMs && prev.size === st.size) continue;
        const h = await head(f); const e = entropy(h);
        if (prev && !COMPRESSED.test(f) && e > 7.5 && prev.entropy < 7.0) { skipped++; continue; } // suspect : on garde l'ancienne copie
        const v = prev ? prev.vfile : crypto.createHash('sha1').update(f).digest('hex'); await fsp.copyFile(f, path.join(cfg.ROLLBACK, v));
        idx.bytes += prev ? st.size - prev.size : st.size; idx.files[f] = { vfile: v, mtime: st.mtimeMs, size: st.size, entropy: e }; added++;
      } catch {}
    }
    writeJson(IDX, idx); return { ok: true, added, skipped };
  } finally { running = false; }
}
async function restore() { // restaure les fichiers disparus ou devenus "chiffrés" ; ne touche pas aux fichiers sains
  let n = 0; const idx = readJson(IDX, { files: {} });
  for (const [f, m] of Object.entries(idx.files)) {
    try {
      let need = false; try { const st = fs.statSync(f); if (st.mtimeMs !== m.mtime) { const e = entropy(await head(f)); need = !COMPRESSED.test(f) && e > 7.5 && m.entropy < 7.0; } } catch { need = true; }
      if (need) { await fsp.mkdir(path.dirname(f), { recursive: true }); await fsp.copyFile(path.join(cfg.ROLLBACK, m.vfile), f); n++; }
    } catch {}
  }
  log('rollback', 'restored ' + n); frozen = false; return { ok: true, restored: n };
}
const freeze = (on) => { frozen = on; };
module.exports = { snapshot, restore, freeze, entropy };
