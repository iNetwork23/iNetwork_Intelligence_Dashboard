'use client';

import {useDeferredValue,useMemo,useState} from 'react';
import SourceSearchField from '../components/SourceSearchField';
import TrendList from './TrendList';
import {rankSourceMatches} from '@/lib/source-search';
import {buildActionCandidates,type SourceBreakdownRow} from '@/lib/source-breakdown';
import {buildPriorityList,candidatePriorityItems,isActionable,type DailyByKey} from '@/lib/affiliate-priority';
import {hiddenBlockedText,partitionBlockedCandidates,SOURCE_BLOCKS_HREF,type SourceBlockMarkerIndex} from '@/lib/source-block-markers';
import type {LatencyInput} from '@/lib/verdict-trust';

/**
 * Tracker-Liste auf tiefster Ebene (Source/Sub-Source je Offer-URL) – seit Etappe 3 Zulieferung der EINEN priorisierten Liste:
 * AUSSCHALTEN und SKALIEREN immer, BEOBACHTEN nur bei negativem Profit; aktiv gesperrte Einheiten bleiben ausgeblendet und gezählt,
 * unklare Sperren bleiben mit Marker sichtbar. Suche, Zeitraum-Label und Sperr-Marker aus Etappe 2 bleiben.
 */
export default function TrafficActionLists({rows,urls,sourcePeriodLabel,blocks,canManage=false,affiliateName='Affiliate',offerName='Offer',finance=true,latency,dailyByKey,rangeParams=''}:{rows:SourceBreakdownRow[];urls:Record<string,string>;sourcePeriodLabel:string;blocks?:SourceBlockMarkerIndex;canManage?:boolean;affiliateName?:string;offerName?:string;finance?:boolean;latency?:LatencyInput|null;/** Tageswerte je Kandidat (Schlüssel wie candidateItemKey: pathKey|mode|main|sub); ohne Daten keine Sparkline. */dailyByKey?:DailyByKey;/** Zeitraum-Parameter für die Deep-Links der Zeilen (openSourceRowHref). */rangeParams?:string}){
 const [query,setQuery]=useState('');
 const deferredQuery=useDeferredValue(query);
 const {list,watch,hidden}=useMemo(()=>{
  const all=rankSourceMatches(buildActionCandidates(rows,'days30'),deferredQuery,item=>[item.sourceId,item.subSource]);
  const {visible,hidden}=partitionBlockedCandidates(all,blocks);
  const items=candidatePriorityItems(visible,{affiliate:affiliateName,offer:offerName,urls},blocks,dailyByKey);
  return{list:buildPriorityList(items.filter(isActionable)),watch:items.filter(item=>item.action==='BEOBACHTEN').length,hidden};
 },[rows,deferredQuery,blocks,urls,affiliateName,offerName,dailyByKey]);
 const refreshing=query!==deferredQuery;
 return <section className={`trafficActionReport${refreshing?' isRefreshing':''}`} aria-busy={refreshing}>
  <header><div><span>DIREKT UMSETZBARE TRAFFIC-ENTSCHEIDUNGEN</span><h2>Tracker-Liste auf tiefster Ebene</h2><p>Offer-URL, Source-ID und Sub-Source eindeutig benannt · eine Liste nach Profit-Wirkung</p></div><span className="actionPeriod">Zeitraum: {sourcePeriodLabel}</span></header>
  <div className="trafficActionSearch"><SourceSearchField value={query} onChange={setQuery} placeholder="Source oder Sub1 in der Maßnahmenliste suchen" scopeId="traffic-actions"/></div>
  <div className="actionReportSummary"><span><b className="critical">{list.counts.AUSSCHALTEN}</b> AUSSCHALTEN</span><span><b className="positive">{list.counts.SKALIEREN}</b> SKALIEREN</span><span><b>{watch}</b> BEOBACHTEN</span></div>
  {hidden.length>0&&<p className="blockedHidden">{hiddenBlockedText(hidden.length)}{canManage&&<a href={SOURCE_BLOCKS_HREF}>Sperren ansehen</a>}</p>}
  <TrendList kicker="TRACKER-KANDIDATEN" title="Source und Sub-Source nach Profit-Wirkung" items={list.items} emptyReason="Keine Kandidaten mit Handlungsbedarf für den Zeitraum und Suchbegriff." rangeParams={rangeParams} finance={finance} latency={latency} canManage={canManage}/>
 </section>;
}
