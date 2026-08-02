import {describe,expect,it} from 'vitest';
import {metricMatchesSourceBlock,normalizeSourceBlockInput,sourceBlockIdentityKey,sourceBlockOffersFromSnapshotRows,sourceBlockVisibleInSnapshotRows,summarizeSourceBlockViolations} from './source-blocks';

describe('source block contract',()=>{
  it('targets one tracked main source inside one affiliate and offer',()=>{
    const block=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'WhatsMeet',trafficMode:'tracked',level:'main_source',mainValue:'25022'});
    expect(block.variables).toEqual([{variable:'source_id',variable_value:'25022',variable_secondary_value:'',comparison_method:'exact_match'}]);
    expect(block.affiliateId).toBe(30);
    expect(block.offerId).toBe(25);
  });

  it('targets a tracked subsource together with its transmitted main source',()=>{
    const block=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'WhatsMeet',trafficMode:'tracked',level:'sub_source',mainValue:'25022',subValue:'A1'});
    expect(block.variables.map(item=>[item.variable,item.variable_value])).toEqual([['source_id','25022'],['sub1','A1']]);
  });

  it('targets an API subsource under the explicitly missing ADV1 bucket',()=>{
    const block=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'DatingLeads by Lewis',offerId:'25',offerName:'WhatsMeet - API',trafficMode:'api',level:'sub_source',mainValue:null,subValue:'P-3591625022'});
    expect(block.variables).toEqual([
      {variable:'adv1',variable_value:'',variable_secondary_value:'',comparison_method:'not_present'},
      {variable:'adv2',variable_value:'P-3591625022',variable_secondary_value:'',comparison_method:'exact_match'},
    ]);
  });

  it('targets an API subsource together with adv1 when both values are transmitted',()=>{
    const block=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'WhatsMeet',trafficMode:'api',level:'sub_source',mainValue:'25022',subValue:'A1'});
    expect(block.variables.map(item=>[item.variable,item.variable_value])).toEqual([['adv1','25022'],['adv2','A1']]);
  });

  it('rejects a subsource block without a subsource and any block without an offer',()=>{
    expect(()=>normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'WhatsMeet',trafficMode:'api',level:'sub_source',mainValue:'25022'})).toThrow('Unterquelle');
    expect(()=>normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'',offerName:'WhatsMeet',trafficMode:'api',level:'main_source',mainValue:'25022'})).toThrow('Offer');
  });

  it('never sends the localized missing-value label as an exact Everflow matcher',()=>{
    const block=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'Offer',trafficMode:'tracked',level:'main_source',mainValue:'Nicht übermittelt'});
    expect(block.mainValue).toBeNull();
    expect(block.variables).toEqual([{variable:'source_id',variable_value:'',variable_secondary_value:'',comparison_method:'not_present'}]);
  });

  it('keeps identities separate by affiliate, offer, main source and subsource',()=>{
    const make=(offerId:string,subValue:string)=>normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId,offerName:'Offer',trafficMode:'api',level:'sub_source',mainValue:'25022',subValue});
    expect(sourceBlockIdentityKey(make('25','A1'))).not.toBe(sourceBlockIdentityKey(make('20','A1')));
    expect(sourceBlockIdentityKey(make('25','A1'))).not.toBe(sourceBlockIdentityKey(make('25','A2')));
  });

  it('counts only post-cutoff rows matching the exact offer-specific source block',()=>{
    const block={...normalizeSourceBlockInput({affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'WhatsMeet',trafficMode:'api',level:'sub_source',mainValue:null,subValue:'P-3591625022'}),effectiveAt:'2026-07-27T10:00:00.000Z'};
    const rows=[
      {metric_date:'2026-07-28',affiliate_id:'30',offer_id:'25',source_id:'',sub_source:'',sois:4,payout:0,raw:{adv1:'',adv2:'P-3591625022'}},
      {metric_date:'2026-07-28',affiliate_id:'30',offer_id:'20',source_id:'',sub_source:'',sois:9,payout:27,raw:{adv1:'',adv2:'P-3591625022'}},
      {metric_date:'2026-07-29',affiliate_id:'30',offer_id:'25',source_id:'',sub_source:'',sois:3,payout:3,raw:{adv1:'',adv2:'other'}},
    ];
    expect(metricMatchesSourceBlock(rows[0],block)).toBe(true);
    expect(metricMatchesSourceBlock(rows[1],block)).toBe(false);
    expect(metricMatchesSourceBlock({...rows[0],raw:{adv1:'different-main',adv2:'P-3591625022'}},block)).toBe(false);
    expect(summarizeSourceBlockViolations(rows,block)).toEqual({sois:4,payout:0,lastTrafficDate:'2026-07-28'});
  });

  it('discovers every offer for the exact snapshot-backed source without mixing affiliate or traffic mode',()=>{
    const row=(affiliate:string,offer:string,offerName:string,campaign:string,mode:'tracked'|'api',main:string,sub:string)=>({columns:[{column_type:'affiliate',id:affiliate,label:affiliate},{column_type:'offer',id:offer,label:offerName},{column_type:'campaign',id:campaign,label:campaign},{column_type:'traffic_mode',id:mode,label:mode},{column_type:'source_id',id:main,label:main},{column_type:'sub1',id:sub||'N/A',label:sub||'N/A'}]});
    const block=normalizeSourceBlockInput({affiliateId:'20',affiliateName:'Partner',offerId:'17',offerName:'Offer 17',campaignId:'23',trafficMode:'tracked',level:'main_source',mainValue:'source-x'});
    const rows=[row('20','17','Offer 17','23','tracked','source-x','a'),row('20','57','Offer 57','99','tracked','source-x','b'),row('20','50','Offer 50','23','api','source-x',''),row('99','8','Foreign','23','tracked','source-x','')];
    expect(sourceBlockOffersFromSnapshotRows(rows,block)).toEqual([{offerId:'17',offerName:'Offer 17'},{offerId:'57',offerName:'Offer 57'}]);
    expect(sourceBlockVisibleInSnapshotRows(rows,block)).toBe(true);
    expect(sourceBlockVisibleInSnapshotRows(rows,{...block,originCampaignId:999})).toBe(false);
  });

  it('requires the exact child value for snapshot-backed sub-source scope',()=>{
    const row=(sub:string)=>({columns:[{column_type:'affiliate',id:'20',label:'20'},{column_type:'offer',id:'17',label:'Offer 17'},{column_type:'campaign',id:'23',label:'23'},{column_type:'traffic_mode',id:'api',label:'api'},{column_type:'source_id',id:'adv-main',label:'adv-main'},{column_type:'sub1',id:sub,label:sub}]});
    const block=normalizeSourceBlockInput({affiliateId:'20',affiliateName:'Partner',offerId:'17',offerName:'Offer 17',campaignId:'23',trafficMode:'api',level:'sub_source',mainValue:'adv-main',subValue:'adv-child'});
    expect(sourceBlockVisibleInSnapshotRows([row('other')],block)).toBe(false);
    expect(sourceBlockVisibleInSnapshotRows([row('adv-child')],block)).toBe(true);
  });
});
