import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
export const w = window.wise || { invoke: async () => ({}), on: () => () => {} };
export const inv = (c, ...a) => w.invoke(c, ...a);
export const fmt = (b) => { b = +b || 0; const u = ['o', 'Ko', 'Mo', 'Go', 'To']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return b.toFixed(i ? 1 : 0) + ' ' + u[i]; };
export const fmtDate = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString(); } catch { return s; } };

export const Card = ({ children, tone = 'none', className = '', glow = false }) => {
  const c = { green: 'border-emerald-500/40', red: 'border-red-500/60', yellow: 'border-amber-500/50', none: 'border-slate-200' }[tone];
  const g = { green: 'glow-green', red: 'glow-red', yellow: 'glow-yellow', none: '' }[tone];
  return <div className={`rounded-2xl border bg-white shadow-card p-5 fade-in lift ${c} ${glow ? g : ''} ${className}`}>{children}</div>;
};
export const Toggle = ({ on, onChange, label, sub, disabled }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-sm"><div>{label}</div>{sub && <div className="text-[11px] text-slate-500">{sub}</div>}</span>
    <button disabled={disabled} onClick={() => onChange(!on)} className={`w-11 h-6 rounded-full transition-all duration-300 relative shrink-0 disabled:opacity-30 ${on ? 'bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,.6)]' : 'bg-slate-700'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${on ? 'left-5' : 'left-0.5'}`} /></button></div>
);
export function Btn({ children, onClick, disabled, kind = 'primary', busy, className = '' }) {
  const [ripple, setRipple] = useState(false);
  const base = 'btn-shine relative overflow-hidden px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-150 disabled:opacity-40 active:scale-95';
  const kinds = { primary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 hover:shadow-[0_0_16px_rgba(34,211,238,.5)]', sec: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200', danger: 'bg-red-600 hover:bg-red-500 text-white hover:shadow-[0_0_16px_rgba(239,68,68,.5)]', ghost: 'bg-transparent hover:bg-slate-800 text-slate-300' };
  return <button disabled={disabled || busy} onClick={(e) => { setRipple(true); setTimeout(() => setRipple(false), 400); onClick && onClick(e); }} className={`${base} ${kinds[kind]} ${className}`}>
    {ripple && <span className="absolute inset-0 bg-blue-300/40 animate-ping-once rounded-xl" />}
    {busy ? <Spinner size={14} /> : children}</button>;
}
export const Spinner = ({ size = 16 }) => <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
export const Bar = ({ pct = 0, color = 'bg-metallic-blue', indeterminate = false, height = 'h-2' }) => (
  <div className={`${height} rounded-full bg-slate-800 overflow-hidden relative`}>
    {indeterminate ? <div className={`h-full w-1/3 ${color} rounded-full animate-indeterminate`} /> : <div className={`h-full ${color} rounded-full transition-all duration-300 ease-out relative overflow-hidden`} style={{ width: Math.max(2, Math.min(100, pct)) + '%' }}><div className="absolute inset-0 bg-white/25 animate-shimmer" /><div className="absolute inset-0 bar-stripes" /></div>}
  </div>
);
export const Input = (p) => <input {...p} className={`bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500/40 focus:border-blue-500 transition ${p.className || ''}`} />;
export const Pill = ({ children, active, onClick, badge }) => (
  <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${active ? 'bg-metallic-blue text-white shadow-[0_0_10px_rgba(34,211,238,.4)]' : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
    {children}{badge > 0 && <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-slate-950/30' : 'bg-red-500 text-white'}`}>{badge}</span>}</button>
);
export const Empty = ({ icon: Icon, text }) => <div className="flex flex-col items-center justify-center py-10 text-slate-600 fade-in">{Icon && <Icon size={30} className="mb-2 opacity-50" />}<div className="text-sm">{text}</div></div>;
export function Toast({ toasts }) {
  const M = { ok: [CheckCircle2, 'border-blue-200 text-blue-700', 'bg-blue-600'], warn: [AlertTriangle, 'border-amber-300 text-amber-700', 'bg-amber-500'], err: [XCircle, 'border-red-300 text-red-700', 'bg-red-500'] };
  return <div className="fixed top-14 right-6 z-50 space-y-2 w-80 pointer-events-none">{toasts.map(t => { const [I, c, bar] = M[t.tone] || M.ok;
    return <div key={t.id} className={`toast-in relative overflow-hidden pointer-events-auto bg-white rounded-xl border shadow-lg px-3.5 py-3 flex items-center gap-2.5 text-xs font-bold ${c} ${t.tone === 'err' ? 'shake' : ''}`}><I size={16} className="check-pop shrink-0" /><span className="min-w-0 break-words">{t.msg}</span><span className={`absolute bottom-0 left-0 h-0.5 toast-bar ${bar}`} /></div>; })}</div>;
}
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, tone = 'ok') => { const id = Math.random().toString(36).slice(2); setToasts(x => [...x, { id, msg, tone }]); setTimeout(() => setToasts(x => x.filter(t => t.id !== id)), 4500); }, []);
  return [toasts, push];
}
// Suit une tâche longue émise par le processus principal via le canal 'job' (clé = nom de la tâche). running/pct/msg/data/result/error.
export function useJob(key) {
  const [s, setS] = useState({ running: false, pct: 0, msg: '', data: null, result: null, error: null, done: false });
  useEffect(() => w.on('job', (j) => { if (j.key !== key) return;
    if (j.state === 'start') setS({ running: true, pct: 0, msg: '', data: null, result: null, error: null, done: false });
    else if (j.state === 'progress') setS(x => ({ ...x, running: true, pct: j.pct, msg: j.msg || x.msg, data: j.data || x.data }));
    else if (j.state === 'done') setS(x => ({ ...x, running: false, pct: 100, result: j.result, done: true }));
    else if (j.state === 'cancelled') setS(x => ({ ...x, running: false, done: true }));
    else if (j.state === 'error') setS(x => ({ ...x, running: false, error: j.msg, done: true })); }), [key]);
  const start = useCallback((...args) => inv('job:' + key, ...args), [key]);
  const cancel = useCallback(() => inv('job:cancel', key), [key]);
  return { ...s, start, cancel };
}
// Clavier virtuel anti-keylogger (ordre des touches mélangé à chaque ouverture)
const ROWS = ['1234567890', 'azertyuiop', 'qsdfghjklm', 'wxcvbn.-_@!#$%&*'];
export function VKeyboard({ onKey, onBack }) {
  const [caps, setCaps] = useState(false);
  const [rows] = useState(() => ROWS.map(r => r.split('').sort(() => Math.random() - 0.5)));
  return <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 fade-in">{rows.map((r, i) => <div key={i} className="flex gap-1 flex-wrap">{r.map(c => <button key={c} onClick={() => onKey(caps ? c.toUpperCase() : c)} className="w-8 h-8 rounded bg-slate-800 hover:bg-cyan-600 text-sm transition active:scale-90">{caps ? c.toUpperCase() : c}</button>)}</div>)}
    <div className="flex gap-1"><button onClick={() => setCaps(!caps)} className={`px-3 h-8 rounded text-xs transition ${caps ? 'bg-cyan-600' : 'bg-slate-800'}`}>Aa</button><button onClick={onBack} className="px-3 h-8 rounded bg-slate-800 text-xs">⌫</button></div></div>;
}
// Liste de lignes sélectionnables avec case à cocher (scan de problèmes, catégories, programmes…)
export function CheckList({ items, selected, onToggle, render, selectAll, onSelectAll }) {
  return <div className="space-y-1">
    {selectAll !== undefined && <label className="flex items-center gap-2 text-xs text-slate-400 pb-2 border-b border-slate-800 mb-1 cursor-pointer"><input type="checkbox" checked={selectAll} onChange={e => onSelectAll(e.target.checked)} className="accent-cyan-500" />Tout sélectionner</label>}
    {items.map((it) => (
      <label key={it.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-slate-800/40 transition cursor-pointer fade-in">
        <input type="checkbox" checked={selected.has(it.id)} onChange={() => onToggle(it.id)} className="mt-1 accent-cyan-500" />
        <div className="flex-1 min-w-0">{render(it)}</div></label>))}
  </div>;
}
// Nombre qui s'incrémente en douceur
export function CountUp({ value, className = '' }) {
  const [v, setV] = useState(0); const from = useRef(0);
  useEffect(() => { const to = +value || 0, f = from.current, t0 = performance.now(); let raf; const step = (n) => { const k = Math.min(1, (n - t0) / 700); setV(Math.round(f + (to - f) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); else from.current = to; }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [value]);
  return <span className={className}>{v.toLocaleString()}</span>;
}
// Anneau d'analyse style Kaspersky : arcs rotatifs, ondes radar, pourcentage au centre
export function ScanRing({ pct = 0, active = true, size = 120 }) {
  const r = 52, c = 2 * Math.PI * r;
  return <div className="relative shrink-0" style={{ width: size, height: size }}>
    {active && <><span className="absolute inset-0 rounded-full border-2 border-blue-400 radar-wave" /><span className="absolute inset-0 rounded-full border-2 border-blue-300 radar-wave" style={{ animationDelay: '1.1s' }} /></>}
    <svg viewBox="0 0 120 120" className="absolute inset-0"><circle cx="60" cy="60" r={r} fill="#fff" stroke="#e2e8f0" strokeWidth="7" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="url(#ringG)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(2, pct) / 100)} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .4s ease' }} />
      <defs><linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e3a8a" /></linearGradient></defs></svg>
    {active && <svg viewBox="0 0 120 120" className="absolute inset-0 ring-spin"><circle cx="60" cy="60" r="42" fill="none" stroke="#2563eb" strokeOpacity=".5" strokeWidth="2" strokeDasharray="20 140" strokeLinecap="round" /></svg>}
    {active && <svg viewBox="0 0 120 120" className="absolute inset-0 ring-spin-rev"><circle cx="60" cy="60" r="34" fill="none" stroke="#60a5fa" strokeOpacity=".6" strokeWidth="2" strokeDasharray="10 90" strokeLinecap="round" /></svg>}
    <div className="absolute inset-0 flex items-center justify-center font-black font-mono text-blue-600" style={{ fontSize: size / 4.5 }}>{Math.round(pct)}%</div></div>;
}
