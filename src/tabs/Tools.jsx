import React, { useEffect, useState } from 'react';
import { Stethoscope, CheckCircle2, XCircle, Archive, Undo2, Trash2, RefreshCw } from 'lucide-react';
import { Card, Btn, Bar, Empty, useJob, inv, fmtDate } from '../ui.jsx';

export function Diagnostics({ t, toast, sig }) {
  const job = useJob('diag'); const [bk, setBk] = useState([]); const loadB = async () => setBk((await inv('backup:list')) || []); useEffect(() => { loadB(); }, []);
  const steps = Array.isArray(job.result) ? job.result : [];
  return <>
    <Card className={job.running ? 'scanline' : ''}><div className="flex items-center justify-between"><div className="font-semibold flex items-center gap-2"><Stethoscope size={16} />{t.tools}</div><Btn busy={job.running} onClick={() => job.start()}>{t.diagRun}</Btn></div>
      <div className="text-xs text-slate-500 mt-1">{t.diagHelp}</div>
      {sig && sig.lastError && <div className="text-xs text-amber-400 mt-2">{t.lastErr}: {sig.lastError.code} — {sig.lastError.hint}</div>}
      {job.running && <div className="mt-3"><Bar pct={job.pct} /><div className="text-xs text-cyan-300 mt-1">{job.msg}</div></div>}
      <div className="mt-3 space-y-2">{steps.map((s, i) => <div key={i} style={{ animationDelay: i * 80 + 'ms' }} className="slide-in flex gap-2 text-xs">{s.ok ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> : <XCircle size={16} className="text-red-400 shrink-0" />}
        <div><div>{s.name}</div><div className="text-slate-500">{s.detail}</div>{!s.ok && s.fix && <div className="text-amber-300">→ {s.fix}</div>}</div></div>)}</div></Card>
    <Card><div className="flex justify-between mb-2"><div className="font-semibold flex items-center gap-2"><Archive size={16} />{t.backups}</div><Btn kind="sec" onClick={loadB}><RefreshCw size={14} /></Btn></div>
      {bk.length === 0 ? <Empty icon={Archive} text={t.noBackup} /> : bk.map(b => <div key={b.id} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800 fade-in"><div><div>{b.label}</div><div className="text-slate-500">{fmtDate(b.date)} · {b.count}</div></div>
        <div className="flex gap-2"><Btn kind="sec" onClick={async () => { const r = await inv('backup:restore', b.id); toast(r && r.ok === false ? r.error : t.done, r && r.ok === false ? 'err' : 'ok'); }}><Undo2 size={14} />{t.restoreBackup}</Btn><Btn kind="ghost" onClick={async () => { await inv('backup:remove', b.id); loadB(); }}><Trash2 size={14} /></Btn></div></div>)}</Card>
  </>;
}
