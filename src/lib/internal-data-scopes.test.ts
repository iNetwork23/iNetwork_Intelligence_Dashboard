import {describe,expect,it} from 'vitest';
import {assertScopesSupported,filterPartnerRows,foreignScopeRequested,parseAccessMetadata} from './rbac';
import {campaignAffiliateRowsForAccess,campaignDirectoryForAccess,partnerAffiliateForSmartlink,sourceRowsForAccess} from './service-scopes';
const rows=[{affiliate_id:'a',offer_id:'o',campaign_id:'1',source_id:'s',sub_source:'ss',revenue:10},{affiliate_id:'b',offer_id:'o',campaign_id:'1',source_id:'s',sub_source:'ss',revenue:999}];
const sourceRows=rows.map(row=>({columns:Object.entries(row).map(([key,value])=>({column_type:({affiliate_id:'affiliate',offer_id:'offer',campaign_id:'campaign'} as Record<string,string>)[key]||key,id:String(value)}))}));
describe('assigned internal scopes',()=>{
 it.each(['super_admin','admin','employee','read_only'] as const)('%s only sees assigned rows before totals or source aggregation',role=>{
  const access=parseAccessMetadata({role,scopes:{affiliate:['a']}});
  expect(filterPartnerRows(rows,access)).toEqual([rows[0]]);
  expect(sourceRowsForAccess(sourceRows,access)).toEqual([sourceRows[0]]);
  expect(foreignScopeRequested(access,{affiliate:'b'})).toBe(true);
  expect(foreignScopeRequested(access,{offer:'o'})).toBe(false);
  expect(()=>assertScopesSupported(access,['offer'])).toThrow('403');
 });
 it('keeps internal unscoped access and partner empty-scope denial',()=>{
  expect(filterPartnerRows(rows,parseAccessMetadata({role:'employee'}))).toEqual(rows);
  expect(filterPartnerRows(rows,parseAccessMetadata({role:'partner'}))).toEqual([]);
 });
 it('scopes smartlink directories and mappings and rejects an ambiguous aggregate',()=>{
  const access=parseAccessMetadata({role:'admin',scopes:{affiliate:['a'],campaign:['1']}});
  expect(campaignDirectoryForAccess([{network_campaign_id:1},{network_campaign_id:2}],access)).toEqual([{network_campaign_id:1}]);
  expect(campaignAffiliateRowsForAccess(sourceRows,access)).toEqual([sourceRows[0]]);
  expect(partnerAffiliateForSmartlink(access)).toBe('a');
  expect(()=>partnerAffiliateForSmartlink(parseAccessMetadata({role:'admin',scopes:{affiliate:['a','b']}}))).toThrow('403');
 });
});
