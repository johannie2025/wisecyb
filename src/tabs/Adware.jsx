import React, { useState } from 'react';
import { Bug, Globe, FileText, Wifi, Package, Wrench } from 'lucide-react';
import { Card, Btn, Bar, Empty, CheckList, useJob, inv } from '../ui.jsx';

const Sec = ({ icon: Icon, title, n, children }) => <Card tone={n ? 'yellow' : 'none'}><div className="font-semibold mb-2 flex items-center gap-2"><Icon size={16} />{title}{n > 0 && <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 rounded-full">{n}</span>}</div>{children}</Card>;
export function Adware({ t, toast }) {
  const job = useJob('adw.scan'); const [selB, setSelB] = useState(new Set()); const [selP, setSelP] = useState(new Set()); const [busy, setBusy] = useState(false); const [fixed, setFixed] = useState({});
  const r = job.result; const tog = (set, fn) => (id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); fn(n); };
  const total = r ? r.browser.length + r.hosts.length + (r.proxy ? 1 : 0) + r.pups.length : 0;
  const act = async (fn, msg) => { setBusy(true); const x = await fn(); setBusy(false); toast(msg(x || {}), x && x.ok === false ? 'err' : 'ok'); job.start(); };
  return <>
    <Card className={job.running ? 'scanline' : ''}><div className="flex items-center justify-between"><div className="font-semibold flex items-center gap-2"><Bug size={16} />{t.adware}</div><Btn busy={job.running} onClick={() => { setSelB(new Set()); setSelP(new Set()); job.start(); }}>{t.adwScan}</Btn></div>
      {job.running && <div className="mt-3"><Bar pct={job.pct} /><div className="text-xs text-cyan-300 mt-1">{job.msg}</div></div>}
      {r && !job.running && total === 0 && <div className="mt-3 text-emerald-400 text-sm slide-in">{t.cleanAll}</div>}</Card>
    {r && !job.running && total > 0 && <>
      <Sec icon={Globe} title={t.browserHijack} n={r.browser.length}>{r.browser.length === 0 ? <div className="text-xs text-emerald-400">OK</div> : <><CheckList items={r.browser} selected={selB} onToggle={tog(selB, setSelB)} selectAll={selB.size === r.browser.length} onSelectAll={v => setSelB(v ? new Set(r.browser.map(b => b.id)) : new Set())}
        render={b => <div className="text-xs"><div>{b.browser || ''} · <b>{b.type}</b></div><div className="text-slate-500 truncate">{b.value}</div></div>} />
        <div className="mt-2"><Btn disabled={!selB.size || busy} onClick={() => act(() => inv('adw:fixBrowser', [...selB]), x => `${x.fixed || 0} ✓ ${x.note || ''}`)}><Wrench size={14} />{t.fixSelected}</Btn></div></>}</Sec>
      <Sec icon={FileText} title={t.hostsFile} n={r.hosts.length}>{r.hosts.length === 0 ? <div className="text-xs text-emerald-400">OK</div> : <>{r.hosts.map(h => <div key={h.line} className="text-xs py-1"><span className="font-mono text-amber-300">{h.line}</span><div className="text-slate-500">{h.reason}</div></div>)}
        <div className="mt-2"><Btn disabled={busy} onClick={() => act(() => inv('adw:fixHosts', r.hosts.map(h => h.line)), x => `${x.removed || 0} ✓`)}><Wrench size={14} />{t.fixSelected}</Btn></div></>}</Sec>
      <Sec icon={Wifi} title={t.proxyHijack} n={r.proxy ? 1 : 0}>{!r.proxy ? <div className="text-xs text-emerald-400">OK</div> : <><div className="text-xs font-mono text-amber-300">{r.proxy.server || r.proxy.pac}</div><div className="mt-2"><Btn disabled={busy} onClick={() => act(() => inv('adw:fixProxy'), () => t.done)}><Wrench size={14} />{t.fixSelected}</Btn></div></>}</Sec>
      <Sec icon={Package} title={t.pupProgs} n={r.pups.length}>{r.pups.length === 0 ? <div className="text-xs text-emerald-400">OK</div> : <><CheckList items={r.pups} selected={selP} onToggle={tog(selP, setSelP)} selectAll={selP.size === r.pups.length} onSelectAll={v => setSelP(v ? new Set(r.pups.map(p => p.id)) : new Set())}
        render={p => <div className="text-xs"><div>{p.name} <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400">{p.kind}</span> <span className="text-amber-400">« {p.matched} »</span></div><div className="text-slate-500 truncate">{p.cmd}</div></div>} />
        <div className="mt-2"><Btn disabled={!selP.size || busy} onClick={() => act(() => inv('adw:fixPup', [...selP]), x => `${x.fixed || 0} ✓ / ${x.failed || 0} ✗`)}><Wrench size={14} />{t.fixSelected}</Btn></div></>}</Sec></>}
  </>;
}
