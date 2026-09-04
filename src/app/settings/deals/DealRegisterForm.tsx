'use client';
import{useMemo,useState}from'react';
import{DEAL_RULE_LIMITS,dealRuleKey,sameDealRuleValues,validateDealRules,type DealRule,type DealRuleInput}from'@/lib/deal-register';
type Props={initialRules:DealRule[];initialSource:'stored'|'defaults';defaults:readonly DealRule[];loadError?:string};
type Draft={affiliateId:string;campaignId:string;testQuotaSois:string;maturityHours:string;cvrFloorPct:string;note:string};
const emptyDraft=():Draft=>({affiliateId:'',campaignId:'',testQuotaSois:'',maturityHours:'',cvrFloorPct:'',note:''});
const toDraft=(rule:DealRule):Draft=>({affiliateId:String(rule.affiliateId),campaignId:rule.campaignId===undefined?'':String(rule.campaignId),testQuotaSois:rule.testQuotaSois===undefined?'':String(rule.testQuotaSois),maturityHours:rule.maturityHours===undefined?'':String(rule.maturityHours),cvrFloorPct:rule.cvrFloorPct===undefined?'':String(rule.cvrFloorPct),note:rule.note});
const stamp=(value:string)=>{if(!value)return'–';const date=new Date(value);return Number.isNaN(date.getTime())?'–':date.toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'})};
const num=(value:number|undefined,unit='')=>value===undefined?'–':`${new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(value)}${unit}`;
const PENDING='pending';
export default function DealRegisterForm({initialRules,initialSource,defaults,loadError}:Props){
 const[rules,setRules]=useState<DealRule[]>(initialRules),[source,setSource]=useState(initialSource),[draft,setDraft]=useState<Draft>(emptyDraft()),[editingKey,setEditingKey]=useState<string|null>(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(loadError||''),[notice,setNotice]=useState('');
 const sorted=useMemo(()=>[...rules].sort((a,b)=>a.affiliateId-b.affiliateId||(a.campaignId??0)-(b.campaignId??0)),[rules]);
 const set=(field:keyof Draft)=>(event:React.ChangeEvent<HTMLInputElement>)=>setDraft(current=>({...current,[field]:event.target.value}));
 const localRule=(input:DealRuleInput):DealRule=>{const existing=rules.find(rule=>dealRuleKey(rule)===dealRuleKey(input));return existing&&sameDealRuleValues(existing,input)?existing:{...input,updatedAt:PENDING,updatedBy:PENDING}};
 function upsert(event:React.FormEvent){event.preventDefault();setError('');setNotice('');const checked=validateDealRules([draft]);if(!checked.ok){setError(checked.error.replace(/^Regel 1: /,''));return}const next=localRule(checked.rules[0]),key=dealRuleKey(next);if(editingKey!==null&&editingKey!==key&&rules.some(rule=>dealRuleKey(rule)===key)){setError(`Für Partner ${next.affiliateId}${next.campaignId?` / Campaign ${next.campaignId}`:''} gibt es bereits eine Regel.`);return}setRules(current=>{const without=current.filter(rule=>dealRuleKey(rule)!==key&&dealRuleKey(rule)!==editingKey);return[...without,next]});setDraft(emptyDraft());setEditingKey(null);setDirty(true)}
 function edit(rule:DealRule){setDraft(toDraft(rule));setEditingKey(dealRuleKey(rule));setError('');setNotice('')}
 function remove(rule:DealRule){setRules(current=>current.filter(item=>dealRuleKey(item)!==dealRuleKey(rule)));if(editingKey===dealRuleKey(rule)){setDraft(emptyDraft());setEditingKey(null)}setDirty(true);setError('');setNotice('')}
 function applyDefaults(){setRules(defaults.map(rule=>({...rule})));setDirty(true);setError('');setNotice('Standardregeln übernommen – noch nicht gespeichert.')}
 async function save(){setBusy(true);setError('');setNotice('');try{const body=rules.map(({affiliateId,campaignId,testQuotaSois,maturityHours,cvrFloorPct,note})=>({affiliateId,campaignId,testQuotaSois,maturityHours,cvrFloorPct,note})),response=await fetch('/api/deals',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:body})}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);setRules(payload.rules);setSource('stored');setDirty(false);setNotice(`Gespeichert · ${payload.rules.length} ${payload.rules.length===1?'Regel':'Regeln'} aktiv.`)}catch(value){setError(value instanceof Error?value.message:'Speichern fehlgeschlagen')}finally{setBusy(false)}}
 return <section className="dealRegister" aria-label="Deal-Register">
  <p className="dealRegisterHint">{source==='defaults'?'Noch kein gespeicherter Eintrag: es gelten die bisherigen Konstanten (Standardregeln unten).':'Gespeichertes Register aktiv.'} Ohne Eintrag für einen Partner gelten die allgemeinen Schwellen der Engine. Campaign-Regeln ergänzen die Partnerregel feldweise; Änderungen wirken nach dem Speichern innerhalb von 60 Sekunden.</p>
  {error&&<p className="dealRegisterNotice error" role="alert">{error}</p>}
  {notice&&<p className="dealRegisterNotice ok" role="status">{notice}</p>}
  <div className="dealRegisterTableWrap">
   <table className="dealRegisterTable">
    <thead><tr><th>Partner</th><th>Campaign</th><th>Testquote</th><th>Reife</th><th>CVR-Untergrenze</th><th>Notiz</th><th>Geändert von</th><th>Geändert am</th><th>Aktionen</th></tr></thead>
    <tbody>{sorted.length?sorted.map(rule=><tr key={dealRuleKey(rule)} className={editingKey===dealRuleKey(rule)?'editing':undefined}><td>{rule.affiliateId}</td><td>{rule.campaignId??'alle'}</td><td>{num(rule.testQuotaSois,' SOIs')}</td><td>{num(rule.maturityHours,' h')}</td><td>{num(rule.cvrFloorPct,' %')}</td><td className="dealRegisterNote">{rule.note||'–'}</td><td>{rule.updatedBy===PENDING?'ungespeichert':rule.updatedBy==='system'?'Standard':rule.updatedBy}</td><td>{rule.updatedAt===PENDING?'–':rule.updatedBy==='system'?'–':stamp(rule.updatedAt)}</td><td className="dealRegisterActions"><button type="button" onClick={()=>edit(rule)} disabled={busy}>Bearbeiten</button><button type="button" className="danger" onClick={()=>remove(rule)} disabled={busy}>Löschen</button></td></tr>):<tr><td colSpan={9} className="dealRegisterEmpty">Keine Regeln – es gelten die allgemeinen Schwellen der Engine.</td></tr>}</tbody>
   </table>
  </div>
  <form className="dealRegisterForm" onSubmit={upsert} aria-label={editingKey?'Regel ändern':'Regel anlegen'}>
   <h2>{editingKey?`Regel ändern · Partner ${draft.affiliateId}${draft.campaignId?` / Campaign ${draft.campaignId}`:''}`:'Regel anlegen'}</h2>
   <div className="dealRegisterFields">
    <label>Partner-ID<input inputMode="numeric" value={draft.affiliateId} onChange={set('affiliateId')} required/></label>
    <label>Campaign-ID (optional)<input inputMode="numeric" value={draft.campaignId} onChange={set('campaignId')} placeholder="alle"/></label>
    <label>Testquote (SOIs)<input inputMode="numeric" value={draft.testQuotaSois} onChange={set('testQuotaSois')} placeholder={`${DEAL_RULE_LIMITS.testQuotaSois.min}–${DEAL_RULE_LIMITS.testQuotaSois.max}`}/></label>
    <label>Reife (Stunden)<input inputMode="numeric" value={draft.maturityHours} onChange={set('maturityHours')} placeholder={`${DEAL_RULE_LIMITS.maturityHours.min}–${DEAL_RULE_LIMITS.maturityHours.max}`}/></label>
    <label>CVR-Untergrenze (%)<input inputMode="decimal" value={draft.cvrFloorPct} onChange={set('cvrFloorPct')} placeholder="z. B. 1"/></label>
    <label className="dealRegisterNoteField">Notiz (max. {DEAL_RULE_LIMITS.noteLength} Zeichen)<input value={draft.note} onChange={set('note')} maxLength={DEAL_RULE_LIMITS.noteLength}/></label>
   </div>
   <div className="dealRegisterButtons">
    <button type="submit" disabled={busy}>{editingKey?'Änderung übernehmen':'Regel hinzufügen'}</button>
    {editingKey&&<button type="button" className="secondary" onClick={()=>{setDraft(emptyDraft());setEditingKey(null)}} disabled={busy}>Abbrechen</button>}
    <button type="button" className="secondary" onClick={applyDefaults} disabled={busy}>Standardregeln übernehmen</button>
    <button type="button" className="primary" onClick={save} disabled={busy||!dirty}>{busy?'Speichern …':'Register speichern'}</button>
    {dirty&&!busy&&<small>Ungespeicherte Änderungen</small>}
   </div>
  </form>
 </section>
}
