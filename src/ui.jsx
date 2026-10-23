import React, { useState } from 'react';
export const w = window.wise || { invoke: async () => ({}), on: () => () => {} };
export const inv = (c, ...a) => w.invoke(c, ...a);
export const fmt = (b) => (b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(1) + ' MB');
export const Card = ({ children, tone = 'none', className = '' }) => {
  const c = { green: 'border-emerald-500/40 glow-green', red: 'border-red-500/60 glow-red', yellow: 'border-amber-500/50 glow-yellow', none: 'border-slate-700/60' }[tone];
  return <div className={`rounded-2xl border bg-slate-900/70 backdrop-blur p-5 fade-in ${c} ${className}`}>{children}</div>;
};
export const Toggle = ({ on, onChange, label }) => (
  <div className="flex items-center justify-between gap-3 py-1.5"><span className="text-sm">{label}</span>
    <button onClick={() => onChange(!on)} className={`w-11 h-6 rounded-full transition relative shrink-0 ${on ? 'bg-cyan-500' : 'bg-slate-700'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} /></button></div>
);
export const Btn = ({ children, onClick, disabled, kind = 'primary' }) => (
  <button disabled={disabled} onClick={onClick} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition disabled:opacity-40 ${kind === 'primary' ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'}`}>{children}</button>
);
export const Bar = ({ pct, color = 'bg-cyan-400' }) => <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${color} transition-all duration-500`} style={{ width: pct + '%' }} /></div>;
export const Input = (p) => <input {...p} className={`bg-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-cyan-500 ${p.className || ''}`} />;
// Clavier virtuel anti-keylogger (ordre des touches mélangé à chaque ouverture) : saisie sans frappe physique
const ROWS = ['1234567890', 'azertyuiop', 'qsdfghjklm', 'wxcvbn.-_@!#$%&*'];
export function VKeyboard({ onKey, onBack }) {
  const [caps, setCaps] = useState(false);
  const [rows] = useState(() => ROWS.map(r => r.split('').sort(() => Math.random() - 0.5)));
  return <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">{rows.map((r, i) => <div key={i} className="flex gap-1 flex-wrap">{r.map(c => <button key={c} onClick={() => onKey(caps ? c.toUpperCase() : c)} className="w-8 h-8 rounded bg-slate-800 hover:bg-cyan-600 text-sm">{caps ? c.toUpperCase() : c}</button>)}</div>)}
    <div className="flex gap-1"><button onClick={() => setCaps(!caps)} className={`px-3 h-8 rounded text-xs ${caps ? 'bg-cyan-600' : 'bg-slate-800'}`}>Aa</button><button onClick={onBack} className="px-3 h-8 rounded bg-slate-800 text-xs">⌫</button></div></div>;
}
