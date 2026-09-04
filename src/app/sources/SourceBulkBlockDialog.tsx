'use client';
import{useEffect,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{SOURCE_BLOCK_REASON_CATEGORIES,SOURCE_BLOCK_REASON_LABELS,type SourceBlockReasonCategory}from'@/lib/source-block-reasons';
import type{SourceBlockRecord}from'@/lib/source-blocks';
import{BULK_BLOCK_LIMIT,type SourceCandidateBlockState,type SourceCandidateRow}from'@/lib/source-candidate-view';
type RowResult={status:'pending'|'running'|'ok'|'error';message:string};
type Props={rows:SourceCandidateRow[];finance:boolean;onClose:()=>void;onBlocked:(key:string,block:SourceCandidateBlockState)=>void};
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const sourceLabel=(row:SourceCandidateRow)=>row.level==='sub_source'?`${row.mainValue||'nicht übermittelt'} → ${row.subValue||'nicht übermittelt'}`:(row.mainValue||'nicht übermittelt');
export const blockStateFromRecord=(record:SourceBlockRecord):SourceCandidateBlockState=>({id:record.id,status:record.status==='inactive'?'error':record.status,effectiveAt:record.effectiveAt,error:record.error??null});
/** EIN Dialog für bis zu BULK_BLOCK_LIMIT Zeilen: Grundkategorie + Begründung einmal erfassen, dann die vorhandenen POST-activate-Aufrufe sequenziell je Zeile (kein Bulk-Endpunkt). */
export default function SourceBulkBlockDialog({rows,finance,onClose,onBlocked}:Props){
 const[reasonCategory,setReasonCategory]=useState<''|SourceBlockReasonCategory>(''),[reason,setReason]=useState(''),[phase,setPhase]=useState<'form'|'running'|'done'>('form'),[results,setResults]=useState<Record<string,RowResult>>({}),dialogRef=useRef<HTMLDivElement>(null);
 const running=phase==='running';
 useEffect(()=>{const previous=document.body.style.overflow,onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!running)onClose()};document.body.style.overflow='hidden';document.addEventListener('keydown',onKeyDown);requestAnimationFrame(()=>dialogRef.current?.focus());return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKeyDown)}},[running,onClose]);
 const run=async()=>{
  if(!reasonCategory||!rows.length)return;
  setPhase('running');setResults(Object.fromEntries(rows.map(row=>[row.key,{status:'pending',message:''} as RowResult])));
  for(const row of rows){
   setResults(current=>({...current,[row.key]:{status:'running',message:''}}));
   try{
    const response=await fetch('/api/source-blocks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'activate',affiliateId:row.affiliateId,affiliateName:row.affiliate,offerId:row.offerId,offerName:row.offer,trafficMode:row.trafficMode,level:row.level,mainValue:row.mainValue,subValue:row.subValue,reasonCategory,reason})}),body=await response.json();
    if(!response.ok||!body.block)throw new Error(body.error||'Sperre konnte nicht aktiviert werden');
    onBlocked(row.key,blockStateFromRecord(body.block as SourceBlockRecord));
    setResults(current=>({...current,[row.key]:{status:'ok',message:'Gesperrt'}}));
   }catch(error){setResults(current=>({...current,[row.key]:{status:'error',message:error instanceof Error?error.message:'Sperre konnte nicht aktiviert werden'}}))}
  }
  setPhase('done');
 };
 const summary=Object.values(results),ok=summary.filter(item=>item.status==='ok').length,failed=summary.filter(item=>item.status==='error').length;
 const modal=<div className="sourceBlockModal" role="dialog" aria-modal="true" aria-labelledby="source-bulk-title" onMouseDown={event=>{if(event.target===event.currentTarget&&!running)onClose()}}>
  <div className="sourceBlockDialog sourceBulkDialog" ref={dialogRef} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}>
   <header className="sourceBlockDialogHeader"><span className="sourceBlockDialogIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M7.1 5.7a8 8 0 1 0 9.8 0"/></svg></span><span><small>Mehrfachauswahl · maximal {BULK_BLOCK_LIMIT}</small><b id="source-bulk-title">{rows.length} {rows.length===1?'Quelle':'Quellen'} sperren</b></span><button type="button" className="sourceBlockClose" onClick={onClose} disabled={running} aria-label="Dialog schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
   <ol className="sourceBulkRows" aria-label="Ausgewählte Quellen">{rows.map(row=>{const result=results[row.key];return <li key={row.key} className={result?`is-${result.status}`:''}><b>{row.affiliate} · {row.offer} (#{row.offerId})</b><span>{row.trafficMode==='api'?'API':'Tracked'} · {sourceLabel(row)} · {row.sois} SOIs{finance&&row.payout!==null?` · Payout ${euro(row.payout)}`:''}{finance&&row.profit!==null?` · Profit ${euro(row.profit)}`:''}</span>{result&&<small role={result.status==='error'?'alert':undefined}>{result.status==='pending'?'Wartet':result.status==='running'?'Wird verifiziert …':result.status==='ok'?'Gesperrt':`Fehler: ${result.message}`}</small>}</li>})}</ol>
   <p className="sourceBlockImpact">Ab Bestätigung werden Vergütung und Partner-Postback für jede ausgewählte Quelle bei ihrem Affiliate und Offer gesperrt – campaignübergreifend, nacheinander je Zeile. Eingehenden Traffic kann nur der Partner selbst stoppen.</p>
   {phase==='form'&&<>
    <label className="sourceBlockReason">Grundkategorie <span>Pflicht · gilt für alle ausgewählten Quellen</span><select value={reasonCategory} onChange={event=>setReasonCategory(event.target.value as ''|SourceBlockReasonCategory)} required><option value="">Bitte wählen</option>{SOURCE_BLOCK_REASON_CATEGORIES.map(category=><option key={category} value={category}>{SOURCE_BLOCK_REASON_LABELS[category]}</option>)}</select></label>
    <label className="sourceBlockReason">Begründung <span>optional · max. 500 Zeichen</span><input value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} placeholder="z. B. Partner per Telegram informiert"/></label>
   </>}
   {phase==='done'&&<p className="sourceBulkSummary" role="status">{ok} gesperrt · {failed} fehlgeschlagen. Fehlgeschlagene Zeilen bleiben ungesperrt und sind im Audit-Protokoll vermerkt.</p>}
   <footer className="sourceBlockDialogActions">{phase==='done'?<button type="button" className="sourceBlockCancel" onClick={onClose}>Schließen</button>:<><button type="button" className="sourceBlockCancel" onClick={onClose} disabled={running}>Abbrechen</button><button type="button" className="sourceConfirmBlock" onClick={run} disabled={running||!reasonCategory||!rows.length}>{running?'Wird verifiziert …':`${rows.length} ${rows.length===1?'Quelle':'Quellen'} jetzt ausschalten`}</button></>}</footer>
  </div>
 </div>;
 return typeof document==='undefined'?null:createPortal(modal,document.body);
}
