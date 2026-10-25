// Parcours de fichiers non bloquant, annulable, sans suivre les liens symboliques
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const tick = () => new Promise(r => setImmediate(r));
async function dirSize(p, { cancelled = () => false } = {}) {
  let bytes = 0, files = 0, n = 0;
  async function w(d) {
    let es; try { es = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (cancelled()) return; const f = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) await w(f); else { try { bytes += (await fsp.lstat(f)).size; files++; } catch {} }
      if (++n % 400 === 0) await tick();
    }
  }
  let st; try { st = await fsp.lstat(p); } catch { return { bytes: 0, files: 0 }; }
  if (st.isDirectory()) await w(p); else if (st.isFile()) { bytes = st.size; files = 1; }
  return { bytes, files };
}
// Supprime le contenu d'un dossier (garde le dossier). Retourne l'espace libéré ; les fichiers verrouillés sont ignorés.
async function emptyDir(p, { cancelled = () => false } = {}) {
  let freed = 0, files = 0, failed = 0, n = 0;
  async function w(d, isRoot) {
    let es; try { es = await fsp.readdir(d, { withFileTypes: true }); } catch { return true; }
    let clean = true;
    for (const e of es) {
      if (cancelled()) return false; const f = path.join(d, e.name);
      if (e.isDirectory() && !e.isSymbolicLink()) { const empty = await w(f, false); if (empty) { try { await fsp.rmdir(f); } catch { clean = false; } } else clean = false; }
      else { try { const s = e.isSymbolicLink() ? { size: 0 } : await fsp.lstat(f); await fsp.unlink(f); freed += s.size; files++; } catch { failed++; clean = false; } }
      if (++n % 300 === 0) await tick();
    }
    return clean;
  }
  await w(p, true); return { freed, files, failed };
}
async function removePath(p) { // fichier ou dossier entier
  let st; try { st = await fsp.lstat(p); } catch { return { freed: 0, files: 0, failed: 0 }; }
  if (st.isDirectory()) { const r = await dirSize(p); const e = await emptyDir(p); try { await fsp.rmdir(p); } catch {} return { freed: e.freed, files: e.files, failed: e.failed }; }
  try { await fsp.unlink(p); return { freed: st.size, files: 1, failed: 0 }; } catch { return { freed: 0, files: 0, failed: 1 }; }
}
async function* walk(root, { cancelled = () => false, skip = () => false, maxDepth = 64 } = {}) {
  let n = 0;
  async function* w(d, depth) {
    let es; try { es = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (cancelled()) return; const f = path.join(d, e.name); if (e.isSymbolicLink() || skip(f, e)) continue;
      if (e.isDirectory()) { if (depth < maxDepth) yield* w(f, depth + 1); } else if (e.isFile()) yield f;
      if (++n % 400 === 0) await tick();
    }
  }
  yield* w(root, 0);
}
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
module.exports = { dirSize, emptyDir, removePath, walk, exists, tick };
