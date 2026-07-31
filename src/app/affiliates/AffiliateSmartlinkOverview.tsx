import Link from 'next/link';
import type {CampaignAffiliateMapping} from '@/lib/affiliate-smartlinks';
import {affiliateCampaignHref,primarySmartlinkRecommendation,type SmartlinkInsight} from '@/lib/optimization-workflow';
import styles from './AffiliateSmartlinkOverview.module.css';

const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const num=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
const rank={critical:0,warning:1,positive:2,neutral:3,missing:4} as const;

export default function AffiliateSmartlinkOverview({affiliateId,mappings,insights,rangeLabel,returnTo}:{affiliateId:string;mappings:CampaignAffiliateMapping[];insights:SmartlinkInsight[];rangeLabel:string;returnTo:string}){
  const byId=new Map(insights.map(insight=>[insight.identity.campaignId,insight]));
  const campaigns=mappings.map(mapping=>{
    const insight=byId.get(mapping.campaignId),recommendation=primarySmartlinkRecommendation(insight?.recommendations||[]);
    return{mapping,insight,recommendation};
  }).sort((a,b)=>rank[a.recommendation?.severity||'missing']-rank[b.recommendation?.severity||'missing']||a.mapping.profit30-b.mapping.profit30);
  const critical=campaigns.filter(item=>item.recommendation?.severity==='critical').length;
  return <section className={styles.overview} aria-labelledby="smartlink-actions-title">
    <header>
      <div><span>SMARTLINK-HANDLUNGSÜBERSICHT</span><h2 id="smartlink-actions-title">Was heute geprüft werden muss</h2><p>Der Affiliate Optimizer priorisiert Campaigns. Routing, Testreife und LP-Begründung werden in der Campaign-Tiefenanalyse geprüft.</p></div>
      <strong className={critical?styles.critical:styles.clear}>{critical?`${critical} dringend prüfen`:'Keine dringende Campaign'}</strong>
    </header>
    <div className={styles.cards}>{campaigns.map(({mapping,insight,recommendation})=>{
      const href=affiliateCampaignHref({campaignId:mapping.campaignId,affiliateId,currentHref:returnTo}),totals=insight?.selectedRange?.attribution.total,saleRate=totals?.sois?100*totals.firstSales/totals.sois:0;
      return <article key={mapping.campaignId} className={styles[recommendation?.severity||'missing']}>
        <div className={styles.identity}><span>CAMPAIGN #{mapping.campaignId} · {mapping.status}</span><h3>{mapping.campaign}</h3><small>{insight?.currentSlots.length||0} aktive LPs · {insight?.legacySlots.length||0} Frühere LPs · Offer {insight?.identity.offerIds.map(id=>`#${id}`).join(', ')||'nicht zugeordnet'}</small></div>
        <div className={styles.periodResult}><span>Ausgewählter Zeitraum · {rangeLabel}</span><strong>{totals?`${num(totals.firstSales)} First-Sales`:'First-Sales nicht verfügbar'}</strong><small>{totals?`${saleRate.toFixed(2).replace('.',',')} % der SOIs werden Zahler · ${euro(totals.revenue)} Umsatz`:'Für diesen Zeitraum fehlen Eventdaten.'}</small></div>
        <div className={styles.decision}><span>NÄCHSTE PRÜFUNG</span><b>{recommendation?.title||'Daten prüfen'}</b><small>{recommendation?.detail||'Keine gemeinsame Campaign-Empfehlung verfügbar.'}</small></div>
        <div className={styles.metrics}><span><b className={mapping.profit30>=0?styles.up:styles.down}>{euro(mapping.profit30)}</b><small>Profit · {rangeLabel}</small></span><span><b>{num(mapping.sois30)}</b><small>SOIs · {rangeLabel}</small></span><span><b>{insight?`${insight.traffic24.cvr.toFixed(2).replace('.',',')} %`:'–'}</b><small>CVR · {insight?.windows.traffic||'Daten fehlen'}</small></span></div>
        <Link href={href} prefetch={false}>Campaign-Tiefenanalyse öffnen <span aria-hidden="true">→</span></Link>
      </article>;
    })}</div>
  </section>;
}
