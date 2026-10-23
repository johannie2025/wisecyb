<?php // Panneau d'administration : /wisecyb/api/admin.php (protéger aussi par .htpasswd si possible)
require __DIR__.'/lib.php'; session_start();
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
if (isset($_POST['login'])) { if (hash_equals($C['admin_key'], $_POST['key'] ?? '')) { session_regenerate_id(true); $_SESSION['ok'] = 1; $_SESSION['csrf'] = bin2hex(random_bytes(16)); } }
if (isset($_GET['logout'])) { session_destroy(); header('Location: admin.php'); exit; }
header('Content-Type: text/html; charset=utf-8'); header('X-Frame-Options: DENY');
if (empty($_SESSION['ok'])) { echo '<form method="post" style="font-family:sans-serif;margin:80px auto;width:300px"><h3>WiseCyb Admin</h3><input type="password" name="key" placeholder="Admin key" style="width:100%;padding:8px"><button name="login" style="margin-top:8px;padding:8px">Login</button></form>'; exit; }
$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['act'])) {
  if (!hash_equals($_SESSION['csrf'], $_POST['csrf'] ?? '')) { http_response_code(400); exit('CSRF'); }
  switch ($_POST['act']) {
    case 'create': $n = min(100, max(1, (int)$_POST['count'])); $ks = []; for ($i=0;$i<$n;$i++) { $k = new_key(); $pdo->prepare('INSERT INTO licenses (license_key,owner,duration_days) VALUES (?,?,?)')->execute([$k, $_POST['owner'] ?: null, (int)($_POST['days'] ?: 365)]); $ks[] = $k; } $msg = 'Créées : '.implode(', ', $ks); break;
    case 'revoke': $pdo->prepare("UPDATE licenses SET status='revoked' WHERE license_key=?")->execute([strtoupper($_POST['license'])]); $msg = 'Révoquée'; break;
    case 'hash': if (preg_match('/^[a-fA-F0-9]{32,64}$/', $_POST['hash'])) { $pdo->prepare('REPLACE INTO malware_hashes (hash,name) VALUES (?,?)')->execute([strtolower($_POST['hash']), $_POST['name'] ?: 'Malware.Generic']); $msg = 'Hash ajouté'; } break;
    case 'domain': if (preg_match('/^[a-z0-9.-]{3,253}$/i', $_POST['domain'])) { $pdo->prepare('REPLACE INTO blocked_domains (domain) VALUES (?)')->execute([strtolower($_POST['domain'])]); $msg = 'Domaine ajouté'; } break;
    case 'publish': $msg = 'Publié : '.publish($pdo, $C, $_POST['yara'] ?? ''); break;
  }
}
$f = fn($act, $inner) => '<form method="post" style="margin:6px 0"><input type="hidden" name="csrf" value="'.$e($_SESSION['csrf']).'"><input type="hidden" name="act" value="'.$act.'">'.$inner.'</form>';
echo '<body style="font-family:sans-serif;max-width:900px;margin:20px auto"><h2>WiseCyb Admin <a href="?logout=1" style="font-size:12px">logout</a></h2><p style="color:green">'.$e($msg).'</p>';
echo '<h3>Licences</h3>'.$f('create','Nombre <input name="count" value="1" size=3> Jours <input name="days" value="365" size=4> Client <input name="owner"> <button>Créer</button>');
echo $f('revoke','<input name="license" placeholder="WISE-XXXX-XXXX-XXXX"> <button>Révoquer</button>');
echo '<h3>Base virale</h3>'.$f('hash','Hash <input name="hash" size=50> Nom <input name="name"> <button>Ajouter</button>').$f('domain','Domaine phishing <input name="domain"> <button>Bloquer</button>');
echo $f('publish','<textarea name="yara" rows=6 cols=90 placeholder="Règles YARA (optionnel)"></textarea><br><button>Publier une nouvelle version signée</button>');
echo '<h3>Dernières licences</h3><table border=1 cellpadding=4 style="border-collapse:collapse;font-size:12px"><tr><th>Clé<th>Client<th>HWID<th>Statut<th>Expire</tr>';
foreach ($pdo->query('SELECT * FROM licenses ORDER BY id DESC LIMIT 50') as $r) echo '<tr><td>'.$e($r['license_key']).'<td>'.$e($r['owner']).'<td>'.$e(substr((string)$r['hwid'],0,12)).'<td>'.$e($r['status']).'<td>'.$e($r['expires_at']).'</tr>';
echo '</table><h3>Alertes récentes</h3><pre style="font-size:11px;max-height:240px;overflow:auto">';
foreach ($pdo->query('SELECT created_at,type,payload FROM alerts ORDER BY id DESC LIMIT 20') as $r) echo $e($r['created_at'].' '.$r['type'].' '.$r['payload'])."\n"; echo '</pre></body>';
