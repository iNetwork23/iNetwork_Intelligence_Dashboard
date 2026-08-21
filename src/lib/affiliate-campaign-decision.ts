import type {CampaignAffiliateMapping} from './affiliate-smartlinks';
import {primarySmartlinkRecommendation,type SmartlinkInsight} from './optimization-workflow';

export type CampaignEconomicStatus='profitabel'|'unprofitabel'|'noch_nicht_bewertbar'|'daten_unvollständig';
export type CampaignAction='ausbauen'|'weiterlaufen'|'beobachten'|'stoppen'|'prüfen';

export type AffiliateCampaignDecision={
  mapping:CampaignAffiliateMapping;
  insight?:SmartlinkInsight;
  status:CampaignEconomicStatus;
  statusLabel:'Profitabel'|'Unprofitabel'|'Noch nicht bewertbar'|'Daten unvollständig';
  action:CampaignAction;
  actionLabel:'Ausbauen'|'Weiterlaufen lassen'|'Beobachten'|'Stoppen'|'Prüfen';
  reason:string;
  firstSales:number|null;
  rebills:number|null;
};

const statusLabels:Record<CampaignEconomicStatus,AffiliateCampaignDecision['statusLabel']>={
  profitabel:'Profitabel',
  unprofitabel:'Unprofitabel',
  noch_nicht_bewertbar:'Noch nicht bewertbar',
  daten_unvollständig:'Daten unvollständig',
};
const actionLabels:Record<CampaignAction,AffiliateCampaignDecision['actionLabel']>={
  ausbauen:'Ausbauen',
  weiterlaufen:'Weiterlaufen lassen',
  beobachten:'Beobachten',
  stoppen:'Stoppen',
  prüfen:'Prüfen',
};
const num=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);

export function buildAffiliateCampaignDecision(mapping:CampaignAffiliateMapping,insight?:SmartlinkInsight):AffiliateCampaignDecision{
  const selectedRange=insight?.selectedRange,selected=selectedRange?.attribution,eventCoverageComplete=selectedRange?.eventCoverageComplete===true;
  const controlMismatch=Boolean(selected&&(
    Math.abs(selected.total.revenue-mapping.revenue30)>=0.01||
    Math.abs(selected.total.payout-mapping.payout30)>=0.01||
    Math.abs(selected.total.profit-mapping.profit30)>=0.01||
    selected.total.sois!==mapping.sois30
  ));
  let status:CampaignEconomicStatus;
  let action:CampaignAction;
  let reason:string;
  if(!selected||!selected.reconciled||controlMismatch||!eventCoverageComplete){
    status='daten_unvollständig';
    action='prüfen';
    reason=!eventCoverageComplete&&selected?'Eventdaten für den Zeitraum sind nicht vollständig belegt.':controlMismatch?'Campaign-Summe und sichtbare Detailwerte stimmen nicht überein.':selected?'Campaign-Summe und Detailwerte sind noch nicht abgestimmt.':'Detail- und Eventdaten für den Zeitraum fehlen.';
  }else if(selected.total.sois<50){
    status='noch_nicht_bewertbar';
    action='beobachten';
    reason=`${num(selected.total.sois)} SOIs · noch keine belastbare Mindestmenge.`;
  }else{
    status=mapping.profit30>=0?'profitabel':'unprofitabel';
    const recommendation=primarySmartlinkRecommendation(insight?.recommendations||[]);
    if(recommendation?.action==='scale')action='ausbauen';
    else if(recommendation?.action==='stop')action='stoppen';
    else if(recommendation?.action==='rotate')action='prüfen';
    else if(recommendation?.action==='hold')action='weiterlaufen';
    else action='beobachten';
    reason=recommendation?.detail||`${euro(mapping.profit30)} bei ${num(mapping.sois30)} SOIs.`;
  }
  return{
    mapping,
    insight,
    status,
    statusLabel:statusLabels[status],
    action,
    actionLabel:actionLabels[action],
    reason,
    firstSales:eventCoverageComplete&&selected?selected.total.firstSales:null,
    rebills:eventCoverageComplete&&selected?selected.total.rebills:null,
  };
}

export function sortCampaignDecisions(rows:AffiliateCampaignDecision[]):AffiliateCampaignDecision[]{
  return[...rows].sort((a,b)=>a.mapping.profit30-b.mapping.profit30||a.mapping.campaignId-b.mapping.campaignId);
}
