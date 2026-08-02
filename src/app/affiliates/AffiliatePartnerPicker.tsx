"use client";

import {useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {filterAffiliateChoices,parseAffiliatePins,sortAffiliateChoices,toggleAffiliatePin,type AffiliateTrafficFilter} from '@/lib/affiliate-pins';
import {isSameRouteTarget} from '@/lib/navigation-target';

export type AffiliatePickerPartner={id:string;name:string;hasDirect:boolean;directCount:number;campaignCount:number;profit:number};
const STORAGE_KEY='wlx-affiliate-pins';
const TRAFFIC_FILTERS=[{value:'all',label:'Alle'},{value:'smartlinks',label:'Smartlink'},{value:'direct',label:'Direct Link'}] as const;
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);

function PinIcon({active}:{active:boolean}){return <svg viewBox="0 0 24 24" aria-hidden="true" className={active?'active':''}><path d="M12 17v5"/><path d="M5 17h14"/><path d="M7 17l2-6V5L7 3h10l-2 2v6l2 6"/></svg>}

export default function AffiliatePartnerPicker({partners,currentId,rangeParams}:{partners:AffiliatePickerPartner[];currentId?:string;rangeParams:string}){
 const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams(),rootRef=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[trafficFilter,setTrafficFilter]=useState<AffiliateTrafficFilter>('all'),[pins,setPins]=useState<string[]>([]),[pendingPartner,setPendingPartner]=useState<AffiliatePickerPartner|null>(null),[pendingTarget,setPendingTarget]=useState(''),[navigationTimedOut,setNavigationTimedOut]=useState(false),[timedOutTarget,setTimedOutTarget]=useState(''),[,startTransition]=useTransition();
 const routeKey=`${pathname}?${searchParams.toString()}`;
 useEffect(()=>setPins(parseAffiliatePins(window.localStorage.getItem(STORAGE_KEY))),[]);
 useEffect(()=>{if(open)requestAnimationFrame(()=>searchRef.current?.focus())},[open]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!rootRef.current?.contains(event.target as Node))setOpen(false)},key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key)}},[]);
 useEffect(()=>{if(pendingPartner&&isSameRouteTarget(pendingTarget,routeKey)){setPendingPartner(null);setPendingTarget('');setTimedOutTarget('');setNavigationTimedOut(false)}},[pendingPartner,pendingTarget,routeKey]);
 useEffect(()=>{if(timedOutTarget&&isSameRouteTarget(timedOutTarget,routeKey)){setTimedOutTarget('');setNavigationTimedOut(false)}},[routeKey,timedOutTarget]);
 useEffect(()=>{if(!pendingPartner)return;const watchdog=window.setTimeout(()=>{setPendingPartner(null);setTimedOutTarget(pendingTarget);setPendingTarget('');setNavigationTimedOut(true)},8_000);return()=>window.clearTimeout(watchdog)},[pendingPartner,pendingTarget]);
 const current=partners.find(partner=>partner.id===currentId),displayPartner=pendingPartner||current,visible=useMemo(()=>filterAffiliateChoices(sortAffiliateChoices(partners,pins,query),trafficFilter),[partners,pins,query,trafficFilter]),pinned=visible.filter(partner=>pins.includes(partner.id)),others=visible.filter(partner=>!pins.includes(partner.id));
 const persistPins=(next:string[])=>{setPins(next);window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next))};
 const togglePin=(id:string)=>persistPins(toggleAffiliatePin(pins,id));
 const select=(partner:AffiliatePickerPartner)=>{const params=new URLSearchParams(rangeParams);params.set('affiliate',partner.id);params.set('mode',trafficFilter==='all'?(partner.hasDirect?'direct':'smartlinks'):trafficFilter);const target=`/affiliates?${params.toString()}`;setOpen(false);setQuery('');setNavigationTimedOut(false);setTimedOutTarget('');if(isSameRouteTarget(target,routeKey)){setPendingPartner(null);setPendingTarget('');return}setPendingPartner(partner);setPendingTarget(target);startTransition(()=>router.push(target))};
 const renderPartner=(partner:AffiliatePickerPartner)=><div className={`affiliatePickerRow ${partner.id===currentId?'selected':''}`} key={partner.id}>
  <button type="button" className="affiliatePickerSelect" onClick={()=>select(partner)} aria-current={partner.id===currentId?'true':undefined}>
   <span className="affiliatePickerAvatar">{partner.name.slice(0,1).toUpperCase()}</span><span><strong>{partner.name}</strong><small>Affiliate #{partner.id} · {partner.directCount} direkte LPs · {partner.campaignCount} Smartlinks</small></span><em className={partner.profit>=0?'up':'down'}>{euro(partner.profit)}</em>
  </button>
  <button type="button" className={`affiliatePinButton ${pins.includes(partner.id)?'pinned':''}`} onClick={()=>togglePin(partner.id)} aria-label={pins.includes(partner.id)?`${partner.name} lösen`:`${partner.name} anpinnen`} title={pins.includes(partner.id)?'Nicht mehr anpinnen':'Oben anpinnen'}><PinIcon active={pins.includes(partner.id)}/></button>
 </div>;
 return <div className="affiliatePicker" ref={rootRef}>
  <label>Affiliate-Partner</label>
  <button type="button" className={`affiliatePickerTrigger${pendingPartner?' affiliatePickerTriggerPending':''}`} aria-expanded={open} aria-controls="affiliate-picker-menu" aria-busy={Boolean(pendingPartner)} onClick={()=>setOpen(value=>!value)}>
   <span className="affiliatePickerAvatar">{displayPartner?.name.slice(0,1).toUpperCase()||'A'}</span><span><small>{pendingPartner?'Affiliate wird geöffnet':displayPartner?`Affiliate #${displayPartner.id}`:`${partners.length} Partner verfügbar`}</small><strong>{displayPartner?.name||'Affiliate auswählen'}</strong></span>{pendingPartner?<span className="affiliatePickerPending" role="status" aria-live="polite"><i/>Lädt …</span>:displayPartner&&pins.includes(displayPartner.id)&&<PinIcon active/>}<i aria-hidden="true">⌄</i>
  </button>
  {navigationTimedOut&&<p className="affiliatePickerTimeout" role="status">Das Laden dauert länger. Bitte Affiliate erneut auswählen.</p>}
  {open&&<div className="affiliatePickerMenu" id="affiliate-picker-menu">
   <div className="affiliatePickerSearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name oder Affiliate-ID suchen" aria-label="Affiliate suchen"/><span>{visible.length}</span></div>
   <div className="affiliatePickerTrafficFilter" aria-label="Partner nach Link-Typ filtern">{TRAFFIC_FILTERS.map(option=><button type="button" key={option.value} aria-pressed={trafficFilter===option.value} onClick={()=>setTrafficFilter(option.value)}>{option.label}</button>)}</div>
   <div className="affiliatePickerList">{pinned.length>0&&<section><header><PinIcon active/><span>Angepinnt</span></header>{pinned.map(renderPartner)}</section>}{others.length>0&&<section><header><span>Alle Partner</span><small>{others.length} verfügbar</small></header>{others.map(renderPartner)}</section>}{!visible.length&&<div className="affiliatePickerEmpty"><b>Kein passender Partner</b><small>Suchbegriff oder Link-Typ ändern.</small></div>}</div>
  </div>}
 </div>;
}
