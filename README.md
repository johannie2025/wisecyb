# WiseCybersecurity Suite v1.1

## Déploiement
1. **Clés de signature** (une fois) : `php backend/tools/gen_keys.php` → `PUBKEY` dans `electron/config.js`, `sign_sk` dans `backend/api/config.php` (la clé secrète ne quitte jamais le serveur).
2. **Backend** : importer `backend/schema.sql` (MySQL alwaysdata), éditer `backend/api/config.php`, uploader `backend/api/` vers `/wisecyb/api/`.
3. **Admin** : `https://wise.alwaysdata.net/wisecyb/api/admin.php` → créer des licences, ajouter hashes/domaines, **Publier** une première version signée.
4. **GitHub** : pousser le dossier → l'Action `Build WiseCybersecurity` lance `npm test` puis produit `WiseCybersecurity-Setup.exe` (tag `v1.1.0` = Release).
5. Local : `npm install && npm run dev` (Windows, terminal administrateur).

## Fonctions
Temps réel + quarantaine + restauration · YARA-lite/hashes/cloud/heuristiques · ClamAV optionnel (analyses manuelles) · anti-ransomware (détection, instantanés + restauration, Dossiers protégés Defender) · pare-feu + IDS · USB (dossiers cachés, faux raccourcis) · DNS anti-phishing + vérificateur de lien · webcam/micro · coffre de mots de passe AES-256-GCM + clavier virtuel + audit · fuites (HIBP) · stalkerware · Wi-Fi + nouveaux appareils · VPN OpenVPN/VPNGate + kill switch · Safe Money (fenêtre isolée) · mode jeu · analyse planifiée · exclusions · FR/ES/EN.

## Limites connues
- Non testé sur Windows réel (UAC, netsh, PowerShell, kill switch VPN) : tester sur une VM avant diffusion.
- Pas de pilote noyau/ETW ni de service SYSTEM : l'appli démarre via tâche planifiée (privilèges max) ; ce n'est pas un EDR.
- VPNGate = serveurs bénévoles, pas de garantie de non-journalisation. Safe Money isole la session mais ne bat pas un keylogger noyau.
- Vérification e-mail HIBP : clé API payante (Paramètres). Test de mot de passe : gratuit.
- Format base de hashes : `sha256_ou_md5:Nom`. Fichier de test : EICAR (inclus).
