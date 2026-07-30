'use client';

import Link from'next/link';
import{useEffect,useMemo,useState}from'react';
import{campaignPartnerOptions,filterCampaignOptions,type CampaignOption}from'@/lib/campaign-picker';
import{smartlinkDeepDiveHref}from'@/lib/optimization-workflow';

type Props={campaigns:CampaignOption[];currentId?:number;affiliateId?:string;returnTo?:string;initialQuery?:string;initialPartner?:string;initialOpen?:string;associationError?:string};
const validPartner=(value?:string)=>value==='unassigned'||/^\d+$/.test(value||'')?value!:'all';
const validOpen=(value?:string)=>/^\d+$/.test(value||'')?Number(value):null;
const countLabel=(count:number)=>`${count} Smartlink${count===1?'':'s'}`;

function statefulHref(campaignId:number,affiliateId:string|undefined,returnTo:string|undefined,query:string,partner:string,open:number|null){
 const url=new URL(smartlinkDeepDiveHref({campaignId,affiliateId,returnTo}),'https://dashboard.local');
 if(query)url.searchParams.set('q',query);
 if(partner!=='all')url.searchParams.set('partner',partner);
 if(open)url.searchParams.set('open',String(open));
 return`${url.pathname}${url.search}`;
}

export default function CampaignPicker({campaigns,currentId,affiliateId,returnTo,initialQuery='',initialPartner,initialOpen,associationError=''}:Props){
 const[query,setQuery]=useState(initialQuery),[partner,setPartner]=useState(validPartner(initialPartner)),[openId,setOpenId]=useState<number|null>(validOpen(initialOpen)),partners=useMemo(()=>campaignPartnerOptions(campaigns),[campaigns]),effectivePartner=associationError?'all':partner,filtered=useMemo(()=>filterCampaignOptions(campaigns,query,effectivePartner),[campaigns,query,effectivePartner]);
 const persist=(next:{query?:string;partner?:string;openId?:number|null},push=false)=>{if(typeof window==='undefined')return;const url=new URL(window.location.href),nextQuery=next.query??query,nextPartner=next.partner??partner,nextOpen=next.openId===undefined?openId:next.openId;if(nextQuery)url.searchParams.set('q',nextQuery);else url.searchParams.delete('q');if(nextPartner!=='all')url.searchParams.set('partner',nextPartner);else url.searchParams.delete('partner');if(nextOpen)url.searchParams.set('open',String(nextOpen));else url.searchParams.delete('open');window.history[push?'pushState':'replaceState']({},'',`${url.pathname}${url.search}${url.hash}`)};
 useEffect(()=>{const restore=()=>{const params=new URLSearchParams(window.location.search);setQuery(params.get('q')||'');setPartner(validPartner(params.get('partner')||undefined));setOpenId(validOpen(params.get('open')||undefined))};window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)},[]);
 const changeQuery=(value:string)=>{setQuery(value);persist({query:value})},changePartner=(value:string)=>{setPartner(value);setOpenId(null);persist({partner:value,openId:null},true)},toggle=(id:number)=>{const next=openId===id?null:id;setOpenId(next);persist({openId:next})};
 return <section className="campaignPicker partnerCampaignPicker">
  <div className="pickerLabel"><div><b>SMARTLINKS UND PARTNER</b><span>{campaigns.length} Campaigns · beobachtete Zuordnung der letzten 30 Tage</span></div>{currentId&&<Link href="/smartlinks">Alle Smartlinks anzeigen</Link>}</div>
  {associationError&&<div className="campaignAssociationError" role="alert"><b>Partnerzuordnung nicht verfügbar</b><span>{associationError} Campaign-Daten bleiben sichtbar; es wird bewusst keine fehlende Zuordnung behauptet.</span></div>}
  <div className="campaignPickerControls">
   <label><span>Partner auswählen</span><select aria-label="Partner auswählen" value={effectivePartner} onChange={event=>changePartner(event.target.value)} disabled={Boolean(associationError)}><option value="all">Alle Partner · {countLabel(campaigns.length)}</option>{!associationError&&partners.map(item=><option key={item.id} value={item.id}>{item.name} · Affiliate #{item.id} · {countLabel(item.campaignCount)}</option>)}{!associationError&&<option value="unassigned">Partner nicht zugeordnet · {countLabel(campaigns.filter(item=>item.partners.length===0).length)}</option>}</select></label>
   <label className="pickerSearch"><span>Smartlinks durchsuchen</span><div className="pickerInput"><i aria-hidden="true">⌕</i><input aria-label="Smartlinks durchsuchen" value={query} onChange={event=>changeQuery(event.target.value)} placeholder="Smartlink, Campaign-ID, Partner oder Affiliate-ID suchen …" autoComplete="off"/><button type="button" onClick={()=>{setQuery('');persist({query:''})}} disabled={!query}>Leeren</button></div></label>
  </div>
  <div className="campaignDirectorySummary" aria-live="polite"><b>{filtered.length} Smartlinks</b><span>{effectivePartner==='all'?'Alle Partner':effectivePartner==='unassigned'?'Ohne beobachtete Zuordnung':`Affiliate #${effectivePartner}`}{query?` · Suche „${query}“`:''}</span></div>
  <div className="campaignDropdown partnerCampaignDirectory">{filtered.map(campaign=>{const expanded=openId===campaign.network_campaign_id,selectedPartner=effectivePartner!=='all'&&effectivePartner!=='unassigned'?campaign.partners.find(item=>item.id===effectivePartner):campaign.partners.length===1?campaign.partners[0]:undefined,incomingPartner=campaign.partners.find(item=>item.id===affiliateId),analysisAffiliate=selectedPartner?.id||incomingPartner?.id;return <article className={`partnerCampaignRow${campaign.network_campaign_id===currentId?' current':''}`} key={campaign.network_campaign_id}>
   <button type="button" className="partnerCampaignSummary" aria-expanded={expanded} aria-controls={`campaign-details-${campaign.network_campaign_id}`} onClick={()=>toggle(campaign.network_campaign_id)}><span className="campaignIdentity"><small>CAMPAIGN #{campaign.network_campaign_id}</small><strong>{campaign.campaign_name}</strong><em>{campaign.campaign_status} · {campaign.activeLandingpageCount} aktive LP-Slots</em></span><span className="campaignPartners">{associationError?<b className="mappingUnknown">Zuordnung nicht verfügbar</b>:campaign.partners.length?campaign.partners.map(item=><b key={item.id}>{item.name}<small>Affiliate #{item.id}</small></b>):<b className="unassigned">Partner nicht zugeordnet</b>}</span><i aria-hidden="true">{expanded?'−':'+'}</i></button>
   {expanded&&<div className="partnerCampaignDetails" id={`campaign-details-${campaign.network_campaign_id}`}>
    <section><div><span>PARTNERZUORDNUNG</span><h3>Beobachtete Partnerzuordnung · letzte 30 Tage</h3></div>{associationError?<p className="mappingUnknown">{associationError}</p>:campaign.partners.length?<div className="partnerAssignmentList">{campaign.partners.map(item=><article key={item.id}><div><b>{item.name}</b><small>Affiliate #{item.id}</small></div><Link href={`/affiliates?affiliate=${item.id}&mode=smartlinks`}>Partner im Affiliate Optimizer öffnen</Link></article>)}</div>:<p>Im 30-Tage-Beobachtungsfenster wurde kein Affiliate-Traffic gefunden. Das ist keine behauptete Eigentümerzuordnung.</p>}</section>
    <section><div className="campaignTechnical"><span><small>Campaign</small><b>#{campaign.network_campaign_id} · {campaign.campaign_status}</b></span><span><small>Tracking-Domain</small><b>{campaign.network_tracking_domain_id?`#${campaign.network_tracking_domain_id}`:'nicht hinterlegt'}</b></span><span><small>Aktuelle Slots</small><b>{campaign.redirects.length}</b></span></div>{campaign.redirects.length?<div className="campaignRedirectList">{campaign.redirects.map(slot=><article key={`${slot.offerId}-${slot.offerUrlId}`}><span><small>LP #{slot.offerUrlId} · Offer #{slot.offerId}</small><b>{slot.name}</b></span><span><b>{slot.weight.toLocaleString('de-DE')} %</b><small>{slot.status}</small></span></article>)}</div>:<p>Keine Redirect-Slots im Campaign-Snapshot.</p>}</section>
    <div className="campaignDetailActions"><Link href={statefulHref(campaign.network_campaign_id,analysisAffiliate,returnTo,query,effectivePartner,campaign.network_campaign_id)}>Smartlink analysieren</Link>{selectedPartner&&<Link href={`/affiliates?affiliate=${selectedPartner.id}&mode=smartlinks`}>Partner im Affiliate Optimizer öffnen</Link>}</div>
   </div>}
  </article>})}{!filtered.length&&<div className="campaignPickerEmpty"><b>Keine Smartlinks gefunden</b><span>Suche oder Partnerfilter ändern.</span></div>}</div>
 </section>;
}
