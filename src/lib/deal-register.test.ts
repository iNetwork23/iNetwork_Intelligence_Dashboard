import {describe,expect,it} from 'vitest';
import {DEAL_RULE_LIMITS,DEFAULT_DEAL_RULES,describeDealRule,normalizeStoredDealRules,resolveDealRule,sameDealRuleValues,validateDealRules,type DealRule} from './deal-register';
const rule=(partial:Partial<DealRule>&{affiliateId:number}):DealRule=>({note:'',updatedAt:'2026-09-04T10:00:00.000Z',updatedBy:'u1',...partial});

describe('deal register defaults (D9)',()=>{
 it('encodes exactly the three former code constants',()=>{
  expect(resolveDealRule(DEFAULT_DEAL_RULES,436)).toMatchObject({testQuotaSois:50,maturityHours:336});
  expect(resolveDealRule(DEFAULT_DEAL_RULES,436,146)).toMatchObject({testQuotaSois:50,maturityHours:336});
  expect(resolveDealRule(DEFAULT_DEAL_RULES,6,2)).toMatchObject({cvrFloorPct:1});
  expect(resolveDealRule(DEFAULT_DEAL_RULES,6)).toBeNull();
  expect(resolveDealRule(DEFAULT_DEAL_RULES,6,3)).toBeNull();
  expect(resolveDealRule(DEFAULT_DEAL_RULES,32)).toBeNull();
  expect(DEFAULT_DEAL_RULES).toHaveLength(2);
  expect(validateDealRules(DEFAULT_DEAL_RULES)).toMatchObject({ok:true});
 });
 it('merges a campaign rule field-wise over the partner rule so a partial campaign rule keeps the partner maturity',()=>{
  const rules=[rule({affiliateId:9,testQuotaSois:40,maturityHours:200}),rule({affiliateId:9,campaignId:5,cvrFloorPct:2,note:'nur CVR'})];
  expect(resolveDealRule(rules,9,5)).toMatchObject({testQuotaSois:40,maturityHours:200,cvrFloorPct:2,note:'nur CVR'});
  expect(resolveDealRule(rules,9,6)).toMatchObject({testQuotaSois:40,maturityHours:200});
  expect(resolveDealRule(rules,9,6)?.cvrFloorPct).toBeUndefined();
  expect(resolveDealRule([rule({affiliateId:9,campaignId:5,testQuotaSois:30})],9)).toBeNull();
  const specific=[rule({affiliateId:9,maturityHours:200}),rule({affiliateId:9,campaignId:5,maturityHours:100})];
  expect(resolveDealRule(specific,9,5)?.maturityHours).toBe(100);
 });
});

describe('deal rule validation',()=>{
 it('accepts form strings, normalizes them and rejects duplicates, empty rules and out-of-range values',()=>{
  const ok=validateDealRules([{affiliateId:'436',campaignId:'',testQuotaSois:'50',maturityHours:'336',cvrFloorPct:'',note:' Test '}]);
  expect(ok).toEqual({ok:true,rules:[{affiliateId:436,testQuotaSois:50,maturityHours:336,note:'Test'}]});
  expect(validateDealRules([{affiliateId:6,campaignId:2,cvrFloorPct:'0,5'}])).toEqual({ok:true,rules:[{affiliateId:6,campaignId:2,cvrFloorPct:0.5,note:''}]});
  expect(validateDealRules('x')).toMatchObject({ok:false});
  expect(validateDealRules([{affiliateId:0,testQuotaSois:1}])).toMatchObject({ok:false,error:expect.stringContaining('Partner-ID')});
  expect(validateDealRules([{affiliateId:1,campaignId:-2,testQuotaSois:1}])).toMatchObject({ok:false,error:expect.stringContaining('Campaign-ID')});
  expect(validateDealRules([{affiliateId:1}])).toMatchObject({ok:false,error:expect.stringContaining('mindestens ein Wert')});
  expect(validateDealRules([{affiliateId:1,testQuotaSois:DEAL_RULE_LIMITS.testQuotaSois.max+1}])).toMatchObject({ok:false,error:expect.stringContaining('Testquote')});
  expect(validateDealRules([{affiliateId:1,maturityHours:12.5}])).toMatchObject({ok:false,error:expect.stringContaining('ganze Zahl')});
  expect(validateDealRules([{affiliateId:1,cvrFloorPct:101}])).toMatchObject({ok:false,error:expect.stringContaining('CVR-Untergrenze')});
  expect(validateDealRules([{affiliateId:1,cvrFloorPct:'abc'}])).toMatchObject({ok:false,error:expect.stringContaining('keine Zahl')});
  expect(validateDealRules([{affiliateId:1,testQuotaSois:1,note:'x'.repeat(DEAL_RULE_LIMITS.noteLength+1)}])).toMatchObject({ok:false,error:expect.stringContaining('Notiz')});
  expect(validateDealRules([{affiliateId:1,testQuotaSois:1},{affiliateId:1,testQuotaSois:2}])).toMatchObject({ok:false,error:expect.stringContaining('doppelt')});
  expect(validateDealRules([{affiliateId:1,testQuotaSois:1},{affiliateId:1,campaignId:2,testQuotaSois:2}])).toMatchObject({ok:true});
  expect(validateDealRules(Array.from({length:DEAL_RULE_LIMITS.maxRules+1},(_,i)=>({affiliateId:i+1,testQuotaSois:1})))).toMatchObject({ok:false});
 });
 it('reads stored records strictly and drops malformed entries',()=>{
  expect(normalizeStoredDealRules(null)).toBeNull();
  expect(normalizeStoredDealRules({version:1})).toBeNull();
  expect(normalizeStoredDealRules({version:1,rules:[]})).toEqual([]);
  const stored=normalizeStoredDealRules({version:1,rules:[rule({affiliateId:436,testQuotaSois:50}),{affiliateId:'436'},{affiliateId:7,testQuotaSois:'x',note:'',updatedAt:'',updatedBy:''}]});
  expect(stored).toHaveLength(1);expect(stored?.[0].affiliateId).toBe(436);
 });
 it('describes rules for tables and compares values without timestamps',()=>{
  expect(describeDealRule({affiliateId:436,testQuotaSois:50,maturityHours:336,note:''})).toBe('Testquote 50 SOIs · Reife 336 h');
  expect(describeDealRule({affiliateId:6,campaignId:2,cvrFloorPct:1.5,note:''})).toBe('CVR ≥ 1,5 %');
  expect(sameDealRuleValues(rule({affiliateId:1,testQuotaSois:5}),{affiliateId:1,testQuotaSois:5,note:''})).toBe(true);
  expect(sameDealRuleValues(rule({affiliateId:1,testQuotaSois:5}),{affiliateId:1,testQuotaSois:6,note:''})).toBe(false);
 });
});
