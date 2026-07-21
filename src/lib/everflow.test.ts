import { describe, expect, it, vi } from 'vitest';
import { loadDashboard } from './everflow';

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
