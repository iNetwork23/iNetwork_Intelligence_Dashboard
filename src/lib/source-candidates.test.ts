import{readFileSync}from'node:fs';
import{join}from'node:path';
import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import{parseAccessMetadata}from'./rbac';
import type{ConversionMetric,SourceBreakdownRow}from'./source-breakdown';
import type{ReportRow}from'./portfolio';

vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
const upsert=vi.fn<()=>Promise<{error:{message:string}|null}>>(async()=>({error:null})),maybeSingle=vi.fn<()=>Promise<{data:{value:unknown}|null;error:{message:string}|null}>>(async()=>({data:null,error:null})),eq=vi.fn(()=>({maybeSingle})),select=vi.fn(()=>({eq})),from=vi.fn(()=>({upsert,select}));
const release=vi.fn(async()=>{}),acquireHistorySyncLock=vi.fn(async()=>release);
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from}),acquireHistorySyncLock:()=>acquireHistorySyncLock()}));
const loadPortfolioFromCache=vi.fn(),refreshLongPortfolioRangeSnapshots=vi.fn();
vi.mock('./supabase-reporting',()=>({loadPortfolioFromCache:(...a:unknown[])=>loadPortfolioFromCache(...a),refreshLongPortfolioRangeSnapshots:(...a:unknown[])=>refreshLongPortfolioRangeSnapshots(...a),reportingRange:(period:string)=>period==='7d'?{from:'2026-08-29',to:'2026-09-04',label:'7'}:{from:'2026-08-06',to:'2026-09-04',label:'30'}}));
const loadRows=vi.fn(),loadIndex=vi.fn(),loadFreshness=vi.fn(),loadConversions=vi.fn();
vi.mock('./cached-evaluations',()=>({loadAffiliateSourceRowsRangeFromCache:(...a:unknown[])=>loadRows(...a),loadAffiliateActivityIndex:(...a:unknown[])=>loadIndex(...a),loadSourceSnapshotFreshness:(...a:unknown[])=>loadFreshness(...a),loadAffiliateConversionsFromCache:(...a:unknown[])=>loadConversions(...a)}));
import type{ConversionRow}from'./everflow';

const range={from:'2026-08-06',to:'2026-09-04'};
const metric=(x:Partial<ConversionMetric>):ConversionMetric=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitPerSoi:0,...x});
const activity={lastLeadDate:'2026-09-03',asOf:'2026-09-04',coverageComplete:true,lookbackDays:365};
const bRow=(x:{affiliateId?:string;offerId?:string;offerUrlId?:string;trafficMode?:'api'|'tracked';mainValue:string|null;subValue:string|null;metric:Partial<ConversionMetric>;lastLeadDate?:string|null}):SourceBreakdownRow=>{const affiliateId=x.affiliateId||'376',offerId=x.offerId||'8',offerUrlId=x.offerUrlId||'2766',m=metric(x.metric);return{pathKey:`${offerId}|${affiliateId}|0|${offerUrlId}`,offerId,affiliateId,offerUrlId,sourceId:x.mainValue===null?'Ohne Source-ID':x.mainValue,subSource:x.subValue===null?'Ohne Sub-Source':x.subValue,trafficMode:x.trafficMode||'tracked',mainValue:x.mainValue,subValue:x.subValue,today:m,days7:m,days30:m,activity:{...activity,lastLeadDate:x.lastLeadDate===undefined?activity.lastLeadDate:x.lastLeadDate}}};
const rRow=(affiliateId:string,source:string,sub:string,r:Partial<Record<'total_click'|'cv'|'first_sales'|'rebills'|'payout'|'revenue'|'profit',number>>,mode:'tracked'|'api'='tracked',offer='8',url='2766'):ReportRow=>({columns:[{column_type:'date',id:'2026-09-01',label:'2026-09-01'},{column_type:'affiliate',id:affiliateId,label:`Partner ${affiliateId}`},{column_type:'offer',id:offer,label:mode==='api'?'Flirt API':'Flirt DE'},{column_type:'campaign',id:'0',label:'N/A'},{column_type:'offer_url',id:url,label:`LP ${url}`},{column_type:'traffic_mode',id:mode,label:mode},{column_type:'source_id',id:source,label:source},{column_type:'sub1',id:sub,label:sub}],reporting:{total_click:0,cv:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,...r}});
let seq=0;
/** Direkter SOI des Partners; Alter in Stunden vor dem Testzeitpunkt, Blatt wie die Berichtszeilen (tracked: source_id/sub1, api: adv1/adv2). */
const soi=(affiliateId:string,ageHours:number,x:{mode?:'tracked'|'api';main?:string|null;sub?:string|null;offer?:string;url?:string;now?:Date}={}):ConversionRow=>{const epoch=(x.now||new Date()).getTime()/1000,mode=x.mode||'tracked';return{transaction_id:`t${++seq}`,event:'SOI',is_event:false,conversion_unix_timestamp:Math.floor(epoch-ageHours*3600),traffic_mode:mode,...(mode==='api'?{adv1:x.main??null,adv2:x.sub??null}:{source_id:x.main??'11000',sub1:x.sub??'N/A'}),relationship:{affiliate:{network_affiliate_id:Number(affiliateId)},offer:{network_offer_id:Number(x.offer??8)},offer_url:{network_offer_url_id:Number(x.url??2766)},campaign:{network_campaign_id:0}}} as ConversionRow};
const portfolio=(ids:string[])=>({range:{from:range.from,to:range.to,label:'30'},totals:{},offers:[],paths:[],generatedAt:'',affiliates:ids.map((id,i)=>({id,name:`Partner ${id}`,sois:100-i,clicks:1000,pathCount:1}))});
const access=(role:'admin'|'partner',scopes:Partial<Record<'affiliate'|'offer'|'source',string[]>>={})=>parseAccessMetadata({role,status:'active',grants:[],denials:[],version:1,scopes});
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

beforeEach(()=>{vi.clearAllMocks();loadConversions.mockResolvedValue([]);loadFreshness.mockResolvedValue({complete:true,availableDays:365,expectedDays:365,minDate:'2025-09-05',maxDate:'2026-09-04',generatedAt:'2026-09-04T10:00:00Z'});loadIndex.mockResolvedValue([]);maybeSingle.mockResolvedValue({data:null,error:null});upsert.mockResolvedValue({error:null})});
afterEach(()=>{vi.useRealTimers()});

describe('sourceCandidatesKey',()=>{it('uses the agreed sync_state namespace',async()=>{const{sourceCandidatesKey}=await import('./source-candidates');expect(sourceCandidatesKey(range)).toBe('source_candidates:v1:2026-08-06:2026-09-04')})});

describe('evaluateSourceCandidates',()=>{
 const labels={affiliate:'Partner 376',paths:new Map([['8|2766',{offer:'Flirt DE',offerUrl:'LP 2766'}]])};
 it('keeps only leaves with AUSSCHALTEN, SKALIEREN or negative BEOBACHTEN and mirrors the partner page leaf logic',async()=>{
  const{evaluateSourceCandidates}=await import('./source-candidates');
  const rows=[bRow({mainValue:'dead',subValue:null,metric:{clicks:150,sois:0}}),bRow({mainValue:'good',subValue:null,metric:{clicks:1000,sois:40,firstSales:5,profit:120.456,revenue:300.001,payout:179.545}}),bRow({mainValue:'young',subValue:null,metric:{clicks:20,sois:2,profit:5}}),bRow({mainValue:'negative',subValue:null,metric:{clicks:50,sois:3,profit:-4}})];
  const out=evaluateSourceCandidates(rows,labels);
  expect(out.map(x=>[x.mainValue,x.action,x.severity])).toEqual([['negative','BEOBACHTEN','warning'],['dead','AUSSCHALTEN','critical'],['good','SKALIEREN','positive']]);
  expect(out[2]).toMatchObject({affiliateId:'376',affiliate:'Partner 376',offerId:'8',offer:'Flirt DE',offerUrlId:'2766',offerUrl:'LP 2766',trafficMode:'tracked',level:'main_source',mainValue:'good',subValue:null,clicks:1000,sois:40,firstSales:5,rebills:0,profit:120.46,revenue:300,payout:179.55,lastLeadDate:'2026-09-03',leadStatus:'Kürzlich aktiv'});
  expect(Object.keys(out[0]).sort()).toEqual(['action','affiliate','affiliateId','clicks','firstSales','gate','lastLeadDate','leadStatus','level','mainValue','offer','offerId','offerUrl','offerUrlId','payout','profit','reason','rebills','revenue','severity','sois','subValue','trafficMode'].sort());
  expect(out[1].gate).toMatchObject({matureSois:0,totalSois:0,requiredSois:50,latencyConfidence:'nicht geprüft',confidence:'unsicher'});
 });
 it('evaluates sub-source leaves per source and keeps the source-less leaf identity',async()=>{
  const{evaluateSourceCandidates}=await import('./source-candidates');
  const rows=[bRow({mainValue:'11000',subValue:'news',metric:{clicks:200,sois:0}}),bRow({mainValue:'11000',subValue:null,metric:{clicks:400,sois:30,firstSales:4,profit:50}}),bRow({mainValue:null,subValue:null,metric:{clicks:120,sois:0}})];
  const out=evaluateSourceCandidates(rows,labels);
  expect(out.map(x=>[x.level,x.mainValue,x.subValue,x.action])).toEqual([['sub_source','11000','news','AUSSCHALTEN'],['main_source',null,null,'AUSSCHALTEN'],['sub_source','11000',null,'SKALIEREN']]);
 });
 it('uses the offer-URL benchmark like the source breakdown and includes API offers',async()=>{
  const{evaluateSourceCandidates}=await import('./source-candidates');
  const api=[bRow({trafficMode:'api',offerId:'9',offerUrlId:'0',mainValue:'adv-strong',subValue:null,metric:{sois:200,firstSales:60,profit:900}}),bRow({trafficMode:'api',offerId:'9',offerUrlId:'0',mainValue:'adv-weak',subValue:null,metric:{sois:80,firstSales:0,profit:-30}})];
  const out=evaluateSourceCandidates(api,{affiliate:'P',paths:new Map([['9|0',{offer:'Flirt API',offerUrl:'Default'}]])});
  expect(out.map(x=>[x.mainValue,x.action,x.trafficMode])).toEqual([['adv-weak','AUSSCHALTEN','api'],['adv-strong','SKALIEREN','api']]);
  const underperformer=[bRow({mainValue:'strong',subValue:null,metric:{clicks:1000,sois:200,firstSales:60,profit:900}}),bRow({mainValue:'weak',subValue:null,metric:{clicks:900,sois:80,firstSales:1,profit:-30}})];
  expect(evaluateSourceCandidates(underperformer,labels).find(x=>x.mainValue==='weak')).toMatchObject({action:'AUSSCHALTEN',reason:expect.stringContaining('halber Vergleichswert')});
  expect(evaluateSourceCandidates([underperformer[1]],labels)[0]).toMatchObject({action:'BEOBACHTEN',severity:'warning'});
 });
 it('reports an unknown lead status when the activity index has no coverage',async()=>{
  const{evaluateSourceCandidates}=await import('./source-candidates');
  const row={...bRow({mainValue:'dead',subValue:null,metric:{clicks:150,sois:0}}),activity:{lastLeadDate:null,asOf:'',coverageComplete:false,lookbackDays:0}};
  expect(evaluateSourceCandidates([row],labels)[0]).toMatchObject({lastLeadDate:null,leadStatus:null});
 });
});

describe('buildSourceCandidatesSnapshot',()=>{
 it('walks the portfolio affiliates with system access, evaluates each with the cached readers and skips failing affiliates',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376','412','999']));
  loadRows.mockImplementation(async(_range:unknown,affiliateId:string)=>{if(affiliateId==='999')throw new Error('snapshot missing');return affiliateId==='376'?[rRow('376','dead','N/A',{total_click:150}),rRow('376','fine','N/A',{total_click:50,cv:2,profit:3})]:[rRow('412','adv7','N/A',{cv:60,first_sales:0,profit:-12},'api','9','0')]});
  loadIndex.mockImplementation(async(affiliateId:string)=>affiliateId==='376'?[{identity:{pathKey:'8|376|0|2766',offerId:'8',affiliateId:'376',offerUrlId:'2766',sourceId:'dead',subSource:'Ohne Sub-Source',trafficMode:'tracked',mainValue:'dead',subValue:null},lastLeadDate:'2026-06-01'}]:[]);
  const now=new Date('2026-09-04T12:00:00Z');
  loadConversions.mockImplementation(async(affiliateId:string)=>affiliateId==='412'?Array.from({length:60},()=>soi('412',200,{mode:'api',main:'adv7',offer:'9',url:'0',now})):[]);
  const snapshot=await buildSourceCandidatesSnapshot(range,{now});
  expect(loadPortfolioFromCache).toHaveBeenCalledWith('custom',expect.anything(),expect.any(Date),range);
  expect(loadPortfolioFromCache.mock.calls[0]).toHaveLength(4);
  expect(loadRows).toHaveBeenCalledWith(range,'376');
  expect(loadIndex).toHaveBeenCalledWith('376',{from:'2025-09-05',to:'2026-09-04'});
  expect(loadConversions).toHaveBeenCalledWith('376',90,now);expect(loadConversions).toHaveBeenCalledWith('412',90,now);
  expect(snapshot).toMatchObject({version:1,range,affiliates:3,affiliatesProcessed:2,coverageComplete:false});
  expect(snapshot.rows.map(x=>[x.affiliateId,x.affiliate,x.offer,x.trafficMode,x.mainValue,x.action])).toEqual([['412','Partner 412','Flirt API','api','adv7','AUSSCHALTEN'],['376','Partner 376','Flirt DE','tracked','dead','AUSSCHALTEN']]);
  expect(snapshot.rows[0].gate).toMatchObject({matureSois:60,totalSois:60,requiredSois:50,maturityReached:true,p75Hours:72,latencyConfidence:'niedrig',confidence:'belastbar',benchmarkRate:null});
  expect(snapshot.rows[1]).toMatchObject({lastLeadDate:'2026-06-01',leadStatus:'Vermutlich inaktiv',offerUrl:'LP 2766',gate:{latencyConfidence:'keine Daten'}});
  expect(Date.parse(snapshot.generatedAt)).toBeGreaterThan(0);
 });
 it('marks coverage complete when every affiliate was evaluated',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));loadRows.mockResolvedValue([rRow('376','fine','N/A',{total_click:50,cv:2,profit:3})]);
  expect(await buildSourceCandidatesSnapshot(range)).toMatchObject({affiliates:1,affiliatesProcessed:1,coverageComplete:true,rows:[]});
 });
 it('stops pulling affiliates once the time budget is exhausted',async()=>{
  const{buildSourceCandidatesSnapshot,CANDIDATE_CONCURRENCY}=await import('./source-candidates');
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
  loadPortfolioFromCache.mockResolvedValue(portfolio(['1','2','3','4','5','6','7']));
  loadRows.mockImplementation(async()=>{await Promise.resolve();vi.setSystemTime(Date.now()+2_000);return[rRow('1','dead','N/A',{total_click:150})]});
  const snapshot=await buildSourceCandidatesSnapshot(range,{timeBudgetMs:1_000});
  expect(snapshot.affiliatesProcessed).toBe(CANDIDATE_CONCURRENCY);
  expect(snapshot).toMatchObject({affiliates:7,coverageComplete:false});
  expect(loadRows).toHaveBeenCalledTimes(CANDIDATE_CONCURRENCY);
  const empty=await buildSourceCandidatesSnapshot(range,{timeBudgetMs:0});
  expect(empty).toMatchObject({affiliates:7,affiliatesProcessed:0,coverageComplete:false,rows:[]});
 });
 it('defaults to a 150 second budget',async()=>{const{DEFAULT_CANDIDATE_TIME_BUDGET_MS}=await import('./source-candidates');expect(DEFAULT_CANDIDATE_TIME_BUDGET_MS).toBe(150_000)});
});

describe('lead maturity in the cron (Etappe 3, D3)',()=>{
 const now=new Date('2026-09-04T12:00:00Z');
 it('holds K1 kills back as BEOBACHTEN with the maturity reason while the sois are younger than the typical wait, and loads conversions in parallel with the rows',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));
  loadRows.mockResolvedValue([rRow('376','11000','news',{total_click:600,cv:60,profit:-90})]);
  const order:string[]=[];
  loadRows.mockImplementation(async()=>{order.push('rows:start');await new Promise(r=>setTimeout(r,5));order.push('rows:end');return[rRow('376','11000','news',{total_click:600,cv:60,profit:-90})]});
  loadConversions.mockImplementation(async()=>{order.push('conversions:start');return[...Array.from({length:12},()=>soi('376',200,{main:'11000',sub:'news',now})),...Array.from({length:48},()=>soi('376',3,{main:'11000',sub:'news',now}))]});
  const snapshot=await buildSourceCandidatesSnapshot(range,{now});
  expect(order.slice(0,2)).toEqual(['rows:start','conversions:start']);
  expect(snapshot.rows).toHaveLength(1);
  expect(snapshot.rows[0]).toMatchObject({mainValue:'11000',subValue:'news',level:'sub_source',action:'BEOBACHTEN',severity:'warning',gate:{matureSois:12,totalSois:60,maturityReached:false,p75Hours:72,latencyConfidence:'niedrig'}});
  expect(snapshot.rows[0].reason).toContain('12 von 60 SOIs reif (Wartezeit p75 ≈ 72 h)');
 });
 it('fails closed per affiliate when the conversions cannot be loaded: BEOBACHTEN „Reife nicht prüfbar“, affiliate still processed',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));
  loadRows.mockResolvedValue([rRow('376','11000','N/A',{total_click:600,cv:60,profit:-90}),rRow('376','dead','N/A',{total_click:150})]);
  loadConversions.mockRejectedValue(new Error('conversions down'));
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});
  const snapshot=await buildSourceCandidatesSnapshot(range,{now});
  expect(snapshot).toMatchObject({affiliatesProcessed:1,coverageComplete:true});
  expect(snapshot.rows.map(x=>[x.mainValue,x.action])).toEqual([['11000','BEOBACHTEN'],['dead','AUSSCHALTEN']]);
  expect(snapshot.rows[0].reason).toContain('Reife nicht prüfbar – keine Conversion-Daten');
  expect(snapshot.rows[0].gate).toMatchObject({latencyConfidence:'keine Daten',maturityReached:false});
  expect(snapshot.rows[1].gate).toMatchObject({latencyConfidence:'keine Daten'});
  expect(error).toHaveBeenCalledWith(expect.stringContaining('lead maturity unavailable for affiliate 376'),expect.any(Error));error.mockRestore();
 });
 it('accepts stored snapshots whose rows carry no gate and passes a stored gate through unchanged',async()=>{
  const{isValidSourceCandidatesSnapshot,loadSourceCandidates}=await import('./source-candidates');
  const row={affiliateId:'376',affiliate:'P',offerId:'8',offer:'O',offerUrlId:'2766',offerUrl:'LP',trafficMode:'tracked',level:'main_source',mainValue:'s1',subValue:null,action:'AUSSCHALTEN',severity:'critical',reason:'r',clicks:1,sois:0,firstSales:0,rebills:0,revenue:0,payout:0,profit:0,lastLeadDate:null,leadStatus:null};
  const gate={matureSois:50,totalSois:55,requiredSois:50,maturityReached:true,p75Hours:48,latencyConfidence:'hoch',rateLow:0,rateHigh:0.07,benchmarkRate:null,confidence:'belastbar'};
  const stored={version:1,range,generatedAt:'2026-09-04T10:00:00Z',affiliates:1,affiliatesProcessed:1,coverageComplete:true,rows:[row,{...row,mainValue:'s2',gate}]};
  expect(isValidSourceCandidatesSnapshot(stored,range)).toBe(true);
  maybeSingle.mockResolvedValue({data:{value:stored},error:null});
  const loaded=await loadSourceCandidates(range,access('admin'));
  expect(loaded?.rows[0]).not.toHaveProperty('gate');expect(loaded?.rows[1].gate).toEqual(gate);
 });
});

describe('cron options: conversions memo, persisted maturity summary, budget grace, maturity counter',()=>{
 it('loads conversions through options.conversionsFor and persists a young summary per affiliate only when asked',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  const now=new Date();loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));loadRows.mockResolvedValue([rRow('376','11000','news',{total_click:900,cv:60,profit:-90})]);
  const conversionsFor=vi.fn(async()=>[...Array.from({length:12},()=>soi('376',200,{main:'11000',sub:'news',now})),...Array.from({length:48},()=>soi('376',3,{main:'11000',sub:'news',now}))]);
  const snapshot=await buildSourceCandidatesSnapshot(range,{now,conversionsFor,persistMaturity:true});
  expect(conversionsFor).toHaveBeenCalledWith('376',now);expect(loadConversions).not.toHaveBeenCalled();
  expect(snapshot.rows[0]).toMatchObject({action:'BEOBACHTEN',gate:{matureSois:12,totalSois:60,maturityReached:false}});
  expect(upsert).toHaveBeenCalledWith({key:'lead_maturity:v1:376',value:expect.objectContaining({version:1,affiliateId:'376',confidence:'niedrig',youngByUrl:{'8|2766':48}})},{onConflict:'key'});
  upsert.mockClear();
  await buildSourceCandidatesSnapshot(range,{now,conversionsFor});
  expect(upsert).not.toHaveBeenCalled();
 });
 it('counts affiliates whose maturity could not be loaded and keeps them evaluated fail-closed',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));loadRows.mockResolvedValue([rRow('376','11000','news',{total_click:900,cv:60,profit:-90})]);
  const snapshot=await buildSourceCandidatesSnapshot(range,{conversionsFor:async()=>{throw new Error('conversions down')}});
  expect(snapshot).toMatchObject({affiliatesProcessed:1,coverageComplete:true,maturityUnavailable:1});
  expect(snapshot.rows[0]).toMatchObject({action:'BEOBACHTEN',gate:{latencyConfidence:'keine Daten'}});
  expect(upsert).not.toHaveBeenCalled();
 });
 it('gives up on an affiliate whose loads overrun the budget plus grace and reports incomplete coverage',async()=>{
  const{buildSourceCandidatesSnapshot}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));loadRows.mockImplementation(()=>new Promise(()=>{}));
  const snapshot=await buildSourceCandidatesSnapshot(range,{timeBudgetMs:20,loadGraceMs:1});
  expect(snapshot).toMatchObject({affiliates:1,affiliatesProcessed:0,coverageComplete:false,rows:[]});
 });
});
describe('capSourceCandidates',()=>{
 it('keeps at most the configured rows per action and flags truncation',async()=>{
  const{capSourceCandidates,CANDIDATE_ROW_LIMITS}=await import('./source-candidates');
  const make=(action:'AUSSCHALTEN'|'BEOBACHTEN'|'SKALIEREN',n:number)=>Array.from({length:n},(_,i)=>({action,profit:-i,affiliateId:'1',offerUrlId:String(i)}) as never);
  const capped=capSourceCandidates([...make('AUSSCHALTEN',CANDIDATE_ROW_LIMITS.AUSSCHALTEN+5),...make('SKALIEREN',3)]);
  expect(capped.truncated).toBe(true);expect(capped.rows.filter(row=>row.action==='AUSSCHALTEN')).toHaveLength(CANDIDATE_ROW_LIMITS.AUSSCHALTEN);expect(capped.rows.filter(row=>row.action==='SKALIEREN')).toHaveLength(3);
  expect(capSourceCandidates(make('BEOBACHTEN',2))).toEqual({rows:make('BEOBACHTEN',2),truncated:false});
 });
});
describe('publishSourceCandidates',()=>{
 it('upserts the snapshot under the range key',async()=>{
  const{publishSourceCandidates}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['376']));loadRows.mockResolvedValue([rRow('376','dead','N/A',{total_click:150})]);
  expect(await publishSourceCandidates(range)).toEqual({rows:1,coverageComplete:true});
  expect(from).toHaveBeenCalledWith('sync_state');
  expect(upsert).toHaveBeenCalledWith({key:'source_candidates:v1:2026-08-06:2026-09-04',value:expect.objectContaining({version:1,range,rows:[expect.objectContaining({mainValue:'dead'})]})},{onConflict:'key'});
 });
 it('surfaces write failures',async()=>{
  const{publishSourceCandidates}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio([]));upsert.mockResolvedValue({error:{message:'boom'}});
  await expect(publishSourceCandidates(range)).rejects.toThrow('Supabase source candidates: boom');
 });
 it('keeps a complete snapshot younger than 6 h instead of overwriting it with a budget-truncated one',async()=>{
  const{publishSourceCandidates,INCOMPLETE_OVERWRITE_AFTER_MS}=await import('./source-candidates');
  loadPortfolioFromCache.mockResolvedValue(portfolio(['1','2','3']));
  const fresh={version:1,range,generatedAt:new Date(Date.now()-60*60_000).toISOString(),affiliates:3,affiliatesProcessed:3,coverageComplete:true,rows:[{},{}]};
  maybeSingle.mockResolvedValue({data:{value:fresh},error:null});
  expect(await publishSourceCandidates(range,{timeBudgetMs:0})).toEqual({rows:2,coverageComplete:true,kept:true});
  expect(upsert).not.toHaveBeenCalled();
  maybeSingle.mockResolvedValue({data:{value:{...fresh,generatedAt:new Date(Date.now()-INCOMPLETE_OVERWRITE_AFTER_MS-60_000).toISOString()}},error:null});
  expect(await publishSourceCandidates(range,{timeBudgetMs:0})).toEqual({rows:0,coverageComplete:false});
  expect(upsert).toHaveBeenCalledTimes(1);
  maybeSingle.mockResolvedValue({data:{value:{...fresh,coverageComplete:false}},error:null});
  expect(await publishSourceCandidates(range,{timeBudgetMs:0})).toEqual({rows:0,coverageComplete:false});
  expect(upsert).toHaveBeenCalledTimes(2);
 });
});

describe('loadSourceCandidates',()=>{
 const stored=(rows:Array<Partial<Record<string,unknown>>>)=>({version:1,range,generatedAt:'2026-09-04T10:00:00Z',affiliates:2,affiliatesProcessed:2,coverageComplete:true,rows:rows.map(row=>({affiliateId:'376',affiliate:'P',offerId:'8',offer:'O',offerUrlId:'2766',offerUrl:'LP',trafficMode:'tracked',level:'main_source',mainValue:'s1',subValue:null,action:'AUSSCHALTEN',severity:'critical',reason:'r',clicks:1,sois:0,firstSales:0,rebills:0,revenue:0,payout:0,profit:0,lastLeadDate:null,leadStatus:null,...row}))});
 it('returns null when the key is missing or belongs to another range (fail-closed)',async()=>{
  const{loadSourceCandidates}=await import('./source-candidates');
  expect(await loadSourceCandidates(range,access('admin'))).toBeNull();
  expect(eq).toHaveBeenCalledWith('key','source_candidates:v1:2026-08-06:2026-09-04');
  maybeSingle.mockResolvedValue({data:{value:{...stored([]),range:{from:'2026-08-01',to:'2026-09-04'}}},error:null});
  expect(await loadSourceCandidates(range,access('admin'))).toBeNull();
  maybeSingle.mockResolvedValue({data:null,error:{message:'down'}});
  await expect(loadSourceCandidates(range,access('admin'))).rejects.toThrow('Supabase source candidates: down');
 });
 it('returns the full snapshot for internal roles and filters partner rows by scope',async()=>{
  const{loadSourceCandidates}=await import('./source-candidates');
  maybeSingle.mockResolvedValue({data:{value:stored([{affiliateId:'376',offerId:'8'},{affiliateId:'412',offerId:'8'},{affiliateId:'376',offerId:'9',mainValue:'s2'}])},error:null});
  expect((await loadSourceCandidates(range,access('admin')))?.rows).toHaveLength(3);
  expect((await loadSourceCandidates(range,access('partner',{affiliate:['376']})))?.rows.map(x=>[x.affiliateId,x.offerId])).toEqual([['376','8'],['376','9']]);
  expect((await loadSourceCandidates(range,access('partner',{affiliate:['376'],offer:['9']})))?.rows.map(x=>x.offerId)).toEqual(['9']);
  expect((await loadSourceCandidates(range,access('partner',{affiliate:['376'],source:['s1']})))?.rows.map(x=>x.mainValue)).toEqual(['s1']);
  const empty=await loadSourceCandidates(range,access('partner'));
  expect(empty).toMatchObject({version:1,coverageComplete:true,rows:[]});
  expect((await loadSourceCandidates(range,access('partner',{affiliate:['999']})))?.rows).toEqual([]);
 });
});

describe('rollups route hook',()=>{
 beforeEach(()=>{process.env.CRON_SECRET='secret';refreshLongPortfolioRangeSnapshots.mockResolvedValue([{key:'portfolio_range:x',rows:1}])});
 it('publishes both ranges after the portfolio rollups inside their own try/catch',()=>{
  const route=read('src/app/api/sync/rollups/route.ts');
  expect(route).toContain('maxDuration=240');
  expect(route).toContain("const CANDIDATE_PERIODS=['30d','7d']as const");
  expect(route).toContain('for(const[index,period]of CANDIDATE_PERIODS.entries())');
  expect(route).toContain('sourceCandidateBudgetMs(rangeStarted-started,CANDIDATE_PERIODS.length-index)');
  expect(route).toContain('console.info(`Source candidates ${period}:');
  expect(route).toMatch(/try\{const range=reportingRange\(period\);sourceCandidates\[period\]=await publishSourceCandidates\(/);
  expect(route).toContain('catch(error){console.error(`Source candidates ${period} failed`,error)');
  expect(route).toContain('sourceCandidates:await publishSourceCandidateRanges(started)');
  expect(route.indexOf('refreshLongPortfolioRangeSnapshots(getSupabaseAdmin())')).toBeLessThan(route.indexOf('publishSourceCandidateRanges(started)'));
  expect(route).toContain('Math.max(15_000,Math.floor(Math.max(0,CANDIDATE_TOTAL_BUDGET_MS-elapsedMs)/Math.max(1,rangesLeft)))');
  expect(route).toContain('CANDIDATE_TOTAL_BUDGET_MS=180_000');
  expect(route).toContain('conversionsFor,persistMaturity:index===0');
  expect(route).toContain("revalidateTag('lead-maturity',{expire:0})");
 });
 it('keeps the total runtime inside the route budget',async()=>{
  const{sourceCandidateBudgetMs}=await import('@/app/api/sync/rollups/route');
  expect(sourceCandidateBudgetMs(0)).toBe(180_000);expect(sourceCandidateBudgetMs(0,2)).toBe(90_000);expect(sourceCandidateBudgetMs(60_000,2)).toBe(60_000);expect(sourceCandidateBudgetMs(170_000)).toBe(15_000);expect(sourceCandidateBudgetMs(230_000,2)).toBe(15_000);
 });
 it('answers with per-range results and never fails the portfolio rollups because of the candidates',async()=>{
  const{GET}=await import('@/app/api/sync/rollups/route');const{NextRequest}=await import('next/server');
  loadPortfolioFromCache.mockImplementation(async(_p:unknown,_c:unknown,_n:unknown,custom:{from:string})=>{if(custom.from==='2026-08-29')throw new Error('7d portfolio missing');return portfolio(['376'])});
  loadRows.mockResolvedValue([rRow('376','dead','N/A',{total_click:150})]);
  const response=await GET(new NextRequest('http://localhost/api/sync/rollups',{headers:{authorization:'Bearer secret'}}));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({snapshots:[{key:'portfolio_range:x',rows:1}],sourceCandidates:{'7d':{error:'7d portfolio missing'},'30d':{rows:1,coverageComplete:true}}});
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({key:'source_candidates:v1:2026-08-06:2026-09-04'}),{onConflict:'key'});
  expect(acquireHistorySyncLock).toHaveBeenCalledTimes(1);expect(release).toHaveBeenCalledTimes(1);
  expect((await GET(new NextRequest('http://localhost/api/sync/rollups'))).status).toBe(401);
 });
});
