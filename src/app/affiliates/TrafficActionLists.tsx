'use client';

import {useDeferredValue,useMemo,useState} from 'react';
import SourceSearchField from '../components/SourceSearchField';
import {rankSourceMatches} from '@/lib/source-search';
import {buildActionCandidates,type ConversionMetric,type SourceBreakdownRow} from '@/lib/source-breakdown';

const num=(n:number)=>new Intl.NumberFormat('de-DE').format(n);
const pct=(n:number)=>`${n.toFixed(1).replace('.',',')} %`;
const eur=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const metric=(m:ConversionMetric)=>m.clicks?`${pct(m.cvr)} (${num(m.sois)} / ${num(m.clicks)})`:`n/a (${num(m.sois)} / 0)`;

export default function TrafficActionLists({rows,urls,sourcePeriodLabel}:{rows:SourceBreakdownRow[];urls:Record<string,string>;sourcePeriodLabel:string}){
 const [query,setQuery]=useState('');
 const deferredQuery=useDeferredValue(query);
 const {stop,scale,watch}=useMemo(()=>{
  const all=rankSourceMatches(buildActionCandidates(rows,'days30'),deferredQuery,item=>[item.sourceId,item.subSource]);
  return{
   stop:all.filter(item=>item.assessment.action==='ABSCHALTEN'),
   scale:all.filter(item=>item.assessment.action==='SKALIEREN'),
   watch:all.filter(item=>item.assessment.action==='BEOBACHTEN'),
  };
 },[rows,deferredQuery]);
 const refreshing=query!==deferredQuery;
 const list=(items:ReturnType<typeof buildActionCandidates>,action:'stop'|'scale')=><div className={`actionCandidateList ${action}`}>{items.length?items.map(item=><article key={`${item.pathKey}|${item.sourceId}|${item.subSource||'source'}`}><header><b>{urls[item.offerUrlId]||`URL #${item.offerUrlId}`}</b><small>URL #{item.offerUrlId}</small></header><code>Source: {item.sourceId} · {item.subSource?`Sub-Source: ${item.subSource}`:'keine Sub-Source (Source-Fallback)'}</code><div><span>{metric(item.metric)}</span><b className={item.metric.profit>=0?'up':'down'}>{eur(item.metric.profit)}</b></div><p>{item.assessment.reason}</p></article>):<p className="actionEmpty">Keine {action==='stop'?'Abschalt-':'Skalierungs-'}Kandidaten für den Zeitraum und Suchbegriff.</p>}</div>;
 return <section className={`trafficActionReport${refreshing?' isRefreshing':''}`} aria-busy={refreshing}>
  <header><div><span>DIREKT UMSETZBARE TRAFFIC-ENTSCHEIDUNGEN</span><h2>Tracker-Liste auf tiefster Ebene</h2><p>Offer-URL, Source-ID und Sub-Source eindeutig benannt</p></div><span className="actionPeriod">Zeitraum: {sourcePeriodLabel}</span></header>
  <div className="trafficActionSearch"><SourceSearchField value={query} onChange={setQuery} placeholder="Source oder Sub1 in der Maßnahmenliste suchen" scopeId="traffic-actions"/></div>
  <div className="actionReportSummary"><span><b className="down">{stop.length}</b> Abschalten</span><span><b className="up">{scale.length}</b> Skalieren</span><span><b>{watch.length}</b> Beobachten</span></div>
  <div className="actionReportColumns"><section><h3>ABSCHALTEN</h3>{list(stop,'stop')}</section><section><h3>SKALIEREN</h3>{list(scale,'scale')}</section></div>
 </section>;
}
