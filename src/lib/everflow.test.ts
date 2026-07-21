import { describe, expect, it, vi } from 'vitest';
import { loadDashboard,loadPortfolio } from './everflow';

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
