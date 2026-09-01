'use client';
import {useEffect,useRef,useState} from 'react';
import {copyText} from '@/lib/clipboard';

const fallbackCopy=(value:string)=>{const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();try{return document.execCommand('copy')}finally{area.remove()}};
export default function PortfolioCopyButton({text,label}:{text:string;label:string}){
 const [state,setState]=useState<'idle'|'copied'|'failed'>('idle'),timer=useRef<number|null>(null);
 useEffect(()=>()=>{if(timer.current!==null)window.clearTimeout(timer.current)},[]);
 const copy=async()=>{const ok=await copyText(text,navigator.clipboard,fallbackCopy);setState(ok?'copied':'failed');if(timer.current!==null)window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setState('idle'),2_000)};
 return <span className="portfolioCopyControl"><button type="button" className={`portfolioCopyButton ${state}`} onClick={copy} disabled={!text}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>{state==='copied'?'Kopiert':label}</button><span className="portfolioCopyFeedback" aria-live="polite">{state==='copied'?'Übersicht kopiert':state==='failed'?'Kopieren fehlgeschlagen':''}</span></span>;
}
