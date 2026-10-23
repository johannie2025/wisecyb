import React, { useEffect, useState } from 'react';
import { Lock, Unlock, KeyRound, Globe, Wifi, Shield, Eye, Copy, Trash2, Plus } from 'lucide-react';
import { Card, Toggle, Btn, Input, VKeyboard, inv, w } from '../ui.jsx';

function Vault({ t }) {
  const [s, setS] = useState({ exists: false, unlocked: false }); const [pw, setPw] = useState(''); const [vk, setVk] = useState(false); const [err, setErr] = useState(''); const [items, setItems] = useState([]); const [f, setF] = useState({ title: '', username: '', secret: '', url: '', type: 'login' }); const [audit, setAudit] = useState({}); const [shown, setShown] = useState({});
  const st = async () => { const x = await inv('vault:state'); setS(x); if (x.unlocked) setItems((await inv('vault:list')) || []); }; useEffect(() => { st(); }, []);
  const go = async () => { const r = await inv(s.exists ? 'vault:unlock' : 'vault:create', pw); setErr(r.ok ? '' : r.error); setPw(''); st(); };
  if (!s.unlocked) return <Card><div className="font-semibold mb-3 flex items-center gap-2"><Lock size={16} />{t.vault}</div>
    <div className="flex gap-2"><Input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={t.master} className="flex-1" /><Btn onClick={() => setVk(!vk)} kind="sec">⌨</Btn><Btn onClick={go}>{s.exists ? t.unlock : t.create}</Btn></div>
    {vk && <VKeyboard onKey={c => setPw(p => p + c)} onBack={() => setPw(p => p.slice(0, -1))} />}{err && <div className="text-xs text-red-400 mt-2">{err}</div>}</Card>;
  const reveal = async (id) => { const v = await inv('vault:reveal', id); setShown(x => ({ ...x, [id]: v })); setTimeout(() => setShown(x => ({ ...x, [id]: null })), 10000); };
  return <Card><div className="flex justify-between mb-3"><div className="font-semibold flex items-center gap-2"><Unlock size={16} />{t.vault}</div><div className="flex gap-2"><Btn kind="sec" onClick={async () => { const r = await inv('vault:audit'); setAudit(Object.fromEntries((r || []).map(x => [x.id, x]))); }}>{t.audit}</Btn><Btn kind="sec" onClick={async () => { await inv('vault:lock'); st(); }}>{t.lock}</Btn></div></div>
    <div className="grid grid-cols-5 gap-2 mb-3"><Input placeholder={t.title} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /><Input placeholder={t.user} value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /><Input placeholder={t.secret} value={f.secret} onChange={e => setF({ ...f, secret: e.target.value })} />
      <Btn kind="sec" onClick={async () => setF({ ...f, secret: await inv('vault:gen', 20) })}>{t.gen}</Btn><Btn onClick={async () => { await inv('vault:save', f); setF({ title: '', username: '', secret: '', url: '', type: 'login' }); st(); }}><Plus size={14} />{t.add}</Btn></div>
    {items.map(i => { const a = audit[i.id]; return <div key={i.id} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-800"><div><div className="text-sm">{i.title} <span className="text-slate-500">{i.username}</span></div>{shown[i.id] && <code className="text-cyan-300">{shown[i.id]}</code>}{a && <div className="text-[11px]">{a.weak && <span className="text-amber-400 mr-2">weak</span>}{a.reused && <span className="text-amber-400 mr-2">reused</span>}{a.pwned > 0 && <span className="text-red-400">pwned ×{a.pwned}</span>}{!a.weak && !a.reused && !a.pwned && <span className="text-emerald-400">OK</span>}</div>}</div>
      <div className="flex gap-1"><Btn kind="sec" onClick={() => reveal(i.id)}><Eye size={14} /></Btn><Btn kind="sec" onClick={async () => { const v = await inv('vault:reveal', i.id); navigator.clipboard.writeText(v); setTimeout(() => navigator.clipboard.writeText(''), 15000); }}><Copy size={14} /></Btn><Btn kind="sec" onClick={async () => { await inv('vault:delete', i.id); st(); }}><Trash2 size={14} /></Btn></div></div>; })}</Card>;
}

function Leak({ t }) {
  const [p, setP] = useState(''); const [e, setE] = useState(''); const [rp, setRp] = useState(null); const [re, setRe] = useState(null);
  return <Card><div className="font-semibold mb-3 flex items-center gap-2"><KeyRound size={16} />{t.leak}</div>
    <div className="flex gap-2 mb-2"><Input type="password" value={p} onChange={x => setP(x.target.value)} placeholder={t.checkPwd} className="flex-1" /><Btn onClick={async () => { setRp(await inv('leak:pwd', p)); setP(''); }}>{t.run}</Btn></div>
    {rp && <div className={`text-xs mb-3 ${rp.count > 0 ? 'text-red-400' : rp.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{rp.ok ? (rp.count > 0 ? `${t.leaked}: ×${rp.count}` : t.clean0) : rp.error}</div>}
    <div className="flex gap-2"><Input value={e} onChange={x => setE(x.target.value)} placeholder={t.checkMail} className="flex-1" /><Btn onClick={async () => setRe(await inv('leak:email', e))}>{t.run}</Btn></div>
    {re && <div className="text-xs mt-2">{re.ok ? (re.breaches.length ? re.breaches.map(b => <div key={b.name} className="text-red-400">{b.name} · {b.date} · {b.data.join(', ')}</div>) : <span className="text-emerald-400">{t.clean0}</span>) : <span className="text-amber-400">{re.error}</span>}</div>}</Card>;
}

function Tools({ t, st, setSt }) {
  const [url, setUrl] = useState(''); const [ru, setRu] = useState(null); const [sk, setSk] = useState(null);
  const sw = (k, ch) => (v) => { setSt({ ...st, [k]: v }); inv(ch, v); };
  return <>
    <Card><Toggle label={t.webshield} on={st.web} onChange={sw('web', 'web:block')} /><Toggle label={t.webcam} on={st.cam} onChange={sw('cam', 'priv:webcam')} /><Toggle label={t.mic} on={st.mic} onChange={sw('mic', 'priv:mic')} /></Card>
    <Card><div className="font-semibold mb-3 flex items-center gap-2"><Globe size={16} />{t.urlcheck}</div><div className="flex gap-2"><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className="flex-1" /><Btn onClick={async () => setRu(await inv('url:check', url))}>{t.run}</Btn></div>
      {ru && ru.ok && <div className={`text-sm mt-2 ${ru.verdict === 'dangerous' ? 'text-red-400' : ru.verdict === 'suspicious' ? 'text-amber-400' : 'text-emerald-400'}`}>{ru.verdict.toUpperCase()} · {ru.reasons.join(', ') || '—'}</div>}</Card>
    <Card><div className="flex justify-between items-center"><div className="font-semibold flex items-center gap-2"><Shield size={16} />{t.stalker}</div><Btn onClick={async () => setSk(await inv('stalker:scan'))}>{t.run}</Btn></div>
      {Array.isArray(sk) && <div className="text-xs mt-2">{sk.length ? sk.map((x, i) => <div key={i} className="text-red-400">{x.kind}: {x.name}</div>) : <span className="text-emerald-400">{t.clean0}</span>}</div>}</Card>
  </>;
}
export function Privacy(p) { return <><Vault {...p} /><Leak {...p} /><Tools {...p} /></>; }

export function Network({ t }) {
  const [wi, setWi] = useState(null); const [dv, setDv] = useState([]); const [vs, setVs] = useState({ state: 'disconnected' }); const [list, setList] = useState([]); const [ks, setKs] = useState(true); const [has, setHas] = useState(true); const [safe, setSafe] = useState('');
  useEffect(() => { inv('wifi:info').then(setWi); inv('wifi:devices').then(r => setDv((r && r.devices) || [])); inv('vpn:installed').then(setHas); return w.on('vpn:state', setVs); }, []);
  const lv = { critical: 'text-red-400', weak: 'text-amber-400', ok: 'text-emerald-400', best: 'text-emerald-400' };
  return <>
    <Card><div className="font-semibold mb-2 flex items-center gap-2"><Wifi size={16} />{t.wifi}</div>{wi && wi.connected ? <div className="text-sm">{wi.ssid} · <span className={lv[wi.level]}>{wi.auth}</span> · {wi.signal}%</div> : <div className="text-xs text-slate-500">—</div>}
      <div className="text-xs text-slate-400 mt-3 mb-1">{t.devices}</div><div className="grid grid-cols-2 gap-1 text-[11px] font-mono">{dv.map(d => <div key={d.mac}>{d.ip} · {d.mac}</div>)}</div></Card>
    <Card><div className="flex justify-between items-center mb-3"><div className="font-semibold">{t.vpn}</div><div className={`text-xs ${vs.state === 'connected' ? 'text-emerald-400' : vs.state === 'blocked' ? 'text-red-400' : 'text-slate-400'}`}>{vs.state}{vs.country ? ' · ' + vs.country : ''}</div></div>
      {!has ? <Btn onClick={() => inv('vpn:install')}>{t.installVpn}</Btn> : <>
        <div className="flex gap-2 items-center mb-3"><Btn kind="sec" onClick={async () => setList((await inv('vpn:list')) || [])}>↻ VPNGate</Btn><Btn kind="sec" onClick={() => inv('vpn:disconnect')}>{t.disconnect}</Btn><Btn kind="sec" onClick={() => inv('vpn:restore')}>{t.restoreNet}</Btn><div className="ml-auto"><Toggle label={t.killsw} on={ks} onChange={setKs} /></div></div>
        <div className="max-h-52 overflow-y-auto text-xs">{Array.isArray(list) && list.map(s => <div key={s.ip} className="flex justify-between py-1 border-b border-slate-800"><span>{s.country} · {s.ip} · {Math.round(s.speed / 1e6)} Mbps · {s.ping} ms</span><Btn kind="sec" onClick={() => inv('vpn:connect', s.ip, ks)}>{t.connect}</Btn></div>)}</div></>}</Card>
    <Card><div className="font-semibold mb-2">{t.safe}</div><div className="flex gap-2"><Input value={safe} onChange={e => setSafe(e.target.value)} placeholder="https://mabanque.com" className="flex-1" /><Btn onClick={() => inv('safe:open', safe)}>{t.open}</Btn></div></Card>
  </>;
}

export function Settings({ t, st, setSt, lang, setLang }) {
  const [ex, setEx] = useState((st.exclusions || []).join('\n')); const [key, setKey] = useState(st.hibpKey || ''); const [msg, setMsg] = useState('');
  const up = (k, ch) => (v) => { setSt({ ...st, [k]: v }); inv(ch || 'settings:set', ch ? v : { [k]: v }); };
  return <>
    <Card><Toggle label={t.scheduled} on={st.scheduled} onChange={up('scheduled')} /><Toggle label={t.gaming} on={st.gaming} onChange={up('gaming')} /><Toggle label={t.cfa} on={st.cfa} onChange={up('cfa', 'cfa:set')} />
      <div className="flex gap-1 mt-3">{['fr', 'es', 'en'].map(l => <button key={l} onClick={() => { setLang(l); inv('settings:set', { lang: l }); }} className={`px-3 py-1 text-xs rounded ${lang === l ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'}`}>{l.toUpperCase()}</button>)}</div></Card>
    <Card><div className="font-semibold mb-2">{t.rollback}</div><Btn kind="sec" onClick={() => inv('rollback:snapshot')}>{t.snap}</Btn></Card>
    <Card><div className="font-semibold mb-2">{t.exclusions}</div><textarea value={ex} onChange={e => setEx(e.target.value)} rows={4} className="w-full bg-slate-800 rounded-xl p-2 text-xs font-mono outline-none" />
      <div className="font-semibold my-2">{t.hibp}</div><Input type="password" value={key} onChange={e => setKey(e.target.value)} className="w-full" />
      <div className="mt-3 flex items-center gap-3"><Btn onClick={async () => { const r = await inv('settings:set', { exclusions: ex.split('\n').map(s => s.trim()).filter(Boolean), hibpKey: key.trim() }); setSt(r); setMsg('OK'); }}>{t.save}</Btn><span className="text-xs text-emerald-400">{msg}</span></div></Card>
  </>;
}
