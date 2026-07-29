import {describe,expect,it,vi} from 'vitest';
import {activateEverflowSourceBlock,buildEverflowBlockPayload,deactivateEverflowSourceBlock} from './everflow-source-blocks';
import {normalizeSourceBlockInput} from './source-blocks';

const block=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'DatingLeads by Lewis',offerId:'25',offerName:'WhatsMeet - API',trafficMode:'api',level:'sub_source',mainValue:null,subValue:'P-3591625022',reason:'Partner gestoppt'});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

describe('Everflow source block writer',()=>{
 it('builds an offer-specific zero-payout rule that disables matched partner postbacks',()=>{
  const payload=buildEverflowBlockPayload(block,'dashboard-id');
  expect(payload).toMatchObject({network_affiliate_ids:[30],network_offer_id:25,network_offer_payout_revenue_id:0,is_custom_payout_enabled:true,payout_amount:0,payout_type:'cpa',is_postback_disabled:true,custom_setting_status:'active'});
  expect(payload.variables).toEqual([
    {variable:'adv1',variable_value:'',variable_secondary_value:'',comparison_method:'not_present'},
    {variable:'adv2',variable_value:'P-3591625022',variable_secondary_value:'',comparison_method:'exact_match'},
  ]);
 });

 it('creates and read-back verifies the exact Everflow rule',async()=>{
  let tableReads=0;
  const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
   const path=String(url);
   if(path.includes('payoutrevenuetable')){tableReads++;return response({custom_payout_revenue_settings:tableReads===1?[]:[{network_custom_payout_revenue_setting_id:777,network_affiliate_ids:[30],network_offer_id:25}],paging:{total_count:tableReads===1?0:1}});}
   if(path.endsWith('/networks/custom/payoutrevenue')&&init?.method==='POST')return response({network_custom_payout_revenue_setting_id:777});
   if(path.includes('/networks/custom/payoutrevenue/777'))return response({...buildEverflowBlockPayload(block,'dashboard-id'),network_custom_payout_revenue_setting_id:777,relationship:{variables:{entries:block.variables}}});
   throw new Error(`unexpected ${path}`);
  });
  await expect(activateEverflowSourceBlock(block,'dashboard-id','secret',fetcher)).resolves.toMatchObject({settingId:777,created:true});
  const create=fetcher.mock.calls.find(call=>String(call[0]).endsWith('/networks/custom/payoutrevenue'))!;
  expect(JSON.parse(String(create[1]?.body))).toMatchObject({payout_amount:0,is_postback_disabled:true,network_offer_id:25});
 });

 it('fails closed when Everflow read-back does not preserve postback suppression',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
   const path=String(url);
   if(path.includes('payoutrevenuetable'))return response({custom_payout_revenue_settings:[]});
   if(path.endsWith('/networks/custom/payoutrevenue')&&init?.method==='POST')return response({network_custom_payout_revenue_setting_id:778});
   return response({...buildEverflowBlockPayload(block,'dashboard-id'),network_custom_payout_revenue_setting_id:778,is_postback_disabled:false,relationship:{variables:{entries:block.variables}}});
  });
  await expect(activateEverflowSourceBlock(block,'dashboard-id','secret',fetcher)).rejects.toThrow('Verifikation');
 });

 it('deletes only the managed setting and verifies it is gone',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
   const path=String(url);
   if(path.includes('/777')&&init?.method==='DELETE')return response({result:true});
   if(path.includes('/777'))return response({Error:'Not found'},404);
   throw new Error(`unexpected ${path}`);
  });
  await expect(deactivateEverflowSourceBlock(777,'secret',fetcher)).resolves.toEqual({deleted:true});
 });
});
