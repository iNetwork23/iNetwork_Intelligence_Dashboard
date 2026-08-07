import type{SmartSlot,SmartlinkSourceBreakdown}from'./smartlink';

export type SourceLandingpageMetrics={clicks:number;sois:number;cvr:number|null;firstSales:number;firstSaleRate:number|null;rebills:number;coinSpend:number;revenue:number;payout:number;profit:number};
export type SourceLandingpageCell={landingpageId:string;landingpageName:string;offerId:string;status:string;weight:number;state:'observed'|'zero'|'unknown';coverageComplete:boolean;metrics:SourceLandingpageMetrics|null};
export type CampaignSourceFit='positive'|'negative'|'mixed'|'insufficient';
export type CampaignSourceRow={key:string;mode:'tracked'|'api';source:string;subSource:string;mainValue:string|null;subValue:string|null;mainLabel:'Source'|'ADV1';subLabel:'Sub1'|'ADV2';cells:SourceLandingpageCell[];affectedLandingpages:number;totals:SourceLandingpageMetrics;bestLandingpageId:string|null;worstLandingpageId:string|null;fit:CampaignSourceFit;observation:string;coverageComplete:boolean};

const round=(value:number,digits=2)=>Number(value.toFixed(digits));
const empty=():SourceLandingpageMetrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:null,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0});
const finish=(value:SourceLandingpageMetrics,mode:'tracked'|'api'):SourceLandingpageMetrics=>({...value,cvr:mode==='api'?null:value.clicks?round(100*value.sois/value.clicks):null,firstSaleRate:value.sois?round(100*value.firstSales/value.sois):null,revenue:round(value.revenue),payout:round(value.payout),profit:round(value.profit)});
const add=(target:SourceLandingpageMetrics,row:Pick<SmartlinkSourceBreakdown,'clicks'|'sois'|'firstSales'|'rebills'|'coinSpend'|'revenue'|'payout'|'profit'>)=>{target.clicks+=row.clicks;target.sois+=row.sois;target.firstSales+=row.firstSales;target.rebills+=row.rebills;target.coinSpend+=row.coinSpend;target.revenue+=row.revenue;target.payout+=row.payout;target.profit+=row.profit};
const technical=(value:string|null|undefined)=>value??null;
const tupleKey=(row:SmartlinkSourceBreakdown)=>JSON.stringify([row.mode,technical(row.mainValue),technical(row.subValue)]);
export const isSmartlinkSourceCoverageComplete=(slot:SmartSlot)=>{const coverage=slot.sourceCoverage,visibleSois=(slot.sourceBreakdown||[]).reduce((sum,row)=>sum+row.sois,0);return Boolean(coverage&&coverage.missingDays.length===0&&coverage.acceptedDays===coverage.expectedDays&&visibleSois===slot.metrics14.sois)};

export function buildCampaignSourceRows(slots:SmartSlot[]):CampaignSourceRow[]{
 const grouped=new Map<string,{row:SmartlinkSourceBreakdown;observed:Map<string,SourceLandingpageMetrics>}>();
 for(const slot of slots)for(const row of slot.sourceBreakdown||[]){
  const key=tupleKey(row),group=grouped.get(key)||{row,observed:new Map()},metrics=group.observed.get(slot.id)||empty();
  add(metrics,row);group.observed.set(slot.id,metrics);grouped.set(key,group);
 }
 return[...grouped.entries()].map(([key,group])=>{
  const mode=group.row.mode,cells=slots.map(slot=>{const observed=group.observed.get(slot.id),coverageComplete=isSmartlinkSourceCoverageComplete(slot);return{landingpageId:slot.id,landingpageName:slot.name,offerId:slot.offerId,status:slot.status,weight:slot.weight,state:observed?'observed':coverageComplete?'zero':'unknown',coverageComplete,metrics:observed?finish(observed,mode):coverageComplete?finish(empty(),mode):null} as SourceLandingpageCell}).sort((a,b)=>a.landingpageId.localeCompare(b.landingpageId,undefined,{numeric:true})),observedCells=cells.filter((cell):cell is SourceLandingpageCell&{metrics:SourceLandingpageMetrics}=>cell.state==='observed'&&cell.metrics!==null),totalsRaw=empty();
  for(const cell of observedCells)add(totalsRaw,cell.metrics);
  const totals=finish(totalsRaw,mode),coverageComplete=cells.every(cell=>cell.coverageComplete),ranked=coverageComplete&&observedCells.length>=2?[...observedCells].sort((a,b)=>b.metrics.profit-a.metrics.profit||b.metrics.firstSales-a.metrics.firstSales||b.metrics.sois-a.metrics.sois||a.landingpageId.localeCompare(b.landingpageId,undefined,{numeric:true})):[],best=ranked[0]||null,worst=ranked.at(-1)||null,hasPositive=observedCells.some(cell=>cell.metrics.profit>0),hasNegative=observedCells.some(cell=>cell.metrics.profit<0);
  let fit:CampaignSourceFit='insufficient',observation='Datenbasis für einen LP-Vergleich noch nicht vollständig';
  if(!coverageComplete)observation='Vergleich wegen unvollständiger Source-Abdeckung offen';
  else if(observedCells.length===1)observation=`Bisher nur auf LP #${observedCells[0].landingpageId} beobachtet`;
  else if(observedCells.length>=2&&hasPositive&&hasNegative){fit='mixed';observation=`Auf LP #${best?.landingpageId} profitabler beobachtet`;}
  else if(observedCells.length>=2&&totals.profit>0){fit='positive';observation='Auf allen beobachteten LPs positiv';}
  else if(observedCells.length>=2&&totals.profit<0){fit='negative';observation='Auf allen beobachteten LPs negativ';}
  else if(observedCells.length>=2){fit='mixed';observation='Unterschiedliche LP-Ergebnisse ohne klaren Profitabstand';}
  const mainLabel:CampaignSourceRow['mainLabel']=mode==='api'?'ADV1':'Source',subLabel:CampaignSourceRow['subLabel']=mode==='api'?'ADV2':'Sub1';
  return{key,mode,source:group.row.source,subSource:group.row.subSource,mainValue:technical(group.row.mainValue),subValue:technical(group.row.subValue),mainLabel,subLabel,cells,affectedLandingpages:observedCells.length,totals,bestLandingpageId:best?.landingpageId||null,worstLandingpageId:worst?.landingpageId||null,fit,observation,coverageComplete};
 }).sort((a,b)=>a.totals.profit-b.totals.profit||b.totals.sois-a.totals.sois||a.key.localeCompare(b.key));
}
