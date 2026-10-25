import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Flame, ScanSearch, Cpu, Bug, Brush, Globe2, Lock, Settings as Cog, KeyRound, Stethoscope, LayoutDashboard, Bell, Minus, Square, X, Trash2 } from 'lucide-react';
import { T } from './i18n.js';
import { w, inv, useJob, useToasts, Toast } from './ui.jsx';
import { Overview, Scan, Engines, Firewall, License } from './tabs/Core.jsx';
import { Adware } from './tabs/Adware.jsx';
import { CleanerHub } from './tabs/Clean.jsx';
import { Network, Privacy, Settings } from './tabs/Extra.jsx';
import { Diagnostics } from './tabs/Tools.jsx';

export default function App() {
  const [lang, setLang] = useState('fr'); const t = T[lang]; const [tab, setTab] = useState('overview'); const [toasts, toast] = useToasts();
  const [lic, setLic] = useState(null); const [sig, setSig] = useState({}); const [sh, setSh] = useState({ enabled: true, stats: {} });
  const [st, setSt] = useState({ ransom: true, usbAuto: true, web: false, cam: false, mic: false, scheduled: true, gaming: true, cfa: false, clam: false, talosIps: true, exclusions: [], hibpKey: '' });
  const [events, setEvents] = useState([]); const [alertOn, setAlertOn] = useState(false); const [ransomAlert, setRansomAlert] = useState(null); const upd = useJob('update');
  const refresh = useCallback(async () => { setLic(await inv('license:status')); setSig((await inv('update:info')) || {}); setSh((await inv('shield:state')) || { enabled: true, stats: {} }); }, []);
  const push = (e) => setEvents(x => [e, ...x].slice(0, 50));
  useEffect(() => { if (upd.done) { refresh(); if (upd.error) toast(upd.error, 'err'); else toast(t.done); } }, [upd.done]);
  useEffect(() => {
    refresh(); inv('settings:get').then(s => { if (s && s.lang) { setSt(x => ({ ...x, ...s })); setLang(s.lang); } }); const iv = setInterval(refresh, 5000);
    const off = [w.on('threat', e => { setAlertOn(true); push({ k: 'threat', ...e }); toast((e.threat || '') + ' ' + (e.file || ''), 'err'); }), w.on('ids', e => push({ k: 'ids', ...e })),
      w.on('ransomware', e => { setAlertOn(true); setRansomAlert(e); push({ k: 'ransom', ...e }); }), w.on('usb:done', e => push({ k: 'usb', ...e })), w.on('wifi:new', e => push({ k: 'wifi', type: 'NEW_DEVICE', ...e })), w.on('license', setLic)];
    return () => { clearInterval(iv); off.forEach(f => f && f()); };
  }, [refresh]);
  const expired = lic && !lic.full; const tone = alertOn ? 'red' : expired || sig.version === '0.0.0' ? 'yellow' : 'green';
  const tabs = [['overview', LayoutDashboard], ['scan', ScanSearch], ['engines', Cpu], ['firewall', Flame], ['adware', Bug], ['cleaner', Brush], ['network', Globe2], ['privacy', Lock], ['tools', Stethoscope]];
  const [bell, setBell] = useState(false); const P = { t, toast }; const unread = events.filter(e => e.k === 'threat' || e.k === 'ransom' || e.k === 'ids').length;
  const pctLic = lic ? Math.min(100, (lic.daysLeft / (lic.mode === 'trial' ? 7 : 365)) * 100) : 0; const Nav = ({ id, Icon, small }) => <button onClick={() => setTab(id)} className={`group relative w-full flex items-center gap-3 px-3 ${small ? 'py-2 font-medium' : 'py-2.5 font-semibold'} rounded-xl text-xs transition-all duration-200 ${tab === id ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:translate-x-1'}`}>
    {tab === id && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r bg-metallic-blue" />}<Icon size={16} className="transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6" />{t[id]}</button>;
  const drag = { WebkitAppRegion: 'drag' }, nodrag = { WebkitAppRegion: 'no-drag' };
  return (
    <div className="h-screen flex flex-col bg-slate-800/80 font-sans">
      <header style={drag} className="h-10 bg-white border-b border-slate-700 flex items-center justify-between px-4 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5"><ShieldCheck size={16} className="text-blue-600" /><span className="text-xs font-bold tracking-wide uppercase text-slate-100">WiseCyber <span className="text-blue-600">Security Suite</span></span><span className="text-[10px] text-slate-400 font-medium">| Wise Design Edition</span></div>
        <div className={`hidden sm:flex items-center gap-2 text-[11px] px-3 py-0.5 rounded-full border font-bold ${tone === 'red' ? 'bg-red-50 border-red-200 text-red-600' : tone === 'yellow' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-current animate-ping" /><span className="relative w-2 h-2 rounded-full bg-current" /></span>{tone === 'red' ? t.alert : tone === 'yellow' ? t.warn : 'Protection active & surveillée'}</div>
        <div style={nodrag} className="flex items-center gap-3 text-slate-400 relative">
          <button onClick={() => setBell(!bell)} className="hover:text-blue-600 transition-colors relative"><Bell size={16} className={unread ? 'bell-ring text-blue-600' : ''} />{unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white rounded-full text-[9px] leading-[14px] text-center font-bold">{unread}</span>}</button>
          <div className="h-3.5 w-px bg-slate-700" /><button onClick={() => inv('win:min')} className="hover:text-slate-200"><Minus size={14} /></button><button onClick={() => inv('win:max')} className="hover:text-slate-200"><Square size={12} /></button><button onClick={() => inv('win:close')} className="hover:text-red-500"><X size={16} /></button>
          {bell && <div className="absolute right-0 top-8 w-80 bg-white border border-slate-700 rounded-xl shadow-xl p-3 toast-in"><div className="flex justify-between text-xs font-bold text-slate-100 mb-2"><span>{t.journal}</span><button className="text-slate-400 hover:text-slate-200 flex items-center gap-1" onClick={() => { setEvents([]); setAlertOn(false); }}><Trash2 size={12} /></button></div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">{events.length === 0 && <div className="text-xs text-slate-400 text-center py-3">—</div>}{events.map((e, i) => <div key={i} className="text-[11px] p-2 rounded-lg bg-slate-800 border border-slate-700 slide-in"><b className={e.k === 'threat' || e.k === 'ransom' ? 'text-red-600' : 'text-blue-700'}>{e.threat || e.type || e.k}</b> <span className="text-slate-400 truncate block">{e.file || e.source || e.ip || e.drive || ''}</span></div>)}</div></div>}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-slate-700 flex flex-col justify-between p-3 shrink-0 z-20 shadow-sm overflow-y-auto">
          <div className="space-y-5">
            <div className="px-2 py-2 border-b border-slate-800 pb-4"><div className="flex items-center gap-3">
              <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-md float-y shrink-0"><defs><radialGradient id="gg" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#60a5fa" /><stop offset="50%" stopColor="#1d4ed8" /><stop offset="100%" stopColor="#0f172a" /></radialGradient><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="50%" stopColor="#1d4ed8" /><stop offset="100%" stopColor="#1e3a8a" /></linearGradient></defs>
                <circle cx="40" cy="50" r="32" fill="url(#gg)" /><path d="M12 50Q40 20 68 50Q40 80 12 50Z" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" /><path d="M40 18V82M20 30H60M20 70H60" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.2" /><path d="M32 25L46 72L58 38L70 72L86 25" fill="none" stroke="url(#wg)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div><div className="flex items-baseline"><span className="font-extrabold text-slate-100 text-lg tracking-tight">W</span><span className="font-bold text-slate-300 text-base">Design</span></div><p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">WiseCyber Security</p></div></div>
              <p className="text-[9.5px] italic text-slate-400 mt-2 font-medium leading-snug">"L'architecture et l'innovation qui donnent vie à vos idées!"</p></div>
            <nav className="space-y-1">{tabs.map(([id, Icon]) => <Nav key={id} id={id} Icon={Icon} />)}</nav></div>
          <div className="space-y-2 pt-3 border-t border-slate-700 mt-4">
            <Nav id="settings" Icon={Cog} small />
            <button onClick={() => setTab('license')} className="w-full text-left p-3 rounded-xl bg-gradient-to-br from-slate-800 to-blue-50 border border-slate-700 shadow-sm lift">
              <div className="flex items-center justify-between text-xs mb-1.5"><span className="text-slate-200 flex items-center gap-1.5 font-bold"><KeyRound size={14} className="text-blue-600" />Licence Wise</span><span className="text-blue-700 font-bold font-mono bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">{lic ? lic.daysLeft : '…'}j</span></div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2"><div className="bg-metallic-blue h-full rounded-full transition-all duration-700 relative overflow-hidden" style={{ width: pctLic + '%' }}><div className="absolute inset-0 animate-shimmer" /></div></div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium"><span>{lic && lic.mode === 'trial' ? t.trial : 'Pack Innovation'}</span><span className="text-blue-600 font-bold">WhatsApp Support</span></div></button></div>
        </aside>
        <main key={tab} className="flex-1 overflow-y-auto p-6 space-y-5 fade-in">
          {tab === 'overview' && <Overview {...{ ...P, tone, lic, sig, sh, upd, events, setAlertOn, refresh, st, setSt, ransomAlert, setRansomAlert, goScan: () => setTab('scan') }} />}
          {tab === 'scan' && <Scan {...P} />}{tab === 'engines' && <Engines {...P} st={st} setSt={setSt} />}{tab === 'firewall' && <Firewall {...P} st={st} setSt={setSt} sig={sig} />}
          {tab === 'adware' && <Adware {...P} />}{tab === 'cleaner' && <CleanerHub {...P} />}{tab === 'network' && <Network {...P} />}{tab === 'privacy' && <Privacy {...P} st={st} setSt={setSt} />}
          {tab === 'license' && <License {...{ ...P, lic, refresh }} />}{tab === 'tools' && <Diagnostics {...P} sig={sig} upd={upd} />}{tab === 'settings' && <Settings {...{ ...P, st, setSt, lang, setLang }} />}
        </main>
      </div>
      <Toast toasts={toasts} />
    </div>
  );
}
