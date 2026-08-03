"use client";
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import type {FraudSourceIdentity} from '@/lib/fraud-control';

type Props={
  affiliateId:string;
  offerId:string;
  source:string;
  subSource:string;
  sourceDimension:FraudSourceIdentity['sourceDimension'];
  subSourceDimension:FraudSourceIdentity['subSourceDimension'];
};

export default function FraudStopRowButton(props:Props){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const exact=props.sourceDimension!=='unknown'&&props.subSourceDimension!=='unknown';
  async function stop(){
    if(!exact||busy)return;
    if(!window.confirm(`Quelle ${props.source} / ${props.subSource} für Affiliate #${props.affiliateId} über alle Offers als gestoppt markieren?`))return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/fraud/stops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({affiliateId:props.affiliateId,source:props.source,subSource:props.subSource,sourceDimension:props.sourceDimension,subSourceDimension:props.subSourceDimension,offerId:props.offerId,scope:'all_offers',requestedAt:new Date().toISOString(),graceHours:24,channel:'dashboard',reference:`Fraud-Dashboard · Offer #${props.offerId}`})}),body=await response.json();
      if(!response.ok)throw new Error(body.error||'Stop konnte nicht gespeichert werden');
      router.refresh();
    }catch(value){setError(value instanceof Error?value.message:'Stop konnte nicht gespeichert werden')}finally{setBusy(false)}
  }
  return <div className="fraudRowAction"><button className="fraudStopNow" type="button" disabled={!exact||busy} onClick={stop}>{busy?'Speichert …':'Jetzt als gestoppt markieren'}</button>{!exact&&<small>Dimension unbekannt</small>}{error&&<small className="fraudInlineError">{error}</small>}</div>;
}
