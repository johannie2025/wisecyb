<?php
// WiseCyb API — déployer dans /wisecyb/api/ ; importer schema.sql avant.
require __DIR__.'/lib.php';
$route = trim($_GET['route'] ?? '', '/'); $m = $_SERVER['REQUEST_METHOD'];
$in = json_decode(file_get_contents('php://input'), true) ?: [];
function admin($C) { if (!hash_equals($C['admin_key'], $_SERVER['HTTP_X_ADMIN_KEY'] ?? '')) out(['error'=>'forbidden'], 403); }

if ($route === 'license/verify' && $m === 'POST') {
  limit($pdo, 'verify', 20, 600);
  $k = strtoupper(trim($in['license'] ?? '')); $hw = substr(trim($in['hwid'] ?? ''), 0, 128);
  if (!preg_match('/^WISE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $k) || !$hw) out(['valid'=>false,'reason'=>'FORMAT']);
  $pdo->beginTransaction();
  $s = $pdo->prepare('SELECT * FROM licenses WHERE license_key=? FOR UPDATE'); $s->execute([$k]); $l = $s->fetch(PDO::FETCH_ASSOC);
  if (!$l) { $pdo->commit(); out(['valid'=>false,'reason'=>'UNKNOWN']); }
  if ($l['status'] !== 'active') { $pdo->commit(); out(['valid'=>false,'reason'=>'REVOKED']); }
  if (!$l['hwid']) {
    $pdo->prepare('UPDATE licenses SET hwid=?, activated_at=NOW(), expires_at=DATE_ADD(NOW(), INTERVAL duration_days DAY) WHERE id=?')->execute([$hw, $l['id']]);
    $s->execute([$k]); $l = $s->fetch(PDO::FETCH_ASSOC);
  } elseif (!hash_equals($l['hwid'], $hw)) { $pdo->commit(); out(['valid'=>false,'reason'=>'HWID_MISMATCH']); }
  $pdo->commit();
  if (strtotime($l['expires_at']) < time()) out(['valid'=>false,'reason'=>'EXPIRED']);
  out(['valid'=>true,'expires_at'=>gmdate('c', strtotime($l['expires_at']))]);
}
if ($route === 'threats/updates' && $m === 'GET') {
  $cur = $_GET['current_version'] ?? '0.0.0';
  $v = $pdo->query('SELECT * FROM threat_versions ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
  if (!$v || $v['version'] === $cur) out(['up_to_date'=>true]);
  out(['version'=>$v['version'],'yara'=>$v['yara'],'hashes'=>$v['hashes'],'domains'=>$v['domains'],'sig'=>$v['sig']]);
}
// Mise à jour manuelle : /threats/download (bundle signé .json, à importer dans l'appli) | ?file=ndb | ?file=yar
if ($route === 'threats/download' && $m === 'GET') {
  $v = $pdo->query('SELECT * FROM threat_versions ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
  $f = $_GET['file'] ?? 'bundle';
  if ($f === 'bundle') { header('Content-Type: application/json'); header('Content-Disposition: attachment; filename="wise-signatures.json"');
    echo json_encode(['version'=>$v['version'],'yara'=>$v['yara'],'hashes'=>$v['hashes'],'domains'=>$v['domains'],'sig'=>$v['sig']]); exit; }
  $col = $f === 'yar' ? 'yara' : 'hashes'; header('Content-Type: text/plain'); header('Content-Disposition: attachment; filename="'.($col==='yara'?'custom_rules.yar':'malware_hashes.ndb').'"'); echo $v[$col]; exit;
}
if ($route === 'scan/hash' && $m === 'POST') {
  limit($pdo, 'hash', 300, 600);
  $h = strtolower(trim($in['sha256'] ?? $in['md5'] ?? '')); if (!preg_match('/^[a-f0-9]{32,64}$/', $h)) out(['error'=>'bad hash'], 400);
  $s = $pdo->prepare('SELECT name FROM malware_hashes WHERE hash=?'); $s->execute([$h]); $r = $s->fetch(PDO::FETCH_ASSOC);
  out(['malicious'=>(bool)$r, 'name'=>$r['name'] ?? null]);
}
if ($route === 'telemetry/alert' && $m === 'POST') {
  limit($pdo, 'tele', 200, 600);
  $pdo->prepare('INSERT INTO alerts (hwid,type,payload) VALUES (?,?,?)')->execute([substr($in['hwid'] ?? '',0,128), substr($in['type'] ?? 'alert',0,40), substr(json_encode($in),0,4000)]); out(['ok'=>true]);
}
if ($route === 'admin/license/create' && $m === 'POST') {
  admin($C); $n = min(100, max(1, (int)($in['count'] ?? 1))); $keys = [];
  for ($i = 0; $i < $n; $i++) { $k = new_key(); $pdo->prepare('INSERT INTO licenses (license_key, owner, duration_days) VALUES (?,?,?)')->execute([$k, $in['owner'] ?? null, (int)($in['days'] ?? 365)]); $keys[] = $k; }
  out(['keys'=>$keys]);
}
if ($route === 'admin/license/revoke' && $m === 'POST') { admin($C); $pdo->prepare("UPDATE licenses SET status='revoked' WHERE license_key=?")->execute([strtoupper($in['license'] ?? '')]); out(['ok'=>true]); }
if ($route === 'admin/hash/add' && $m === 'POST') { admin($C); $pdo->prepare('REPLACE INTO malware_hashes (hash,name) VALUES (?,?)')->execute([strtolower($in['hash'] ?? ''), $in['name'] ?? 'Malware.Generic']); out(['ok'=>true]); }
if ($route === 'admin/threats/publish' && $m === 'POST') { admin($C); out(['version'=>publish($pdo, $C, $in['yara'] ?? '', $in['version'] ?? null)]); }
out(['error'=>'not found'], 404);
