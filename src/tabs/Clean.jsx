import React, { useEffect, useState } from 'react';
import { Brush, Trash2, RefreshCw, Power, PackageX, ArrowUpCircle } from 'lucide-react';
import { Card, Btn, Bar, Pill, Empty, CheckList, Toggle, Input, useJob, inv, fmt } from '../ui.jsx';

const useSel = () => { const [s, setS] = useState(new Set()); return [s, (id) => setS(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }), (v, ids) => setS(v ? new Set(ids) : new Set()), setS]; };

function Cleaner({ t, toast }) {
  const an = useJob('clean.analyze'); const run = useJob('clean.run'); const [sel, tog, all, setSel] = useSel(); const [closeB, setCloseB] = useState(true);
  useEffect(() => { an.start(); }, []); useEffect(() => { if (an.result) setSel(new Set(an.result.filter(c => c.def).map(c => c.id))); }, [an.result]);
  useEffect(() => { if (run.done && run.result) { toast(`${fmt(run.result.freed)} ${t.freed}`); an.start(); } }, [run.done]);
  const items = (an.result || []).map(c => ({ ...c, id: c.id })); const groups = [...new Set(items.map(i => i.group))]; const total = items.filter(i => sel.has(i.id)).reduce((a, i) => a + i.bytes, 0);
  return <>
    <Card className={an.running || run.running ? 'scanline' : ''}><div className="flex items-center justify-between"><div><div className="font-semibold flex items-center gap-2"><Brush size={16} />{t.cleaner}</div><div className="text-xs text-slate-400 mt-1">{fmt(total)} {t.selected}</div></div>
      <div className="flex gap-2"><Btn kind="sec" busy={an.running} onClick={() => an.start()}><RefreshCw size={14} />{t.analyze}</Btn><Btn busy={run.running} disabled={!sel.size || an.running} onClick={() => run.start([...sel], { closeBrowsers: closeB })}><Trash2 size={14} />{t.cleanBtn}</Btn></div></div>
      <div className="mt-2"><Toggle label={t.closeBrowsers} on={closeB} onChange={setCloseB} /></div>
      {(an.running || run.running) && <div className="mt-3"><Bar pct={(run.running ? run : an).pct} /><div className="text-xs text-cyan-300 mt-1 truncate">{(run.running ? run : an).msg}</div></div>}</Card>
    {groups.map(g => <Card key={g}><div className="font-semibold text-sm mb-1">{g}</div><CheckList items={items.filter(i => i.group === g)} selected={sel} onToggle={tog}
      render={c => <div className="flex justify-between text-xs gap-3"><div><div>{c.label}</div>{c.warn && <div className="text-amber-400">⚠ {t.cleanBtn}?</div>}{c.running.length > 0 && <div className="text-slate-500">{c.running.join(', ')}</div>}</div><div className="text-cyan-300 whitespace-nowrap">{c.noSize ? '—' : fmt(c.bytes)}</div></div>} /></Card>)}
    {!an.running && items.length === 0 && <Empty icon={Brush} text={t.noItems} />}
  </>;
}

function Registry({ t, toast }) {
  const sc = useJob('reg.scan'); const fx = useJob('reg.fix'); const [sel, tog, all, setSel] = useSel(); const items = sc.result || [];
  useEffect(() => { if (sc.result) setSel(new Set(sc.result.map(i => i.id))); }, [sc.result]); useEffect(() => { if (fx.done && fx.result) { toast(`${fx.result.fixed} ✓ · ${fx.result.failed} ✗`); sc.start(); } }, [fx.done]);
  return <Card className={sc.running ? 'scanline' : ''}><div className="flex items-center justify-between mb-3"><div className="font-semibold">{t.registryTab} · {items.length} {t.issues}</div><div className="flex gap-2"><Btn busy={sc.running} kind="sec" onClick={() => sc.start()}>{t.analyze}</Btn><Btn busy={fx.running} disabled={!sel.size} onClick={() => fx.start([...sel])}>{t.fixSelected}</Btn></div></div>
    {(sc.running || fx.running) && <div className="mb-3"><Bar pct={(fx.running ? fx : sc).pct} /><div className="text-xs text-cyan-300 mt-1">{(fx.running ? fx : sc).msg}</div></div>}
    {items.length === 0 && !sc.running ? <Empty icon={Brush} text={sc.done ? t.cleanAll : t.noItems} /> : <CheckList items={items} selected={sel} onToggle={tog} selectAll={sel.size === items.length} onSelectAll={v => all(v, items.map(i => i.id))} render={i => <div className="text-xs"><div className="text-amber-300">{i.type}</div><div className="text-slate-500 truncate">{i.detail}</div></div>} />}</Card>;
}

function Startup({ t, toast }) {
  const [rows, setRows] = useState(null); const [busy, setBusy] = useState(false); const load = async () => { setBusy(true); setRows((await inv('startup:list')) || []); setBusy(false); }; useEffect(() => { load(); }, []);
  return <Card><div className="flex justify-between mb-3"><div className="font-semibold">{t.startupTab} · {rows ? rows.length : '…'}</div><Btn kind="sec" busy={busy} onClick={load}><RefreshCw size={14} /></Btn></div>
    {(rows || []).map(e => <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 text-xs fade-in"><div className="min-w-0"><div className={e.enabled ? '' : 'text-slate-500 line-through'}>{e.name} <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400">{e.type}</span></div><div className="truncate text-slate-500">{e.publisher ? e.publisher + ' · ' : ''}{e.command}</div></div>
      <div className="flex items-center gap-2"><Toggle label="" on={e.enabled} onChange={async v => { const r = await inv('startup:toggle', e.id, v); if (r && r.ok) setRows(x => x.map(y => y.id === e.id ? { ...y, enabled: v } : y)); else toast((r && r.error) || 'Erreur', 'err'); }} />
        {!e.advanced && <Btn kind="ghost" onClick={async () => { const r = await inv('startup:remove', e.id); toast(r && r.ok ? t.done : (r && r.error) || 'Erreur', r && r.ok ? 'ok' : 'err'); load(); }}><Trash2 size={14} /></Btn>}</div></div>)}
    {rows && rows.length === 0 && <Empty text="—" />}</Card>;
}

function Programs({ t, toast }) {
  const [rows, setRows] = useState(null); const [q, setQ] = useState(''); const [silent, setSilent] = useState(true); const [sel, tog, , setSel] = useSel(); const job = useJob('uninst.run'); const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); setRows((await inv('uninst:list')) || []); setBusy(false); }; useEffect(() => { load(); }, []); useEffect(() => { if (job.done) { toast(t.done); setSel(new Set()); load(); } }, [job.done]);
  const f = (rows || []).filter(r => (r.name + r.publisher).toLowerCase().includes(q.toLowerCase()));
  return <Card><div className="flex gap-2 mb-3 items-center"><Input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍" className="flex-1" /><Btn kind="sec" busy={busy} onClick={load}><RefreshCw size={14} /></Btn><Btn kind="danger" busy={job.running} disabled={!sel.size} onClick={() => job.start([...sel], silent)}><PackageX size={14} />{t.uninstallBtn} ({sel.size})</Btn></div>
    <Toggle label={t.silent} on={silent} onChange={setSilent} />{job.running && <div className="my-2"><Bar pct={job.pct} /><div className="text-xs text-cyan-300 mt-1">{job.msg}</div></div>}
    <div className="mt-2"><CheckList items={f} selected={sel} onToggle={tog} render={p => <div className="flex justify-between text-xs gap-3"><div className="min-w-0"><div>{p.name} <span className="text-slate-500">{p.version}</span></div><div className="text-slate-500 truncate">{p.publisher}{p.date ? ' · ' + p.date : ''}</div></div><div className="text-slate-400 whitespace-nowrap">{p.sizeKB ? fmt(p.sizeKB * 1024) : ''}</div></div>} /></div>
    {rows && f.length === 0 && <Empty text="—" />}</Card>;
}

function Software({ t, toast }) {
  const [res, setRes] = useState(null); const [sel, tog, all, setSel] = useSel(); const job = useJob('sw.upgrade'); const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); const r = await inv('sw:list'); setRes(r || { ok: false, items: [] }); setSel(new Set(((r && r.items) || []).map(i => i.id))); setBusy(false); }; useEffect(() => { load(); }, []); useEffect(() => { if (job.done) { toast(t.done); load(); } }, [job.done]);
  const items = (res && res.items) || [];
  return <Card><div className="flex justify-between mb-3"><div className="font-semibold">{t.swTab} · {items.length}</div><div className="flex gap-2"><Btn kind="sec" busy={busy} onClick={load}><RefreshCw size={14} /></Btn><Btn busy={job.running} disabled={!sel.size} onClick={() => job.start([...sel])}><ArrowUpCircle size={14} />{sel.size === items.length ? t.upgradeAll : t.update}</Btn></div></div>
    {res && !res.ok && <div className="text-xs text-amber-400 mb-2">{res.error}</div>}{job.running && <div className="mb-3"><Bar pct={job.pct} /><div className="text-xs text-cyan-300 mt-1">{job.msg}</div></div>}
    <CheckList items={items} selected={sel} onToggle={tog} selectAll={items.length > 0 && sel.size === items.length} onSelectAll={v => all(v, items.map(i => i.id))} render={s => <div className="flex justify-between text-xs"><div>{s.name}<div className="text-slate-500">{s.id}</div></div><div className="text-slate-400">{s.version} → <span className="text-emerald-400">{s.available}</span></div></div>} />
    {res && items.length === 0 && res.ok && <Empty text={t.cleanAll} />}</Card>;
}

export function CleanerHub(p) {
  const [sub, setSub] = useState('clean'); const S = { clean: Cleaner, reg: Registry, start: Startup, prog: Programs, sw: Software }[sub];
  return <><div className="flex gap-2 flex-wrap">{[['clean', p.t.cleaner], ['reg', p.t.registryTab], ['start', p.t.startupTab], ['prog', p.t.uninstTab], ['sw', p.t.swTab]].map(([k, l]) => <Pill key={k} active={sub === k} onClick={() => setSub(k)}>{l}</Pill>)}</div><S key={sub} {...p} /></>;
}
