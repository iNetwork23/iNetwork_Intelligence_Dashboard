'use client';
import{useState}from'react';
import{useHydratedLocale}from'../components/LanguageProvider';
import{localizeClientRoot}from'../components/LocalizedLinkContent';
import{SOURCE_BLOCK_REASON_LABELS,type SourceBlockReasonCategory}from'@/lib/source-block-reasons';
import{sourceBlockHistoryActionLabel}from'@/lib/source-block-history-labels';
import{berlinDateTime}from'@/lib/format-berlin';
/** Historie je Sperre, erst auf Klick geladen (GET /api/source-blocks?action=history&id=…): Zeit · Aktion · Kategorie · Akteur · Fehlertext. */
type HistoryEvent={id:string;at:string;action:string;actorId:string;reasonCategory?:SourceBlockReasonCategory;reason?:string;error?:string};
const fmt=(value:string)=>berlinDateTime(value);
export default function SourceBlockHistoryPanel({blockId}:{blockId:string}){
 const locale=useHydratedLocale();
 const[open,setOpen]=useState(false),[state,setState]=useState<{loading:boolean;events?:HistoryEvent[];error?:string}>({loading:false});
 const toggle=async()=>{
  if(open){setOpen(false);return}
  setOpen(true);
  if(state.events||state.loading)return;
  setState({loading:true});
  try{const response=await fetch(`/api/source-blocks?action=history&id=${encodeURIComponent(blockId)}`,{cache:'no-store'}),body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'Historie nicht verfügbar');setState({loading:false,events:Array.isArray(body.events)?body.events:[]})}
  catch(error){setState({loading:false,error:error instanceof Error?error.message:'Historie nicht verfügbar'})}
 };
 return localizeClientRoot(<div className="sourceBlockHistory"><button type="button" className="sourceBlockHistoryToggle" aria-expanded={open} onClick={toggle}>{open?'Historie ausblenden':'Historie anzeigen'}</button>
  {open&&(state.loading?<p>Historie wird geladen …</p>:state.error?<p role="alert">{state.error}</p>:state.events?.length?<ol className="sourceBlockHistoryList">{state.events.map(event=><li key={event.id}><time dateTime={event.at}>{fmt(event.at)}</time><b data-no-translate={sourceBlockHistoryActionLabel(event.action)===event.action?true:undefined}>{sourceBlockHistoryActionLabel(event.action)||event.action}</b><span>{event.reasonCategory?SOURCE_BLOCK_REASON_LABELS[event.reasonCategory]:'–'}</span><span data-no-translate>{event.actorId||'–'}</span>{event.reason&&<small data-no-translate>{event.reason}</small>}{event.error&&<em data-no-translate>{event.error}</em>}</li>)}</ol>:<p>Keine Historie vorhanden.</p>)}
 </div>,locale);
}
