import {describe,expect,it} from 'vitest';
import {fraudConversionFromCacheRecord,fraudMetricFromReportRow} from './fraud-adapters';

const row=(overrides:Record<string,string>={})=>({columns:[
  {column_type:'date',id:'2026-07-20',label:'2026-07-20'},
  {column_type:'affiliate',id:'77',label:'Affiliate 77'},
  {column_type:'offer',id:overrides.offer||'999',label:overrides.offerName||'Unlisted Offer'},
  {column_type:'campaign',id:overrides.campaign||'0',label:overrides.campaignName||'Direct'},
  {column_type:'offer_url',id:'44',label:'Landingpage'},
  {column_type:'traffic_mode',id:overrides.mode||'tracked',label:overrides.mode||'tracked'},
  {column_type:'source_id',id:'source-x',label:'source-x'},
  {column_type:'sub1',id:'leaf-y',label:'leaf-y'},
],reporting:{total_click:12,cv:5,first_sales:1,rebills:2,coin_spend:3,payout:15,revenue:40,profit:25}});

describe('fraud reporting adapters',()=>{
  it('includes an offer outside every historical baseline as tracked Direct',()=>{
    expect(fraudMetricFromReportRow(row())).toMatchObject({offerId:'999',trafficMode:'tracked_direct',source:'source-x',subSource:'leaf-y',clicks:12,sois:5,firstSales:1,coinEvents:3});
  });

  it('distinguishes a tracked Smartlink from Direct',()=>{
    expect(fraudMetricFromReportRow(row({campaign:'42',campaignName:'Smartlink'})).trafficMode).toBe('tracked_smartlink');
  });

  it('maps an API snapshot to clickless without click semantics',()=>{
    const api=row({mode:'api',offer:'20',offerName:'XLOVES API'});api.columns.push({column_type:'adv1',id:'publisher-a',label:'publisher-a'},{column_type:'adv2',id:'placement-b',label:'placement-b'});
    expect(fraudMetricFromReportRow(api)).toMatchObject({trafficMode:'clickless_api',offerId:'20',source:'publisher-a',subSource:'placement-b',sourceDimension:'adv1',subSourceDimension:'adv2'});
  });

  it('uses the deepest complete tracked source tuple at the real fraud boundary',()=>{
    const deep=row();deep.columns.push({column_type:'sub2',id:'child',label:'child'},{column_type:'sub3',id:'leaf',label:'leaf'});
    expect(fraudMetricFromReportRow(deep)).toMatchObject({source:'source-x',subSource:'leaf',sourceDimension:'source_id',subSourceDimension:'sub3'});
  });

  it('keeps an explicit event-only tracked snapshot in tracked Direct mode',()=>{
    const eventOnly=row();eventOnly.reporting.total_click=0;eventOnly.columns=eventOnly.columns.map(column=>column.column_type==='offer_url'?{...column,id:'0'}:column);
    expect(fraudMetricFromReportRow(eventOnly)).toMatchObject({trafficMode:'tracked_direct',source:'source-x',subSource:'leaf-y'});
  });

  it('preserves an explicit unknown snapshot mode instead of reclassifying it from clicks',()=>{
    expect(fraudMetricFromReportRow(row({mode:'unknown'})).trafficMode).toBe('unknown');
  });

  it('maps only server-safe conversion columns into the engine',()=>{
    const converted=fraudConversionFromCacheRecord({id:'cv',type:'coin_spend',converted_at:'2026-07-20T12:00:00Z',click_at:null,affiliate_id:'77',affiliate_name:'Affiliate 77',offer_id:'999',offer_name:'Offer',campaign_id:'0',campaign_name:'Direct',offer_url_id:'44',offer_url_name:'LP',traffic_mode:'tracked_direct',source_id:'source-x',sub_source:'leaf-y',lead_id:'lead-secret',status:'approved',is_scrub:false,error_code:null,payout:0,revenue:0,raw:{ip:'must-not-leak'}});
    expect(converted).toMatchObject({id:'cv',type:'coin_spend',leadId:'lead-secret',trafficMode:'tracked_direct'});
    expect(converted).not.toHaveProperty('raw');
  });
});
