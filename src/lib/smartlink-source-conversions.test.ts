import{describe,expect,it}from'vitest';
import{canonicalSmartlinkSubSource,mergeCanonicalSourceConversions}from'./smartlink-source-conversions';
import type{SmartlinkSourceFact}from'./smartlink-transparency';

const snapshot:SmartlinkSourceFact[]=[
 {metric_date:'2026-08-02',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',source_id:'amcch-adn',sub_source:'dir_de48ee39',clicks:25,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,raw:{traffic_mode:'tracked'}},
 {metric_date:'2026-08-02',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',source_id:'',sub_source:'',clicks:0,sois:1,first_sales:1,rebills:0,coin_spend:0,payout:3,revenue:16.66,profit:13.66,raw:{traffic_mode:'tracked'}},
];

describe('canonical Smartlink source conversion overlay',()=>{
 it('collapses Source 255 click IDs into its real DG and tutu Sub1 groups',()=>{
  expect(canonicalSmartlinkSubSource('255',{sub1:'2g520o04blrhm',sub2:'tutu',sub4:'5d1b72d184064e42aa7af8f80f721958'})).toBe('tutu');
  expect(canonicalSmartlinkSubSource('255',{sub1:'DG',sub4:'d227029ec1ca496fa9fbca917422d34c'})).toBe('DG');
  expect(canonicalSmartlinkSubSource('255',{sub1:'2g520o04blrhm',sub4:'5d1b72d184064e42aa7af8f80f721958'})).toBe('');
  expect(canonicalSmartlinkSubSource('other',{sub1:'real-sub',sub2:'deeper'})).toBe('real-sub');
 });
 it('assigns Source 255 conversion events to the same real Sub1 groups',()=>{
  const rows=mergeCanonicalSourceConversions([], [
   {type:'soi',converted_at:'2026-08-02T10:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:0,payout:3,status:'approved',is_scrub:false,raw:{source_id:'255',sub1:'2g520o04blrhm',sub2:'tutu',sub4:'5d1b72d184064e42aa7af8f80f721958'}},
   {type:'first_sale',converted_at:'2026-08-02T12:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:16.66,payout:0,status:'approved',is_scrub:false,raw:{source_id:'255',sub1:'DG',sub4:'d227029ec1ca496fa9fbca917422d34c'}},
  ],new Set(['2026-08-02']));
  expect(rows.map(row=>row.sub_source).sort()).toEqual(['DG','tutu']);
  expect(rows.some(row=>/^[a-f0-9]{32}$/.test(row.sub_source)||row.sub_source==='2g520o04blrhm')).toBe(false);
 });
 it('replaces unattributed snapshot money with the tracked source carried by canonical conversions',()=>{
  const rows=mergeCanonicalSourceConversions(snapshot,[
   {type:'soi',converted_at:'2026-08-02T10:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:0,payout:3,status:'approved',is_scrub:false,raw:{source_id:'amcch-adn',sub1:'dir_de48ee39',sub4:'385985403'}},
   {type:'first_sale',converted_at:'2026-08-02T12:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:16.66,payout:0,status:'approved',is_scrub:false,raw:{source_id:'amcch-adn',sub1:'dir_de48ee39',sub4:'385985403'}},
  ],new Set(['2026-08-02']));
  expect(rows).toHaveLength(1);
  expect(rows.reduce((sum,row)=>sum+Number(row.revenue),0)).toBe(16.66);
  expect(rows[0]).toMatchObject({source_id:'amcch-adn',sub_source:'dir_de48ee39',clicks:25,sois:1,first_sales:1,payout:3,revenue:16.66,profit:13.66});
  expect(rows.some(row=>!row.source_id&&Number(row.revenue)>0)).toBe(false);
 });
 it('never promotes Advery sub4 transaction IDs into the displayed Sub1 dimension',()=>{
  const rows=mergeCanonicalSourceConversions([{...snapshot[0],sub_source:'',clicks:1}], [
   {type:'soi',converted_at:'2026-08-02T10:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:0,payout:3,status:'approved',is_scrub:false,raw:{source_id:'b4971luh',sub1:'',sub4:'f2b5f7e1b4718ea3a0f3'}},
  ],new Set(['2026-08-02']));
  expect(rows.some(row=>row.sub_source==='f2b5f7e1b4718ea3a0f3')).toBe(false);
  expect(rows.find(row=>Number(row.sois)===1)).toMatchObject({source_id:'b4971luh',sub_source:''});
 });
 it('keeps non-accepted legacy snapshot days untouched and excludes rejected or scrubbed conversions',()=>{
  const rows=mergeCanonicalSourceConversions(snapshot,[
   {type:'rebill',converted_at:'2026-08-02T12:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:20,payout:0,status:'rejected',is_scrub:false,raw:{source_id:'amcch-adn'}},
   {type:'rebill',converted_at:'2026-08-02T13:00:00Z',offer_url_id:'2751',offer_id:'57',offer_name:'Singles69',revenue:30,payout:0,status:'approved',is_scrub:true,raw:{source_id:'amcch-adn'}},
  ],new Set());
  expect(rows).toEqual(snapshot);
 });
});
