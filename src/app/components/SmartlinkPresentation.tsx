'use client';

import {useMemo,useState,type ReactNode} from 'react';
import {sortSmartlinkSlots,type SmartlinkSort} from '../../lib/smartlink-presentation';
import type {SlotRecommendation,SmartSlot,SmartlinkSourceBreakdown} from '../../lib/smartlink';

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

export function LandingpageSourceBreakdown({rows,scope,totalSois,landingpageId,onOpenChange}:{rows:SmartlinkSourceBreakdown[];scope:string;totalSois:number;landingpageId:string;onOpenChange?:(open:boolean)=>void}){
 const [sort,setSort]=useState<SourceSort>('loss');
 const sorted=useMemo(()=>[...rows].sort((a,b)=>sort==='sois'?b.sois-a.sois:sort==='coinSpend'?b.coinSpend-a.coinSpend:sort==='profit'?b.profit-a.profit:a.profit-b.profit),[rows,sort]);
 const sourceSois=rows.reduce((sum,row)=>sum+row.sois,0);
 const reconciled=sourceSois===totalSois;
 return <details className="lpSourceBreakdown" onToggle={event=>onOpenChange?.(event.currentTarget.open)}>
  <summary><span><b>LP #{landingpageId} · Woher kommen die Leads?</b><small>{rows.length} Source-Kombination{rows.length===1?'':'en'} · {sourceSois} von {totalSois} SOIs nach Herkunft zugeordnet · {scope}</small></span><strong className={reconciled?'up':'down'}>{reconciled?'Vollständig zugeordnet':'Abweichung prüfen'}</strong><i aria-hidden="true">›</i></summary>
  <div className="lpSourcePanel">
   <div className="sourceSort" role="group" aria-label="Source-Kombinationen sortieren"><small>Sortieren nach</small>{([['loss','größtem Verlust'],['sois','SOIs'],['coinSpend','Coin-Spend'],['profit','Profit']] as const).map(([id,label])=><button type="button" key={id} className={sort===id?'active':''} aria-pressed={sort===id} onClick={()=>setSort(id)}>{label}</button>)}</div>
   {rows.length?<div className="lpSourceTableWrap"><table className="lpSourceTable">
    <caption className="srOnly">Lead-Herkunft für LP #{landingpageId}</caption>
    <thead><tr><th>Herkunft</th><th>Klicks</th><th>SOIs · Anteil</th><th>CVR</th><th>First-Sales</th><th>Rebills</th><th>Coin-Spend-Events</th><th>Umsatz</th><th>SOI-Vergütung</th><th>Profit</th></tr></thead>
    <tbody>{sorted.map((row,index)=><tr key={`${row.mode}-${row.source}-${row.subSource}-${index}`}>
     <td data-label="Herkunft"><b>{row.mode==='api'?'ADV1':'Source ID'}: {row.source||'Nicht übermittelt'}</b><small>{row.mode==='api'?'ADV2':'Subsource ID'}: {row.subSource||'Nicht übermittelt'}</small></td>
     <td data-label="Klicks">{row.mode==='api'?'n/a – clickless':num(row.clicks)}</td>
     <td data-label="SOIs · Anteil"><b>{num(row.sois)} SOIs · {share(row.sois,totalSois)}</b></td>
     <td data-label="CVR">{row.cvr===null?'n/a – clickless':pct(row.cvr)}</td>
     <td data-label="First-Sales">{num(row.firstSales)}</td>
     <td data-label="Rebills">{num(row.rebills)}</td>
     <td data-label="Coin-Spend-Events">{num(row.coinSpend)}</td>
     <td data-label="Umsatz">{euro(row.revenue)}</td>
     <td data-label="SOI-Vergütung">{euro(row.payout)}</td>
     <td data-label="Profit" className={row.profit>=0?'up':'down'}>{euro(row.profit)}</td>
    </tr>)}</tbody>
   </table></div>:<p className="emptyInline">Keine Source-Daten in diesem Zeitraum. Fehlende Werte werden als „Nicht übermittelt“ ausgewiesen.</p>}
  </div>
 </details>;
}

function LandingpageCard({slot,recommendation,windows}:{slot:SmartSlot;recommendation?:SlotRecommendation;windows:Windows}){
 const [sourceOpen,setSourceOpen]=useState(false);
 return <article className={`sharedLpCard ${recommendation?.severity||'neutral'}${sourceOpen?' source-open':''}`}>
  <header><div><span>LP #{slot.id} · Offer #{slot.offerId}</span><h3>{slot.name}</h3><small>{slot.weight} % Gewicht · Status: {slot.status}</small></div><StatusBadge recommendation={recommendation}/></header>
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
  <LandingpageSourceBreakdown rows={slot.sourceBreakdown||[]} scope={windows.source||windows.maturity} totalSois={slot.metrics14.sois} landingpageId={slot.id} onOpenChange={setSourceOpen}/>
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
 const sorted=useMemo(()=>sortSmartlinkSlots(slots,sort),[slots,sort]);
 const byId=useMemo(()=>new Map(recommendations.map(x=>[x.slotId,x])),[recommendations]);
 return <section className="sharedRotation">
  <div className="rotationToolbar"><div><span>AKTUELLE ROTATION</span><b>{slots.length} aktive Landingpages</b><small>{rotationLabel}</small></div>{slots.length>1&&<div className="rotationSort" role="group" aria-label="Landingpages sortieren"><small>Sortieren nach</small>{([['rotation','Rotation'],['profit','Profit'],['cvr','CVR'],['sois','SOIs']] as const).map(([id,label])=><button type="button" key={id} className={sort===id?'active':''} aria-pressed={sort===id} onClick={()=>setSort(id)}>{label}</button>)}</div>}</div>
  <div className={`sharedLpGrid count-${slots.length}`}>{sorted.map(slot=><LandingpageCard key={slot.id} slot={slot} recommendation={byId.get(slot.id)} windows={windows}/>)}</div>
 </section>;
}
