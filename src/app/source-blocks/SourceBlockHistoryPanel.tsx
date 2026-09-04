'use client';
import{useState}from'react';
import{SOURCE_BLOCK_REASON_LABELS,type SourceBlockReasonCategory}from'@/lib/source-block-reasons';
/** Historie je Sperre, erst auf Klick geladen (GET /api/source-blocks?action=history&id=…): Zeit · Aktion · Kategorie · Akteur · Fehlertext. */
type HistoryEvent={id:string;at:string;action:string;actorId:string;reasonCategory?:SourceBlockReasonCategory;reason?:string;error?:string};
const ACTION_LABELS:Record<string,string>={activate:'Gesperrt',activate_across_offers:'Gesperrt (alle Offers)',deactivate:'Freigegeben',activate_failed:'Sperre fehlgeschlagen',deactivate_failed:'Freigabe fehlgeschlagen',reconcile_ok:'Abgleich ok',reconcile_mismatch:'Abgleich: Abweichung'};
const fmt=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(date)};
export default function SourceBlockHistoryPanel({blockId}:{blockId:string}){
 const[open,setOpen]=useState(false),[state,setState]=useState<{loading:boolean;events?:HistoryEvent[];error?:string}>({loading:false});
 const toggle=async()=>{
  if(open){setOpen(false);return}
  setOpen(true);
  if(state.events||state.loading)return;
  setState({loading:true});
  try{const response=await fetch(`/api/source-blocks?action=history&id=${encodeURIComponent(blockId)}`,{cache:'no-store'}),body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'Historie nicht verfügbar');setState({loading:false,events:Array.isArray(body.events)?body.events:[]})}
  catch(error){setState({loading:false,error:error instanceof Error?error.message:'Historie nicht verfügbar'})}
 };
 return <div className="sourceBlockHistory"><button type="button" className="sourceBlockHistoryToggle" aria-expanded={open} onClick={toggle}>{open?'Historie ausblenden':'Historie anzeigen'}</button>
  {open&&(state.loading?<p>Historie wird geladen …</p>:state.error?<p role="alert">{state.error}</p>:state.events?.length?<ol className="sourceBlockHistoryList">{state.events.map(event=><li key={event.id}><time dateTime={event.at}>{fmt(event.at)}</time><b>{ACTION_LABELS[event.action]||event.action}</b><span>{event.reasonCategory?SOURCE_BLOCK_REASON_LABELS[event.reasonCategory]:'–'}</span><span>{event.actorId||'–'}</span>{event.reason&&<small>{event.reason}</small>}{event.error&&<em>{event.error}</em>}</li>)}</ol>:<p>Keine Historie vorhanden.</p>)}
 </div>;
}
