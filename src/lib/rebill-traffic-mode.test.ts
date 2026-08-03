import{describe,expect,it}from'vitest';
import{buildRebillCustomerIndex,rebillCustomerIdsFromIndex,type RebillEvent}from'./rebill-concentration';

describe('Rebill traffic-mode isolation',()=>{
 it('never merges identical tracked and API tuples',()=>{
  const base={type:'rebill' as const,convertedAt:'2026-07-28T10:00:00Z',campaignId:'0',offerId:'20',offerUrlId:'0',sourceId:'same',subSource:'same'};
  const events:RebillEvent[]=[{...base,customerId:'tracked',trafficMode:'tracked_direct'},{...base,customerId:'api',trafficMode:'clickless_api'}];
  const index=buildRebillCustomerIndex(events,{from:'2026-07-28',to:'2026-07-28'});
  expect(rebillCustomerIdsFromIndex(index,{...base,trafficMode:'tracked_direct'})).toEqual(['tracked']);
  expect(rebillCustomerIdsFromIndex(index,{...base,trafficMode:'clickless_api'})).toEqual(['api']);
 });
});
