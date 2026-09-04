import{beforeEach,describe,expect,it,vi}from'vitest';
import type{Metrics,PathRow,Portfolio,ReportRow}from'./portfolio';
import type{ConversionRow}from'./everflow';
import{parseAccessMetadata}from'./rbac';

vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
const getDashboard=vi.fn();
vi.mock('./dashboard-service',()=>({getDashboard:(...a:unknown[])=>getDashboard(...a)}));
const loadConversions=vi.fn(),loadRows=vi.fn(),loadIndex=vi.fn(),loadFreshness=vi.fn();
vi.mock('./cached-evaluations',()=>({loadAffiliateConversionsFromCache:(...a:unknown[])=>loadConversions(...a),loadAffiliateSourceRowsRangeFromCache:(...a:unknown[])=>loadRows(...a),loadAffiliateActivityIndex:(...a:unknown[])=>loadIndex(...a),loadSourceSnapshotFreshness:(...a:unknown[])=>loadFreshness(...a)}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>{throw new Error('nicht erwartet')}}));

const now=new Date(),epoch=now.getTime()/1000,range={from:'2026-08-06',to:'2026-09-04'};
const m=(x:Partial<Metrics>):Metrics=>{const base={clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x};return{...base,firstSaleRate:base.sois?100*base.firstSales/base.sois:0}};
const path=(affiliateId:string,urlId:string,x:Partial<Metrics>):PathRow=>({...m(x),key:`8|${affiliateId}|0|${urlId}`,offerId:'8',offer:'Flirt DE',affiliateId,affiliate:`Partner ${affiliateId}`,campaignId:'0',campaign:'Direkt',offerUrlId:urlId,offerUrl:`LP ${urlId}`,trafficType:'Direkt'});
const portfolio=(paths:PathRow[]):Portfolio=>({range:{from:range.from,to:range.to,label:'30'},totals:m({}),offers:[],affiliates:[],paths,generatedAt:'2026-09-04T12:00:00Z'});
let seq=0;
const soi=(ageHours:number,url:string,source='11000',sub='news'):ConversionRow=>({transaction_id:`t${++seq}`,event:'SOI',is_event:false,conversion_unix_timestamp:Math.floor(epoch-ageHours*3600),traffic_mode:'tracked',source_id:source,sub1:sub,relationship:{affiliate:{network_affiliate_id:376},offer:{network_offer_id:8},offer_url:{network_offer_url_id:Number(url)},campaign:{network_campaign_id:0}}} as ConversionRow);
const rRow=(source:string,sub:string,r:Partial<Record<'total_click'|'cv'|'first_sales'|'profit',number>>,url='2766'):ReportRow=>({columns:[{column_type:'date',id:'2026-09-01',label:'2026-09-01'},{column_type:'affiliate',id:'376',label:'Partner 376'},{column_type:'offer',id:'8',label:'Flirt DE'},{column_type:'campaign',id:'0',label:'N/A'},{column_type:'offer_url',id:url,label:`LP ${url}`},{column_type:'traffic_mode',id:'tracked',label:'tracked'},{column_type:'source_id',id:source,label:source},{column_type:'sub1',id:sub,label:sub}],reporting:{total_click:0,cv:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,...r}});
const access=parseAccessMetadata({role:'admin',status:'active',grants:[],denials:[],version:1,scopes:{}});
// Zwei Partner: 376 mit einer abschaltreifen URL 1 (K1) und einer skalierenden URL 2; 412 mit einer toten URL (K3) und einer K1-URL.
const current=()=>portfolio([path('376','1',{clicks:900,sois:60,profit:-100}),path('376','2',{clicks:900,sois:40,firstSales:5,profit:200}),path('412','3',{clicks:150,sois:0,profit:-20}),path('412','4',{clicks:900,sois:70,profit:-50})]);
beforeEach(()=>{vi.clearAllMocks();getDashboard.mockReset();loadConversions.mockResolvedValue([]);loadIndex.mockResolvedValue([]);loadFreshness.mockResolvedValue({complete:true,availableDays:365,expectedDays:365,minDate:'2025-09-05',maxDate:'2026-09-04',generatedAt:'2026-09-04T10:00:00Z'})});

describe('URL verdicts through the lead maturity gate (D3)',()=>{
 it('leaves every affiliate ungated (gate „nicht geprüft“) without leadMaturityFor and never loads conversions',async()=>{
  const{getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
  getDashboard.mockResolvedValue(current());
  const result=await getAffiliateOptimizationsWithTrend('custom',range,access,range);
  expect(loadConversions).not.toHaveBeenCalled();
  expect(result.find(a=>a.affiliateId==='376')?.variants.find(v=>v.offerUrlId==='1')?.recommendation).toMatchObject({action:'AUSSCHALTEN'});
  expect((result.find(a=>a.affiliateId==='376')?.variants.find(v=>v.offerUrlId==='1')?.recommendation as{gate?:{latencyConfidence:string}}).gate).toMatchObject({latencyConfidence:'nicht geprüft'});
 });
 it('gates only the selected affiliate: immature sois turn K1 into WEITER TESTEN with the gate, K3 and SKALIEREN stay',async()=>{
  const{getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
  getDashboard.mockResolvedValue(current());
  loadConversions.mockResolvedValue([...Array.from({length:20},()=>soi(200,'1')),...Array.from({length:40},()=>soi(5,'1')),...Array.from({length:40},()=>soi(200,'2'))]);
  const result=await getAffiliateOptimizationsWithTrend('custom',range,access,range,{leadMaturityFor:'376'});
  expect(loadConversions).toHaveBeenCalledTimes(1);expect(loadConversions).toHaveBeenCalledWith('376',90,expect.any(Date));
  const selected=result.find(a=>a.affiliateId==='376')!,url1=selected.variants.find(v=>v.offerUrlId==='1')!.recommendation as{action:string;reason:string;gate?:{matureSois:number;totalSois:number;maturityReached:boolean;latencyConfidence:string;p75Hours:number|null}};
  expect(url1.action).toBe('WEITER TESTEN');expect(url1.reason).toContain('20 von 60 SOIs reif (Wartezeit p75 ≈ 72 h)');
  expect(url1.gate).toMatchObject({matureSois:20,totalSois:60,maturityReached:false,latencyConfidence:'niedrig',p75Hours:72});
  expect(selected.variants.find(v=>v.offerUrlId==='2')!.recommendation).toMatchObject({action:'SKALIEREN',gate:{matureSois:40,totalSois:40}});
  expect(selected.summary).toBe('2 direkte Offer-/URL-Varianten · 0 Ausschaltkandidaten · 1 Skalierungskandidaten');
  expect(selected.variants.map(v=>v.offerUrlId)).toEqual(['2','1']);
  expect(selected.variants.every(v=>'trendVerdict'in v)).toBe(true);
  const other=result.find(a=>a.affiliateId==='412')!;
  expect(other.variants.map(v=>[v.offerUrlId,v.recommendation.action])).toEqual([['3','AUSSCHALTEN'],['4','AUSSCHALTEN']]);
  expect((other.variants[0].recommendation as{gate?:{latencyConfidence:string}}).gate).toMatchObject({latencyConfidence:'nicht geprüft'});
 });
 it('keeps a K1 kill once enough sois are mature and carries the url benchmark into the gate',async()=>{
  const{getAffiliateOptimizations}=await import('./affiliate-optimizer-service');
  getDashboard.mockResolvedValue(current());
  loadConversions.mockResolvedValue([...Array.from({length:60},()=>soi(200,'1')),...Array.from({length:40},()=>soi(200,'2'))]);
  const result=await getAffiliateOptimizations('custom',range,access,{leadMaturityFor:'376'});
  const url1=result.find(a=>a.affiliateId==='376')!.variants.find(v=>v.offerUrlId==='1')!.recommendation as{action:string;gate?:{maturityReached:boolean;benchmarkRate:number|null;confidence:string}};
  expect(url1.action).toBe('AUSSCHALTEN');expect(url1.gate).toMatchObject({maturityReached:true,benchmarkRate:0.125,confidence:'belastbar'});
 });
 it('fails closed when conversions cannot be loaded: would-be kills become BEOBACHTEN „Reife nicht prüfbar“ and nothing throws',async()=>{
  const{getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
  getDashboard.mockResolvedValue(current());
  loadConversions.mockRejectedValue(new Error('supabase down'));
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});
  const result=await getAffiliateOptimizationsWithTrend('custom',range,access,range,{leadMaturityFor:'376'});
  const url1=result.find(a=>a.affiliateId==='376')!.variants.find(v=>v.offerUrlId==='1')!.recommendation as{action:string;reason:string;gate?:{latencyConfidence:string}};
  expect(url1.action).toBe('BEOBACHTEN');expect(url1.reason).toContain('Reife nicht prüfbar – keine Conversion-Daten');expect(url1.gate).toMatchObject({latencyConfidence:'keine Daten'});
  expect(error).toHaveBeenCalled();error.mockRestore();
 });
 it('ignores leadMaturityFor for affiliates outside the result',async()=>{
  const{getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
  getDashboard.mockResolvedValue(current());
  await getAffiliateOptimizationsWithTrend('custom',range,access,range,{leadMaturityFor:'999'});
  expect(loadConversions).not.toHaveBeenCalled();
 });
});

describe('source rows carry the lead maturity of their leaf',()=>{
 it('attaches maturity from the conversions to every row so groupSources gates the leaves',async()=>{
  const{getAffiliateSourceBreakdown}=await import('./affiliate-optimizer-service');const{groupSources}=await import('./source-breakdown');
  loadRows.mockResolvedValue([rRow('11000','news',{total_click:600,cv:60,profit:-90}),rRow('11000','push',{total_click:600,cv:60,profit:-90})]);
  loadConversions.mockResolvedValue([...Array.from({length:10},()=>soi(200,'2766','11000','news')),...Array.from({length:50},()=>soi(5,'2766','11000','news')),...Array.from({length:60},()=>soi(200,'2766','11000','push'))]);
  const rows=await getAffiliateSourceBreakdown('376',range,access,now);
  expect(loadConversions).toHaveBeenCalledWith('376',90,expect.any(Date));
  expect(rows.find(x=>x.subSource==='news')?.maturity).toEqual({matureSois:10,totalSois:60,p75Hours:72,confidence:'niedrig'});
  expect(rows.find(x=>x.subSource==='push')?.maturity).toEqual({matureSois:60,totalSois:60,p75Hours:72,confidence:'niedrig'});
  const leaves=Object.fromEntries(groupSources(rows,'days30','sois')[0].leaves.map(x=>[x.subSource,x.assessment]));
  expect(leaves.news).toMatchObject({action:'BEOBACHTEN',gate:{matureSois:10,maturityReached:false}});
  expect(leaves.push).toMatchObject({action:'AUSSCHALTEN',gate:{matureSois:60,maturityReached:true}});
 });
 it('marks every row „keine Daten“ when the conversions fail to load (fail-closed) and still returns the rows',async()=>{
  const{getAffiliateSourceBreakdown}=await import('./affiliate-optimizer-service');
  loadRows.mockResolvedValue([rRow('11000','news',{total_click:600,cv:60,profit:-90})]);
  loadConversions.mockRejectedValue(new Error('supabase down'));
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});
  const rows=await getAffiliateSourceBreakdown('376',range,access,now);
  expect(rows).toHaveLength(1);expect(rows[0].maturity).toEqual({matureSois:0,totalSois:0,p75Hours:72,confidence:'keine Daten'});
  error.mockRestore();
 });
 it('exposes the maturity index for the selected partner with the usual scope checks',async()=>{
  const{getAffiliateLeadMaturity}=await import('./affiliate-optimizer-service');
  loadConversions.mockResolvedValue([soi(200,'2766')]);
  expect(await getAffiliateLeadMaturity('376',range,access)).toMatchObject({confidence:'niedrig',p75Hours:72,fallbackUsed:true,byUrl:{'8|2766':{matureSois:1,totalSois:1}}});
  const partner=parseAccessMetadata({role:'partner',status:'active',grants:[],denials:[],version:1,scopes:{affiliate:['412']}});
  await expect(getAffiliateLeadMaturity('376',range,partner)).rejects.toThrow('403');
  await expect(getAffiliateLeadMaturity('376',{from:'',to:''},access)).rejects.toThrow('Auswertungszeitraum fehlt');
 });
});

describe('gateAffiliateAnalysis',()=>{
 it('is pure and re-sorts by action order then profit',async()=>{
  const{gateAffiliateAnalysis}=await import('./affiliate-optimizer-service');const{analyzeAffiliateTraffic}=await import('./affiliate-optimizer');const{buildLeadMaturityIndex}=await import('./lead-maturity');
  const analysis=analyzeAffiliateTraffic(current()).find(a=>a.affiliateId==='376')!;
  const gated=gateAffiliateAnalysis(analysis,buildLeadMaturityIndex(Array.from({length:20},()=>soi(5,'1')),{p75Hours:null,confidence:'keine Daten'},range,now));
  expect(analysis.variants.find(v=>v.offerUrlId==='1')?.recommendation.action).toBe('AUSSCHALTEN');
  expect(gated.variants.map(v=>[v.offerUrlId,v.recommendation.action])).toEqual([['2','SKALIEREN'],['1','WEITER TESTEN']]);
  expect(gated.bestVariantKey).toBe('376|8|2');
 });
});
