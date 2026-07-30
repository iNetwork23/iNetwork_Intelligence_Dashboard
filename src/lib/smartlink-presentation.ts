import type{SmartSlot}from'./smartlink';
export type SmartlinkSort='rotation'|'profit'|'cvr'|'sois';
export type AnalysisTab='overview'|'sources';
export function smartlinkInstanceKey(campaignId:string|undefined,landingpageId:string){const clean=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'-');return`${clean(campaignId||'campaign')}-${clean(landingpageId)}`}
export function nextAnalysisTab(current:AnalysisTab,key:string):AnalysisTab|null{if(key==='Home')return'overview';if(key==='End')return'sources';if(key==='ArrowLeft'||key==='ArrowRight')return current==='overview'?'sources':'overview';return null}
export function sortSmartlinkSlots(slots:SmartSlot[],sort:SmartlinkSort){if(sort==='rotation')return[...slots];return[...slots].sort((a,b)=>sort==='profit'?b.metrics14.profit-a.metrics14.profit:sort==='cvr'?b.metrics24.cvr-a.metrics24.cvr:b.metrics14.sois-a.metrics14.sois)}
