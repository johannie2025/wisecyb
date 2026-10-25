// Windows Defender : lecture seule. WiseCybersecurity fonctionne EN PARALLÈLE de Defender (défense en profondeur) ;
// il ne le désactive pas et ne contourne pas la Protection contre les falsifications. Windows bascule Defender en mode passif tout seul
// uniquement pour un antivirus enregistré auprès de Microsoft (programme MVI).
const { psJson } = require('./util');
async function status() {
  const mp = (await psJson('Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,IsTamperProtected,AMRunningMode,AntivirusSignatureLastUpdated | ConvertTo-Json -Compress'))[0] || null;
  const av = await psJson("Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct | Select-Object displayName | ConvertTo-Json -Compress");
  return { defender: mp, products: av.map(x => x.displayName).filter(Boolean) };
}
module.exports = { status };
