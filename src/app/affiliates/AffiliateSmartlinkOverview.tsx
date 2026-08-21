import LiveCampaignDeepDiveLink from './LiveCampaignDeepDiveLink';
import type {CampaignAffiliateMapping} from '@/lib/affiliate-smartlinks';
import {buildAffiliateCampaignDecision,sortCampaignDecisions} from '@/lib/affiliate-campaign-decision';
import {affiliateCampaignHref,primarySmartlinkRecommendation,type SmartlinkInsight} from '@/lib/optimization-workflow';
import styles from './AffiliateSmartlinkOverview.module.css';

const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const num=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
type AttentionSeverity='critical'|'warning'|'positive'|'neutral'|'missing';
const joinOrigins=(values:string[])=>values.length<2?values[0]||'':`${values.slice(0,-1).join(', ')} und ${values.at(-1)}`;

function campaignAttention(insight:SmartlinkInsight|undefined){
  if(insight?.selectedRange?.eventCoverageComplete!==true)return{severity:'missing' as const,detail:'Eventdaten für den Zeitraum sind nicht vollständig belegt.'};
  const recommendation=primarySmartlinkRecommendation(insight.recommendations);
  const attribution=insight?.selectedRange?.attribution,current=attribution?.current;
  const currentMonetizationGap=Boolean(current&&current.sois>=50&&current.firstSales===0&&current.revenue<=0&&current.profit<0);
  if(recommendation?.severity==='critical')return{severity:'critical' as const,detail:recommendation.detail};
  if(currentMonetizationGap&&current&&attribution){
    const origins=[attribution.legacy.revenue>0?'frühere LPs':'',attribution.beforeRotation.revenue>0?'Zeitraum vor aktueller Rotation':'',attribution.transitionDay.revenue>0?'Campaign-Speichertag':'',attribution.unassigned.revenue>0?'nicht eindeutig zugeordnete Events':''].filter(Boolean);
    const originDetail=attribution.total.revenue<=0?'Auch die Campaign gesamt hat noch keinen Umsatz.':origins.length?`Umsatzbeiträge: ${joinOrigins(origins)}.`:'Die Umsatzherkunft ist nicht vollständig zugeordnet.';
    return{severity:'warning' as const,detail:`${num(current.sois)} SOIs der aktuellen LPs · ${euro(current.revenue)} Umsatz · ${euro(current.profit)} Profit. ${originDetail} Einzelne LPs bleiben bis zu ihrer Reifeschwelle auf Beobachten.`};
  }
  return{severity:(recommendation?.severity||'missing') as AttentionSeverity,detail:recommendation?.detail||'Keine gemeinsame Campaign-Empfehlung verfügbar.'};
}

export default function AffiliateSmartlinkOverview({affiliateId,mappings,insights,rangeLabel,returnTo}:{affiliateId:string;mappings:CampaignAffiliateMapping[];insights:SmartlinkInsight[];rangeLabel:string;returnTo:string}){
  const byId=new Map(insights.map(insight=>[insight.identity.campaignId,insight]));
  const decisions=sortCampaignDecisions(mappings.map(mapping=>buildAffiliateCampaignDecision(mapping,byId.get(mapping.campaignId))));
  const campaigns=decisions.map(decision=>({...decision,attention:campaignAttention(decision.insight)}));
  const totals=mappings.reduce((sum,item)=>({revenue:sum.revenue+item.revenue30,payout:sum.payout+item.payout30,profit:sum.profit+item.profit30,sois:sum.sois+item.sois30}),{revenue:0,payout:0,profit:0,sois:0});
  const firstSales=decisions.some(item=>item.firstSales===null||item.status==='daten_unvollständig')?null:decisions.reduce((sum,item)=>sum+(item.firstSales||0),0);
  const critical=campaigns.filter(item=>item.action==='stoppen'||item.attention.severity==='critical').length;
  const review=campaigns.filter(item=>item.action==='prüfen'||item.action==='stoppen'||item.attention.severity==='critical'||item.attention.severity==='warning').length;
  const status=critical?`${critical} dringend prüfen`:review?`${review} Campaign${review===1?'':'s'} mit Prüfhinweis`:'Keine Campaign mit Prüfhinweis';
  return <section className={styles.overview} aria-labelledby="smartlink-actions-title">
    <header><div><span>SMARTLINK-ERGEBNIS · {rangeLabel}</span><h2 id="smartlink-actions-title">Ergebnis und nächste Maßnahme</h2></div><strong className={critical?styles.critical:review?styles.notice:styles.clear}>{status}</strong></header>
    <div className={styles.portfolioKpis} aria-label="Gesamtergebnis Smartlinks">
      <span><small>Umsatz</small><b>{euro(totals.revenue)}</b></span>
      <span><small>Payout</small><b>{euro(totals.payout)}</b></span>
      <span><small>Profit</small><b className={totals.profit>=0?styles.up:styles.down}>{euro(totals.profit)}</b></span>
      <span><small>SOIs</small><b>{num(totals.sois)}</b></span>
      <span><small>First-Sales</small><b>{firstSales===null?'–':num(firstSales)}</b></span>
    </div>
    <div className={styles.campaignList}>{campaigns.map(({mapping,insight,statusLabel,status:financialStatus,actionLabel,reason,attention})=>{
      const href=affiliateCampaignHref({campaignId:mapping.campaignId,affiliateId,currentHref:returnTo}),eventTotals=insight?.selectedRange?.eventCoverageComplete===true?insight.selectedRange.attribution.total:undefined,saleRate=eventTotals?.sois?100*eventTotals.firstSales/eventTotals.sois:null;
      const revenueWithoutFirstSale=Boolean(eventTotals&&eventTotals.firstSales===0&&eventTotals.revenue>0&&(eventTotals.rebills>0||eventTotals.coinSpend>0));
      return <article key={mapping.campaignId} className={`${styles.campaignRow} ${styles[financialStatus]}`}>
        <div className={styles.identity}><span>CAMPAIGN #{mapping.campaignId} · {mapping.status}</span><h3>{mapping.campaign}</h3><small>{insight?.currentSlots.length||0} aktive LPs · {insight?.legacySlots.length||0} Frühere LPs · Offer {insight?.identity.offerIds.map(id=>`#${id}`).join(', ')||'nicht zugeordnet'}</small></div>
        <div className={styles.statusCell}><small>STATUS</small><b>{statusLabel}</b><span>Ausgewählter Zeitraum · {rangeLabel}</span></div>
        <div className={styles.resultCell}><small>ERGEBNIS</small><b className={mapping.profit30>=0?styles.up:styles.down}>{euro(mapping.profit30)}</b><span>{euro(mapping.revenue30)} Umsatz · {euro(mapping.payout30)} Payout</span><span>{num(mapping.sois30)} SOIs{eventTotals?` · ${num(eventTotals.firstSales)} First-Sales · ${num(eventTotals.rebills)} Rebills · ${num(eventTotals.coinSpend)} Coin-Spend-Events`:''}</span>{eventTotals&&<span>{saleRate===null?'First-Sale-Rate nicht berechenbar':`${saleRate.toFixed(2).replace('.',',')} % First-Sales je SOI`}</span>}</div>
        <div className={styles.actionCell}><small>NÄCHSTE MASSNAHME</small><b>{actionLabel}</b><strong>{euro(mapping.profit30)} bei {num(mapping.sois30)} SOIs</strong><span>{reason}</span>{attention.detail!==reason&&<span>{attention.detail}</span>}{revenueWithoutFirstSale&&eventTotals&&<span className={styles.explanation}>Im gleichen Zeitraum wurden {eventTotals.rebills?`${num(eventTotals.rebills)} Rebills`:''}{eventTotals.rebills&&eventTotals.coinSpend?' und ':''}{eventTotals.coinSpend?`${num(eventTotals.coinSpend)} Coin-Spend-Events`:''} erfasst. Diese Events können Umsatz erklären; eine direkte Umsatzzuordnung liegt hier nicht vor.</span>}</div>
        <LiveCampaignDeepDiveLink campaignId={mapping.campaignId} affiliateId={affiliateId} initialHref={href} label="Campaign öffnen"/>
      </article>;
    })}</div>
  </section>;
}
