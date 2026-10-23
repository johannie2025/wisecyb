<?php // php gen_keys.php  -> met PUBKEY dans electron/config.js, sign_sk dans backend/api/config.php (NE JAMAIS publier la clé secrète)
$kp = sodium_crypto_sign_keypair();
echo "PUBKEY (client)  : ".base64_encode(sodium_crypto_sign_publickey($kp))."\n";
echo "sign_sk (serveur): ".base64_encode(sodium_crypto_sign_secretkey($kp))."\n";
