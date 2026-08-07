import{describe,expect,it}from'vitest';
import{mergeCanonicalSourceConversions}from'./smartlink-source-conversions';
import type{SmartlinkSourceFact}from'./smartlink-transparency';

const snapshot:SmartlinkSourceFact[]=[
 {metric_date:'2026-08-02',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',source_id:'amcch-adn',sub_source:'385985403',clicks:25,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,raw:{traffic_mode:'tracked'}},
 {metric_date:'2026-08-02',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',source_id:'',sub_source:'',clicks:0,sois:1,first_sales:1,rebills:0,coin_spend:0,payout:3,revenue:16.66,profit:13.66,raw:{traffic_mode:'tracked'}},
];

describe('canonical Smartlink source conversion overlay',()=>{
 it('replaces unattributed snapshot money with the tracked source carried by canonical conversions',()=>{
  const rows=mergeCanonicalSourceConversions(snapshot,[
   {type:'soi',converted_at:'2026-08-02T10:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:0,payout:3,status:'approved',is_scrub:false,raw:{source_id:'amcch-adn',sub4:'385985403'}},
   {type:'first_sale',converted_at:'2026-08-02T12:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:16.66,payout:0,status:'approved',is_scrub:false,raw:{source_id:'amcch-adn',sub4:'385985403'}},
  ],new Set(['2026-08-02']));
  expect(rows).toHaveLength(1);
  expect(rows.reduce((sum,row)=>sum+Number(row.revenue),0)).toBe(16.66);
  expect(rows[0]).toMatchObject({source_id:'amcch-adn',sub_source:'385985403',clicks:25,sois:1,first_sales:1,payout:3,revenue:16.66,profit:13.66});
  expect(rows.some(row=>!row.source_id&&Number(row.revenue)>0)).toBe(false);
 });
 it('keeps non-accepted legacy snapshot days untouched and excludes rejected or scrubbed conversions',()=>{
  const rows=mergeCanonicalSourceConversions(snapshot,[
   {type:'rebill',converted_at:'2026-08-02T12:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:20,payout:0,status:'rejected',is_scrub:false,raw:{source_id:'amcch-adn'}},
   {type:'rebill',converted_at:'2026-08-02T13:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:30,payout:0,status:'approved',is_scrub:true,raw:{source_id:'amcch-adn'}},
  ],new Set());
  expect(rows).toEqual(snapshot);
 });
});
