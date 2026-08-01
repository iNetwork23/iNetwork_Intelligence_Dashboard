import Link from 'next/link';
import type {CampaignAffiliateMapping} from '@/lib/affiliate-smartlinks';
import {affiliateCampaignHref,primarySmartlinkRecommendation,type SmartlinkInsight} from '@/lib/optimization-workflow';
import styles from './AffiliateSmartlinkOverview.module.css';

const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const num=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
const rank={critical:0,warning:1,positive:2,neutral:3,missing:4} as const;
type AttentionSeverity=keyof typeof rank;

function campaignAttention(insight:SmartlinkInsight|undefined){
  const recommendation=primarySmartlinkRecommendation(insight?.recommendations||[]);
  const current=insight?.selectedRange?.attribution.current;
  const currentMonetizationGap=Boolean(current&&current.sois>=50&&current.firstSales===0&&current.revenue<=0&&current.profit<0);
  if(recommendation?.severity==='critical')return{severity:'critical' as const,title:recommendation.title,detail:recommendation.detail};
  if(currentMonetizationGap&&current)return{
    severity:'warning' as const,
    title:'Aktuelle Rotation noch ohne Umsatz',
    detail:`${num(current.sois)} SOIs der aktuellen LPs · ${euro(current.revenue)} Umsatz · ${euro(current.profit)} Profit. Der Gesamtumsatz stammt aus früheren LPs oder vor der aktuellen Rotation. Einzelne LPs bleiben bis zu ihrer Reifeschwelle auf Beobachten.`,
  };
  return{severity:(recommendation?.severity||'missing') as AttentionSeverity,title:recommendation?.title||'Daten prüfen',detail:recommendation?.detail||'Keine gemeinsame Campaign-Empfehlung verfügbar.'};
}

export default function AffiliateSmartlinkOverview({affiliateId,mappings,insights,rangeLabel,returnTo}:{affiliateId:string;mappings:CampaignAffiliateMapping[];insights:SmartlinkInsight[];rangeLabel:string;returnTo:string}){
  const byId=new Map(insights.map(insight=>[insight.identity.campaignId,insight]));
  const campaigns=mappings.map(mapping=>{
    const insight=byId.get(mapping.campaignId),attention=campaignAttention(insight);
    return{mapping,insight,attention};
  }).sort((a,b)=>rank[a.attention.severity]-rank[b.attention.severity]||a.mapping.profit30-b.mapping.profit30);
  const critical=campaigns.filter(item=>item.attention.severity==='critical').length;
  const review=campaigns.filter(item=>item.attention.severity==='critical'||item.attention.severity==='warning').length;
  const status=critical?`${critical} dringend prüfen`:review?`${review} Campaign${review===1?'':'s'} mit Prüfhinweis`:'Keine Campaign mit Prüfhinweis';
  return <section className={styles.overview} aria-labelledby="smartlink-actions-title">
    <header>
      <div><span>SMARTLINK-HANDLUNGSÜBERSICHT</span><h2 id="smartlink-actions-title">Was heute geprüft werden muss</h2><p>Der Affiliate Optimizer priorisiert Campaigns. Routing, Testreife und LP-Begründung werden in der Campaign-Tiefenanalyse geprüft.</p></div>
      <strong className={critical?styles.critical:review?styles.notice:styles.clear}>{status}</strong>
    </header>
    <div className={styles.cards}>{campaigns.map(({mapping,insight,attention})=>{
      const href=affiliateCampaignHref({campaignId:mapping.campaignId,affiliateId,currentHref:returnTo}),totals=insight?.selectedRange?.attribution.total,saleRate=totals?.sois?100*totals.firstSales/totals.sois:0;
      const revenueWithoutFirstSale=Boolean(totals&&totals.firstSales===0&&totals.revenue>0&&(totals.rebills>0||totals.coinSpend>0));
      return <article key={mapping.campaignId} className={styles[attention.severity]}>
        <div className={styles.identity}><span>CAMPAIGN #{mapping.campaignId} · {mapping.status}</span><h3>{mapping.campaign}</h3><small>{insight?.currentSlots.length||0} aktive LPs · {insight?.legacySlots.length||0} Frühere LPs · Offer {insight?.identity.offerIds.map(id=>`#${id}`).join(', ')||'nicht zugeordnet'}</small></div>
        <div className={styles.periodResult}><span>Ausgewählter Zeitraum · {rangeLabel}</span><strong>{totals?`${num(totals.firstSales)} First-Sales · ${num(totals.rebills)} Rebills · ${num(totals.coinSpend)} Coin-Spend-Events`:'Monetarisierung nicht verfügbar'}</strong><small>{totals?`${saleRate.toFixed(2).replace('.',',')} % First-Sales je SOI · ${euro(totals.revenue)} Umsatz`:'Für diesen Zeitraum fehlen Eventdaten.'}</small>{revenueWithoutFirstSale&&totals&&<small className={styles.explanation}>Der Umsatz stammt aus {totals.rebills?`${num(totals.rebills)} Rebills`:''}{totals.rebills&&totals.coinSpend?' und ':''}{totals.coinSpend?`${num(totals.coinSpend)} Coin-Spend-Events`:''}; deshalb sind Umsatz und 0 First-Sales gleichzeitig möglich.</small>}</div>
        <div className={styles.decision}><span>NÄCHSTE PRÜFUNG</span><b>{attention.title}</b><small>{attention.detail}</small></div>
        <div className={styles.metrics}><span><b className={mapping.profit30>=0?styles.up:styles.down}>{euro(mapping.profit30)}</b><small>Profit · {rangeLabel}</small></span><span><b>{num(mapping.sois30)}</b><small>SOIs · {rangeLabel}</small></span><span><b>{insight?`${insight.traffic24.cvr.toFixed(2).replace('.',',')} %`:'–'}</b><small>CVR · {insight?.windows.traffic||'Daten fehlen'}</small></span></div>
        <Link href={href} prefetch={false}>Campaign-Tiefenanalyse öffnen <span aria-hidden="true">→</span></Link>
      </article>;
    })}</div>
  </section>;
}
