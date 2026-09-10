'use client';
import LocalizedRoot from '../../components/LocalizedRoot';
import {useHydratedLocale} from '../../components/LanguageProvider';
import {localeTag,type DashboardLocale} from '@/lib/i18n';
import{useId,useMemo,useRef,useState}from'react';
import{DEAL_RULE_LIMITS,dealRuleKey,sameDealRuleValues,validateDealRules,type DealRule,type DealRuleInput,type DealRuleField}from'@/lib/deal-register';
type Props={initialRevision?:string;initialRules:DealRule[];initialSource:'stored'|'defaults';defaults:readonly DealRule[];loadError?:string};
type Draft={affiliateId:string;campaignId:string;testQuotaSois:string;maturityHours:string;cvrFloorPct:string;note:string};
const emptyDraft=():Draft=>({affiliateId:'',campaignId:'',testQuotaSois:'',maturityHours:'',cvrFloorPct:'',note:''});
const toDraft=(rule:DealRule):Draft=>({affiliateId:String(rule.affiliateId),campaignId:rule.campaignId===undefined?'':String(rule.campaignId),testQuotaSois:rule.testQuotaSois===undefined?'':String(rule.testQuotaSois),maturityHours:rule.maturityHours===undefined?'':String(rule.maturityHours),cvrFloorPct:rule.cvrFloorPct===undefined?'':String(rule.cvrFloorPct),note:rule.note});
const stamp=(value:string,locale:DashboardLocale)=>{if(!value)return'–';const date=new Date(value);return Number.isNaN(date.getTime())?'–':date.toLocaleString(localeTag(locale),{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'})};
const num=(value:number|undefined,unit='')=>value===undefined?'–':`${new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(value)}${unit}`;
const PENDING='pending';
export default function DealRegisterForm({initialRevision,initialRules,initialSource,defaults,loadError}:Props){
 const locale=useHydratedLocale();
 const[rules,setRules]=useState<DealRule[]>(initialRules),[source,setSource]=useState(initialSource),[draft,setDraft]=useState<Draft>(emptyDraft()),[editingKey,setEditingKey]=useState<string|null>(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(loadError||''),[notice,setNotice]=useState('');
 const[revision,setRevision]=useState(initialRevision),[conflict,setConflict]=useState(false);
 const [invalidFields,setInvalidFields]=useState<DealRuleField[]>([]),errorId=useId(),form=useRef<HTMLFormElement>(null);
 const hasDraft=editingKey!==null||Object.values(draft).some(value=>value!=='');
 const saving=useRef(false),unavailable=Boolean(loadError)||!revision,saveBlocked=unavailable||conflict;
 const sorted=useMemo(()=>[...rules].sort((a,b)=>a.affiliateId-b.affiliateId||(a.campaignId??0)-(b.campaignId??0)),[rules]);
 const clearValidation=()=>{setInvalidFields([]);setError('')};
 const resetDraft=()=>{setDraft(emptyDraft());setEditingKey(null);clearValidation()};
 const set=(field:keyof Draft)=>(event:React.ChangeEvent<HTMLInputElement>)=>{setDraft(current=>({...current,[field]:event.target.value}));if(invalidFields.length)clearValidation()};
 const invalid=(field:DealRuleField)=>({name:field,'aria-invalid':invalidFields.includes(field)||undefined,'aria-describedby':invalidFields.includes(field)?errorId:undefined});
 function rejectDraft(message:string,fields:DealRuleField[]=[]){setError(message);setInvalidFields(fields);const field=form.current?.elements.namedItem(fields[0]);if(field instanceof HTMLElement)field.focus()}
 const localRule=(input:DealRuleInput):DealRule=>{const existing=rules.find(rule=>dealRuleKey(rule)===dealRuleKey(input));return existing&&sameDealRuleValues(existing,input)?existing:{...input,updatedAt:PENDING,updatedBy:PENDING}};
 function upsert(event:React.FormEvent){event.preventDefault();if(unavailable||saving.current)return;setError('');setNotice('');const checked=validateDealRules([draft]);if(!checked.ok){rejectDraft(checked.error.replace(/^Regel 1: /,''),checked.fields);return}const next=localRule(checked.rules[0]),key=dealRuleKey(next);if(editingKey!==key&&rules.some(rule=>dealRuleKey(rule)===key)){rejectDraft(`Für Partner ${next.affiliateId}${next.campaignId?` / Campaign ${next.campaignId}`:''} gibt es bereits eine Regel.`,['affiliateId','campaignId']);return}setRules(current=>{const without=current.filter(rule=>dealRuleKey(rule)!==key&&dealRuleKey(rule)!==editingKey);return[...without,next]});resetDraft();setDirty(true)}
 function edit(rule:DealRule){setDraft(toDraft(rule));setEditingKey(dealRuleKey(rule));clearValidation();setNotice('')}
 function remove(rule:DealRule){setRules(current=>current.filter(item=>dealRuleKey(item)!==dealRuleKey(rule)));if(editingKey===dealRuleKey(rule))resetDraft();setDirty(true);clearValidation();setNotice('')}
 function applyDefaults(){setRules(defaults.map(rule=>({...rule})));setDirty(true);clearValidation();setNotice('Standardregeln übernommen – noch nicht gespeichert.')}
 async function save(){if(saveBlocked||saving.current||!dirty||hasDraft)return;if(!rules.length&&!window.confirm('Register wirklich leer speichern? Die bisherigen Sonderregeln (Standardregeln) entfallen dann für alle Partner.'))return;saving.current=true;setBusy(true);setError('');setNotice('');try{const body=rules.map(({affiliateId,campaignId,testQuotaSois,maturityHours,cvrFloorPct,note})=>({affiliateId,campaignId,testQuotaSois,maturityHours,cvrFloorPct,note})),response=await fetch('/api/deals',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:body,expectedRevision:revision})}),payload=await response.json().catch(()=>({}));if(response.status===409)setConflict(true);if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);setRules(payload.rules);setRevision(payload.revision);setSource('stored');setDirty(false);if(payload.audited===false)setError('Register gespeichert, aber der Auditnachweis ist fehlgeschlagen. Bitte vor weiteren Änderungen prüfen.');else setNotice(`Gespeichert · ${payload.rules.length} ${payload.rules.length===1?'Regel':'Regeln'} aktiv.`)}catch(value){setError(value instanceof Error?value.message:'Speichern fehlgeschlagen')}finally{saving.current=false;setBusy(false)}}
 return <LocalizedRoot><section className="dealRegister" aria-label="Deal-Register">
  <p className="dealRegisterHint">{source==='defaults'?'Kein gespeichertes Register: es gelten die bisherigen Sonderdeal-Konstanten (Standardregeln unten).':rules.length?'Gespeichertes Register aktiv.':'Register leer gespeichert – keine Sonderdeals aktiv.'} Ohne Regel für einen Partner gelten die allgemeinen Schwellen der Engine; ein leer gespeichertes Register schaltet alle Sonderdeals ab. Campaign-Regeln ergänzen die Partnerregel feldweise; Änderungen wirken nach dem Speichern innerhalb von 60 Sekunden.</p>
  {error&&<p className="dealRegisterNotice error" role="alert" id={errorId}>{error}</p>}
  {saveBlocked&&<p className="dealRegisterNotice" role="status">{conflict?'Ein neuerer Stand ist verfügbar. Dein Entwurf bleibt hier sichtbar. Vor dem Neuladen benötigte Änderungen sichern.':'Speichern ist gesperrt, bis das Register vollständig geladen wurde.'} <a href="/settings/deals">Register neu laden</a></p>}
  {notice&&<p className="dealRegisterNotice ok" role="status">{notice}</p>}
  <div className="dealRegisterTableWrap">
   <table className="dealRegisterTable">
    <thead><tr><th>Partner</th><th>Campaign</th><th>Testquote</th><th>Reife</th><th>CVR-Untergrenze</th><th>Notiz</th><th>Geändert von</th><th>Geändert am</th><th>Aktionen</th></tr></thead>
    <tbody>{sorted.length?sorted.map(rule=><tr key={dealRuleKey(rule)} className={editingKey===dealRuleKey(rule)?'editing':undefined}><td>{rule.affiliateId}</td><td>{rule.campaignId??'alle'}</td><td>{num(rule.testQuotaSois,' SOIs')}</td><td>{num(rule.maturityHours,' h')}</td><td>{num(rule.cvrFloorPct,' %')}</td><td className="dealRegisterNote" data-no-translate>{rule.note||'–'}</td><td>{rule.updatedBy===PENDING?'ungespeichert':rule.updatedBy==='system'?'Standard':rule.updatedBy}</td><td>{rule.updatedAt===PENDING?'–':rule.updatedBy==='system'?'–':<time dateTime={rule.updatedAt} data-no-translate>{stamp(rule.updatedAt,locale)}</time>}</td><td className="dealRegisterActions"><button type="button" onClick={()=>edit(rule)} disabled={busy||unavailable}>Bearbeiten</button><button type="button" className="danger" onClick={()=>remove(rule)} disabled={busy||unavailable}>Löschen</button></td></tr>):<tr><td colSpan={9} className="dealRegisterEmpty">Keine Regeln – es gelten die allgemeinen Schwellen der Engine.</td></tr>}</tbody>
   </table>
  </div>
  <form ref={form} className="dealRegisterForm" onSubmit={upsert} aria-label={editingKey?'Regel ändern':'Regel anlegen'}>
   <h2>{editingKey?`Regel ändern · Partner ${draft.affiliateId}${draft.campaignId?` / Campaign ${draft.campaignId}`:''}`:'Regel anlegen'}</h2>
   <div className="dealRegisterFields">
    <label>Partner-ID<input inputMode="numeric" {...invalid('affiliateId')} value={draft.affiliateId} onChange={set('affiliateId')} required/></label>
    <label>Campaign-ID (optional)<input inputMode="numeric" {...invalid('campaignId')} value={draft.campaignId} onChange={set('campaignId')} placeholder="alle"/></label>
    <label>Testquote (SOIs)<input inputMode="numeric" {...invalid('testQuotaSois')} value={draft.testQuotaSois} onChange={set('testQuotaSois')} placeholder={`${DEAL_RULE_LIMITS.testQuotaSois.min}–${DEAL_RULE_LIMITS.testQuotaSois.max}`}/></label>
    <label>Reife (Stunden)<input inputMode="numeric" {...invalid('maturityHours')} value={draft.maturityHours} onChange={set('maturityHours')} placeholder={`${DEAL_RULE_LIMITS.maturityHours.min}–${DEAL_RULE_LIMITS.maturityHours.max}`}/></label>
    <label>CVR-Untergrenze (%)<input inputMode="decimal" {...invalid('cvrFloorPct')} value={draft.cvrFloorPct} onChange={set('cvrFloorPct')} placeholder="z. B. 1"/></label>
    <label className="dealRegisterNoteField">Notiz (max. {DEAL_RULE_LIMITS.noteLength} Zeichen)<input {...invalid('note')} value={draft.note} onChange={set('note')} maxLength={DEAL_RULE_LIMITS.noteLength}/></label>
   </div>
   <div className="dealRegisterButtons">
    <button type="submit" disabled={busy||unavailable}>{editingKey?'Änderung übernehmen':'Regel hinzufügen'}</button>
    {hasDraft&&<button type="button" className="secondary" onClick={resetDraft} disabled={busy||unavailable}>Abbrechen</button>}
    <button type="button" className="secondary" onClick={applyDefaults} disabled={busy||unavailable}>Standardregeln übernehmen</button>
    <button type="button" className="primary" onClick={save} disabled={busy||!dirty||saveBlocked||hasDraft}>{busy?'Speichern …':'Register speichern'}</button>
    {dirty&&hasDraft&&!busy&&<p role="status">Regel im Formular zuerst übernehmen oder verwerfen.</p>}
    {dirty&&!busy&&<small>Ungespeicherte Änderungen</small>}
   </div>
  </form>
 </section></LocalizedRoot>
}
