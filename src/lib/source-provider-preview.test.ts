import {describe,expect,it,vi} from 'vitest';
import {activateEverflowSourceBlock,buildEverflowBlockPayload,previewEverflowSourceBlock} from './everflow-source-blocks';
import {normalizeSourceBlockInput} from './source-blocks';
const block=normalizeSourceBlockInput({affiliateId:'6',offerId:'56',affiliateName:'Partner',offerName:'Offer',trafficMode:'tracked',level:'main_source',mainValue:null});
const response=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const summary=(id:number)=>({network_custom_payout_revenue_setting_id:id,network_offer_id:56,network_affiliate_ids:[6],network_offer_payout_revenue_id:0});
const matching=(id:number)=>({...summary(id),...buildEverflowBlockPayload(block,'existing'),relationship:{variables:{entries:block.variables}}});
const readOnly=(fetcher:ReturnType<typeof vi.fn>)=>expect(fetcher.mock.calls.every(([url,init])=>String(url).includes('/payoutrevenuetable?')?init?.method==='POST':!init?.method||init.method==='GET')).toBe(true);
describe('read-only provider preview',()=>{
 it('reports exact missing-source semantics and a new-rule plan without creating anything',async()=>{
  const fetcher=vi.fn(async()=>response({custom_payout_revenue_settings:[],paging:{total_count:0}}));
  const result=await previewEverflowSourceBlock(block,'test-key',fetcher);
  expect(result).toMatchObject({operation:'create',matchingSettingIds:[],affiliateId:6,offerId:56,variables:[{variable:'source_id',comparison_method:'not_present',variable_value:''}],payoutAmount:0,postbackDisabled:true});
  expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);readOnly(fetcher);
 });
 it('identifies an existing matching rule without adopting or deleting it',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request)=>response(String(url).includes('payoutrevenuetable')?{custom_payout_revenue_settings:[summary(777)],paging:{total_count:1}}:matching(777)));
  expect(await previewEverflowSourceBlock(block,'test-key',fetcher)).toMatchObject({operation:'reuse',matchingSettingIds:[777]});readOnly(fetcher);
 });
 it('reads a second full-list page when the provider omits its count and finds a conflicting rule before any write',async()=>{
  const page1=Array.from({length:100},(_,i)=>({...summary(i+1),network_offer_id:99}));
  const fetcher=vi.fn(async(url:string|URL|Request)=>{const path=String(url);return response(path.includes('payoutrevenuetable')?{custom_payout_revenue_settings:path.includes('page=1&')?page1:[summary(777)]}:{...matching(777),payout_amount:5})});
  await expect(previewEverflowSourceBlock(block,'test-key',fetcher)).rejects.toThrow('widersprüchliche');
  expect(fetcher.mock.calls.some(([url])=>String(url).includes('page=2&'))).toBe(true);readOnly(fetcher);
  fetcher.mockClear();await expect(activateEverflowSourceBlock(block,'new','test-key',fetcher)).rejects.toThrow('widersprüchliche');readOnly(fetcher);
 });
 it.each([{}, {custom_payout_revenue_settings:[],paging:{total_count:1}}, {custom_payout_revenue_settings:[summary(2),summary(2)],paging:{total_count:2}}, {custom_payout_revenue_settings:[],paging:{total_count:'invalid'}}])('refuses incomplete or inconsistent lists without provider writes: %j',async body=>{
  const fetcher=vi.fn(async()=>response(body));await expect(previewEverflowSourceBlock(block,'test-key',fetcher)).rejects.toThrow();readOnly(fetcher);
 });
 it('accepts an integer count encoded as text',async()=>{const fetcher=vi.fn(async()=>response({custom_payout_revenue_settings:[],paging:{total_count:'0'}}));expect((await previewEverflowSourceBlock(block,'test-key',fetcher)).operation).toBe('create')});
});
