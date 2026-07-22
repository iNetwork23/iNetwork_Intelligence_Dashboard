import type{SmartSlot}from'./smartlink';
export type SmartlinkSort='rotation'|'profit'|'cvr'|'sois';
export function sortSmartlinkSlots(slots:SmartSlot[],sort:SmartlinkSort){if(sort==='rotation')return[...slots];return[...slots].sort((a,b)=>sort==='profit'?b.metrics14.profit-a.metrics14.profit:sort==='cvr'?b.metrics24.cvr-a.metrics24.cvr:b.metrics14.sois-a.metrics14.sois)}
