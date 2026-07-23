import{describe,expect,it}from'vitest';
import{decodeSourceSnapshotRow,encodeSourceSnapshotRow,mapAffiliateSourceRows,type DailySourceRow}from'./affiliate-source-cache';

const base:DailySourceRow={affiliate_id:'154',affiliate_name:'API Partner',offer_id:'20',offer_name:'XLOVES API',campaign_id:'0',campaign_name:'Direct',offer_url_id:'0',offer_url_name:'API',source_id:'N/A',sub_source:'N/A',clicks:0,sois:4,first_sales:1,rebills:2,coin_spend:3,payout:12,revenue:30,profit:18,raw:{traffic_mode:'api',adv1:'N/A',adv2:'placement-1'}};

describe('Supabase API source mapping',()=>{
  it('keeps ADV2 when ADV1 is missing and exposes clickless economics',()=>{
    const[report]=mapAffiliateSourceRows([base]);
    expect(report.columns.find(column=>column.column_type==='source_id')).toMatchObject({id:'Nicht übermittelt'});
    expect(report.columns.find(column=>column.column_type==='sub1')).toMatchObject({id:'placement-1'});
    expect(report.reporting).toMatchObject({total_click:0,cv:4,first_sales:1,rebills:2,coin_spend:3,payout:12,revenue:30,profit:18});
  });
  it('aggregates equal ADV pairs but keeps different ADV2 placements separate',()=>{
    const rows=mapAffiliateSourceRows([base,{...base,sois:2,raw:{traffic_mode:'api',adv1:'N/A',adv2:'placement-1'}},{...base,raw:{traffic_mode:'api',adv1:'N/A',adv2:'placement-2'}}]);
    expect(rows).toHaveLength(2);
    expect(rows.find(row=>row.columns.some(column=>column.id==='placement-1'))?.reporting.cv).toBe(6);
  });
  it('keeps tracked offers on source_id and sub1',()=>{
    const[report]=mapAffiliateSourceRows([{...base,offer_id:'8',offer_name:'Michverlieben',source_id:'source-a',sub_source:'sub-b',raw:{traffic_mode:'tracked',adv1:'ignored',adv2:'ignored'}}]);
    expect(report.columns.find(column=>column.column_type==='source_id')?.id).toBe('source-a');
    expect(report.columns.find(column=>column.column_type==='sub1')?.id).toBe('sub-b');
  });
  it('round-trips compact source snapshots without duplicating canonical cache fields',()=>{
    const metric={...base,clicks:Number(base.clicks),sois:Number(base.sois),first_sales:Number(base.first_sales),rebills:Number(base.rebills),coin_spend:Number(base.coin_spend),payout:Number(base.payout),revenue:Number(base.revenue),profit:Number(base.profit),id:'metric-id',metric_date:'2026-07-23',raw:{...base.raw,canonical_id:'legacy-id'}},encoded=encodeSourceSnapshotRow(metric),decoded=decodeSourceSnapshotRow(encoded,base.affiliate_id,base.affiliate_name);
    expect(decoded).toMatchObject(base);expect(encoded).not.toHaveProperty('id');expect(encoded).not.toHaveProperty('canonical_id');expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify(metric).length);
  });
});
