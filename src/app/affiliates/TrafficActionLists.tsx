'use client';

import {useDeferredValue,useMemo,useState} from 'react';
import SourceSearchField from '../components/SourceSearchField';
import CandidateTopN,{CANDIDATE_TOP_N} from './CandidateTopN';
import {rankSourceMatches} from '@/lib/source-search';
import {buildActionCandidates,type ConversionMetric,type SourceBreakdownRow} from '@/lib/source-breakdown';
import {blockMarkerText,findBlockMarker,hiddenBlockedText,partitionBlockedCandidates,SOURCE_BLOCKS_HREF,type SourceBlockMarkerIndex} from '@/lib/source-block-markers';

const num=(n:number)=>new Intl.NumberFormat('de-DE').format(n);
const pct=(n:number)=>`${n.toFixed(1).replace('.',',')} %`;
const eur=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const metric=(m:ConversionMetric)=>m.clicks?`${pct(m.cvr)} (${num(m.sois)} / ${num(m.clicks)})`:`n/a (${num(m.sois)} / 0)`;

export default function TrafficActionLists({rows,urls,sourcePeriodLabel,blocks,canManage=false}:{rows:SourceBreakdownRow[];urls:Record<string,string>;sourcePeriodLabel:string;blocks?:SourceBlockMarkerIndex;canManage?:boolean}){
 const [query,setQuery]=useState('');
 const deferredQuery=useDeferredValue(query);
 const {stop,scale,watch,hidden}=useMemo(()=>{
  const all=rankSourceMatches(buildActionCandidates(rows,'days30'),deferredQuery,item=>[item.sourceId,item.subSource]);
  const {visible,hidden}=partitionBlockedCandidates(all,blocks);
  return{
   stop:visible.filter(item=>item.assessment.action==='AUSSCHALTEN'),
   scale:visible.filter(item=>item.assessment.action==='SKALIEREN'),
   watch:visible.filter(item=>item.assessment.action==='BEOBACHTEN'),
   hidden,
  };
 },[rows,deferredQuery,blocks]);
 const refreshing=query!==deferredQuery;
 const card=(item:ReturnType<typeof buildActionCandidates>[number])=>{const marker=findBlockMarker(blocks,item),markerText=marker?blockMarkerText(marker):null;return <article key={`${item.pathKey}|${item.sourceId}|${item.subSource||'source'}`}><header><b>{urls[item.offerUrlId]||`URL #${item.offerUrlId}`}</b><small>URL #{item.offerUrlId}</small></header><code>Source: {item.sourceId} · {item.subSource?`Sub-Source: ${item.subSource}`:'keine Sub-Source (Source-Fallback)'}</code><div><span>{metric(item.metric)}</span><b className={item.metric.profit>=0?'up':'down'}>{eur(item.metric.profit)}</b></div><p>{item.assessment.reason}</p>{markerText&&(canManage?<a className={`blockMarker ${marker?.status==='active'?'active':'unclear'}`} href={SOURCE_BLOCKS_HREF}>{markerText}</a>:<span className={`blockMarker ${marker?.status==='active'?'active':'unclear'}`}>{markerText}</span>)}</article>};
 const list=(items:ReturnType<typeof buildActionCandidates>,action:'stop'|'scale')=>items.length?<CandidateTopN className={`actionCandidateList ${action}`} head={items.slice(0,CANDIDATE_TOP_N).map(card)} rest={items.slice(CANDIDATE_TOP_N).map(card)} restCount={Math.max(0,items.length-CANDIDATE_TOP_N)}/>:<div className={`actionCandidateList ${action}`}><p className="actionEmpty">Keine {action==='stop'?'Abschalt-':'Skalierungs-'}Kandidaten für den Zeitraum und Suchbegriff.</p></div>;
 return <section className={`trafficActionReport${refreshing?' isRefreshing':''}`} aria-busy={refreshing}>
  <header><div><span>DIREKT UMSETZBARE TRAFFIC-ENTSCHEIDUNGEN</span><h2>Tracker-Liste auf tiefster Ebene</h2><p>Offer-URL, Source-ID und Sub-Source eindeutig benannt</p></div><span className="actionPeriod">Zeitraum: {sourcePeriodLabel}</span></header>
  <div className="trafficActionSearch"><SourceSearchField value={query} onChange={setQuery} placeholder="Source oder Sub1 in der Maßnahmenliste suchen" scopeId="traffic-actions"/></div>
  <div className="actionReportSummary"><span><b className="down">{stop.length}</b> Abschalten</span><span><b className="up">{scale.length}</b> Skalieren</span><span><b>{watch.length}</b> Beobachten</span></div>
  {hidden.length>0&&<p className="blockedHidden">{hiddenBlockedText(hidden.length)}{canManage&&<a href={SOURCE_BLOCKS_HREF}>Sperren ansehen</a>}</p>}
  <div className="actionReportColumns"><section><h3>AUSSCHALTEN</h3>{list(stop,'stop')}</section><section><h3>SKALIEREN</h3>{list(scale,'scale')}</section></div>
 </section>;
}
