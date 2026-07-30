import{describe,expect,it}from'vitest';
import{parseAccessMetadata}from'./rbac';
import{assertAffiliateOptimizerAggregateAccess,campaignAffiliateRowsForAccess,campaignDirectoryForAccess,partnerAffiliateForSmartlink,sourceRowsForAccess}from'./service-scopes';

const campaign=(id:number)=>({network_campaign_id:id,campaign_name:`C${id}`,campaign_status:'active'});
const sourceRow=(affiliate:string,offer:string,source:string,subSource:string,campaignId='0')=>({columns:[{column_type:'affiliate',id:affiliate},{column_type:'offer',id:offer},{column_type:'campaign',id:campaignId},{column_type:'source_id',id:source},{column_type:'sub1',id:subSource}],reporting:{cv:1}});

describe('pre-aggregation service scoping',()=>{
 it('filters campaign discovery by explicit campaign scope',()=>{
  const access=parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],campaign:['2']}});
  expect(campaignDirectoryForAccess([campaign(1),campaign(2)],access).map(x=>x.network_campaign_id)).toEqual([2]);
  expect(campaignDirectoryForAccess([campaign(2)],parseAccessMetadata({role:'partner',scopes:{affiliate:['7']}}))).toEqual([]);
 });
 it('requires both affiliate and campaign scope before exposing observed partner mappings',()=>{
  const rows=[sourceRow('7','8','a','x','2'),sourceRow('9','8','b','y','2')];
  expect(campaignAffiliateRowsForAccess(rows,parseAccessMetadata({role:'partner',scopes:{campaign:['2']}}))).toEqual([]);
  expect(campaignAffiliateRowsForAccess(rows,parseAccessMetadata({role:'partner',scopes:{affiliate:['7']}}))).toEqual([]);
  expect(campaignAffiliateRowsForAccess(rows,parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],campaign:['2']}}))).toEqual([rows[0]]);
  expect(campaignAffiliateRowsForAccess(rows,parseAccessMetadata({role:'admin'}))).toEqual(rows);
 });
 it('requires one affiliate dimension for partner smartlink aggregation and rejects unsupported scopes',()=>{
  expect(partnerAffiliateForSmartlink(parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],campaign:['2']}}))).toBe('7');
  expect(()=>partnerAffiliateForSmartlink(parseAccessMetadata({role:'partner',scopes:{affiliate:['7','8'],campaign:['2']}}))).toThrow(/403/);
  expect(()=>partnerAffiliateForSmartlink(parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],campaign:['2'],source:['x']}}))).toThrow(/403/);
 });
 it('filters every source snapshot to partner scopes before aggregation',()=>{
  const rows=[sourceRow('7','8','allowed','a'),sourceRow('7','8','blocked','b'),sourceRow('9','8','allowed','a')],access=parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],offer:['8'],source:['allowed'],sub_source:['a']}});
  expect(sourceRowsForAccess(rows,access)).toEqual([rows[0]]);
  expect(sourceRowsForAccess(rows,parseAccessMetadata({role:'partner'}))).toEqual([]);
  expect(sourceRowsForAccess(rows,parseAccessMetadata({role:'admin'}))).toEqual(rows);
 });
 it('rejects affiliate optimizer aggregates when source dimensions are unavailable',()=>{
  expect(()=>assertAffiliateOptimizerAggregateAccess(parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],source:['x']}}))).toThrow(/403/);
  expect(()=>assertAffiliateOptimizerAggregateAccess(parseAccessMetadata({role:'partner',scopes:{affiliate:['7'],offer:['4']}}))).not.toThrow();
 });
});
