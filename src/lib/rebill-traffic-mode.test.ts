import{describe,expect,it}from'vitest';
import{buildRebillCustomerIndex,rebillCustomerIdsFromIndex,type RebillEvent}from'./rebill-concentration';
import{analyzeRebillConcentration,firstSaleCustomerIdsFromIndex}from'./rebill-concentration';
import{conversionToCacheRow}from'./history-cache';
import{buildRebillDaySnapshots,decodeCompleteRebillDaySnapshots}from'./rebill-event-snapshots';

describe('Rebill traffic-mode isolation',()=>{
 it('round-trips a provider event with unknown attribution without inventing customer coverage',()=>{
  const range={from:'2026-07-30',to:'2026-07-30'},canonical=conversionToCacheRow({conversion_id:'unknown-event',transaction_id:'ambiguous-transaction',conversion_unix_timestamp:Date.parse('2026-07-30T10:00:00Z')/1000,is_event:true,event:'Rebill',status:'approved',relationship:{affiliate:{network_affiliate_id:30},offer:{network_offer_id:20}}})!;
  expect(canonical.traffic_mode).toBe('unknown');
  expect(canonical.lead_id).toMatch(/^unjoinable-sha256:/);
  const records=buildRebillDaySnapshots([canonical],range,'30'),decoded=decodeCompleteRebillDaySnapshots(records,'30',range);
  expect(decoded).toMatchObject({complete:true,events:[{trafficMode:'unknown',type:'rebill'}]});
  const index=buildRebillCustomerIndex(decoded.events,range),customerIds=rebillCustomerIdsFromIndex(index,{trafficMode:'unknown',offerId:'20'});
  expect(customerIds).toEqual([null]);
  expect(rebillCustomerIdsFromIndex(index,{trafficMode:'tracked_direct',offerId:'20'})).toEqual([]);
  expect(analyzeRebillConcentration({firstSales:0,totalRebills:1,customerIds})).toMatchObject({status:'unavailable',coverageComplete:false,rebillCustomers:0,topCustomers:[]});
 });
 it.each(['unjoinable-sha256:','unjoinable-legacy-sha256:','api-customer-unavailable-sha256:'])('keeps missing customer identity unavailable for first sales and rebills (%s)',prefix=>{
  const base={customerId:prefix+'a'.repeat(64),convertedAt:'2026-07-30T10:00:00Z',campaignId:'0',offerId:'20',offerUrlId:'0',trafficMode:'clickless_api' as const},index=buildRebillCustomerIndex([{...base,type:'first_sale'},{...base,type:'rebill'}],{from:'2026-07-30',to:'2026-07-30'});
  expect(rebillCustomerIdsFromIndex(index,base)).toEqual([null]);
  expect(firstSaleCustomerIdsFromIndex(index,base)).toEqual([null]);
 });
 it('never merges identical tracked and API tuples',()=>{
  const base={type:'rebill' as const,convertedAt:'2026-07-28T10:00:00Z',campaignId:'0',offerId:'20',offerUrlId:'0',sourceId:'same',subSource:'same'};
  const events:RebillEvent[]=[{...base,customerId:'tracked',trafficMode:'tracked_direct'},{...base,customerId:'api',trafficMode:'clickless_api'}];
  const index=buildRebillCustomerIndex(events,{from:'2026-07-28',to:'2026-07-28'});
  expect(rebillCustomerIdsFromIndex(index,{...base,trafficMode:'tracked_direct'})).toEqual(['tracked']);
  expect(rebillCustomerIdsFromIndex(index,{...base,trafficMode:'clickless_api'})).toEqual(['api']);
 });
});
