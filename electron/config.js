const path = require('path');
const base = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'WiseCybersecurity');
module.exports = {
  API: 'https://wise.alwaysdata.net/wisecyb/api',
  BASE: base, SIGS: path.join(base, 'signatures'), QUAR: path.join(base, 'Quarantine'), LOGS: path.join(base, 'logs'), STATE: path.join(base, 'state'),
  ROLLBACK: path.join(base, 'RollbackVault'), ENGINES: path.join(base, 'engines'), BACKUP: path.join(base, 'backups'), TMP: path.join(base, 'tmp'),
  TRIAL_DAYS: 7, UPDATE_CRON: '*/30 * * * *', APP_VERSION: '1.3.0',
  // Clé publique Ed25519 (base64, 32 octets) générée par backend/tools/gen_keys.php. Vide = signature non vérifiée (déconseillé en production).
  PUBKEY: '',
  HIBP: 'https://api.pwnedpasswords.com/range/',
  CLAM_PORT: 3310
};
