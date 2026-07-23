import{describe,expect,it}from'vitest';
import{normalizeAffiliateSourceDimensions}from'./affiliate-source-dimensions';
const row=(offer:string)=>({columns:[{column_type:'offer',id:'20',label:offer},{column_type:'source_id',id:'source-old',label:'source-old'},{column_type:'sub1',id:'sub-old',label:'sub-old'},{column_type:'adv1',id:'api-source',label:'api-source'},{column_type:'adv2',id:'api-sub',label:'api-sub'}],reporting:{cv:1}});
describe('affiliate source dimensions',()=>{
  it('maps ADV1 and ADV2 to the operational source fields for API offers',()=>{const normalized=normalizeAffiliateSourceDimensions(row('XLOVES - API'));expect(normalized.columns.find(x=>x.column_type==='source_id')?.id).toBe('api-source');expect(normalized.columns.find(x=>x.column_type==='sub1')?.id).toBe('api-sub')});
  it('keeps source_id and sub1 for tracked non-API offers',()=>{const normalized=normalizeAffiliateSourceDimensions(row('Michverlieben - CPL SOI'));expect(normalized.columns.find(x=>x.column_type==='source_id')?.id).toBe('source-old');expect(normalized.columns.find(x=>x.column_type==='sub1')?.id).toBe('sub-old')});
});
