import type{SmartSlot,SmartlinkSourceBreakdown}from'./smartlink';
export type SmartlinkSort='rotation'|'profit'|'cvr'|'sois';
export type SourceMetricSort='clicks'|'sois'|'cvr'|'firstSales'|'rebills'|'coinSpend'|'revenue'|'payout'|'profit';
export type SortDirection='asc'|'desc';
export type AnalysisTab='overview'|'sources';
export function smartlinkInstanceKey(campaignId:string|undefined,landingpageId:string){const clean=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'-');return`${clean(campaignId||'campaign')}-${clean(landingpageId)}`}
export function nextAnalysisTab(current:AnalysisTab,key:string):AnalysisTab|null{if(key==='Home')return'overview';if(key==='End')return'sources';if(key==='ArrowLeft'||key==='ArrowRight')return current==='overview'?'sources':'overview';return null}
export function sortSmartlinkSlots(slots:SmartSlot[],sort:SmartlinkSort){if(sort==='rotation')return[...slots];return[...slots].sort((a,b)=>sort==='profit'?b.metrics14.profit-a.metrics14.profit:sort==='cvr'?b.metrics24.cvr-a.metrics24.cvr:b.metrics14.sois-a.metrics14.sois)}
export function sortSourceBreakdownRows(rows:SmartlinkSourceBreakdown[],metric:SourceMetricSort,direction:SortDirection){const multiplier=direction==='asc'?1:-1;return[...rows].sort((a,b)=>{const left=a[metric],right=b[metric];if(left===null&&right!==null)return 1;if(right===null&&left!==null)return-1;return multiplier*((left??0)-(right??0))||a.source.localeCompare(b.source)||a.subSource.localeCompare(b.subSource)})}
