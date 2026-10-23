import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Database, RefreshCw, Usb, Trash2, Play, FolderOpen, Power, Upload, Archive, Undo2 } from 'lucide-react';
import { Card, Toggle, Btn, Bar, Input, inv, w, fmt } from '../ui.jsx';

export function Overview({ t, tone, lic, sig, sh, upd, events, setAlertOn, refresh, st, setSt, ransomAlert, setRansomAlert }) {
  const Icon = tone === 'green' ? ShieldCheck : tone === 'red' ? ShieldAlert : ShieldQuestion; const color = { green: 'text-emerald-400', red: 'text-red-400', yellow: 'text-amber-400' }[tone];
  const sw = (k, ch, ...a) => (v) => { setSt({ ...st, [k]: v }); inv('settings:set', { [k]: v }); if (ch) inv(ch, v, ...a); };
  return <>
    <Card tone={tone} className="flex items-center gap-6"><Icon size={72} className={`${color} ${tone === 'red' ? 'animate-pulse' : ''}`} />
      <div className="flex-1"><div className={`text-2xl font-bold ${color}`}>{tone === 'green' ? t.secure : tone === 'red' ? t.alert : t.warn}</div>
        <div className="text-sm text-slate-400 mt-1">{lic && (lic.mode === 'expired' ? t.expired : `${lic.mode === 'trial' ? t.trial : t.licensed} · ${lic.daysLeft} ${t.days}`)}{sh.gaming ? ' · 🎮' : ''}</div></div>
      {tone === 'red' && <Btn onClick={() => setAlertOn(false)}>OK</Btn>}</Card>
    {ransomAlert && <Card tone="red" className="flex items-center justify-between"><div className="text-red-300 text-sm">{t.ransom}: {ransomAlert.file}</div><Btn onClick={async () => { await inv('rollback:restore'); setRansomAlert(null); }}><Undo2 size={14} />{t.restore}</Btn></Card>}
    <div className="grid grid-cols-4 gap-4">{[[t.scanned, sh.stats.scanned || 0], [t.threats, sh.stats.threats || 0], [t.quarantined, sh.stats.quarantined || 0], [t.version, sig.version || '-']].map(([k, v]) => <Card key={k}><div className="text-xs text-slate-500">{k}</div><div className="text-2xl font-bold mt-1">{v}</div></Card>)}</div>
    <div className="grid grid-cols-2 gap-4">
      <Card><div className="flex items-center justify-between mb-3"><div className="font-semibold flex items-center gap-2"><Database size={16} />{t.sigs}</div><Btn onClick={() => inv('update:check')} disabled={!!upd}><RefreshCw size={14} className={upd ? 'animate-spin' : ''} />{t.update}</Btn></div>
        <div className="text-xs text-slate-400 space-y-1"><div>{t.version}: {sig.version}</div><div>{t.last}: {sig.lastSync ? new Date(sig.lastSync).toLocaleString() : '—'}</div></div>
        {upd && <div className="mt-3"><Bar pct={upd.pct} /><div className="text-xs mt-1 text-cyan-300">{upd.step}…</div></div>}</Card>
      <Card><Toggle label={t.realtime} on={sh.enabled} onChange={async v => { await inv('shield:toggle', v); refresh(); }} />
        <Toggle label={t.ransom} on={st.ransom} onChange={sw('ransom')} /><Toggle label={t.usbAuto} on={st.usbAuto} onChange={sw('usbAuto')} />
        <Toggle label={t.webshield} on={st.web} onChange={sw('web', 'web:block')} /></Card></div>
    <Card><div className="font-semibold mb-2">{t.journal}</div><div className="space-y-1 max-h-56 overflow-y-auto text-xs font-mono">{events.length === 0 && <div className="text-slate-500">—</div>}
      {events.map((e, i) => <div key={i} className={e.k === 'threat' || e.k === 'ransom' ? 'text-red-400' : e.k === 'ids' ? 'text-amber-300' : 'text-cyan-300'}>[{e.k}] {e.threat || e.type || e.drive || ''} {e.file || e.source || e.ip || ''}</div>)}</div></Card>
  </>;
}

export function Scan({ t }) {
  const [prog, setProg] = useState(null); const [busy, setBusy] = useState(false); const [q, setQ] = useState([]); const [drives, setDrives] = useState([]);
  const loadQ = async () => setQ((await inv('quarantine:list')) || []);
  useEffect(() => { loadQ(); inv('usb:list').then(d => setDrives(d || [])); return w.on('scan:progress', setProg); }, []);
  const run = async (p) => { if (!p) return; setBusy(true); setProg({ done: 0, total: 1, found: 0 }); await inv('scan:path', p); setBusy(false); loadQ(); };
  const quick = async () => run((await inv('app:paths')).user);
  return <>
    <Card className={busy ? 'scanline' : ''}><div className="font-semibold mb-3">{t.scan}</div>
      <div className="flex gap-2 flex-wrap"><Btn onClick={quick} disabled={busy}><Play size={14} />{t.quick}</Btn><Btn onClick={() => run('C:\\')} disabled={busy} kind="sec"><Play size={14} />{t.full}</Btn><Btn kind="sec" disabled={busy} onClick={async () => run(await inv('scan:pick'))}><FolderOpen size={14} />{t.choose}</Btn></div>
      {prog && <div className="mt-4"><Bar pct={Math.round((prog.done / Math.max(prog.total, 1)) * 100)} /><div className="text-xs text-slate-400 mt-1 truncate">{prog.done}/{prog.total} · {t.threats}: {prog.found} · {prog.current}</div></div>}</Card>
    <Card><div className="font-semibold mb-3 flex items-center gap-2"><Usb size={16} />USB</div>{drives.length === 0 && <div className="text-xs text-slate-500">—</div>}
      {drives.map(d => <div key={d.DeviceID} className="flex items-center justify-between py-1.5 text-sm"><span>{d.DeviceID} {d.VolumeName || ''}</span><Btn kind="sec" onClick={() => inv('usb:disinfect', d.DeviceID)}><Trash2 size={14} />{t.unhide}</Btn></div>)}</Card>
    <Card><div className="font-semibold mb-3 flex items-center gap-2"><Archive size={16} />{t.quarantined}</div>
      {q.map(m => <div key={m.id} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800"><div className="min-w-0"><div className="text-red-300">{m.threat}</div><div className="truncate text-slate-500">{m.original}</div></div><div className="flex gap-2"><Btn kind="sec" onClick={async () => { await inv('quarantine:restore', m.id); loadQ(); }}>{t.restore}</Btn><Btn kind="sec" onClick={async () => { await inv('quarantine:delete', m.id); loadQ(); }}>{t.del}</Btn></div></div>)}</Card>
  </>;
}

export function Firewall({ t }) {
  const [rules, setRules] = useState([]); const [prof, setProf] = useState([]);
  const load = async () => { setRules((await inv('fw:rules')) || []); setProf((await inv('fw:status')) || []); }; useEffect(() => { load(); }, []);
  const add = async () => { const p = await inv('fw:pick'); if (!p) return; const name = p.split('\\').pop().replace('.exe', '').replace(/[^\w\-. ]/g, ''); await inv('fw:block', { name, program: p, direction: 'both' }); load(); };
  const on = prof.length > 0 && prof.every(p => p.Enabled === true || p.Enabled === 1);
  return <>
    <Card tone={on ? 'green' : 'red'}><Toggle label={t.firewall + ' (Domain / Private / Public)'} on={on} onChange={async v => { await inv('fw:enable', v); load(); }} /><div className="text-xs text-slate-500">{t.ids}: RDP brute-force · Port scan · ARP spoofing</div></Card>
    <Card><div className="flex justify-between mb-3"><div className="font-semibold">Inbound / Outbound</div><Btn onClick={add}>{t.addRule}</Btn></div>
      {rules.map(r => <div key={r.Name} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800"><div><div>{r.Name}</div><div className="text-slate-500 truncate max-w-md">{r.Direction} · {r.Action} · {r.Program}</div></div>
        <div className="flex items-center gap-3"><Toggle label="" on={r.Enabled === 'True'} onChange={async v => { await inv('fw:toggle', r.Name, v); load(); }} /><Btn kind="sec" onClick={async () => { await inv('fw:remove', r.Name); load(); }}><Trash2 size={14} /></Btn></div></div>)}</Card>
  </>;
}

export function Sigs({ t, sig, upd }) {
  return <Card><div className="font-semibold mb-4 flex items-center gap-2"><Database size={18} />{t.sigs}</div>
    <div className="grid grid-cols-4 gap-4 mb-4">{[[t.version, sig.version], [t.rules, sig.rules || 0], [t.hashes, sig.hashes || 0], [t.domains, sig.domains || 0]].map(([k, v]) => <div key={k}><div className="text-xs text-slate-500">{k}</div><div className="text-xl font-bold">{v}</div></div>)}</div>
    <div className="text-xs text-slate-400 mb-3">{t.last}: {sig.lastSync ? new Date(sig.lastSync).toLocaleString() : '—'}</div>{upd && <div className="mb-3"><Bar pct={upd.pct} /></div>}
    <div className="flex gap-2"><Btn onClick={() => inv('update:check')}><RefreshCw size={14} />{t.update}</Btn><Btn kind="sec" onClick={() => inv('update:import')}><Upload size={14} />{t.import}</Btn></div></Card>;
}

export function License({ t, lic, refresh }) {
  const [key, setKey] = useState(''); const [msg, setMsg] = useState('');
  const go = async () => { const r = await inv('license:activate', key); setMsg(r.ok ? 'OK' : r.error); refresh(); };
  if (!lic) return null; const pct = Math.min(100, (lic.daysLeft / (lic.mode === 'trial' ? 7 : 365)) * 100);
  return <Card tone={lic.mode === 'expired' ? 'red' : 'green'}><div className="font-semibold mb-3">{t.license}</div>
    <div className="text-sm mb-1">{lic.mode === 'expired' ? t.expired : lic.mode === 'trial' ? t.trial : t.licensed} · <b>{lic.daysLeft}</b> {t.days}</div><Bar pct={pct} color={pct < 15 ? 'bg-red-500' : 'bg-emerald-400'} />
    <div className="text-[11px] text-slate-500 mt-2 break-all">HWID: {lic.hwid}</div>
    <div className="flex gap-2 mt-4"><Input value={key} onChange={e => setKey(e.target.value.toUpperCase())} placeholder="WISE-XXXX-YYYY-ZZZZ" className="flex-1 font-mono" /><Btn onClick={go}>{t.activate}</Btn></div>
    {msg && <div className={`text-xs mt-2 ${msg === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</div>}</Card>;
}

export function Optimize({ t }) {
  const [a, setA] = useState(null); const [st, setSt] = useState([]); const [dk, setDk] = useState([]); const [busy, setBusy] = useState(false); const [sw, setSw] = useState('');
  const load = async () => { setA(await inv('opt:analyze')); setSt((await inv('opt:startup')) || []); setDk((await inv('opt:disks')) || []); }; useEffect(() => { load(); }, []);
  return <>
    <Card><div className="flex justify-between items-center"><div><div className="font-semibold">{t.clean}</div><div className="text-xs text-slate-400">{a && a.total != null ? fmt(a.total) : '…'}</div></div><Btn disabled={busy} onClick={async () => { setBusy(true); await inv('opt:clean'); await load(); setBusy(false); }}><Trash2 size={14} />{t.clean}</Btn></div></Card>
    <Card><div className="font-semibold mb-2">{t.startup}</div>{st.map(s => <div key={s.key + s.name} className="flex items-center justify-between py-1 text-xs border-b border-slate-800"><div className="min-w-0"><div>{s.name}</div><div className="truncate text-slate-500">{s.cmd}</div></div><Btn kind="sec" onClick={async () => { await inv('opt:startup:off', { key: s.key, name: s.name }); load(); }}><Power size={14} /></Btn></div>)}</Card>
    <Card><div className="font-semibold mb-2">{t.disks}</div>{dk.map(d => <div key={d.FriendlyName} className="flex justify-between text-sm py-1"><span>{d.FriendlyName} ({d.MediaType})</span><span className={d.HealthStatus === 'Healthy' ? 'text-emerald-400' : 'text-red-400'}>{d.HealthStatus}</span></div>)}</Card>
    <Card><div className="flex gap-2 mb-2"><Btn kind="sec" onClick={async () => setSw(await inv('opt:sw'))}>{t.swupd}</Btn><Btn onClick={() => inv('opt:sw:all')}>winget upgrade --all</Btn></div>{sw && typeof sw === 'string' && <pre className="text-[10px] text-slate-400 max-h-40 overflow-auto">{sw}</pre>}</Card>
  </>;
}
