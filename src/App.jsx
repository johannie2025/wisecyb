import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Flame, ScanSearch, Database, KeyRound, Gauge, Globe2, Lock, Settings as Cog } from 'lucide-react';
import { T } from './i18n.js';
import { w, inv } from './ui.jsx';
import { Overview, Scan, Firewall, Sigs, License, Optimize } from './tabs/Core.jsx';
import { Network, Privacy, Settings } from './tabs/Extra.jsx';

export default function App() {
  const [lang, setLang] = useState('fr'); const t = T[lang]; const [tab, setTab] = useState('overview');
  const [lic, setLic] = useState(null); const [sig, setSig] = useState({}); const [sh, setSh] = useState({ enabled: true, stats: {} }); const [st, setSt] = useState({ ransom: true, usbAuto: true, web: false, cam: false, mic: false, scheduled: true, gaming: true, cfa: false, exclusions: [], hibpKey: '' });
  const [upd, setUpd] = useState(null); const [events, setEvents] = useState([]); const [alertOn, setAlertOn] = useState(false); const [ransomAlert, setRansomAlert] = useState(null);
  const refresh = useCallback(async () => { setLic(await inv('license:status')); setSig(await inv('update:info')); setSh(await inv('shield:state')); }, []);
  const push = (e) => setEvents(x => [e, ...x].slice(0, 50));
  useEffect(() => {
    refresh(); inv('settings:get').then(s => { if (s && s.lang) { setSt(s); setLang(s.lang); } }); const iv = setInterval(refresh, 5000);
    const off = [w.on('update:progress', setUpd), w.on('update:done', i => { setUpd(null); setSig(i); }), w.on('update:error', () => setUpd(null)),
      w.on('threat', e => { setAlertOn(true); push({ k: 'threat', ...e }); }), w.on('ids', e => push({ k: 'ids', ...e })), w.on('ransomware', e => { setAlertOn(true); setRansomAlert(e); push({ k: 'ransom', ...e }); }),
      w.on('usb:done', e => push({ k: 'usb', ...e })), w.on('wifi:new', e => push({ k: 'wifi', type: 'NEW_DEVICE', ...e })), w.on('license', setLic)];
    return () => { clearInterval(iv); off.forEach(f => f && f()); };
  }, [refresh]);
  const expired = lic && !lic.full; const tone = alertOn ? 'red' : expired || sig.version === '0.0.0' ? 'yellow' : 'green';
  const tabs = [['overview', ShieldCheck], ['scan', ScanSearch], ['firewall', Flame], ['network', Globe2], ['privacy', Lock], ['sigs', Database], ['license', KeyRound], ['optimize', Gauge], ['settings', Cog]];
  return (
    <div className="h-screen flex bg-[radial-gradient(ellipse_at_top_left,#0b1d33,#05080f_60%)]">
      <aside className="w-60 bg-slate-950/80 border-r border-slate-800 p-4 flex flex-col gap-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-2 mb-5"><ShieldCheck className="text-cyan-400" /><div><div className="font-bold tracking-wide">Wise<span className="text-cyan-400">Cyber</span></div><div className="text-[10px] text-slate-500">SECURITY SUITE</div></div></div>
        {tabs.map(([id, Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${tab === id ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800/60 border border-transparent'}`}><Icon size={18} />{t[id]}</button>)}
      </aside>
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {tab === 'overview' && <Overview {...{ t, tone, lic, sig, sh, upd, events, setAlertOn, refresh, st, setSt, ransomAlert, setRansomAlert }} />}
        {tab === 'scan' && <Scan t={t} />}{tab === 'firewall' && <Firewall t={t} />}{tab === 'network' && <Network t={t} />}{tab === 'privacy' && <Privacy t={t} st={st} setSt={setSt} />}
        {tab === 'sigs' && <Sigs {...{ t, sig, upd }} />}{tab === 'license' && <License {...{ t, lic, refresh }} />}{tab === 'optimize' && <Optimize t={t} />}{tab === 'settings' && <Settings {...{ t, st, setSt, lang, setLang }} />}
      </main>
    </div>
  );
}
