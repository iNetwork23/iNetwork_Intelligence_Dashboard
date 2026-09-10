'use client';

import {useEffect,useRef,useState} from 'react';
import type {SourceBlockInput,SourceBlockProviderPreview} from '@/lib/source-blocks';
import {useHydratedLocale} from '../components/LanguageProvider';

/** A user-triggered read; provider mutations continue to verify their own fresh state. */
export default function SourceBlockProviderPreviewPanel({identity,disabled=false}:{identity:SourceBlockInput;disabled?:boolean}){
 const en=useHydratedLocale()==='en',controller=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<SourceBlockProviderPreview|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const read=async()=>{
  if(loading||disabled)return;
  const abort=new AbortController();controller.current=abort;setLoading(true);setError(false);setPreview(null);
  const params=new URLSearchParams({action:'preview_provider'});
  for(const key of ['affiliateId','affiliateName','offerId','offerName','campaignId','trafficMode','level','mainValue','subValue'] as const){const value=identity[key];if(value!==null&&value!==undefined)params.set(key,value)}
  try{const response=await fetch(`/api/source-blocks?${params}`,{method:'GET',cache:'no-store',signal:abort.signal}),body=await response.json();if(!response.ok||!body.preview)throw new Error('preview unavailable');if(!abort.signal.aborted)setPreview(body.preview)}
  catch{if(!abort.signal.aborted)setError(true)}
  finally{if(!abort.signal.aborted)setLoading(false)}
 };
 return <section className="sourceBlockHistory" aria-label={en?'Provider preview':'Provider-Vorschau'} data-no-translate>
  <button type="button" className="sourceBlockHistoryToggle" onClick={read} disabled={disabled||loading}>{loading?(en?'Checking provider state …':'Providerzustand wird geprüft …'):(en?'Check provider state':'Providerzustand prüfen')}</button>
  <p>{en?'This check does not create, adopt or remove a rule.':'Diese Prüfung legt keine Regel an, übernimmt keine und entfernt keine.'}</p>
  {error&&<p className="sourceBlockError" role="alert">{en?'The provider state could not be fully checked. Nothing was changed. Retry before confirming.':'Der Providerzustand konnte nicht vollständig geprüft werden. Es wurde nichts geändert. Vor einer Bestätigung erneut prüfen.'}</p>}
  {preview&&<div role="status">
   <p>{en?'Checked':'Geprüft'}: {new Intl.DateTimeFormat(en?'en-GB':'de-DE',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(preview.checkedAt))} · Europe/Berlin</p>
   <p>{preview.operation==='create'?(en?'No matching rule exists. Confirmation would create a new rule.':'Keine passende Regel vorhanden. Eine Bestätigung würde eine neue Regel anlegen.'):(en?'Matching provider rules already exist; this would not be a new test rule.':'Passende Providerregeln sind bereits vorhanden; dies wäre keine neue Testregel.')}</p>
   {preview.matchingSettingIds.length>0&&<p>{en?'Existing setting IDs':'Vorhandene Setting-IDs'}: {preview.matchingSettingIds.join(', ')}</p>}
   <p>Affiliate #{preview.affiliateId} · Offer #{preview.offerId} · {preview.trafficMode}</p>
   <ul>{preview.variables.map(variable=><li key={variable.variable}>{variable.variable}: {variable.comparison_method==='not_present'?(en?'not supplied (not_present)':'nicht übermittelt (not_present)'):`${variable.variable_value} (exact_match)`}</li>)}</ul>
   <p>{en?'Planned effect: payout 0 and partner postback disabled. Traffic continues.':'Geplante Wirkung: Payout 0 und Partner-Postback aus. Traffic wird weiter angenommen.'}</p>
  </div>}
 </section>;
}
