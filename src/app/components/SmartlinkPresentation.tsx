'use client';

import {Fragment,useMemo,useState,type KeyboardEvent,type ReactNode} from 'react';
import {groupSmartlinkSourcesByMain,latestLeadActivity,leadBadge,nextAnalysisTab,smartlinkInstanceKey,sortSmartlinkSlots,sortSourceBreakdownRows,type AnalysisTab,type SmartlinkSort,type SmartlinkSourceGroup,type SortDirection,type SourceMetricSort} from '../../lib/smartlink-presentation';
import {rankSourceMatches} from '../../lib/source-search';
import type {SlotRecommendation,SmartSlot,SmartlinkSourceBreakdown,SmartlinkSourceCoverage} from '../../lib/smartlink';
import {leadActivityStatus} from '../../lib/source-breakdown';
import CopyValue from '../affiliates/CopyValue';
import SourcePairCopy from '../affiliates/SourcePairCopy';
import SourceBlockButton from '../affiliates/SourceBlockButton';
import SourceSearchField from './SourceSearchField';
import{buildCampaignSourceRows,type CampaignSourceRow}from'../../lib/smartlink-source-workspace';
import{cvrTone,signTone,type Volume}from'../../lib/verdict-vocabulary';
import{toneClass}from'../../lib/verdict-trust';

/** Vorzeichenfarbe nur bei reifer Evidenz (D15): Volumen der Zeile/Gruppe entscheidet, ob ein Vorzeichen eine Farbe bekommt. */
const volumeOf=(m:{clicks:number;sois:number}):Volume=>({clicks:m.clicks,sois:m.sois});
const moneyClass=(profit:number,m:{clicks:number;sois:number})=>toneClass(signTone(profit,volumeOf(m)));
const moneyText=(profit:number,m:{clicks:number;sois:number})=>{const tone=signTone(profit,volumeOf(m));return tone==='positive'?'Positiver Profit':tone==='negative'?'Verlust im Zeitraum':profit===0?'Ausgeglichen':'unter Reifeschwelle'};
/** Kampagnenweite CVR als Vergleichswert (D1: kein fester Zielwert) für die CVR-Ampel der Landingpages. */
const campaignCvrBenchmark=(slots:SmartSlot[])=>{const clicks=slots.reduce((sum,slot)=>sum+slot.metrics24.clicks,0),sois=slots.reduce((sum,slot)=>sum+slot.metrics24.sois,0);return clicks>0?100*sois/clicks:null};

const euro=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const num=(n:number)=>new Intl.NumberFormat('de-DE').format(n);
const pct=(n:number)=>`${n.toFixed(2).replace('.',',')} %`;
const actionLabel:{[K in SlotRecommendation['action']]:string}={stop:'STOPPEN',rotate:'ROTIEREN',scale:'SKALIEREN',protect:'SCHÜTZEN',hold:'HALTEN'};
const statusActionLabel:{[K in SlotRecommendation['action']]:string}={stop:'Stoppen',rotate:'Rotieren',scale:'Skalieren',protect:'Schützen',hold:'Halten'};

type Windows={traffic:string;economics:string;maturity:string;source?:string};

export function KpiValue({label,value,detail,scope,size='m',tone='neutral'}:{label:string;value:string;detail?:string;scope?:string;size?:'l'|'m'|'s';tone?:'positive'|'negative'|'neutral'}){
 return <div className={`sharedKpi size-${size} tone-${tone}`}><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}{scope&&<em>{scope}</em>}</div>;
}

export function TimeWindowSection({title,subtitle,children,className=''}:{title:string;subtitle?:string;children:ReactNode;className?:string}){
 return <section className={`timeWindowSection ${className}`.trim()}><header><b>{title}</b>{subtitle&&<span>{subtitle}</span>}</header><div>{children}</div></section>;
}

export function RecommendationBanner({recommendation,scope='Aktuelle BI-Empfehlung · Nur Anzeige'}:{recommendation:SlotRecommendation;scope?:string}){
 return <section className={`sharedRecommendation ${recommendation.severity}`}><div><span>{scope}</span><h3>{recommendation.title}</h3><p>{recommendation.detail}</p></div><b>{actionLabel[recommendation.action]}</b></section>;
}

export function StatusBadge({recommendation}:{recommendation?:SlotRecommendation}){
 const rec=recommendation||{action:'hold',severity:'neutral',title:'Beobachten',detail:'Noch keine belastbare Empfehlung.'} as SlotRecommendation;
 const tip=`${rec.title}: ${rec.detail}`;
 return <span role="status" tabIndex={0} className={`sharedStatusBadge ${rec.severity}`} data-tooltip={tip} aria-label={`Empfehlung: ${statusActionLabel[rec.action]}. ${tip}`}>Empfehlung: {statusActionLabel[rec.action]}</span>;
}

const sourceSortOptions:[SourceMetricSort,string][]=[['clicks','Klicks'],['sois','SOIs'],['cvr','CVR'],['firstSales','First-Sales'],['rebills','Rebills'],['coinSpend','Coin-Spend'],['revenue','Umsatz'],['payout','Payout'],['profit','Profit']];
const share=(value:number,total:number)=>total?`${(100*value/total).toFixed(1).replace('.',',')} %`:'n/a';
const technicalSourceValue=(technical:string|null|undefined,display:string)=>technical===undefined?(display&&display!=='Nicht übermittelt'?display:null):technical;
const sourceDimensionLabels=(row:SmartlinkSourceBreakdown)=>({main:row.mode==='api'?'ADV1':'Source',sub:row.mode==='api'?'ADV2':'Sub1'});
const transmitted=(value:string|null|undefined)=>Boolean(value&&value!=='Nicht übermittelt');
const sourcePresentation=(input:{source?:string|null;subSource?:string|null;mainLabel:string;subLabel:string})=>{const hasMain=transmitted(input.source),hasSub=transmitted(input.subSource),missingMain=input.mainLabel==='Source'?'Source-ID nicht übermittelt':`${input.mainLabel} nicht übermittelt`;return hasMain?{primary:input.source!,primaryLabel:input.mainLabel,secondary:hasSub?input.subSource!:null,secondaryLabel:input.subLabel,missingMain:null}:{primary:hasSub?input.subSource!:'Nicht übermittelt',primaryLabel:hasSub?input.subLabel:input.mainLabel,secondary:null,secondaryLabel:null,missingMain:hasSub?missingMain:null}};
const shortDay=(day:string)=>day?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${day}T12:00:00Z`)):'';
function SourceActivity({row}:{row:SmartlinkSourceBreakdown}){const status=leadActivityStatus({lastLeadDate:row.lastLeadDate||null,asOf:row.activityAsOf||'',coverageComplete:Boolean(row.activityCoverageComplete),lookbackDays:row.activityLookbackDays||365}),date=row.lastLeadDate?row.lastLeadDate.split('-').reverse().join('.'):null;return <span className={`leadActivity ${status.tone}`} aria-label={`${status.label}. ${date?`Letzter Lead: ${date}. `:''}${status.detail}`}><b>{date||status.label}</b><small>{date?'Letzter Lead':status.detail}</small>{date&&<em>{status.detail}</em>}</span>}

function SourceMetric({label,value,tone='neutral'}:{label:string;value:string;tone?:'positive'|'negative'|'neutral'}){return <span className={`lpSourceMetric ${tone}`}><small>{label}</small><b>{value}</b></span>}

const sourceRowKey=(row:SmartlinkSourceBreakdown)=>`${row.mode}|${row.source}|${row.subSource}`;

export function LandingpageSourceBreakdown({rows,scope,totalSois,landingpageId,coverage,onOpenChange,affiliateId='',affiliateName='Affiliate',offerId='',offerName='Offer',campaignId,canManage=false,embedded=false}:{rows:SmartlinkSourceBreakdown[];scope:string;totalSois:number;landingpageId:string;coverage?:SmartlinkSourceCoverage;onOpenChange?:(open:boolean)=>void;affiliateId?:string;affiliateName?:string;offerId?:string;offerName?:string;campaignId?:string;canManage?:boolean;embedded?:boolean}){
 const [sort,setSort]=useState<SourceMetricSort>('profit');
 const [direction,setDirection]=useState<SortDirection>('asc');
 const [query,setQuery]=useState('');
 const [visibleCount,setVisibleCount]=useState(12);
 const [selectedKey,setSelectedKey]=useState('');
 const instanceKey=smartlinkInstanceKey(campaignId,landingpageId);
 const sorted=useMemo(()=>sortSourceBreakdownRows(rows,sort,direction),[rows,sort,direction]);
 const matched=useMemo(()=>rankSourceMatches(sorted,query,row=>[row.source,row.subSource]),[sorted,query]);
 const groups=useMemo(()=>groupSmartlinkSourcesByMain(matched,sort,direction),[matched,sort,direction]);
 const visibleGroups:SmartlinkSourceGroup[]=groups.slice(0,visibleCount);
 const visible=visibleGroups.flatMap((group:SmartlinkSourceGroup)=>group.rows);
 const selected=visible.find(row=>sourceRowKey(row)===selectedKey)||visible[0];
 const selectedLabels=selected?sourceDimensionLabels(selected):{main:'Source',sub:'Sub1'},selectedIdentity=sourcePresentation({source:selected?.source,subSource:selected?.subSource,mainLabel:selectedLabels.main,subLabel:selectedLabels.sub}),selectedMainValue=selected?technicalSourceValue(selected.mainValue,selected.source):null,selectedSubValue=selected?technicalSourceValue(selected.subValue,selected.subSource):null;
 const sourceSois=rows.reduce((sum,row)=>sum+row.sois,0);
 const sourceFirstSales=rows.reduce((sum,row)=>sum+row.firstSales,0);
 const sourceRebills=rows.reduce((sum,row)=>sum+row.rebills,0);
 const sourceCoinSpend=rows.reduce((sum,row)=>sum+row.coinSpend,0);
 const sourceRevenue=rows.reduce((sum,row)=>sum+row.revenue,0);
 const sourceProfit=rows.reduce((sum,row)=>sum+row.profit,0);
 const reconciled=sourceSois===totalSois&&(!coverage||coverage.missingDays.length===0);
 const chooseSort=(next:SourceMetricSort)=>{if(next===sort)setDirection(current=>current==='asc'?'desc':'asc');else{setSort(next);setDirection('desc')}setVisibleCount(12)};
 const heading=<span><b>LP #{landingpageId} · Woher kommen die Leads?</b><small>{rows.length} Source-Kombination{rows.length===1?'':'en'} · {sourceSois} von {totalSois} SOIs nach Herkunft zugeordnet · {scope}</small></span>;
 const panel=<div className="lpSourcePanel">
  {coverage&&<aside className={`lpSourceCoverage ${coverage.missingDays.length?'incomplete':'complete'}`}><b>Datenabdeckung Quellenanalyse: {coverage.acceptedDays} von {coverage.expectedDays} Tagen</b><span>{coverage.acceptedFrom&&coverage.acceptedTo?`${shortDay(coverage.acceptedFrom).slice(0,6)}–${shortDay(coverage.acceptedTo)}`:'Keine akzeptierten Snapshot-Tage'}</span>{coverage.missingDays.length>0&&<small>Fehlende Tage: {coverage.missingDays.map(shortDay).join(', ')}</small>}</aside>}
  <section className="lpSourceSummary" aria-label="Zusammenfassung Quellenanalyse"><span><b>{num(rows.length)}</b><small>Quellen</small></span><span><b>{num(sourceSois)}</b><small>SOIs</small></span><span><b>{num(sourceFirstSales)}</b><small>First-Sales</small></span><span><b>{num(sourceRebills)}</b><small>Rebills</small></span><span><b>{num(sourceCoinSpend)}</b><small>Coin-Spend</small></span><span><b>{euro(sourceRevenue)}</b><small>Umsatz</small></span><span className={moneyClass(sourceProfit,{clicks:rows.reduce((sum,row)=>sum+row.clicks,0),sois:sourceSois})}><b>{euro(sourceProfit)}</b><small>Profit</small></span></section>
  <div className="sourcePanelToolbar"><SourceSearchField value={query} onChange={setQuery} placeholder="Source, Sub1, ADV1 oder ADV2 suchen" scopeId={`landingpage-${instanceKey}`}/><div className="sourceSort" role="group" aria-label="Source-Kombinationen nach Zahlenwert sortieren"><small>Sortieren nach</small>{sourceSortOptions.map(([id,label])=>{const active=sort===id,current=direction==='asc'?'niedrigste zuerst':'höchste zuerst',next=direction==='asc'?'höchste zuerst':'niedrigste zuerst';return <button type="button" key={id} className={active?'active':''} aria-pressed={active} aria-label={`Nach ${label} sortieren${active?`: derzeit ${current}; klicken für ${next}`:': höchste zuerst'}`} onClick={()=>chooseSort(id)}>{label}{active?` ${direction==='asc'?'↑':'↓'}`:''}</button>})}</div></div>
  {visible.length?<div className="lpSourceMasterDetail">
   <section className="lpSourceRanking" aria-label={`Lead-Herkunft für LP #${landingpageId}`}>
    <header><span>Source / Sub1</span><span>SOIs</span><span>First-Sales</span><span>Rebills</span><span>Coin-Spend</span><span>Umsatz / Payout</span><span>Profit</span></header>
    {visibleGroups.map((group:SmartlinkSourceGroup)=>{const groupKey=`${group.mode}|${group.source}`,single=group.rows.length===1;
     const leafButton=(row:SmartlinkSourceBreakdown,nested:boolean)=>{const key=sourceRowKey(row),active=sourceRowKey(selected)===key,labels=sourceDimensionLabels(row),identity=sourcePresentation({source:row.source,subSource:row.subSource,mainLabel:labels.main,subLabel:labels.sub});return <button type="button" key={key} className={`${nested?'lpSourceSubRow ':''}${active?'selected':''}`.trim()} aria-pressed={active} onClick={()=>setSelectedKey(key)}>
      <span><b>{nested?(identity.secondary||'Nicht übermittelt'):identity.primary}</b><small>{nested?identity.secondaryLabel:(identity.missingMain||`${identity.secondaryLabel} · ${identity.secondary||'Nicht übermittelt'}`)}</small></span>
      <span><b>{num(row.sois)}</b><small>{share(row.sois,totalSois)}</small></span>
      <span><b>{num(row.firstSales)}</b><small>{share(row.firstSales,row.sois)}</small></span>
      <span><b>{num(row.rebills)}</b><small>Rebills</small></span>
      <span><b>{num(row.coinSpend)}</b><small>Coin-Spend</small></span>
      <span><b>{euro(row.revenue)}</b><small>{euro(row.payout)} Payout</small></span>
      <span className={moneyClass(row.profit,row)}><b>{euro(row.profit)}</b><small>{moneyText(row.profit,row)}</small></span>
     </button>};
     if(single)return <Fragment key={groupKey}>{leafButton(group.rows[0],false)}</Fragment>;
     return <Fragment key={groupKey}>
      <div className={`lpSourceGroupRow ${group.verdict}`}>
       <span><b>{group.source}</b><small>{group.rows.length} Sub1-Werte zusammengefasst</small></span>
       <span><b>{num(group.totals.sois)}</b><small>{share(group.totals.sois,totalSois)}</small></span>
       <span><b>{num(group.totals.firstSales)}</b><small>{share(group.totals.firstSales,group.totals.sois)}</small></span>
       <span><b>{num(group.totals.rebills)}</b><small>Rebills</small></span>
       <span><b>{num(group.totals.coinSpend)}</b><small>Coin-Spend</small></span>
       <span><b>{euro(group.totals.revenue)}</b><small>{euro(group.totals.payout)} Payout</small></span>
       <span className={moneyClass(group.totals.profit,group.totals)}><b>{euro(group.totals.profit)}</b><small>{group.verdict==='verdient'?'Verdient Geld':group.verdict==='verbrennt'?'Verbrennt Geld':'Ausgeglichen'}</small></span>
      </div>
      {group.rows.map((row:SmartlinkSourceBreakdown)=>leafButton(row,true))}
     </Fragment>})}
   </section>
   <article className="lpSourceDetail" aria-live="polite">
    <header><div className="lpSourceIdentity">{selectedIdentity.missingMain&&<span className="lpSourceIdentityNote">{selectedIdentity.missingMain}</span>}{transmitted(selected.source)&&<CopyValue label={selectedLabels.main} value={selected.source}/>}<CopyValue label={selectedLabels.sub} value={selected.subSource||'Nicht übermittelt'}/></div>{transmitted(selected.source)&&<SourcePairCopy mode={selected.mode==='api'?'api':'tracked'} source={selected.source} subSource={selected.subSource||'Nicht übermittelt'}/>}</header>
    {canManage&&affiliateId&&offerId&&<div className="lpSourceActions" aria-label="Quellensteuerung">{selectedMainValue&&<SourceBlockButton affiliateId={affiliateId} affiliateName={affiliateName} offerId={offerId} offerName={offerName} campaignId={campaignId} trafficMode={selected.mode} level="main_source" mainValue={selectedMainValue}/>} {selectedSubValue&&<SourceBlockButton affiliateId={affiliateId} affiliateName={affiliateName} offerId={offerId} offerName={offerName} campaignId={campaignId} trafficMode={selected.mode} level="sub_source" mainValue={selectedMainValue} subValue={selectedSubValue}/>}<small>Ausschalten sperrt Vergütung und Partner-Postback affiliate- und offerweit, auch in anderen Campaigns. Eingehenden Traffic steuert der Partner.</small></div>}
    <div className="lpSourcePriority"><span><small>Letzter Lead</small><SourceActivity row={selected}/></span><SourceMetric label="Profit" value={euro(selected.profit)} tone={signTone(selected.profit,volumeOf(selected))}/><SourceMetric label="SOIs · Anteil" value={`${num(selected.sois)} SOIs · ${share(selected.sois,totalSois)}`}/><SourceMetric label="First-Sales · Rate" value={`${num(selected.firstSales)} · ${share(selected.firstSales,selected.sois)}`}/></div>
    <div className="lpSourceSecondary"><SourceMetric label="Klicks" value={selected.mode==='api'?'n/a – clickless':num(selected.clicks)}/><SourceMetric label="CVR" value={selected.cvr===null?'n/a – clickless':pct(selected.cvr)}/><SourceMetric label="Rebills" value={num(selected.rebills)}/><SourceMetric label="Coin-Spend · Eventquote" value={`${num(selected.coinSpend)} · ${share(selected.coinSpend,selected.sois)}`}/><SourceMetric label="Umsatz" value={euro(selected.revenue)}/><SourceMetric label="Payout" value={euro(selected.payout)}/></div>
    <small className="coinSpendDefinition">Eventquote, keine Kundenquote. Ein Kunde kann mehrere Coin-Spend-Events verursachen.</small>
   </article>
  </div>:<p className="emptyInline">{query.trim()?`Keine Quelle passt zu „${query.trim()}“.`:'Keine Source-Daten in diesem Zeitraum. Fehlende Werte werden als „Nicht übermittelt“ ausgewiesen.'}</p>}
  {visibleCount<groups.length&&<button type="button" className="showMoreSources" onClick={()=>setVisibleCount(count=>Math.min(count+12,groups.length))}>Weitere {num(Math.min(12,groups.length-visibleCount))} Quellen anzeigen</button>}
 </div>;
 if(embedded)return <section className="lpSourceBreakdown embedded"><header className="lpSourceEmbeddedHeader">{heading}<strong className={reconciled?'up':'down'}>{reconciled?'Vollständig zugeordnet':'Abweichung prüfen'}</strong></header>{panel}</section>;
 return <details className="lpSourceBreakdown" onToggle={event=>onOpenChange?.(event.currentTarget.open)}><summary>{heading}<strong className={reconciled?'up':'down'}>{reconciled?'Vollständig zugeordnet':'Abweichung prüfen'}</strong><i aria-hidden="true">›</i></summary>{panel}</details>;
}

export function ProvisionalSourceList({rows}:{rows:SmartlinkSourceBreakdown[]}){
 const [sort,setSort]=useState<SourceMetricSort>('sois');
 const [direction,setDirection]=useState<SortDirection>('desc');
 const groups=useMemo(()=>groupSmartlinkSourcesByMain(rows,sort,direction),[rows,sort,direction]);
 const chooseSort=(next:SourceMetricSort)=>{if(next===sort)setDirection(current=>current==='asc'?'desc':'asc');else{setSort(next);setDirection('desc')}};
 if(!rows.length)return <p>Keine Source-ID im verfügbaren Snapshot.</p>;
 const events=(row:SmartlinkSourceBreakdown)=>`${num(row.firstSales)} First-Sales · ${num(row.rebills)} Rebills · ${num(row.coinSpend)} Coin-Spend-Events`;
 const cvrText=(clicks:number,sois:number)=>clicks>0?`${(100*sois/clicks).toFixed(1).replace('.',',')} %`:'—';
 const moneyTone=(value:number,m:{clicks:number;sois:number})=>toneClass(signTone(value,volumeOf(m)))||'flat';
 const isDormant=(row:SmartlinkSourceBreakdown)=>!row.clicks&&!row.sois&&!row.firstSales&&!row.rebills&&!row.coinSpend&&!row.revenue&&!row.payout&&!row.profit;
 const verdictText=(group:SmartlinkSourceGroup)=>group.verdict==='verdient'?'Verdient Geld':group.verdict==='verbrennt'?'Verbrennt Geld':'Ausgeglichen';
 return <div className="incompleteSourceList"><div className="incompleteSourceSort" role="group" aria-label="Vorläufige Quellen nach Zahlenwert sortieren"><small>Sortieren nach</small>{sourceSortOptions.map(([id,label])=>{const active=id===sort,current=direction==='asc'?'niedrigste zuerst':'höchste zuerst',next=direction==='asc'?'höchste zuerst':'niedrigste zuerst';return <button type="button" key={id} className={active?'active':''} aria-pressed={active} aria-label={`Nach ${label} sortieren${active?`: derzeit ${current}; klicken für ${next}`:': höchste zuerst'}`} onClick={()=>chooseSort(id)}>{label}{active?` ${direction==='asc'?'↑':'↓'}`:''}</button>})}</div>{groups.map((group:SmartlinkSourceGroup)=>{
  const first=group.rows[0],labels=sourceDimensionLabels(first),single=group.rows.length===1;
  return <section className={`provisionalSourceGroup ${group.verdict}`} key={`${group.mode}|${group.source}`}>
   <header className="provisionalSourceHead columns">
    <span className="provisionalIdentity"><small>{labels.main}</small><b>{group.mainValue||group.source||'Nicht übermittelt'}</b><em>{single?`${labels.sub}: ${first.subValue||first.subSource||'Nicht übermittelt'}`:`${num(group.rows.length)} ${labels.sub}-Werte`}</em>{(()=>{const badge=leadBadge(latestLeadActivity(group.rows));return <em className={`provisionalLead ${badge.tone}`} title={badge.detail}>{badge.text}</em>})()}</span>
    <span><small>Klicks</small><b>{num(group.totals.clicks)}</b></span>
    <span><small>SOIs</small><b>{num(group.totals.sois)}</b></span>
    <span><small>CVR</small><b>{cvrText(group.totals.clicks,group.totals.sois)}</b></span>
    <span><small>First-Sales</small><b>{num(group.totals.firstSales)}</b></span>
    <span><small>Rebills</small><b>{num(group.totals.rebills)}</b></span>
    <span><small>Coin-Spend</small><b>{num(group.totals.coinSpend)}</b></span>
    <span><small>Umsatz</small><b>{euro(group.totals.revenue)}</b></span>
    <span><small>Payout</small><b>{euro(group.totals.payout)}</b></span>
    <span><small>Profit</small><b className={moneyTone(group.totals.profit,group.totals)}>{euro(group.totals.profit)}</b></span>
    <strong className="provisionalVerdict">{verdictText(group)}</strong>
   </header>
   {!single&&(()=>{const active=group.rows.filter((row:SmartlinkSourceBreakdown)=>!isDormant(row)),dormant=group.rows.filter(isDormant),subRow=(row:SmartlinkSourceBreakdown)=><li key={sourceRowKey(row)} data-scope={`source-events-${row.source}-${row.subSource}`}>
     <span className="sub">{row.subValue||row.subSource||'Nicht übermittelt'}</span>
     <span>{num(row.clicks)}</span>
     <span>{num(row.sois)}</span>
     <span>{cvrText(row.clicks,row.sois)}</span>
     <span>{num(row.firstSales)}</span>
     <span>{num(row.rebills)}</span>
     <span>{num(row.coinSpend)}</span>
     <span>{euro(row.revenue)}</span>
     <span>{euro(row.payout)}</span>
     <b className={moneyTone(row.profit,row)}>{euro(row.profit)}</b>
     <span aria-hidden="true"/>
    </li>;return <>
    <ul className="provisionalSubRows columns">{active.map(subRow)}</ul>
    {dormant.length>0&&<details className="dormantSubs"><summary>{num(dormant.length)} ruhende Sub1-Werte ohne Aktivität im Zeitraum · anzeigen</summary><ul className="provisionalSubRows columns">{dormant.map(subRow)}</ul></details>}
   </>})()}
   <small className="incompleteSourceEvents" data-scope={single?`source-events-${first.source}-${first.subSource}`:undefined}>{single?`vorläufiger Source-Snapshot · ${events(first)}`:`vorläufiger Source-Snapshot · ${num(group.rows.length)} ${labels.sub}-Werte zusammengefasst`}</small>
  </section>})}</div>;
}

function LandingpageOverviewCard({slot,recommendation,selected,detailId,onSelect,windows,cvrBenchmark=null}:{slot:SmartSlot;recommendation?:SlotRecommendation;selected:boolean;detailId:string;onSelect:()=>void;windows:Windows;cvrBenchmark?:number|null}){
 const sources=[...(slot.sourceBreakdown||[])].sort((a,b)=>b.profit-a.profit||b.firstSales-a.firstSales||b.sois-a.sois),sourceSois=sources.reduce((sum,row)=>sum+row.sois,0),coverage=slot.sourceCoverage,sourceComparisonComplete=Boolean(coverage&&coverage.missingDays.length===0&&coverage.acceptedDays===coverage.expectedDays&&sourceSois===slot.metrics14.sois),strongest=sourceComparisonComplete?sources[0]:undefined,weakest=sourceComparisonComplete&&sources.length>1?sources.at(-1):undefined,sourceLabel=(row:SmartlinkSourceBreakdown)=>{const labels=sourceDimensionLabels(row),identity=sourcePresentation({source:row.source,subSource:row.subSource,mainLabel:labels.main,subLabel:labels.sub});return identity.missingMain?`${identity.primaryLabel}: ${identity.primary}`:`${identity.primary}${identity.secondary?` / ${identity.secondary}`:''}`};
 return <article className={`lpOverviewCard ${recommendation?.severity||'neutral'}${selected?' selected':''}`}>
  <header><div><span>LP #{slot.id} · Offer #{slot.offerId}</span><h3>{slot.name}</h3><small>{slot.weight} % Gewicht · {slot.status}</small></div><StatusBadge recommendation={recommendation}/></header>
  <div className="lpOverviewGrid">
   <KpiValue label="Profit" value={euro(slot.metrics14.profit)} scope={windows.maturity} size="s" tone={signTone(slot.metrics14.profit,volumeOf(slot.metrics14))}/>
   <KpiValue label="CVR" value={pct(slot.metrics24.cvr)} scope={windows.traffic} size="s" tone={cvrTone(slot.metrics24.clicks,slot.metrics24.cvr,cvrBenchmark)}/>
   <KpiValue label="SOIs" value={num(slot.metrics14.sois)} scope={windows.maturity} size="s"/>
   <KpiValue label="First-Sale-Rate" value={slot.metrics14.sois?pct(slot.metrics14.firstSaleRate):'n/a'} scope={windows.maturity} size="s"/>
  </div>
  <div className="lpOverviewEvents" aria-label={`Sales und Nachzahlungen für LP #${slot.id}`}><span><b>{num(slot.metrics14.firstSales)} First-Sales</b></span><span><b>{num(slot.metrics14.rebills)} Rebill{slot.metrics14.rebills===1?'':'s'}</b></span><span><b>{num(slot.metrics14.coinSpend)} Coin-Spend-Events</b></span><small>{windows.maturity}</small></div>
  <div className="lpOverviewSources"><header><b>{sources.length} Quellenkombination{sources.length===1?'':'en'}</b>{!sourceComparisonComplete&&sources.length?<em>Quellen unvollständig</em>:null}</header>{strongest?<div><span><small>Stärkste Quelle</small><b>{sourceLabel(strongest)}</b><em className={moneyClass(strongest.profit,strongest)}>{euro(strongest.profit)}</em></span>{weakest&&<span><small>Schwächste Quelle</small><b>{sourceLabel(weakest)}</b><em className={moneyClass(weakest.profit,weakest)}>{euro(weakest.profit)}</em></span>}</div>:<small>{sources.length?'Source-Vergleich erst nach vollständiger Abdeckung.':'Noch keine Source-Daten'}</small>}</div>
  <button type="button" className="lpOverviewSelect" aria-pressed={selected} aria-controls={detailId} onClick={onSelect}>{selected?'Details ausgewählt':'Details ansehen'}<span aria-hidden="true">→</span></button>
 </article>;
}

function LandingpageDetail({slot,recommendation,windows,affiliateId,affiliateName,campaignId,canManage,cvrBenchmark=null}:{slot:SmartSlot;recommendation?:SlotRecommendation;windows:Windows;affiliateId?:string;affiliateName?:string;campaignId?:string;canManage?:boolean;cvrBenchmark?:number|null}){
 const [mode,setMode]=useState<AnalysisTab>('overview');
 const instanceKey=smartlinkInstanceKey(campaignId,slot.id),detailId=`lp-detail-${instanceKey}`,overviewTabId=`lp-overview-tab-${instanceKey}`,sourcesTabId=`lp-sources-tab-${instanceKey}`,overviewPanelId=`lp-overview-panel-${instanceKey}`,sourcesPanelId=`lp-sources-panel-${instanceKey}`;
 const onTabKeyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{const next=nextAnalysisTab(mode,event.key);if(!next)return;event.preventDefault();setMode(next);requestAnimationFrame(()=>document.getElementById(next==='overview'?overviewTabId:sourcesTabId)?.focus())};
 return <article className={`sharedLpCard lpDetailRegion ${recommendation?.severity||'neutral'}`} id={detailId}>
  <header><div><span>AUSGEWÄHLTE LANDINGPAGE · LP #{slot.id} · Offer #{slot.offerId}</span><h3>{slot.name}</h3><small>{slot.weight} % Gewicht · Status: {slot.status}</small></div><StatusBadge recommendation={recommendation}/></header>
  <div className="lpDetailTabs" role="tablist" aria-label={`Auswertung für LP #${slot.id}`}><button type="button" role="tab" id={overviewTabId} aria-selected={mode==='overview'} aria-controls={overviewPanelId} tabIndex={mode==='overview'?0:-1} onKeyDown={onTabKeyDown} onClick={()=>setMode('overview')}>Übersicht</button><button type="button" role="tab" id={sourcesTabId} aria-selected={mode==='sources'} aria-controls={sourcesPanelId} tabIndex={mode==='sources'?0:-1} onKeyDown={onTabKeyDown} onClick={()=>setMode('sources')}>Quellenanalyse</button></div>
  <section className="lpDetailTabPanel" role="tabpanel" id={overviewPanelId} aria-labelledby={overviewTabId} hidden={mode!=='overview'}>
   <div className="primaryKpis"><KpiValue label="LP-Profit" value={euro(slot.metrics14.profit)} detail="Anderer Zeitraum als der Campaign-Profit · nicht addieren" scope={windows.maturity} size="l" tone={signTone(slot.metrics14.profit,volumeOf(slot.metrics14))}/><KpiValue label="Anmelderate (CVR)" value={pct(slot.metrics24.cvr)} detail={`${num(slot.metrics24.sois)} SOIs aus ${num(slot.metrics24.clicks)} Klicks`} scope={windows.traffic} size="l" tone={cvrTone(slot.metrics24.clicks,slot.metrics24.cvr,cvrBenchmark)}/></div>
   <section className="lpEvidenceStrip"><header><b>LP #{slot.id} · Sales und Nachzahlungen</b><span>{windows.maturity}</span></header><div><KpiValue label="SOIs" value={num(slot.metrics14.sois)}/><KpiValue label="First-Sales" value={num(slot.metrics14.firstSales)}/><KpiValue label="Anteil SOI → First-Sale" value={slot.metrics14.sois?pct(slot.metrics14.firstSaleRate):'n/a'} detail={`${num(slot.metrics14.firstSales)} First-Sales aus ${num(slot.metrics14.sois)} SOIs`}/><KpiValue label="Rebills" value={num(slot.metrics14.rebills)} detail="Nachzahlungen bestehender Kunden"/><KpiValue label="Coin-Spend-Events" value={num(slot.metrics14.coinSpend)} detail="Eventanzahl, keine eindeutigen Kunden"/></div></section>
   <section className="lpEconomics"><header><b>LP #{slot.id} · Kosten, Umsatz und Prognose</b><span>Umsatz – SOI-Vergütung = Profit</span></header><div><KpiValue label="Profit je Klick" value={euro(slot.metrics14.profitEpc)} size="s" tone={signTone(slot.metrics14.profitEpc,volumeOf(slot.metrics14))}/><KpiValue label={`Umsatz · ${windows.economics}`} value={euro(slot.metrics72.revenue)} size="s"/><KpiValue label={`Payout · ${windows.economics}`} value={euro(slot.metrics72.payout)} size="s"/><KpiValue label="Geschätzte Zeit bis 50 SOIs" value={slot.hoursTo50Sois===null?'Noch keine Prognose':`${slot.hoursTo50Sois} Std.`} size="s"/></div></section>
  </section>
  <section className="lpDetailTabPanel" role="tabpanel" id={sourcesPanelId} aria-labelledby={sourcesTabId} hidden={mode!=='sources'}><LandingpageSourceBreakdown embedded rows={slot.sourceBreakdown||[]} coverage={slot.sourceCoverage} scope={windows.source||windows.maturity} totalSois={slot.metrics14.sois} landingpageId={slot.id} affiliateId={affiliateId} affiliateName={affiliateName} offerId={slot.offerId} offerName={`Offer #${slot.offerId}`} campaignId={campaignId} canManage={canManage}/></section>
 </article>;
}

function CampaignSourceWorkspace({rows,selectedKey,onSelect,scope}:{rows:CampaignSourceRow[];selectedKey:string;onSelect:(key:string)=>void;scope:string}){
 const identityFor=(row:CampaignSourceRow)=>sourcePresentation({source:row.source,subSource:row.subSource,mainLabel:row.mainLabel,subLabel:row.subLabel});
 const selected=rows.find(row=>row.key===selectedKey)||rows[0];
 if(!selected)return <section className="campaignSourceWorkspace empty"><h3>Source × Landingpage</h3><p>Noch keine Source-Daten für die aktiven Landingpages.</p></section>;
 const selectedIdentity=identityFor(selected);
 return <section className="campaignSourceWorkspace"><header><div><span>CAMPAIGN-WEITER LP-VERGLEICH · EIGENES SOURCE-FENSTER</span><h3>Source × Landingpage</h3><p>Nur belastbare Source-Snapshots der aktiven Landingpages. Diese Summe erklärt nicht automatisch die Campaign-Bilanz im ausgewählten Zeitraum.</p></div><small>{scope}</small></header>
  <div className="campaignSourceMasterDetail"><nav className="campaignSourceList" aria-label="Sources über Landingpages">{rows.map(row=>{const identity=identityFor(row);return <button type="button" key={row.key} className={`${row.fit}${row.key===selected.key?' selected':''}`} aria-pressed={row.key===selected.key} onClick={()=>onSelect(row.key)}><span><b>{identity.primary}</b><small>{identity.missingMain||`${row.subLabel} · ${row.subSource||'Nicht übermittelt'}`} · {row.affectedLandingpages} Landingpage{row.affectedLandingpages===1?'':'s'}</small></span><span><b>{num(row.totals.sois)} SOIs</b><small>{num(row.totals.firstSales)} First-Sales · {num(row.totals.rebills)} Rebills</small></span><strong className={moneyClass(row.totals.profit,row.totals)}>{euro(row.totals.profit)}</strong></button>})}</nav>
   <article className={`campaignSourceComparison ${selected.fit}`} aria-live="polite"><header><div><span>{selectedIdentity.primaryLabel}{selectedIdentity.secondaryLabel?` / ${selectedIdentity.secondaryLabel}`:''}</span><h4>{selectedIdentity.primary}{selectedIdentity.secondary?` / ${selectedIdentity.secondary}`:''}</h4><small>{selectedIdentity.missingMain&&`${selectedIdentity.missingMain} · `}{selected.affectedLandingpages} Landingpage{selected.affectedLandingpages===1?'':'s'} · {selected.observation}</small></div><strong className={moneyClass(selected.totals.profit,selected.totals)}>{euro(selected.totals.profit)}<small>Profit gesamt</small></strong></header>
    <div className="campaignSourceTotals" data-scope="campaign-source-events"><span><small>SOIs</small><b>{num(selected.totals.sois)}</b></span><span><small>First-Sales</small><b>{num(selected.totals.firstSales)} · {selected.totals.firstSaleRate===null?'n/a':pct(selected.totals.firstSaleRate)}</b></span><span><small>Rebills</small><b>{num(selected.totals.rebills)}</b></span><span><small>Coin-Spend</small><b>{num(selected.totals.coinSpend)}</b></span><span><small>Umsatz</small><b>{euro(selected.totals.revenue)}</b></span><span><small>Payout</small><b>{euro(selected.totals.payout)}</b></span><span><small>Profit</small><b className={moneyClass(selected.totals.profit,selected.totals)}>{euro(selected.totals.profit)}</b></span></div>
    <div className="sourceLandingpageCells">{[...selected.cells].sort((a,b)=>(b.metrics?.profit??Number.NEGATIVE_INFINITY)-(a.metrics?.profit??Number.NEGATIVE_INFINITY)).map(cell=><section className={cell.state} key={cell.landingpageId}><header><div><span>LP #{cell.landingpageId} · Offer #{cell.offerId}</span><b>{cell.landingpageName}</b><small>{cell.weight} % Gewicht · {cell.status}</small></div>{cell.metrics?<strong className={moneyClass(cell.metrics.profit,cell.metrics)}>{euro(cell.metrics.profit)}</strong>:<strong>Unbekannt</strong>}</header>{cell.metrics?<div data-scope={`campaign-source-lp-events-${cell.landingpageId}`}><span><small>SOIs</small><b>{num(cell.metrics.sois)}</b></span><span><small>First-Sales</small><b>{num(cell.metrics.firstSales)} · {cell.metrics.firstSaleRate===null?'n/a':pct(cell.metrics.firstSaleRate)}</b></span><span><small>Rebills</small><b>{num(cell.metrics.rebills)}</b></span><span><small>Coin-Spend</small><b>{num(cell.metrics.coinSpend)}</b></span><span><small>Umsatz</small><b>{euro(cell.metrics.revenue)}</b></span><span><small>Payout</small><b>{euro(cell.metrics.payout)}</b></span><span><small>Profit</small><b className={moneyClass(cell.metrics.profit,cell.metrics)}>{euro(cell.metrics.profit)}</b></span></div>:<p>Source-Zelle unbekannt · Snapshot-Abdeckung dieser LP ist unvollständig oder nicht abgestimmt.</p>}</section>)}</div>
    <p className="campaignSourceRoutingNote"><b>Beobachtung · keine automatische Traffic-Steuerung.</b> Die Ansicht vergleicht Fakten und erzeugt keine Source-Routingentscheidung. Ausschalten sperrt weiterhin Vergütung und Partner-Postback affiliate- und offerweit; eingehenden Traffic steuert der Partner.</p>
   </article>
  </div>
 </section>;
}

export function SmartlinkRotationCards({slots,recommendations,rotationLabel,windows,affiliateId,affiliateName,campaignId,canManage=false}:{slots:SmartSlot[];recommendations:SlotRecommendation[];rotationLabel:string;windows:Windows;affiliateId?:string;affiliateName?:string;campaignId?:string;canManage?:boolean}){
 const [sort,setSort]=useState<SmartlinkSort>('rotation');
 const [workspace,setWorkspace]=useState<'landingpages'|'sources'>('landingpages');
 const [selectedId,setSelectedId]=useState(slots[0]?.id||'');
 const sorted=useMemo(()=>sortSmartlinkSlots(slots,sort),[slots,sort]);
 const cvrBenchmark=useMemo(()=>campaignCvrBenchmark(slots),[slots]);
 const byId=useMemo(()=>new Map(recommendations.map(x=>[x.slotId,x])),[recommendations]);
 const sourceRows=useMemo(()=>buildCampaignSourceRows(slots),[slots]);
 const [selectedSourceKey,setSelectedSourceKey]=useState(sourceRows[0]?.key||'');
 const selectedSlot=slots.find(slot=>slot.id===selectedId)||sorted[0];
 const select=(id:string)=>{setSelectedId(id);if(typeof document!=='undefined')requestAnimationFrame(()=>document.getElementById(`lp-detail-${smartlinkInstanceKey(campaignId,id)}`)?.scrollIntoView({behavior:'smooth',block:'start'}))};
 return <section className="sharedRotation">
  <div className="campaignWorkspaceTabs" role="tablist" aria-label="Campaign-Analyse"><button type="button" role="tab" aria-selected={workspace==='landingpages'} aria-controls="campaign-workspace-landingpages" onClick={()=>setWorkspace('landingpages')}>Landingpages</button><button type="button" role="tab" aria-selected={workspace==='sources'} aria-controls="campaign-workspace-sources" onClick={()=>setWorkspace('sources')}>Sources über Landingpages <small>{sourceRows.length}</small></button></div>
  <div id="campaign-workspace-landingpages" role="tabpanel" hidden={workspace!=='landingpages'}>
   <div className="rotationToolbar"><div><span>AKTUELLE ROTATION</span><b>{slots.length} aktive Landingpages</b><small>{rotationLabel}</small></div>{slots.length>1&&<div className="rotationSort" role="group" aria-label="Landingpages sortieren"><small>Sortieren nach</small>{([['rotation','Rotation'],['profit','Profit'],['cvr','CVR'],['sois','SOIs']] as const).map(([id,label])=><button type="button" key={id} className={sort===id?'active':''} aria-pressed={sort===id} onClick={()=>setSort(id)}>{label}</button>)}</div>}</div>
   <div className={`sharedLpGrid count-${slots.length}`}>{sorted.map(slot=><LandingpageOverviewCard key={slot.id} slot={slot} recommendation={byId.get(slot.id)} selected={slot.id===selectedSlot?.id} detailId={`lp-detail-${smartlinkInstanceKey(campaignId,slot.id)}`} onSelect={()=>select(slot.id)} windows={windows} cvrBenchmark={cvrBenchmark}/>)}</div>
   {selectedSlot&&<LandingpageDetail key={smartlinkInstanceKey(campaignId,selectedSlot.id)} slot={selectedSlot} recommendation={byId.get(selectedSlot.id)} windows={windows} affiliateId={affiliateId} affiliateName={affiliateName} campaignId={campaignId} canManage={canManage} cvrBenchmark={cvrBenchmark}/>}
  </div>
  <div id="campaign-workspace-sources" role="tabpanel" hidden={workspace!=='sources'}><CampaignSourceWorkspace rows={sourceRows} selectedKey={selectedSourceKey} onSelect={setSelectedSourceKey} scope={windows.source||windows.maturity}/></div>
 </section>;
}
