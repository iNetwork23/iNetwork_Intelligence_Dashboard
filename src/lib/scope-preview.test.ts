import {describe,expect,it} from 'vitest';
import {parseScopePreviewInput,previewScopeEntities,type ScopePreview} from './scope-preview';
import type {PathRow} from './portfolio';

const path=(over:Partial<PathRow>):PathRow=>({key:'',offerId:'20',offer:'Offer 20',affiliateId:'154',affiliate:'Partner 154',campaignId:'0',campaign:'N/A',offerUrlId:'1',offerUrl:'LP 1',trafficType:'Direkt',clicks:100,sois:10,cvr:10,firstSales:1,firstSaleRate:10,rebills:0,coinSpend:0,payout:30,revenue:50,profit:20,profitEpc:0.2,...over});
const portfolio={paths:[
 path({affiliateId:'154',affiliate:'Partner 154',offerId:'20',offer:'Offer 20',sois:10}),
 path({affiliateId:'154',affiliate:'Partner 154',offerId:'21',offer:'Offer 21',sois:5,campaignId:'7',campaign:'Camp 7',trafficType:'Smartlink'}),
 path({affiliateId:'436',affiliate:'Partner 436',offerId:'20',offer:'Offer 20',sois:40}),
 path({affiliateId:'6',affiliate:'Partner 6',offerId:'22',offer:'Offer 22',sois:1,campaignId:'2',campaign:'Camp 2',trafficType:'Smartlink'}),
]};
const ids=(list:ScopePreview['affiliates'])=>list.map(x=>x.id);
const noMoney=(value:unknown)=>expect(JSON.stringify(value)).not.toMatch(/profit|revenue|payout|epc/i);

describe('previewScopeEntities – dieselbe Semantik wie rbac.filterPartnerRows',()=>{
 it('partner with an empty scope sees nothing (fail closed)',()=>{
  const preview=previewScopeEntities(portfolio,{role:'partner',scopes:{}});
  expect(preview).toEqual({affiliates:[],offers:[],paths:0,hidden:{affiliates:3,offers:3},scopesApply:true,unsupported:[]});
  expect(previewScopeEntities(portfolio,{role:'partner',scopes:{account:['9']}}).unsupported).toEqual(['account']);
 });
 it('partner sees only the affiliates/offers every populated dimension allows, sorted by SOIs',()=>{
  const preview=previewScopeEntities(portfolio,{role:'partner',scopes:{affiliate:['154']}});
  expect(ids(preview.affiliates)).toEqual(['154']);
  expect(preview.affiliates[0]).toEqual({id:'154',name:'Partner 154',sois:15});
  expect(ids(preview.offers)).toEqual(['20','21']);
  expect(preview.paths).toBe(2);
  expect(preview.hidden).toEqual({affiliates:2,offers:1});
  const narrowed=previewScopeEntities(portfolio,{role:'partner',scopes:{affiliate:['154'],campaign:['7']}});
  expect(ids(narrowed.offers)).toEqual(['21']);
  expect(narrowed.paths).toBe(1);
  expect(previewScopeEntities(portfolio,{role:'partner',scopes:{affiliate:['999']}}).paths).toBe(0);
 });
 it('internal roles see everything – populated scopes do not restrict them (like filterPartnerRows) and the preview says so',()=>{
  const all=previewScopeEntities(portfolio,{role:'employee',scopes:{}});
  expect(ids(all.affiliates)).toEqual(['436','154','6']);
  expect(ids(all.offers)).toEqual(['20','21','22']);
  expect(all.paths).toBe(4);
  expect(all.hidden).toEqual({affiliates:0,offers:0});
  expect(all.scopesApply).toBe(false);
  const scoped=previewScopeEntities(portfolio,{role:'admin',scopes:{affiliate:['154']}});
  expect(scoped.paths).toBe(4);
  expect(scoped.scopesApply).toBe(false);
 });
 it('never carries money into the preview',()=>{
  noMoney(previewScopeEntities(portfolio,{role:'super_admin',scopes:{}}));
  noMoney(previewScopeEntities(portfolio,{role:'partner',scopes:{affiliate:['436']}}));
 });
 it('leaves the portfolio untouched',()=>{
  const before=JSON.stringify(portfolio);
  previewScopeEntities(portfolio,{role:'partner',scopes:{offer:['20']}});
  expect(JSON.stringify(portfolio)).toBe(before);
 });
});

describe('parseScopePreviewInput – bounded, validated query input',()=>{
 it('accepts a standard role and a JSON scope object with string arrays',()=>{
  expect(parseScopePreviewInput('partner','{"affiliate":["154"," 7 "],"offer":[]}')).toEqual({role:'partner',scopes:{affiliate:['154','7'],offer:[]}});
  expect(parseScopePreviewInput('employee',null)).toEqual({role:'employee',scopes:{}});
 });
 it('rejects unknown roles, malformed or oversized JSON and unknown scope keys',()=>{
  expect(parseScopePreviewInput('root','{}')).toBeNull();
  expect(parseScopePreviewInput('partner','{')).toBeNull();
  expect(parseScopePreviewInput('partner','[]')).toBeNull();
  expect(parseScopePreviewInput('partner','{"affiliate":"154"}')).toBeNull();
  expect(parseScopePreviewInput('partner',`{"affiliate":["${'x'.repeat(5000)}"]}`)).toBeNull();
  expect(parseScopePreviewInput('partner','{"constructor":["1"]}')).toBeNull();
  expect(parseScopePreviewInput('partner','{"affiliate":["1"],"colour":["red"]}')).toBeNull();
 });
});
