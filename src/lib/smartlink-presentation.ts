import type{SmartSlot,SmartlinkSourceBreakdown}from'./smartlink';
export type SmartlinkSort='rotation'|'profit'|'cvr'|'sois';
export type SourceMetricSort='clicks'|'sois'|'cvr'|'firstSales'|'rebills'|'coinSpend'|'revenue'|'payout'|'profit';
export type SortDirection='asc'|'desc';
export type AnalysisTab='overview'|'sources';
export function smartlinkInstanceKey(campaignId:string|undefined,landingpageId:string){const clean=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'-');return`${clean(campaignId||'campaign')}-${clean(landingpageId)}`}
export function nextAnalysisTab(current:AnalysisTab,key:string):AnalysisTab|null{if(key==='Home')return'overview';if(key==='End')return'sources';if(key==='ArrowLeft'||key==='ArrowRight')return current==='overview'?'sources':'overview';return null}
export function sortSmartlinkSlots(slots:SmartSlot[],sort:SmartlinkSort){if(sort==='rotation')return[...slots];return[...slots].sort((a,b)=>sort==='profit'?b.metrics14.profit-a.metrics14.profit:sort==='cvr'?b.metrics24.cvr-a.metrics24.cvr:b.metrics14.sois-a.metrics14.sois)}
export function sortSourceBreakdownRows(rows:SmartlinkSourceBreakdown[],metric:SourceMetricSort,direction:SortDirection){const multiplier=direction==='asc'?1:-1;return[...rows].sort((a,b)=>{const left=a[metric],right=b[metric];if(left===null&&right!==null)return 1;if(right===null&&left!==null)return-1;return multiplier*((left??0)-(right??0))||a.source.localeCompare(b.source)||a.subSource.localeCompare(b.subSource)})}

export type SourceVerdict='verdient'|'verbrennt'|'neutral';
export type SmartlinkSourceGroup={mode:'api'|'tracked';source:string;mainValue?:string|null;verdict:SourceVerdict;totals:{clicks:number;sois:number;firstSales:number;rebills:number;coinSpend:number;revenue:number;payout:number;profit:number};rows:SmartlinkSourceBreakdown[]};

const sumField=(rows:SmartlinkSourceBreakdown[],field:'clicks'|'sois'|'firstSales'|'rebills'|'coinSpend'|'revenue'|'payout'|'profit')=>rows.reduce((total,row)=>total+row[field],0);

/** Fasst alle Sub-Sources unter ihrer Haupt-Source zusammen und sagt je Source, ob sie Geld verdient oder verbrennt. */
export function groupSmartlinkSourcesByMain(rows:SmartlinkSourceBreakdown[],metric:SourceMetricSort,direction:SortDirection):SmartlinkSourceGroup[]{
 const buckets=new Map<string,SmartlinkSourceBreakdown[]>();
 for(const row of rows){const key=`${row.mode}|${row.source}`,bucket=buckets.get(key)||[];bucket.push(row);buckets.set(key,bucket)}
 const groups=[...buckets.values()].map(bucket=>{
  const totals={clicks:sumField(bucket,'clicks'),sois:sumField(bucket,'sois'),firstSales:sumField(bucket,'firstSales'),rebills:sumField(bucket,'rebills'),coinSpend:sumField(bucket,'coinSpend'),revenue:sumField(bucket,'revenue'),payout:sumField(bucket,'payout'),profit:sumField(bucket,'profit')};
  return{mode:bucket[0].mode,source:bucket[0].source,mainValue:bucket[0].mainValue,totals,
   verdict:(totals.profit>0?'verdient':totals.profit<0?'verbrennt':'neutral') as SourceVerdict,
   rows:sortSourceBreakdownRows(bucket,metric,direction)};
 });
 const multiplier=direction==='asc'?1:-1;
 return groups.sort((a,b)=>{
  const value=(group:SmartlinkSourceGroup)=>metric==='cvr'?(group.totals.clicks?100*group.totals.sois/group.totals.clicks:0):group.totals[metric];
  return multiplier*(value(a)-value(b))||a.source.localeCompare(b.source);
 });
}
