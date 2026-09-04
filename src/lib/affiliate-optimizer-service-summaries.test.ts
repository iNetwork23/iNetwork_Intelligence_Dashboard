import{beforeEach,describe,expect,it,vi}from'vitest';
import type{Metrics,PathRow,Portfolio}from'./portfolio';
import{parseAccessMetadata}from'./rbac';
import type{LeadYoungSummary}from'./lead-maturity';

vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
const getDashboard=vi.fn();
vi.mock('./dashboard-service',()=>({getDashboard:(...a:unknown[])=>getDashboard(...a)}));
const loadConversions=vi.fn();
vi.mock('./cached-evaluations',()=>({loadAffiliateConversionsFromCache:(...a:unknown[])=>loadConversions(...a),loadAffiliateSourceRowsRangeFromCache:vi.fn(),loadAffiliateActivityIndex:vi.fn(),loadSourceSnapshotFreshness:vi.fn()}));
const summaryRows=vi.fn<()=>Promise<{data:Array<{value:unknown}>|null;error:{message:string}|null}>>();
const likeSpy=vi.fn();
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>({select:()=>({like:(column:string,pattern:string)=>{likeSpy(column,pattern);return{limit:()=>summaryRows()}}})})})}));

// Fenster endet heute (Berlin) und die Kurzfassung ist frisch – nur dann gilt sie für die Übersicht.
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const today=berlinDay(new Date()),range={from:berlinDay(new Date(Date.now()-29*86_400_000)),to:today};
const m=(x:Partial<Metrics>):Metrics=>{const base={clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x};return{...base,firstSaleRate:base.sois?100*base.firstSales/base.sois:0}};
const path=(affiliateId:string,urlId:string,x:Partial<Metrics>):PathRow=>({...m(x),key:`8|${affiliateId}|0|${urlId}`,offerId:'8',offer:'Flirt DE',affiliateId,affiliate:`Partner ${affiliateId}`,campaignId:'0',campaign:'Direkt',offerUrlId:urlId,offerUrl:`LP ${urlId}`,trafficType:'Direkt'});
const portfolio=(paths:PathRow[]):Portfolio=>({range:{from:range.from,to:range.to,label:'30'},totals:m({}),offers:[],affiliates:[],paths,generatedAt:'2026-09-04T12:00:00Z'});
const access=parseAccessMetadata({role:'admin',status:'active',grants:[],denials:[],version:1,scopes:{}});
const summary=(affiliateId:string,youngByUrl:Record<string,number>,confidence:LeadYoungSummary['confidence']='hoch'):LeadYoungSummary=>({version:1,affiliateId,generatedAt:new Date(Date.now()-10*60_000).toISOString(),p75Hours:30,confidence,fallbackUsed:false,youngByUrl});
// Je Partner zwei direkte URLs (die Analyse überspringt Partner mit nur einer Variante): eine abschaltreife K1-URL und eine skalierende.
const current=()=>portfolio([path('376','1',{clicks:900,sois:60,profit:-100}),path('376','2',{clicks:900,sois:40,firstSales:5,profit:200}),path('412','4',{clicks:900,sois:70,profit:-50}),path('412','5',{clicks:900,sois:40,firstSales:5,profit:200}),path('500','9',{clicks:900,sois:80,profit:-10}),path('500','10',{clicks:900,sois:40,firstSales:5,profit:200})]);
beforeEach(()=>{vi.clearAllMocks();getDashboard.mockResolvedValue(current());loadConversions.mockResolvedValue([])});

describe('overview gating through persisted lead-maturity summaries (Rollups-Cron)',()=>{
 it('gates every partner with a summary without loading conversions; partners without summary stay ungated',async()=>{
  summaryRows.mockResolvedValue({data:[{value:summary('376',{'8|1':20})},{value:summary('412',{})},{value:{version:9}}],error:null});
  const{getAffiliateOptimizations}=await import('./affiliate-optimizer-service');
  const result=await getAffiliateOptimizations('30d',undefined,access);
  const rec=(affiliateId:string,url:string)=>result.find(a=>a.affiliateId===affiliateId)!.variants.find(v=>v.offerUrlId===url)!.recommendation as{action:string;gate?:{matureSois:number;totalSois:number;latencyConfidence:string}};
  expect(rec('376','1')).toMatchObject({action:'WEITER TESTEN',gate:{matureSois:40,totalSois:60,latencyConfidence:'hoch'}});
  expect(rec('412','4')).toMatchObject({action:'AUSSCHALTEN',gate:{matureSois:70,totalSois:70,latencyConfidence:'hoch'}});
  expect(rec('500','9')).toMatchObject({action:'AUSSCHALTEN',gate:{latencyConfidence:'nicht geprüft'}});
  expect(loadConversions).not.toHaveBeenCalled();
  expect(likeSpy).toHaveBeenCalledWith('key','lead\\_maturity:v1:%');
 });
 it('ignores a stale summary (older than two hours) and leaves the partner ungated',async()=>{
  summaryRows.mockResolvedValue({data:[{value:{...summary('376',{'8|1':20}),generatedAt:new Date(Date.now()-3*60*60_000).toISOString()}}],error:null});
  const{getAffiliateOptimizations}=await import('./affiliate-optimizer-service');
  const result=await getAffiliateOptimizations('30d',undefined,access);
  expect(result.find(a=>a.affiliateId==='376')!.variants.find(v=>v.offerUrlId==='1')!.recommendation).toMatchObject({action:'AUSSCHALTEN',gate:{latencyConfidence:'nicht geprüft'}});
 });
 it('falls back to ungated verdicts when the summaries cannot be read',async()=>{
  summaryRows.mockResolvedValue({data:null,error:{message:'boom'}});
  const{getAffiliateOptimizations}=await import('./affiliate-optimizer-service');
  const result=await getAffiliateOptimizations('30d',undefined,access);
  expect((result.find(a=>a.affiliateId==='376')!.variants.find(v=>v.offerUrlId==='1')!.recommendation as{gate?:{latencyConfidence:string}}).gate).toMatchObject({latencyConfidence:'nicht geprüft'});
 });
 it('prefers the fresh conversions index for the selected partner and the summary for the others',async()=>{
  summaryRows.mockResolvedValue({data:[{value:summary('376',{'8|1':20})},{value:summary('412',{'8|4':30})}],error:null});
  const now=new Date(),epoch=now.getTime()/1000;let seq=0;
  loadConversions.mockResolvedValue(Array.from({length:60},()=>({transaction_id:`t${++seq}`,event:'SOI',is_event:false,conversion_unix_timestamp:Math.floor(epoch-200*3600),traffic_mode:'tracked',source_id:'11000',sub1:'news',relationship:{affiliate:{network_affiliate_id:376},offer:{network_offer_id:8},offer_url:{network_offer_url_id:1},campaign:{network_campaign_id:0}}})));
  const{getAffiliateOptimizations}=await import('./affiliate-optimizer-service');
  const result=await getAffiliateOptimizations('30d',undefined,access,{leadMaturityFor:'376'});
  expect(loadConversions).toHaveBeenCalledTimes(1);expect(loadConversions).toHaveBeenCalledWith('376',90,expect.any(Date));
  expect(result.find(a=>a.affiliateId==='376')!.variants.find(v=>v.offerUrlId==='1')!.recommendation).toMatchObject({action:'AUSSCHALTEN',gate:{matureSois:60,totalSois:60}});
  expect(result.find(a=>a.affiliateId==='412')!.variants.find(v=>v.offerUrlId==='4')!.recommendation).toMatchObject({action:'WEITER TESTEN',gate:{matureSois:40,totalSois:70}});
 });
});

describe('summary applicability (window contains today, rollup at most two hours old)',()=>{
 it('leaves partners ungated for windows that end before today or for stale summaries',async()=>{
  const{summaryAppliesTo}=await import('./lead-maturity');
  const now=new Date('2026-09-04T13:00:00Z'),fresh={generatedAt:'2026-09-04T11:47:00.000Z'};
  expect(summaryAppliesTo(fresh,{from:'2026-08-06',to:'2026-09-04'},now)).toBe(true);
  expect(summaryAppliesTo(fresh,{from:'2026-08-01',to:'2026-08-31'},now)).toBe(false);
  expect(summaryAppliesTo({generatedAt:'2026-09-04T09:47:00.000Z'},{from:'2026-08-06',to:'2026-09-04'},now)).toBe(false);
  expect(summaryAppliesTo({generatedAt:'kaputt'},{from:'2026-08-06',to:'2026-09-04'},now)).toBe(false);
 });
 it('applies the summary only through the applicability rule inside gateAffiliates',async()=>{
  const{summaryAppliesTo}=await import('./lead-maturity');
  const service=(await import('node:fs')).readFileSync((await import('node:path')).join(process.cwd(),'src/lib/affiliate-optimizer-service.ts'),'utf8');
  expect(service).toContain('summary&&summaryAppliesTo(summary,range,now)?gateAffiliateAnalysis(a,resolverFromSummary(summary)):a');
  expect(typeof summaryAppliesTo).toBe('function');
 });
});
