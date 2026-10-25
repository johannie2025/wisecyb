// [fr, es, en]
const K = {
  // navigation
  overview: ["Vue d'ensemble", 'Resumen', 'Overview'], scan: ['Analyse', 'Análisis', 'Scan'], engines: ['Moteurs', 'Motores', 'Engines'], firewall: ['Pare-feu', 'Cortafuegos', 'Firewall'],
  adware: ['Anti-Adware', 'Anti-Adware', 'Anti-Adware'], cleaner: ['Nettoyeur', 'Limpieza', 'Cleaner'], network: ['Réseau & VPN', 'Red y VPN', 'Network & VPN'], privacy: ['Confidentialité', 'Privacidad', 'Privacy'],
  license: ['Licence', 'Licencia', 'License'], tools: ['Diagnostic', 'Diagnóstico', 'Diagnostics'], settings: ['Paramètres', 'Ajustes', 'Settings'],
  // overview
  secure: ['Votre PC est protégé', 'Tu PC está protegido', 'Your PC is protected'], alert: ['Menace détectée', 'Amenaza detectada', 'Threat detected'], warn: ['Attention requise', 'Atención requerida', 'Attention required'],
  update: ['Mettre à jour', 'Actualizar', 'Update now'], version: ['Version', 'Versión', 'Version'], last: ['Dernière synchro', 'Última sincronización', 'Last sync'], journal: ['Journal', 'Registro', 'Log'],
  scanned: ['Fichiers analysés', 'Archivos analizados', 'Files scanned'], threats: ['Menaces', 'Amenazas', 'Threats'], quarantined: ['En quarantaine', 'En cuarentena', 'Quarantined'],
  realtime: ['Protection temps réel', 'Protección en tiempo real', 'Real-time protection'], ransom: ['Anti-ransomware', 'Anti-ransomware', 'Anti-ransomware'], usbAuto: ['Désinfection auto des clés USB', 'Desinfección automática de USB', 'Auto-disinfect USB drives'],
  webshield: ['Filtrage DNS anti-phishing', 'Filtro DNS anti-phishing', 'Anti-phishing DNS filter'], dismiss: ['OK, compris', 'OK, entendido', 'OK, got it'],
  // scan
  quick: ['Analyse rapide', 'Análisis rápido', 'Quick scan'], full: ['Analyse complète', 'Análisis completo', 'Full scan'], choose: ['Choisir un dossier', 'Elegir carpeta', 'Choose folder'],
  procScan: ['Analyser les processus actifs', 'Analizar procesos activos', 'Scan running processes'], cancel: ['Annuler', 'Cancelar', 'Cancel'], restore: ['Restaurer', 'Restaurar', 'Restore'], del: ['Supprimer', 'Eliminar', 'Delete'],
  unhide: ['Désinfecter', 'Desinfectar', 'Disinfect'], noThreat: ['Aucune menace détectée', 'Ninguna amenaza detectada', 'No threats found'], filesPerSec: ['fichiers/s', 'archivos/s', 'files/s'],
  // engines
  clamTitle: ['Moteur ClamAV', 'Motor ClamAV', 'ClamAV engine'], yaraTitle: ['Moteur YARA', 'Motor YARA', 'YARA engine'], install: ['Installer', 'Instalar', 'Install'], uninstall: ['Désinstaller', 'Desinstalar', 'Uninstall'],
  notInstalled: ['Non installé', 'No instalado', 'Not installed'], installed: ['Installé', 'Instalado', 'Installed'], updateDb: ['Mettre à jour la base', 'Actualizar base', 'Update database'], rebuild: ['Recompiler', 'Recompilar', 'Rebuild'],
  running: ['En cours d\'exécution', 'En ejecución', 'Running'], stopped: ['Arrêté', 'Detenido', 'Stopped'], start2: ['Démarrer', 'Iniciar', 'Start'], stop: ['Arrêter', 'Detener', 'Stop'], rulesCompiled: ['Règles compilées', 'Reglas compiladas', 'Compiled rules'],
  verifiedBy: ['Vérifié par', 'Verificado por', 'Verified via'], defenderStatus: ['Microsoft Defender (coexiste avec WiseCyb)', 'Microsoft Defender (coexiste con WiseCyb)', 'Microsoft Defender (coexists with WiseCyb)'],
  sigs: ['Signatures', 'Firmas', 'Signatures'], rules: ['Règles YARA', 'Reglas YARA', 'YARA rules'], hashes: ['Hashes', 'Hashes', 'Hashes'], domains: ['Domaines bloqués', 'Dominios bloqueados', 'Blocked domains'], import: ['Importer', 'Importar', 'Import'],
  // firewall
  rulesTab: ['Règles', 'Reglas', 'Rules'], portsTab: ['Ports ouverts', 'Puertos abiertos', 'Open ports'], connsTab: ['Connexions', 'Conexiones', 'Connections'], idsTab: ['Anti-intrusion', 'Anti-intrusión', 'Intrusion detection'],
  addRule: ['Bloquer une application', 'Bloquear una aplicación', 'Block an application'], blockIpBtn: ['Bloquer une IP', 'Bloquear una IP', 'Block an IP'], blockPortBtn: ['Bloquer un port', 'Bloquear un puerto', 'Block a port'],
  talosSync: ['Synchroniser la liste Talos', 'Sincronizar lista Talos', 'Sync Talos list'], talosApplied: ['adresses bloquées', 'direcciones bloqueadas', 'addresses blocked'], exposed: ['Exposé au réseau', 'Expuesto a la red', 'Network-exposed'],
  // adware
  adwScan: ['Lancer l\'analyse', 'Iniciar análisis', 'Run scan'], browserHijack: ['Détournements de navigateur', 'Secuestros de navegador', 'Browser hijacks'], hostsFile: ['Fichier hosts', 'Archivo hosts', 'Hosts file'],
  proxyHijack: ['Proxy détourné', 'Proxy secuestrado', 'Hijacked proxy'], pupProgs: ['Programmes indésirables', 'Programas no deseados', 'Unwanted programs'], fixSelected: ['Corriger la sélection', 'Corregir selección', 'Fix selected'], cleanAll: ['Aucun problème — tout est propre', 'Sin problemas — todo limpio', 'No issues — all clean'],
  // cleaner
  analyze: ['Analyser', 'Analizar', 'Analyze'], cleanBtn: ['Nettoyer la sélection', 'Limpiar selección', 'Clean selected'], closeBrowsers: ['Fermer les navigateurs avant nettoyage', 'Cerrar navegadores antes de limpiar', 'Close browsers before cleaning'],
  registryTab: ['Registre', 'Registro', 'Registry'], startupTab: ['Démarrage', 'Inicio', 'Startup'], uninstTab: ['Programmes', 'Programas', 'Programs'], swTab: ['Logiciels', 'Software', 'Software'], freed: ['libérés', 'liberados', 'freed'],
  disable: ['Désactiver', 'Desactivar', 'Disable'], enable: ['Activer', 'Activar', 'Enable'], uninstallBtn: ['Désinstaller', 'Desinstalar', 'Uninstall'], silent: ['Silencieux quand possible', 'Silenciosa cuando sea posible', 'Silent when possible'], upgradeAll: ['Tout mettre à jour', 'Actualizar todo', 'Upgrade all'],
  // network
  wifi: ['Sécurité Wi-Fi', 'Seguridad Wi-Fi', 'Wi-Fi security'], devices: ['Appareils sur le réseau', 'Dispositivos en la red', 'Devices on network'], vpn: ['VPN', 'VPN', 'VPN'], connect: ['Connecter', 'Conectar', 'Connect'],
  disconnect: ['Déconnecter', 'Desconectar', 'Disconnect'], killsw: ['Kill Switch', 'Kill Switch', 'Kill Switch'], installVpn: ['Installer OpenVPN', 'Instalar OpenVPN', 'Install OpenVPN'], restoreNet: ['Rétablir le réseau', 'Restablecer la red', 'Restore network'],
  safe: ['Safe Money (navigateur isolé)', 'Safe Money (navegador aislado)', 'Safe Money (isolated browser)'], open: ['Ouvrir', 'Abrir', 'Open'], refreshList: ['Actualiser la liste', 'Actualizar lista', 'Refresh list'],
  // privacy
  vault: ['Gestionnaire de mots de passe', 'Gestor de contraseñas', 'Password manager'], master: ['Mot de passe maître (8+)', 'Contraseña maestra (8+)', 'Master password (8+)'], create: ['Créer le coffre', 'Crear bóveda', 'Create vault'],
  unlock: ['Déverrouiller', 'Desbloquear', 'Unlock'], lock: ['Verrouiller', 'Bloquear', 'Lock'], add: ['Ajouter', 'Añadir', 'Add'], title: ['Titre', 'Título', 'Title'], user: ['Identifiant', 'Usuario', 'Username'],
  secret: ['Mot de passe', 'Contraseña', 'Password'], gen: ['Générer', 'Generar', 'Generate'], audit: ['Auditer le coffre', 'Auditar bóveda', 'Audit vault'], reveal: ['Afficher', 'Mostrar', 'Show'], copy: ['Copier', 'Copiar', 'Copy'],
  leak: ['Vérificateur de fuites', 'Verificador de filtraciones', 'Data leak checker'], checkPwd: ['Tester un mot de passe', 'Probar contraseña', 'Test a password'], checkMail: ['Tester un e-mail', 'Probar correo', 'Test an email'],
  clean0: ['Aucune fuite connue', 'Sin filtraciones conocidas', 'No known leak'], leaked: ['Trouvé dans des fuites', 'Encontrado en filtraciones', 'Found in leaks'], stalker: ['Stalkerware / keylogger', 'Stalkerware / keylogger', 'Stalkerware / keylogger'],
  run: ['Lancer', 'Iniciar', 'Run'], urlcheck: ['Vérifier un lien', 'Verificar enlace', 'Check a link'], webcam: ['Bloquer la webcam', 'Bloquear webcam', 'Block webcam'], mic: ['Bloquer le micro', 'Bloquear micrófono', 'Block microphone'],
  // license
  activate: ['Activer', 'Activar', 'Activate'], days: ['jours restants', 'días restantes', 'days left'], trial: ['Essai gratuit', 'Prueba gratuita', 'Free trial'], expired: ['Expiré — modules restreints', 'Caducada — módulos restringidos', 'Expired — modules restricted'], licensed: ['Licence active', 'Licencia activa', 'License active'],
  // diag / backup
  diagRun: ['Lancer le diagnostic', 'Ejecutar diagnóstico', 'Run diagnostics'], diagHelp: ['Si une mise à jour échoue, lancez ce diagnostic : chaque étape est testée séparément.', 'Si una actualización falla, ejecute este diagnóstico: cada paso se prueba por separado.', "If an update fails, run this diagnostic: each step is tested separately."],
  backups: ['Sauvegardes', 'Copias de seguridad', 'Backups'], noBackup: ['Aucune sauvegarde', 'Sin copias de seguridad', 'No backups'],
  // settings
  scheduled: ['Analyse quotidienne planifiée', 'Análisis diario programado', 'Daily scheduled scan'], gaming: ['Mode Jeu / Ne pas déranger', 'Modo juego / No molestar', 'Gaming / Do-not-disturb mode'],
  hibp: ['Clé API HIBP (vérif. e-mail)', 'Clave API HIBP (correo)', 'HIBP API key (email check)'], exclusions: ['Exclusions (un chemin par ligne)', 'Exclusiones (una ruta por línea)', 'Exclusions (one path per line)'], save: ['Enregistrer', 'Guardar', 'Save'],
  cfa: ['Dossiers protégés Windows (Defender)', 'Carpetas protegidas de Windows (Defender)', 'Windows Controlled Folder Access'], talosIpsOpt: ['Bloquer les IP malveillantes (Talos)', 'Bloquear IP maliciosas (Talos)', 'Block malicious IPs (Talos)'],
  clamOpt: ['Activer le moteur ClamAV (clamd)', 'Activar motor ClamAV (clamd)', 'Enable ClamAV engine (clamd)'],
};
export const T = { fr: {}, es: {}, en: {} };
Object.entries(K).forEach(([k, [f, s, e]]) => { T.fr[k] = f; T.es[k] = s; T.en[k] = e; });
const X = { ids: ['Anti-intrusion', 'Anti-intrusión', 'Intrusion detection'], rollback: ['Retour arrière anti-ransomware', 'Reversión anti-ransomware', 'Ransomware rollback'], snap: ['Créer un instantané', 'Crear instantánea', 'Create snapshot'],
  startup: ['Démarrage', 'Inicio', 'Startup'], clean: ['Nettoyer', 'Limpiar', 'Clean'], noItems: ['Rien à afficher — lancez une analyse', 'Nada que mostrar — inicie un análisis', 'Nothing to show — run a scan'], selected: ['sélectionné(s)', 'seleccionado(s)', 'selected'],
  restoreBackup: ['Restaurer', 'Restaurar', 'Restore'], issues: ['problème(s)', 'problema(s)', 'issue(s)'], lastErr: ['Dernière erreur', 'Último error', 'Last error'], runningNow: ['En cours…', 'En curso…', 'Running…'], done: ['Terminé', 'Terminado', 'Done'] };
Object.entries(X).forEach(([k, [f, s, e]]) => { T.fr[k] = f; T.es[k] = s; T.en[k] = e; });
