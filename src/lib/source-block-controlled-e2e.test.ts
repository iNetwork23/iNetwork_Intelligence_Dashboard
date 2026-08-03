import{describe,expect,it}from'vitest';
// Runtime module is plain ESM so operators can execute it without a TypeScript loader.
// @ts-expect-error no declaration file is intentionally required for the operator script
import{activeBlockInventory,approvalPhrase,assertSafeScope,matchingActiveBlocks}from'../../scripts/source-block-controlled-e2e.mjs';

const scope={affiliateId:'20',affiliateName:'ME Media',offerId:'17',offerName:'XLOVES - CPL SOI',campaignId:'23',trafficMode:'tracked',level:'sub_source',mainValue:'source-a',subValue:'sub-b',expectedConfirmation:'sub-b',allowDestructive:true};

describe('controlled source-block production E2E guard',()=>{
 it('requires one fully bounded campaign/offer/source scope and explicit destructive flag',()=>{
  expect(()=>assertSafeScope(scope)).not.toThrow();
  for(const patch of [{campaignId:''},{offerId:'0'},{mainValue:''},{subValue:''},{allowDestructive:false}])expect(()=>assertSafeScope({...scope,...patch})).toThrow();
 });
 it('binds approval to the exact tuple instead of a generic yes',()=>{
  expect(approvalPhrase(scope)).toBe('ACTIVATE-AND-ROLLBACK:20:17:23:tracked:sub_source:source-a:sub-b');
 });
 it('detects an existing active block for the exact technical tuple',()=>{
  const blocks=[{status:'active',affiliateId:20,offerId:17,originCampaignId:23,trafficMode:'tracked',level:'sub_source',mainValue:'source-a',subValue:'sub-b'},{status:'inactive',affiliateId:20,offerId:17,originCampaignId:23,trafficMode:'tracked',level:'sub_source',mainValue:'source-a',subValue:'sub-b'}];
  expect(matchingActiveBlocks(blocks,scope)).toHaveLength(1);
  expect(matchingActiveBlocks(blocks,{...scope,subValue:'other'})).toHaveLength(0);
 });
 it('compares the complete canonical active inventory rather than only its count',()=>{
  const a={id:'a',status:'active',affiliateId:20,offerId:17,originCampaignId:23,trafficMode:'tracked',level:'sub_source',mainValue:'source-a',subValue:'sub-b',everflowSettingId:'11'};
  const b={id:'b',status:'active',affiliateId:21,offerId:18,originCampaignId:24,trafficMode:'tracked',level:'main_source',mainValue:'source-x',subValue:null,everflowSettingId:'12'};
  expect(activeBlockInventory([b,a])).toEqual(activeBlockInventory([a,b]));
  expect(activeBlockInventory([a,{...b,id:'c'}])).not.toEqual(activeBlockInventory([a,b]));
 });
});
