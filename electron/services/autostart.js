// Démarrage avec privilèges max sans fenêtre UAC à chaque ouverture de session : tâche planifiée ONLOGON / HIGHEST
const { run } = require('./util');
const enable = () => run('schtasks', ['/Create', '/TN', 'WiseCybersecurity', '/TR', `"${process.execPath}" --hidden`, '/SC', 'ONLOGON', '/RL', 'HIGHEST', '/F']);
const disable = () => run('schtasks', ['/Delete', '/TN', 'WiseCybersecurity', '/F']);
const status = async () => (await run('schtasks', ['/Query', '/TN', 'WiseCybersecurity'])).ok;
module.exports = { enable, disable, status };
