'use client';
import{useEffect,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{useHydratedLocale}from'../components/LanguageProvider';
import{localizeClientRoot,localizeLinkText}from'../components/LocalizedLinkContent';
import{SOURCE_BLOCK_REASON_CATEGORIES,SOURCE_BLOCK_REASON_LABELS,type SourceBlockReasonCategory}from'@/lib/source-block-reasons';
import type{SourceBlockRecord}from'@/lib/source-blocks';
import{BULK_BLOCK_LIMIT,type SourceCandidateBlockState,type SourceCandidateRow}from'@/lib/source-candidate-view';
type RowResult={status:'pending'|'running'|'ok'|'error';message:string};
type Props={rows:SourceCandidateRow[];finance:boolean;onClose:()=>void;onBlocked:(key:string,block:SourceCandidateBlockState)=>void;onFinished?:(hadErrors:boolean)=>void};
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const sourceLabel=(row:SourceCandidateRow,locale:'de'|'en')=>row.level==='sub_source'?`${row.mainValue||localizeLinkText('nicht übermittelt',locale)} → ${row.subValue||localizeLinkText('nicht übermittelt',locale)}`:(row.mainValue||localizeLinkText('nicht übermittelt',locale));
export const blockStateFromRecord=(record:SourceBlockRecord):SourceCandidateBlockState=>({id:record.id,status:record.status==='inactive'?'error':record.status,effectiveAt:record.effectiveAt,error:record.error??null});
/** EIN Dialog für bis zu BULK_BLOCK_LIMIT Zeilen: Grundkategorie + Begründung einmal erfassen, dann die vorhandenen POST-activate-Aufrufe sequenziell je Zeile (kein Bulk-Endpunkt). */
export default function SourceBulkBlockDialog({rows,finance,onClose,onBlocked,onFinished}:Props){
 const locale=useHydratedLocale();
 const[reasonCategory,setReasonCategory]=useState<''|SourceBlockReasonCategory>(''),[reason,setReason]=useState(''),[phase,setPhase]=useState<'form'|'running'|'done'>('form'),[results,setResults]=useState<Record<string,RowResult>>({}),dialogRef=useRef<HTMLDivElement>(null);
 const running=phase==='running';
 useEffect(()=>{if(!running)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[running]);
 const runningRef=useRef(running);useEffect(()=>{runningRef.current=running},[running]);
 useEffect(()=>{
  const previous=document.body.style.overflow,opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const controls=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')??[]).filter(element=>!element.closest('[hidden],[inert]')&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden');
  const focusFirst=()=>(controls()[0]??dialogRef.current)?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!runningRef.current){event.preventDefault();onClose()}
   if(event.key!=='Tab')return;
   const items=controls(),first=items[0],last=items.at(-1),active=document.activeElement;
   if(!items.length){event.preventDefault();dialogRef.current?.focus()}
   else if(!dialogRef.current?.contains(active)||active===dialogRef.current||(event.shiftKey?active===first:active===last)){event.preventDefault();(event.shiftKey?last:first)?.focus()}
  };
  const onFocus=(event:FocusEvent)=>{if(event.target instanceof Node&&!dialogRef.current?.contains(event.target))focusFirst()};
  document.body.style.overflow='hidden';document.addEventListener('keydown',onKeyDown);document.addEventListener('focusin',onFocus);focusFirst();
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKeyDown);document.removeEventListener('focusin',onFocus);if(opener?.isConnected)opener.focus()};
 },[onClose]);
 const run=async()=>{
  if(!reasonCategory||!rows.length)return;
  setPhase('running');setResults(Object.fromEntries(rows.map(row=>[row.key,{status:'pending',message:''} as RowResult])));
  let hadErrors=false;
  for(const row of rows){
   setResults(current=>({...current,[row.key]:{status:'running',message:''}}));
   try{
    const response=await fetch('/api/source-blocks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'activate',affiliateId:row.affiliateId,affiliateName:row.affiliate,offerId:row.offerId,offerName:row.offer,trafficMode:row.trafficMode,level:row.level,mainValue:row.mainValue,subValue:row.subValue,reasonCategory,reason})}),body=await response.json();
    if(!response.ok||!body.block)throw new Error(body.error||'Sperre konnte nicht aktiviert werden');
    onBlocked(row.key,blockStateFromRecord(body.block as SourceBlockRecord));
    setResults(current=>({...current,[row.key]:{status:'ok',message:'Gesperrt'}}));
   }catch(error){hadErrors=true;setResults(current=>({...current,[row.key]:{status:'error',message:error instanceof Error?error.message:'Sperre konnte nicht aktiviert werden'}}))}
  }
  setPhase('done');
  onFinished?.(hadErrors);
 };
 const summary=Object.values(results),ok=summary.filter(item=>item.status==='ok').length,failed=summary.filter(item=>item.status==='error').length;
 const modal=localizeClientRoot(<div className="sourceBlockModal" role="dialog" aria-modal="true" aria-labelledby="source-bulk-title" onMouseDown={event=>{if(event.target===event.currentTarget&&!running)onClose()}}>
  <div className="sourceBlockDialog sourceBulkDialog" ref={dialogRef} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}>
   <header className="sourceBlockDialogHeader"><span className="sourceBlockDialogIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M7.1 5.7a8 8 0 1 0 9.8 0"/></svg></span><span><small>Mehrfachauswahl · maximal {BULK_BLOCK_LIMIT}</small><b id="source-bulk-title">{`${rows.length} ${rows.length===1?'Quelle':'Quellen'} sperren`}</b></span><button type="button" className="sourceBlockClose" onClick={onClose} disabled={running} aria-label="Dialog schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
   <ol className="sourceBulkRows" aria-label="Ausgewählte Quellen">{rows.map(row=>{const result=results[row.key];return <li key={row.key} className={result?`is-${result.status}`:''}><b data-no-translate>{row.affiliate} · {row.offer} (#{row.offerId})</b><span>{row.trafficMode==='api'?'API':'Tracked'} · <span data-no-translate>{sourceLabel(row,locale)}</span> · {row.sois} SOIs{finance&&row.payout!==null?` · Payout ${euro(row.payout)}`:''}{finance&&row.profit!==null?` · Profit ${euro(row.profit)}`:''}</span>{result&&<small role={result.status==='error'?'alert':undefined}>{result.status==='pending'?'Wartet':result.status==='running'?'Wird verifiziert …':result.status==='ok'?'Gesperrt':`Fehler: ${result.message}`}</small>}</li>})}</ol>
   <p className="sourceBlockImpact">Ab Bestätigung werden Vergütung und Partner-Postback für jede ausgewählte Quelle bei ihrem Affiliate und Offer gesperrt – campaignübergreifend, nacheinander je Zeile. Eingehenden Traffic kann nur der Partner selbst stoppen.</p>
   {phase==='form'&&<>
    <label className="sourceBlockReason">Grundkategorie <span>Pflicht · gilt für alle ausgewählten Quellen</span><select value={reasonCategory} onChange={event=>setReasonCategory(event.target.value as ''|SourceBlockReasonCategory)} required><option value="">Bitte wählen</option>{SOURCE_BLOCK_REASON_CATEGORIES.map(category=><option key={category} value={category}>{SOURCE_BLOCK_REASON_LABELS[category]}</option>)}</select></label>
    <label className="sourceBlockReason">Begründung <span>optional · max. 500 Zeichen</span><input value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} placeholder="z. B. Partner per Telegram informiert"/></label>
   </>}
   {phase==='done'&&<p className="sourceBulkSummary" role="status">{ok} gesperrt · {failed} fehlgeschlagen. Fehlgeschlagene Zeilen erscheinen als „Zustand unklar“ und sind im Audit-Protokoll vermerkt – kein zweiter Versuch ohne Prüfung in Everflow.</p>}
   <footer className="sourceBlockDialogActions">{phase==='done'?<button type="button" className="sourceBlockCancel" onClick={onClose}>Schließen</button>:<><button type="button" className="sourceBlockCancel" onClick={onClose} disabled={running}>Abbrechen</button><button type="button" className="sourceConfirmBlock" onClick={run} disabled={running||!reasonCategory||!rows.length}>{running?'Wird verifiziert …':`${rows.length} ${rows.length===1?'Quelle':'Quellen'} jetzt sperren`}</button></>}</footer>
  </div>
 </div>,locale);
 return typeof document==='undefined'?null:createPortal(modal,document.body);
}
