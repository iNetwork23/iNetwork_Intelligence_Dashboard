import { describe, expect, it, vi } from 'vitest';
import { loadAffiliateConversions,loadDashboard,loadPortfolio,loadSmartlinkInsight,searchCampaigns } from './everflow';

const response=(body:unknown)=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(body),text:()=>Promise.resolve(JSON.stringify(body))} as Response);

describe('loadDashboard',()=>{
 it('loads current campaign redirects and validates report scope',async()=>{
  const fetcher=vi.fn()
   .mockImplementationOnce(()=>response({network_campaign_id:169,campaign_name:'WLX',campaign_status:'active',redirect_routing_type:'weight',relationship:{redirects:{entries:[{redirect_network_offer_id:57,redirect_network_offer_url_id:2774,routing_value:1,relationship:{offer_url:{name:'SecretCasual',url_status:'active'}}}]}}}))
   .mockImplementationOnce(()=>response({table:[{columns:[{column_type:'campaign',id:'169',label:'WLX'},{column_type:'offer',id:'57',label:'Single69'},{column_type:'offer_url',id:'2774',label:'SecretCasual'}],reporting:{total_click:10,cv:2,payout:6,revenue:0,profit:-6}}]}))
   .mockImplementationOnce(()=>response({table:[]}));
  const result=await loadDashboard('7d','secret',fetcher,new Date('2026-07-21T18:00:00Z'));
  expect(result.slots[0]).toMatchObject({urlId:'2774',clicks:10,sois:2,profit:-6});
  expect(fetcher).toHaveBeenCalledTimes(3);
  const reportBody=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(reportBody.query.filters).toEqual([{resource_type:'offer',filter_id_value:'57'},{resource_type:'campaign',filter_id_value:'169'}]);
 });
});

describe('loadPortfolio',()=>{
 it('requests the complete account without offer or campaign filters',async()=>{
  const row={columns:[{column_type:'affiliate',id:'1',label:'Partner'},{column_type:'offer',id:'8',label:'Offer'},{column_type:'campaign',id:'0',label:'N/A'},{column_type:'offer_url',id:'10',label:'LP'}],reporting:{total_click:10,cv:2,payout:6,revenue:9,profit:3}};
  const fetcher=vi.fn().mockImplementationOnce(()=>response({table:[row]})).mockImplementationOnce(()=>response({table:[]}));
  const result=await loadPortfolio('30d','secret',fetcher,new Date('2026-07-21T18:00:00Z'));
  expect(result.offers[0]).toMatchObject({id:'8',clicks:10,profit:3});
  expect(fetcher).toHaveBeenCalledTimes(2);
  const body=JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.query.filters).toEqual([]);
  expect(body.columns.map((x:{column:string})=>x.column)).toEqual(['affiliate','offer','campaign','offer_url']);
 });
});

describe('affiliate conversion history',()=>{
 it('paginates and constrains the conversion report to one direct-link affiliate',async()=>{const conversion={transaction_id:'tx',event:'SOI',is_event:false,conversion_unix_timestamp:1,relationship:{affiliate:{network_affiliate_id:376}}};const fetcher=vi.fn().mockImplementationOnce(()=>response({conversions:[conversion],paging:{total_count:2001}})).mockImplementationOnce(()=>response({conversions:[{...conversion,transaction_id:'tx2'}],paging:{total_count:2001}}));const rows=await loadAffiliateConversions('376','secret',90,fetcher,new Date('2026-07-22T12:00:00Z'));expect(rows).toHaveLength(2);expect(fetcher).toHaveBeenCalledTimes(2);const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.query.filters).toEqual([{resource_type:'affiliate',filter_id_value:'376'},{resource_type:'campaign',filter_id_value:'0'}]);expect(body).toMatchObject({show_conversions:true,show_events:true})});
});

describe('smartlink intelligence loader',()=>{
 it('loads one campaign plus hourly base and event reports with exact campaign filter',async()=>{
  const campaign={network_campaign_id:146,campaign_name:'Global',campaign_status:'active',redirect_routing_type:'weight',relationship:{redirects:{entries:[]}}};
  const fetcher=vi.fn().mockImplementationOnce(()=>response(campaign)).mockImplementationOnce(()=>response({table:[]})).mockImplementationOnce(()=>response({table:[]}));
  const result=await loadSmartlinkInsight(146,'secret',fetcher,new Date('2026-07-22T12:00:00Z'));
  expect(result.identity.campaignId).toBe(146);expect(fetcher).toHaveBeenCalledTimes(3);
  for(const call of fetcher.mock.calls.slice(1)){const body=JSON.parse(call[1].body);expect(body.query.filters).toEqual([{resource_type:'campaign',filter_id_value:'146'}]);expect(body.columns.map((x:{column:string})=>x.column)).toContain('hour');}
 });
 it('searches campaigns by ID or name',async()=>{const fetcher=vi.fn().mockImplementation(()=>response({campaigns:[{network_campaign_id:2,campaign_name:'TrafficPartner',campaign_status:'active'},{network_campaign_id:146,campaign_name:'Global TrafficCompany',campaign_status:'active'}]}));expect((await searchCampaigns('trafficcompany','secret',fetcher))[0].network_campaign_id).toBe(146);expect((await searchCampaigns('2','secret',fetcher))[0].network_campaign_id).toBe(2);});
 it('returns the complete directory for client-side cached search',async()=>{const campaigns=Array.from({length:30},(_,i)=>({network_campaign_id:i+1,campaign_name:`Campaign ${i+1}`,campaign_status:'active'}));const fetcher=vi.fn().mockImplementation(()=>response({campaigns}));expect(await searchCampaigns('','secret',fetcher)).toHaveLength(30);});
});
