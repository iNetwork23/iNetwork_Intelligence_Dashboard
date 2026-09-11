"use client";

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createPortal} from 'react-dom';
import {useHydratedLocale} from '../components/LanguageProvider';
import {localizeClientRoot} from '../components/LocalizedLinkContent';

type Status='active'|'paused';
type Props={campaignId:number;campaignName:string;affiliateId?:string;initialStatus:string;canManage:boolean};
function PowerIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M7.1 5.7a8 8 0 1 0 9.8 0"/></svg>}
export default function CampaignStatusButton({campaignId,campaignName,affiliateId='',initialStatus,canManage}:Props){
 const locale=useHydratedLocale();
 const router=useRouter(),[status,setStatus]=useState<Status>(initialStatus==='paused'?'paused':'active'),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),dialogRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow,opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';dialogRef.current?.focus();
  return()=>{document.body.style.overflow=previous;if(opener?.isConnected)opener.focus()};
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();if(!busy)setOpen(false);return}
   if(event.key!=='Tab')return;
   const dialog=dialogRef.current;if(!dialog)return;
   const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'));
   const first=controls[0],last=controls[controls.length-1],active=document.activeElement;
   if(!first){event.preventDefault();dialog.focus();return}
   if(event.shiftKey&&(active===first||active===dialog||!dialog.contains(active))){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(active===last||active===dialog||!dialog.contains(active))){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
 },[open,busy]);
 const supported=initialStatus==='active'||initialStatus==='paused';
 if(!canManage||!supported)return null;
 const paused=status==='paused',target:Status=paused?'active':'paused',label=paused?'Campaign wieder aktivieren':'Campaign pausieren';
 const mutate=async()=>{setBusy(true);setError('');try{const response=await fetch('/api/campaign-status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({campaignId,affiliateId,status:target})}),body=await response.json();if(!response.ok)throw new Error(body.error||'Campaign-Status konnte nicht geändert werden');setStatus(body.campaign.status);setOpen(false);router.refresh()}catch(value){setError(value instanceof Error?value.message:'Campaign-Status konnte nicht geändert werden')}finally{setBusy(false)}};
 const modal=open?localizeClientRoot(<div className="campaignStatusModal" role="dialog" aria-modal="true" aria-labelledby={`campaign-status-${campaignId}`} onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setOpen(false)}}><div className="campaignStatusDialog" ref={dialogRef} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><header><span className={paused?'active':''}><PowerIcon/></span><div><small>Campaign #{campaignId}</small><b id={`campaign-status-${campaignId}`}>{label}</b></div></header><dl><div><dt>Campaign</dt><dd data-no-translate>{campaignName}</dd></div><div><dt>Everflow-Wirkung</dt><dd>{paused?'Status wird auf „active“ gesetzt.':'Status wird auf „paused“ gesetzt; alle Affiliates und Redirects dieser Campaign sind betroffen.'}</dd></div></dl><p>{paused?'Die vorhandene Redirect-Rotation bleibt unverändert und wird wieder aktiviert. Externe Partnerkampagnen werden dadurch nicht gesteuert.':'Kein garantierter Traffic-Stopp: Everflow bestätigt nur den Campaign-Status. Partner oder Trafficquellen müssen gegebenenfalls separat pausiert werden; Redirects und Gewichte bleiben gespeichert.'}</p>{error&&<small className="sourceBlockError" role="alert">{error}</small>}<footer><button type="button" className="sourceBlockCancel" onClick={()=>setOpen(false)} disabled={busy}>Abbrechen</button><button type="button" className={paused?'sourceReactivate':'sourceConfirmBlock'} onClick={mutate} disabled={busy}>{busy?'Wird in Everflow verifiziert …':paused?'Jetzt aktivieren':'Campaign jetzt pausieren'}</button></footer></div></div>,locale):null;
 return localizeClientRoot(<span className="campaignStatusControl"><button type="button" className={`campaignStatusButton${paused?' paused':''}`} onClick={()=>setOpen(true)} aria-label={label} title={label} aria-pressed={paused}><PowerIcon/><span>{paused?'Campaign pausiert':'Campaign pausieren'}</span></button>{error&&!open&&<small className="sourceBlockError" role="alert">{error}</small>}{modal&&createPortal(modal, document.body)}</span>,locale)
}
