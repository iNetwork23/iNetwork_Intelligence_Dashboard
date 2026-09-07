import {describe,expect,it,vi} from 'vitest';
import {conversionReportBody,metricRows} from './history-cache';
import {createEverflowHistorySource,everflowEntityReportBody} from './everflow-history';
import {resolveAffiliatePeriod} from './affiliate-period';
import {loadDashboard,loadPortfolio,loadAffiliateSourceRowsRange,loadAffiliateConversions,loadCampaignAffiliateRows,loadAffiliateSmartlinkInsights,loadSmartlinkInsight} from './everflow';
import {berlinDayUtcBounds} from './reporting-day';

// Provider metadata read-back 2026-09-07: GET /v1/meta/timezones.
// 56 = Europe/Berlin; 80 = America/New_York. Keep this contract independent of the implementation constant.
const now=new Date('2026-07-01T12:00:00Z');
const campaign={network_campaign_id:169,campaign_name:'Test',campaign_status:'active',redirect_routing_type:'weight',relationship:{redirects:{entries:[]}}};
const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200});

describe('Everflow Berlin reporting contract',()=>{
 it('uses Berlin for historical conversion and daily entity reports and period metadata',()=>{
  expect(conversionReportBody('2026-07-01','2026-07-01').timezone_id).toBe(56);
  expect(everflowEntityReportBody('2026-07-01','2026-07-01').timezone_id).toBe(56);
  expect(resolveAffiliatePeriod({},now)).toMatchObject({timezone:'Europe/Berlin',timezoneId:56});
 });
 const loaders:[string,(fetcher:typeof fetch)=>Promise<unknown>][]=[
  ['dashboard',f=>loadDashboard('7d','fixture-key',f,now)],
  ['portfolio',f=>loadPortfolio('30d','fixture-key',f,now)],
  ['affiliate sources',f=>loadAffiliateSourceRowsRange({from:'2026-07-01',to:'2026-07-01'},'6','fixture-key',f)],
  ['affiliate conversions',f=>loadAffiliateConversions('6','fixture-key',7,f,now)],
  ['campaign mapping',f=>loadCampaignAffiliateRows('fixture-key',f,now)],
  ['affiliate smartlinks',f=>loadAffiliateSmartlinkInsights('6',[169],'fixture-key',f,now)],
  ['smartlink insight',f=>loadSmartlinkInsight(169,'fixture-key',f,now)],
 ];
 it.each(loaders)('requests Berlin dates for %s',async(_name,load)=>{
  const bodies:Record<string,unknown>[]=[];
  const fetcher=vi.fn<typeof fetch>(async(url,init)=>{
   if(String(url).includes('/campaigns/'))return json(campaign);
   bodies.push(JSON.parse(String(init?.body)));
   return json(String(url).includes('/conversions')?{conversions:[],paging:{total_count:0}}:{table:[]});
  });
  await load(fetcher);
  expect(bodies.length).toBeGreaterThan(0);
  expect(bodies.every(body=>body.timezone_id===56)).toBe(true);
 });
 it.each([
  ['2026-07-01','2026-06-30T22:15:00Z','2026-07-01T22:15:00Z'],
  ['2026-01-15','2026-01-14T23:15:00Z','2026-01-15T23:15:00Z'],
  ['2026-03-29','2026-03-28T23:15:00Z','2026-03-29T22:15:00Z'],
  ['2026-10-25','2026-10-24T22:15:00Z','2026-10-25T23:15:00Z'],
 ])('keeps provider conversions inside the SQL replacement day on %s',async(day,inside,outside)=>{
  const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
   const body=JSON.parse(String(init?.body)),timestamp=body.timezone_id===56?inside:outside;
   return json({conversions:[{conversion_id:'fixture',transaction_id:'fixture-lead',conversion_unix_timestamp:Date.parse(timestamp)/1000,is_event:false,event:'SOI',status:'approved'}],paging:{total_count:1}});
  });
  const rows=await createEverflowHistorySource('fixture-key',fetcher).loadConversions(day,day);
  const bounds=berlinDayUtcBounds(day),instant=rows[0].conversion_unix_timestamp*1000;
  expect(instant).toBeGreaterThanOrEqual(Date.parse(bounds.from));
  expect(instant).toBeLessThan(Date.parse(bounds.toExclusive));
  expect(metricRows([],[],rows)[0].metric_date).toBe(day);
 });
});
