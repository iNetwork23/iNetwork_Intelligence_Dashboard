import {describe,expect,it,vi} from 'vitest';
import {loadAutomationOfferLandingpages,searchAutomationOffers} from './automation-inventory';
const response=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
describe('automation inventory',()=>{
 it('searches offers by canonical ID or name and keeps status visible',async()=>{
  const fetcher=vi.fn().mockImplementation((url:string|URL|Request)=>Promise.resolve(response(String(url).endsWith('/offers/50')?{network_offer_id:50,name:'Sex69',offer_status:'paused'}:{offers:[{network_offer_id:57,name:'Singles69',offer_status:'active'},{network_offer_id:50,name:'Sex69',offer_status:'paused'}]})));
  expect(await searchAutomationOffers('sing', 'key',fetcher)).toEqual([{offerId:57,name:'Singles69',status:'active'}]);
  expect((await searchAutomationOffers('50','key',fetcher))[0]).toMatchObject({offerId:50,status:'paused'});
 });
 it('loads every offer-url page, filters exact offers and verifies affiliate visibility client-side',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request)=>{const value=String(url);if(value.includes('/offerurls?page=1'))return response({urls:[{network_offer_url_id:5701,network_offer_id:57,name:'A',url_status:'active'},{network_offer_url_id:999,network_offer_id:8,name:'Other',url_status:'active'}],paging:{total_count:3}});if(value.includes('/offerurls?page=2'))return response({urls:[{network_offer_url_id:5702,network_offer_id:57,name:'B',url_status:'paused'}],paging:{total_count:3}});if(value.includes('/offers/57/visibility'))return response({network_affiliate_ids:[436,32],set_type:'visible'});throw new Error(value)});
  const result=await loadAutomationOfferLandingpages([57],436,'key',fetcher,2);
  expect(result).toEqual([{offerId:57,visible:true,landingpages:[{offerUrlId:5701,name:'A',status:'active'}]}]);
  expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it('fails closed when visibility payload cannot prove the exact affiliate',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request)=>String(url).includes('/offerurls')?response({urls:[],paging:{total_count:0}}):response({network_affiliate_ids:[32]}));
  const result=await loadAutomationOfferLandingpages([57],436,'key',fetcher,500);
  expect(result[0]).toMatchObject({offerId:57,visible:false,landingpages:[]});
 });
});
