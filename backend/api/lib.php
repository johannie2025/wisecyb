<?php
$C = require __DIR__.'/config.php';
$pdo = new PDO("mysql:host={$C['db_host']};dbname={$C['db_name']};charset=utf8mb4", $C['db_user'], $C['db_pass'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
function out($a, $c = 200) { http_response_code($c); header('Content-Type: application/json; charset=utf-8'); echo json_encode($a); exit; }
function limit($pdo, $key, $max, $win) {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  $pdo->prepare('DELETE FROM rate_limit WHERE ts < (NOW() - INTERVAL ? SECOND)')->execute([$win]);
  $s = $pdo->prepare('SELECT COUNT(*) FROM rate_limit WHERE k=? AND ip=?'); $s->execute([$key, $ip]);
  if ((int)$s->fetchColumn() >= $max) out(['error'=>'rate_limited'], 429);
  $pdo->prepare('INSERT INTO rate_limit (k,ip) VALUES (?,?)')->execute([$key, $ip]);
}
function sign_bundle($C, $ver, $yara, $hashes, $domains) {
  if (empty($C['sign_sk'])) return '';
  $msg = implode("\n", [$ver, hash('sha256', $yara), hash('sha256', $hashes), hash('sha256', $domains)]);
  return base64_encode(sodium_crypto_sign_detached($msg, base64_decode($C['sign_sk'])));
}
function publish($pdo, $C, $yara, $ver = null) {
  $hashes = implode("\n", array_map(fn($r)=>$r['hash'].':'.$r['name'], $pdo->query('SELECT hash,name FROM malware_hashes')->fetchAll(PDO::FETCH_ASSOC)));
  $domains = implode("\n", $pdo->query('SELECT domain FROM blocked_domains')->fetchAll(PDO::FETCH_COLUMN));
  $ver = $ver ?: date('Y.md.Hi'); $sig = sign_bundle($C, $ver, $yara, $hashes, $domains);
  $pdo->prepare('INSERT INTO threat_versions (version,yara,hashes,domains,sig) VALUES (?,?,?,?,?)')->execute([$ver, $yara, $hashes, $domains, $sig]);
  return $ver;
}
function new_key() { $g = fn() => strtoupper(substr(bin2hex(random_bytes(3)), 0, 4)); return "WISE-{$g()}-{$g()}-{$g()}"; }
