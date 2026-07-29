'use client';

import {useMemo,useState,type ReactNode} from 'react';
import {sortSmartlinkSlots,type SmartlinkSort} from '../../lib/smartlink-presentation';
import type {SlotRecommendation,SmartSlot,SmartlinkSourceBreakdown} from '../../lib/smartlink';
import {leadActivityStatus} from '../../lib/source-breakdown';
import CopyValue from '../affiliates/CopyValue';
import SourcePairCopy from '../affiliates/SourcePairCopy';

const euro=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const num=(n:number)=>new Intl.NumberFormat('de-DE').format(n);
const pct=(n:number)=>`${n.toFixed(2).replace('.',',')} %`;
const actionLabel:{[K in SlotRecommendation['action']]:string}={stop:'STOPPEN',rotate:'ROTIEREN',scale:'SKALIEREN',protect:'SCHÜTZEN',hold:'HALTEN'};
const statusActionLabel:{[K in SlotRecommendation['action']]:string}={stop:'Stoppen',rotate:'Rotieren',scale:'Skalieren',protect:'Schützen',hold:'Halten'};

type Windows={traffic:string;economics:string;maturity:string;source?:string};
const defaultWindows:Windows={traffic:'Letzte 24 Stunden',economics:'Letzte 72 Stunden',maturity:'Maximal 14 Tage'};

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

type SourceSort='loss'|'sois'|'coinSpend'|'profit';
const share=(value:number,total:number)=>`${(total?100*value/total:0).toFixed(1).replace('.',',')} %`;
function SourceActivity({row}:{row:SmartlinkSourceBreakdown}){const status=leadActivityStatus({lastLeadDate:row.lastLeadDate||null,asOf:row.activityAsOf||'',coverageComplete:Boolean(row.activityCoverageComplete),lookbackDays:row.activityLookbackDays||365}),date=row.lastLeadDate?row.lastLeadDate.split('-').reverse().join('.'):null;return <span className={`leadActivity ${status.tone}`} aria-label={`${status.label}. ${date?`Letzter Lead: ${date}. `:''}${status.detail}`}><b>{date||status.label}</b><small>{date?'Letzter Lead':status.detail}</small>{date&&<em>{status.detail}</em>}</span>}

function SourceMetric({label,value,tone='neutral'}:{label:string;value:string;tone?:'positive'|'negative'|'neutral'}){return <span className={`lpSourceMetric ${tone}`}><small>{label}</small><b>{value}</b></span>}

export function LandingpageSourceBreakdown({rows,scope,totalSois,landingpageId,onOpenChange}:{rows:SmartlinkSourceBreakdown[];scope:string;totalSois:number;landingpageId:string;onOpenChange?:(open:boolean)=>void}){
 const [sort,setSort]=useState<SourceSort>('loss');
 const [visibleCount,setVisibleCount]=useState(12);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>sort==='sois'?b.sois-a.sois:sort==='coinSpend'?b.coinSpend-a.coinSpend:sort==='profit'?b.profit-a.profit:a.profit-b.profit),[rows,sort]);
 const sourceSois=rows.reduce((sum,row)=>sum+row.sois,0);
 const reconciled=sourceSois===totalSois;
 const visible=sorted.slice(0,visibleCount);
 const chooseSort=(next:SourceSort)=>{setSort(next);setVisibleCount(12)};
 return <details className="lpSourceBreakdown" onToggle={event=>onOpenChange?.(event.currentTarget.open)}>
  <summary><span><b>LP #{landingpageId} · Woher kommen die Leads?</b><small>{rows.length} Source-Kombination{rows.length===1?'':'en'} · {sourceSois} von {totalSois} SOIs nach Herkunft zugeordnet · {scope}</small></span><strong className={reconciled?'up':'down'}>{reconciled?'Vollständig zugeordnet':'Abweichung prüfen'}</strong><i aria-hidden="true">›</i></summary>
  <div className="lpSourcePanel">
   <div className="sourcePanelToolbar"><div className="sourceSort" role="group" aria-label="Source-Kombinationen sortieren"><small>Sortieren nach</small>{([['loss','größtem Verlust'],['sois','SOIs'],['coinSpend','Coin-Spend'],['profit','Profit']] as const).map(([id,label])=><button type="button" key={id} className={sort===id?'active':''} aria-pressed={sort===id} onClick={()=>chooseSort(id)}>{label}</button>)}</div>{rows.length>12&&<small>{num(visible.length)} von {num(rows.length)} sichtbar</small>}</div>
   {rows.length?<section className="lpSourceCards" aria-label={`Lead-Herkunft für LP #${landingpageId}`}>
    {visible.map((row,index)=><article className="lpSourceCard" key={`${row.mode}-${row.source}-${row.subSource}-${index}`}>
     <header>
      <div className="lpSourceIdentity"><CopyValue label={row.mode==='api'?'ADV1':'Source'} value={row.source||'Nicht übermittelt'}/><CopyValue label={row.mode==='api'?'ADV2':'Sub1'} value={row.subSource||'Nicht übermittelt'}/></div>
      <SourcePairCopy mode={row.mode==='api'?'api':'tracked'} source={row.source||'Nicht übermittelt'} subSource={row.subSource||'Nicht übermittelt'}/>
     </header>
     <div className="lpSourcePriority">
      <span><small>Letzter Lead</small><SourceActivity row={row}/></span>
      <SourceMetric label="Profit" value={euro(row.profit)} tone={row.profit>=0?'positive':'negative'}/>
      <SourceMetric label="SOIs · Anteil" value={`${num(row.sois)} SOIs · ${share(row.sois,totalSois)}`}/>
      <SourceMetric label="First-Sales" value={`${num(row.firstSales)} · ${row.sois?share(row.firstSales,row.sois):'0,0 %'}`}/>
     </div>
     <div className="lpSourceSecondary">
      <SourceMetric label="Klicks" value={row.mode==='api'?'n/a – clickless':num(row.clicks)}/>
      <SourceMetric label="CVR" value={row.cvr===null?'n/a – clickless':pct(row.cvr)}/>
      <SourceMetric label="Rebills" value={num(row.rebills)}/>
      <SourceMetric label="Coin-Spend-Events" value={num(row.coinSpend)}/>
      <SourceMetric label="Umsatz" value={euro(row.revenue)}/>
      <SourceMetric label="SOI-Vergütung" value={euro(row.payout)}/>
     </div>
    </article>)}
   </section>:<p className="emptyInline">Keine Source-Daten in diesem Zeitraum. Fehlende Werte werden als „Nicht übermittelt“ ausgewiesen.</p>}
   {visibleCount<sorted.length&&<button type="button" className="showMoreSources" onClick={()=>setVisibleCount(count=>Math.min(count+12,sorted.length))}>Weitere {num(Math.min(12,sorted.length-visibleCount))} Quellen anzeigen</button>}
  </div>
 </details>;
}

function LandingpageOverviewCard({slot,recommendation,selected,onSelect}:{slot:SmartSlot;recommendation?:SlotRecommendation;selected:boolean;onSelect:()=>void}){
 return <article className={`lpOverviewCard ${recommendation?.severity||'neutral'}${selected?' selected':''}`}>
  <header><div><span>LP #{slot.id} · Offer #{slot.offerId}</span><h3>{slot.name}</h3><small>{slot.weight} % Gewicht · {slot.status}</small></div><StatusBadge recommendation={recommendation}/></header>
  <div className="lpOverviewGrid">
   <KpiValue label="Profit" value={euro(slot.metrics14.profit)} size="s" tone={slot.metrics14.profit>=0?'positive':'negative'}/>
   <KpiValue label="CVR" value={pct(slot.metrics24.cvr)} size="s" tone={slot.metrics24.cvr>=1?'positive':slot.metrics24.clicks?'negative':'neutral'}/>
   <KpiValue label="SOIs" value={num(slot.metrics14.sois)} size="s"/>
   <KpiValue label="First-Sale-Rate" value={pct(slot.metrics14.firstSaleRate)} size="s"/>
  </div>
  <button type="button" className="lpOverviewSelect" aria-pressed={selected} aria-controls={`lp-detail-${slot.id}`} onClick={onSelect}>{selected?'Details ausgewählt':'Details ansehen'}<span aria-hidden="true">→</span></button>
 </article>;
}

function LandingpageDetail({slot,recommendation,windows}:{slot:SmartSlot;recommendation?:SlotRecommendation;windows:Windows}){
 return <article className={`sharedLpCard lpDetailRegion ${recommendation?.severity||'neutral'}`} id={`lp-detail-${slot.id}`}>
  <header><div><span>AUSGEWÄHLTE LANDINGPAGE · LP #{slot.id} · Offer #{slot.offerId}</span><h3>{slot.name}</h3><small>{slot.weight} % Gewicht · Status: {slot.status}</small></div><StatusBadge recommendation={recommendation}/></header>
  <div className="primaryKpis">
   <KpiValue label="Profit im Reifefenster" value={euro(slot.metrics14.profit)} scope={windows.maturity} size="l" tone={slot.metrics14.profit>=0?'positive':'negative'}/>
   <KpiValue label="Anmelderate (CVR)" value={pct(slot.metrics24.cvr)} detail={`${num(slot.metrics24.sois)} SOIs aus ${num(slot.metrics24.clicks)} Klicks`} scope={windows.traffic} size="l" tone={slot.metrics24.cvr>=1?'positive':slot.metrics24.clicks?'negative':'neutral'}/>
  </div>
  <section className="lpEvidenceStrip"><header><b>LP #{slot.id} · Sales und Nachzahlungen</b><span>{windows.maturity}</span></header><div>
   <KpiValue label="SOIs" value={num(slot.metrics14.sois)}/>
   <KpiValue label="First-Sales" value={num(slot.metrics14.firstSales)}/>
   <KpiValue label="Anteil SOI → First-Sale" value={pct(slot.metrics14.firstSaleRate)} detail={`${num(slot.metrics14.firstSales)} First-Sales aus ${num(slot.metrics14.sois)} SOIs`}/>
   <KpiValue label="Rebills" value={num(slot.metrics14.rebills)} detail="Nachzahlungen bestehender Kunden"/>
   <KpiValue label="Coin-Spend-Events" value={num(slot.metrics14.coinSpend)} detail="Eventanzahl, keine eindeutigen Kunden"/>
  </div></section>
  <LandingpageSourceBreakdown rows={slot.sourceBreakdown||[]} scope={windows.source||windows.maturity} totalSois={slot.metrics14.sois} landingpageId={slot.id}/>
  <details className="lpDiagnostics"><summary><b>LP #{slot.id} · Kosten, Umsatz und Prognose</b><span>Umsatz – SOI-Vergütung = Profit</span><i aria-hidden="true">›</i></summary><div>
   <KpiValue label="Profit je Klick" value={euro(slot.metrics14.profitEpc)} size="s" tone={slot.metrics14.profitEpc>=0?'positive':'negative'}/>
   <KpiValue label={`Umsatz · ${windows.economics}`} value={euro(slot.metrics72.revenue)} size="s"/>
   <KpiValue label={`SOI-Vergütung · ${windows.economics}`} value={euro(slot.metrics72.payout)} size="s"/>
   <KpiValue label="Geschätzte Zeit bis 50 SOIs" value={slot.hoursTo50Sois===null?'Noch keine Prognose':`${slot.hoursTo50Sois} Std.`} size="s"/>
  </div></details>
 </article>;
}

export function SmartlinkRotationCards({slots,recommendations,rotationLabel,windows=defaultWindows}:{slots:SmartSlot[];recommendations:SlotRecommendation[];rotationLabel:string;windows?:Windows}){
 const [sort,setSort]=useState<SmartlinkSort>('rotation');
 const [selectedId,setSelectedId]=useState(slots[0]?.id||'');
 const sorted=useMemo(()=>sortSmartlinkSlots(slots,sort),[slots,sort]);
 const byId=useMemo(()=>new Map(recommendations.map(x=>[x.slotId,x])),[recommendations]);
 const selectedSlot=slots.find(slot=>slot.id===selectedId)||sorted[0];
 const select=(id:string)=>{setSelectedId(id);if(typeof document!=='undefined')requestAnimationFrame(()=>document.getElementById(`lp-detail-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'}))};
 return <section className="sharedRotation">
  <div className="rotationToolbar"><div><span>AKTUELLE ROTATION</span><b>{slots.length} aktive Landingpages</b><small>{rotationLabel}</small></div>{slots.length>1&&<div className="rotationSort" role="group" aria-label="Landingpages sortieren"><small>Sortieren nach</small>{([['rotation','Rotation'],['profit','Profit'],['cvr','CVR'],['sois','SOIs']] as const).map(([id,label])=><button type="button" key={id} className={sort===id?'active':''} aria-pressed={sort===id} onClick={()=>setSort(id)}>{label}</button>)}</div>}</div>
  <div className={`sharedLpGrid count-${slots.length}`}>{sorted.map(slot=><LandingpageOverviewCard key={slot.id} slot={slot} recommendation={byId.get(slot.id)} selected={slot.id===selectedSlot?.id} onSelect={()=>select(slot.id)}/>)}</div>
  {selectedSlot&&<LandingpageDetail slot={selectedSlot} recommendation={byId.get(selectedSlot.id)} windows={windows}/>}
 </section>;
}
