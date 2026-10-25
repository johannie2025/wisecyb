import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Database, RefreshCw, Usb, Trash2, Play, FolderOpen, Upload, Archive, Undo2, Cpu, Download, Square, Globe, Activity, Network as Net, Radar, Cog } from 'lucide-react';
import { Card, Toggle, Btn, Bar, Input, Pill, Empty, CheckList, CountUp, ScanRing, useJob, inv, w, fmt, fmtDate } from '../ui.jsx';
import { FileSearch, Archive as Arch, Zap, HardDrive, FolderSearch, CheckCircle2, Clock, Wifi, Loader2 } from 'lucide-react';

export function Overview({ goScan, t, tone, lic, sig, sh, upd, events, setAlertOn, refresh, st, setSt, ransomAlert, setRansomAlert }) {
  const Icon = tone === 'green' ? ShieldCheck : tone === 'red' ? ShieldAlert : ShieldQuestion; const color = { green: 'text-emerald-400', red: 'text-red-400', yellow: 'text-amber-400' }[tone];
  const sw = (k, ch) => (v) => { setSt({ ...st, [k]: v }); inv('settings:set', { [k]: v }); if (ch) inv(ch, v); };
  return <>
    <div className={`relative rounded-2xl overflow-hidden p-6 bg-white border shadow-soft transition-all duration-300 ${tone === 'red' ? 'border-red-300' : tone === 'yellow' ? 'border-amber-300' : 'border-blue-200'}`}>
      <div className="absolute -right-10 -top-10 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" /><div className="absolute right-40 bottom-0 w-64 h-64 bg-blue-50 rounded-full blur-2xl pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between gap-6 flex-wrap"><div className="flex items-center gap-6">
        <div className="relative shrink-0"><div className={`absolute inset-0 rounded-2xl blur-xl shield-glow ${tone === 'red' ? 'bg-red-500' : tone === 'yellow' ? 'bg-amber-500' : 'bg-blue-500'}`} /><div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg border border-white/20 ${tone === 'red' ? 'bg-gradient-to-br from-red-500 to-red-800 shake' : tone === 'yellow' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-metallic-blue'}`}><Icon size={44} strokeWidth={2.2} /></div></div>
        <div className="space-y-1"><div className="flex items-center gap-2 flex-wrap"><h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">{tone === 'green' ? t.secure : tone === 'red' ? t.alert : t.warn}</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${tone === 'red' ? 'bg-red-100 text-red-700 border-red-200' : tone === 'yellow' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>{tone === 'green' ? 'OPÉRATIONNEL' : tone === 'red' ? 'ALERTE' : 'ATTENTION'}</span></div>
          <p className="text-xs text-slate-300">{lic && (lic.mode === 'expired' ? t.expired : `${lic.mode === 'trial' ? t.trial : t.licensed} • ${lic.daysLeft} ${t.days}`)}{sh.gaming ? ' · 🎮' : ''}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs pt-2 font-medium"><span className={`flex items-center gap-1.5 font-semibold ${sh.enabled ? 'text-blue-700' : 'text-amber-600'}`}><CheckCircle2 size={14} />{t.realtime}</span><span className="flex items-center gap-1.5 text-slate-400"><Clock size={14} />{t.last}: {fmtDate(sig.lastSync)}</span></div></div></div>
        <div className="flex gap-3">{tone === 'red' && <Btn kind="sec" onClick={() => setAlertOn(false)}>{t.dismiss}</Btn>}<Btn onClick={goScan} className="px-6 py-3.5 text-xs uppercase tracking-wider font-bold"><Play size={14} className="fill-white" />{t.quick}</Btn></div></div></div>
    {ransomAlert && <Card tone="red" className="flex items-center justify-between"><div className="text-red-300 text-sm">{t.ransom}: {ransomAlert.file}</div><Btn onClick={async () => { await inv('rollback:restore'); setRansomAlert(null); }}><Undo2 size={14} />{t.restore}</Btn></Card>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[[t.scanned, sh.stats.scanned || 0, FileSearch, 'bg-blue-50 text-blue-600 border-blue-100'], [t.threats, sh.stats.threats || 0, ShieldCheck, 'bg-emerald-50 text-emerald-600 border-emerald-100'], [t.quarantined, sh.stats.quarantined || 0, Arch, 'bg-amber-50 text-amber-600 border-amber-100'], [t.version, null, Database, 'bg-slate-800 text-slate-300 border-slate-700']].map(([k, v, I, c], i) =>
      <div key={k} style={{ animationDelay: i * 70 + 'ms' }} className="fade-in lift bg-white p-4 rounded-2xl border border-slate-700 shadow-card"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k}</p>
        {v === null ? <p className="text-xs font-bold text-blue-700 mt-2 font-mono truncate">{sig.version || '-'}</p> : <CountUp value={v} className="block text-2xl font-black text-slate-100 mt-1 font-mono" />}</div><div className={`p-2.5 rounded-xl border ${c}`}><I size={20} /></div></div></div>)}</div>
    <div className="grid grid-cols-2 gap-4">
      <Card><div className="flex items-center justify-between mb-3"><div className="font-semibold flex items-center gap-2"><Database size={16} />{t.sigs}</div><Btn onClick={() => inv('update:check')} disabled={upd.running}><RefreshCw size={14} className={upd.running ? 'animate-spin' : ''} />{t.update}</Btn></div>
        <div className="text-xs text-slate-400 space-y-1"><div>{t.version}: {sig.version}</div><div>{t.last}: {fmtDate(sig.lastSync)}</div>{sig.lastError && <div className="text-amber-400">{sig.lastError.hint || sig.lastError.code}</div>}</div>
        {upd.running && <div className="mt-3"><Bar pct={upd.pct} /><div className="text-xs mt-1 text-cyan-300">{upd.msg}</div></div>}</Card>
      <Card><Toggle label={t.realtime} on={sh.enabled} onChange={async v => { await inv('shield:toggle', v); refresh(); }} />
        <Toggle label={t.ransom} on={st.ransom} onChange={sw('ransom')} /><Toggle label={t.usbAuto} on={st.usbAuto} onChange={sw('usbAuto')} /><Toggle label={t.webshield} on={st.web} onChange={sw('web', 'web:block')} /></Card></div>
    <Card><div className="font-semibold mb-2">{t.journal}</div><div className="space-y-1 max-h-56 overflow-y-auto text-xs font-mono">{events.length === 0 && <div className="text-slate-500">—</div>}
      {events.map((e, i) => <div key={i} className={`slide-in ${e.k === 'threat' || e.k === 'ransom' ? 'text-red-400' : e.k === 'ids' ? 'text-amber-300' : 'text-cyan-300'}`}>[{e.k}] {e.threat || e.type || e.drive || ''} {e.file || e.source || e.ip || ''}</div>)}</div></Card>
  </>;
}

export function Scan({ t, toast }) {
  const job = useJob('scan.path'); const pj = useJob('scan.processes'); const [q, setQ] = useState([]); const [drives, setDrives] = useState([]); const cur = job.running ? job : pj;
  const loadQ = async () => setQ((await inv('quarantine:list')) || []);
  useEffect(() => { loadQ(); inv('usb:list').then(d => setDrives(d || [])); }, []);
  useEffect(() => { if (job.done || pj.done) { loadQ(); const r = job.result || pj.result; if (r && r.found) toast(`${t.threats}: ${r.found}`, 'err'); else if (!job.error && !pj.error) toast(t.noThreat); } }, [job.done, pj.done]);
  const run = (p) => p && job.start(p); const busy = job.running || pj.running; const r = (job.done && job.result) || (pj.done && pj.result);
  const modes = [[Zap, t.quick, 'bg-blue-50 text-blue-600', async () => run((await inv('app:paths')).user), 'primary'], [HardDrive, t.full, 'bg-blue-50 text-blue-700', () => run('C:\\'), 'dark'], [FolderSearch, t.choose, 'bg-slate-800 text-slate-300', async () => run(await inv('scan:pick')), 'sec'], [Activity, t.procScan, 'bg-emerald-50 text-emerald-600', () => pj.start(), 'sec']];
  return <>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{modes.map(([I, l, c, f, k], i) => <div key={l} style={{ animationDelay: i * 70 + 'ms' }} className="fade-in lift bg-white p-5 rounded-2xl border border-slate-700 shadow-card flex flex-col justify-between h-44"><div><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c}`}><I size={20} /></div><h3 className="font-bold text-slate-100 text-sm">{l}</h3></div>
      <Btn kind={k === 'dark' ? 'sec' : k} disabled={busy} onClick={f} className="w-full justify-center uppercase tracking-wider text-xs font-bold">{t.run}</Btn></div>)}</div>
    {busy && <div className="relative overflow-hidden bg-white p-6 rounded-2xl border border-blue-300 shadow-soft scanline slide-in"><div className="flex items-center gap-6"><ScanRing pct={cur.pct} />
      <div className="flex-1 min-w-0 space-y-3"><div className="flex items-center justify-between"><h4 className="font-bold text-slate-100 text-sm flex items-center gap-2"><Loader2 size={16} className="animate-spin text-blue-600" />WiseCyber — {t.runningNow}</h4><Btn kind="danger" onClick={() => cur.cancel()}><Square size={14} />{t.cancel}</Btn></div>
        <div className="text-xs text-slate-400 font-mono truncate">{cur.msg}</div><Bar pct={cur.pct} height="h-2.5" /><div className="flex justify-between text-xs text-slate-400 font-mono"><span>{t.scanned}: <b className="text-slate-100">{cur.data && cur.data.done != null ? cur.data.done.toLocaleString() : '…'}</b></span><span>{t.threats}: <b className="text-blue-600">{cur.data && cur.data.found != null ? cur.data.found : 0}</b></span></div></div></div></div>}
    {!busy && r && r.total != null && <Card tone={r.found ? 'red' : 'green'} className="slide-in flex items-center gap-4">{r.found ? <ShieldAlert size={36} className="text-red-500 shake" /> : <CheckCircle2 size={36} className="text-emerald-500 check-pop" />}<div><div className={`font-bold ${r.found ? 'text-red-600' : 'text-emerald-600'}`}>{r.found ? `${t.threats}: ${r.found}` : t.noThreat}</div><div className="text-xs text-slate-400 font-mono">{r.scanned}/{r.total} · {(r.ms / 1000).toFixed(1)}s</div></div></Card>}
    {!busy && r && Array.isArray(r.threats) && r.threats.map((x, i) => <div key={i} className="text-xs text-red-600 truncate slide-in">{x.threat || x.name} — {x.file || x.path}</div>)}
    <Card><div className="font-semibold mb-3 flex items-center gap-2"><Usb size={16} />USB</div>{drives.length === 0 && <div className="text-xs text-slate-500">—</div>}
      {drives.map(d => <div key={d.DeviceID} className="flex items-center justify-between py-1.5 text-sm"><span>{d.DeviceID} {d.VolumeName || ''}</span><Btn kind="sec" onClick={async () => { await inv('usb:disinfect', d.DeviceID); toast(t.done); }}><Trash2 size={14} />{t.unhide}</Btn></div>)}</Card>
    <Card><div className="font-semibold mb-3 flex items-center gap-2"><Archive size={16} />{t.quarantined}</div>{q.length === 0 && <Empty icon={Archive} text="—" />}
      {q.map(m => <div key={m.id} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800 fade-in"><div className="min-w-0"><div className="text-red-300">{m.threat}</div><div className="truncate text-slate-500">{m.original}</div></div><div className="flex gap-2"><Btn kind="sec" onClick={async () => { await inv('quarantine:restore', m.id); loadQ(); }}>{t.restore}</Btn><Btn kind="sec" onClick={async () => { await inv('quarantine:delete', m.id); loadQ(); }}>{t.del}</Btn></div></div>)}</Card>
  </>;
}

function Engine({ title, icon: Icon, s, children, tone }) {
  return <Card tone={tone}><div className="flex items-center justify-between mb-3"><div className="font-semibold flex items-center gap-2"><Icon size={16} />{title}</div>
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.installed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{s.label}</span></div>{children}</Card>;
}
export function Engines({ t, toast, st, setSt }) {
  const [s, setS] = useState({ clam: {}, yara: {} }); const [def, setDef] = useState(null); const ji = useJob('engines.install'); const ju = useJob('engines.clamUpdate'); const jy = useJob('engines.yaraRebuild');
  const load = async () => { setS((await inv('engines:status')) || { clam: {}, yara: {} }); const d = await inv('defender:status'); setDef(d && d.defender ? d : null); }; useEffect(() => { load(); }, []);
  useEffect(() => { if (ji.done || ju.done || jy.done) { load(); const e = ji.error || ju.error || jy.error; if (e) toast(e, 'err'); } }, [ji.done, ju.done, jy.done]);
  const c = s.clam || {}, y = s.yara || {}; const busyI = ji.running; const Prog = ({ j }) => j.running ? <div className="mt-3"><Bar pct={j.pct} /><div className="text-xs text-cyan-300 mt-1 truncate">{j.msg}</div></div> : null;
  const sw = (k, ch) => (v) => { setSt({ ...st, [k]: v }); inv('settings:set', { [k]: v }); };
  return <>
    <Engine title={t.clamTitle} icon={Cpu} s={{ installed: c.installed, label: c.installed ? (c.running ? t.running : t.installed) : t.notInstalled }} tone={c.ready ? 'green' : 'none'}>
      <div className="text-xs text-slate-400 space-y-1 mb-3"><div>{t.version}: {c.version || c.tag || '—'} {c.signatures ? `· ${t.sigs}: ${c.signatures}` : ''}</div>{c.verified && <div>{t.verifiedBy}: {c.verified}</div>}{c.error && <div className="text-amber-400">{String(c.error)}</div>}</div>
      <div className="flex gap-2 flex-wrap">{!c.installed ? <Btn busy={busyI} onClick={() => ji.start('clam')}><Download size={14} />{t.install}</Btn> : <>
        <Btn busy={ju.running} onClick={() => ju.start()}><RefreshCw size={14} />{t.updateDb}</Btn>
        {c.running ? <Btn kind="sec" onClick={async () => { await inv('engines:clamStop'); load(); }}><Square size={14} />{t.stop}</Btn> : <Btn kind="sec" disabled={!c.dbPresent} onClick={async () => { await inv('engines:clamStart'); load(); }}><Play size={14} />{t.start2}</Btn>}
        <Btn kind="ghost" onClick={async () => { await inv('engines:uninstall', 'clam'); load(); }}><Trash2 size={14} />{t.uninstall}</Btn></>}</div>
      <Prog j={ji} /><Prog j={ju} /><div className="mt-3"><Toggle label={t.clamOpt} on={!!st.clam} disabled={!c.installed} onChange={async v => { sw('clam')(v); if (v) await inv('engines:clamStart'); else await inv('engines:clamStop'); load(); }} /></div></Engine>
    <Engine title={t.yaraTitle} icon={Radar} s={{ installed: y.installed, label: y.installed ? t.installed : t.notInstalled }} tone={y.compiled ? 'green' : 'none'}>
      <div className="text-xs text-slate-400 space-y-1 mb-3"><div>{t.version}: {y.tag || '—'}</div><div>{t.rulesCompiled}: {y.rules || 0}{y.skipped ? ` (−${y.skipped})` : ''} · {fmtDate(y.built)}</div>{y.verified && <div>{t.verifiedBy}: {y.verified}</div>}</div>
      <div className="flex gap-2">{!y.installed ? <Btn busy={busyI} onClick={() => ji.start('yara')}><Download size={14} />{t.install}</Btn> : <><Btn busy={jy.running} onClick={() => jy.start()}><RefreshCw size={14} />{t.rebuild}</Btn><Btn kind="ghost" onClick={async () => { await inv('engines:uninstall', 'yara'); load(); }}><Trash2 size={14} />{t.uninstall}</Btn></>}</div>
      <Prog j={ji} /><Prog j={jy} /></Engine>
    {def && <Card><div className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck size={16} />{t.defenderStatus}</div><div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
      {[['AMServiceEnabled', 'Service'], ['RealTimeProtectionEnabled', t.realtime], ['AntivirusSignatureVersion', t.sigs]].map(([k, l]) => <div key={k}><div className="text-slate-500">{l}</div><div className={def.defender[k] === false ? 'text-amber-400' : 'text-slate-200'}>{String(def.defender[k] ?? '—')}</div></div>)}</div></Card>}
  </>;
}

export function Firewall({ t, toast, st, setSt, sig }) {
  const [sub, setSub] = useState('rules'); const [rules, setRules] = useState([]); const [prof, setProf] = useState([]); const [ports, setPorts] = useState([]); const [conns, setConns] = useState([]); const [ids, setIds] = useState([]); const [info, setInfo] = useState({}); const [ip, setIp] = useState(''); const [port, setPort] = useState(''); const [load, setLoad] = useState(false); const sync = useJob('fw.ipSync');
  const loadRules = async () => { setRules((await inv('fw:rules')) || []); setProf((await inv('fw:status')) || []); setInfo((await inv('fw:ipInfo')) || {}); };
  const refreshSub = async (s = sub) => { setLoad(true); if (s === 'ports') setPorts((await inv('fw:ports')) || []); if (s === 'conns') setConns((await inv('fw:connections')) || []); if (s === 'ids') setIds((await inv('fw:ids')) || []); setLoad(false); };
  useEffect(() => { loadRules(); }, []); useEffect(() => { refreshSub(); }, [sub]); useEffect(() => { if (sync.done) loadRules(); }, [sync.done]);
  const add = async () => { const p = await inv('fw:pick'); if (!p) return; const name = p.split('\\').pop().replace('.exe', '').replace(/[^\w\-. ]/g, ''); await inv('fw:block', { name, program: p, direction: 'both' }); loadRules(); };
  const on = prof.length > 0 && prof.every(p => p.Enabled === true || p.Enabled === 1);
  return <>
    <Card tone={on ? 'green' : 'red'} glow><Toggle label={t.firewall + ' (Domain / Private / Public)'} on={on} onChange={async v => { await inv('fw:enable', v); loadRules(); }} />
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400"><span>Talos : {info.count || 0} {t.talosApplied}{info.applied ? ' ✓' : ''}</span><Btn kind="sec" busy={sync.running} onClick={() => sync.start()}><RefreshCw size={14} />{t.talosSync}</Btn></div>
      {sync.running && <div className="mt-2"><Bar pct={sync.pct} /></div>}</Card>
    <div className="flex gap-2">{[['rules', t.rulesTab], ['ports', t.portsTab], ['conns', t.connsTab], ['ids', t.idsTab]].map(([k, l]) => <Pill key={k} active={sub === k} onClick={() => setSub(k)}>{l}</Pill>)}</div>
    {sub === 'rules' && <Card><div className="flex gap-2 flex-wrap mb-3"><Btn onClick={add}>{t.addRule}</Btn><Input value={ip} onChange={e => setIp(e.target.value)} placeholder="1.2.3.4" className="w-36" /><Btn kind="sec" disabled={!ip} onClick={async () => { const r = await inv('fw:blockIp', ip); toast(r && r.ok === false ? r.error : t.done, r && r.ok === false ? 'err' : 'ok'); setIp(''); loadRules(); }}>{t.blockIpBtn}</Btn>
      <Input value={port} onChange={e => setPort(e.target.value)} placeholder="445" className="w-24" /><Btn kind="sec" disabled={!port} onClick={async () => { const r = await inv('fw:blockPort', +port, 'TCP'); toast(r && r.ok === false ? r.error : t.done, r && r.ok === false ? 'err' : 'ok'); setPort(''); loadRules(); }}>{t.blockPortBtn}</Btn></div>
      {rules.length === 0 && <Empty icon={Net} text="—" />}
      {rules.map(r => <div key={r.Name} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800"><div><div>{r.Name}</div><div className="text-slate-500 truncate max-w-md">{r.Direction} · {r.Action} · {r.Program}</div></div>
        <div className="flex items-center gap-3"><Toggle label="" on={r.Enabled === 'True'} onChange={async v => { await inv('fw:toggle', r.Name, v); loadRules(); }} /><Btn kind="sec" onClick={async () => { await inv('fw:remove', r.Name); loadRules(); }}><Trash2 size={14} /></Btn></div></div>)}</Card>}
    {sub === 'ports' && <Card><div className="flex justify-between mb-2"><div className="font-semibold">{t.portsTab}</div><Btn kind="sec" busy={load} onClick={() => refreshSub()}><RefreshCw size={14} /></Btn></div>
      {ports.map(p => <div key={p.port + '|' + p.pid} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800 fade-in"><div><span className="font-mono text-cyan-300">{p.port}</span> · {p.name || '?'} <span className="text-slate-500">PID {p.pid} · {p.addr}</span>{p.risky && <div className="text-amber-400">{p.risky}</div>}</div>
        <div className="flex items-center gap-2">{p.exposed && <span className="text-[10px] text-amber-300">{t.exposed}</span>}<Btn kind="sec" onClick={async () => { await inv('fw:blockPort', p.port, 'TCP'); toast(t.done); loadRules(); }}>{t.blockPortBtn}</Btn></div></div>)}</Card>}
    {sub === 'conns' && <Card><div className="flex justify-between mb-2"><div className="font-semibold">{t.connsTab}</div><Btn kind="sec" busy={load} onClick={() => refreshSub()}><RefreshCw size={14} /></Btn></div>
      {conns.map((c, i) => <div key={i} className={`flex items-center justify-between py-1.5 text-xs border-b border-slate-800 ${c.bad ? 'text-red-400' : ''}`}><div><span>{c.name}</span> <span className="text-slate-500 font-mono">{c.remote}:{c.rport}</span></div>{!c.priv && !c.bad && <Btn kind="ghost" onClick={async () => { await inv('fw:blockIp', c.remote); toast(t.done); }}>{t.blockIpBtn}</Btn>}{c.bad && <span>Talos</span>}</div>)}</Card>}
    {sub === 'ids' && <Card><div className="flex justify-between mb-2"><div className="font-semibold">{t.idsTab}</div><Btn kind="sec" busy={load} onClick={() => refreshSub()}><RefreshCw size={14} /></Btn></div><div className="text-xs text-slate-500 mb-2">RDP brute-force · Port scan · ARP spoofing</div>
      {ids.length === 0 ? <div className="text-sm text-emerald-400">{t.noThreat}</div> : ids.map((x, i) => <div key={i} className="text-xs text-amber-300 py-1">{x.type} {x.source || x.ip || ''} {x.detail || ''}</div>)}</Card>}
  </>;
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
