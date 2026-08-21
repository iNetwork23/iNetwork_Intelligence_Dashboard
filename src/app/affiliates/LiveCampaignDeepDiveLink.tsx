'use client';
import Link from'next/link';
import{useCallback,useEffect,useState,type MouseEvent}from'react';
import{affiliateCampaignHref}from'@/lib/optimization-workflow';

const liveHref=(campaignId:number,affiliateId:string)=>affiliateCampaignHref({campaignId,affiliateId,currentHref:window.location.href});

export default function LiveCampaignDeepDiveLink({campaignId,affiliateId,initialHref,label='Campaign-Tiefenanalyse öffnen'}:{campaignId:number;affiliateId:string;initialHref:string;label?:string}){
 const[href,setHref]=useState(initialHref);
 const sync=useCallback(()=>setHref(liveHref(campaignId,affiliateId)),[campaignId,affiliateId]);
 useEffect(()=>{
  sync();
  window.addEventListener('popstate',sync);
  window.addEventListener('affiliate-url-statechange',sync);
  return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('affiliate-url-statechange',sync)};
 },[sync]);
 const click=(event:MouseEvent<HTMLAnchorElement>)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const current=liveHref(campaignId,affiliateId);
  if(current===href)return;
  event.preventDefault();
  window.location.assign(current);
 };
 return <Link href={href} prefetch={false} onPointerDown={sync} onFocus={sync} onClick={click}>{label} <span aria-hidden="true">→</span></Link>;
}
