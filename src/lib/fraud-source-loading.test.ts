import {beforeEach,expect,it,vi} from 'vitest';
import type {SourceSnapshotRow} from './affiliate-source-cache';
import {getFraudDashboard} from './fraud-service';

const state=vi.hoisted(()=>({reads:[] as number[],signals:[] as AbortSignal[],distinct:false}));
vi.mock('next/cache',()=>({unstable_cache:(fn:()=>unknown)=>fn}));
vi.mock('./fraud-backfill-service',()=>({loadFraudBackfillState:async()=>null}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
 let fields='',lower='';
 const chain={select:(value:string)=>{fields=value;return chain},gte:(_key:string,value:string)=>{lower=value;return chain},lte:()=>chain,lt:()=>chain,order:()=>chain,is:()=>chain,abortSignal:(signal:AbortSignal)=>{state.signals.push(signal);return chain},
  range:async(from:number,to:number)=>{state.reads.push(to-from+1);if(to-from+1>8)return{data:null,error:{message:'Snapshot response budget exceeded'}};return{data:Array.from({length:state.distinct?600:105},(_,index)=>({value:{affiliate_id:String(index%2+1),affiliate_name:'Partner',rows:[{o:'50',on:'Offer',c:'0',cn:'Direct',u:'5',un:'LP',s:state.distinct?`src-${String(index).padStart(4,'0')}`:'src',ss:'sub',m:'tracked',s1:'sub',cl:2,cv:1,fs:0,rb:0,cs:0,p:1,r:2,pr:1} satisfies SourceSnapshotRow]}})).slice(from,to+1),error:null}},
  then:(done:(value:unknown)=>unknown)=>Promise.resolve(done(table==='fraud_stop_requests'?{data:[],error:null}:fields==='key,value'&&lower.startsWith('source_day_generation:')?{data:[{value:{version:5,timezoneId:56,date:'2026-09-01',generation:'one'}},{value:{version:5,timezoneId:56,date:'2026-09-02',generation:'two'}}],error:null}:{data:[],error:null}))};return chain;
}})}));
beforeEach(()=>{state.reads=[];state.signals=[];state.distinct=false});
const access={role:'super_admin' as const,status:'active' as const,version:1,grants:[],denials:[],scopes:{affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]}};
it('reads bounded snapshot pages and retains exact totals across chunks, days and affiliates',async()=>{
 const result=await getFraudDashboard({from:'2026-09-01',to:'2026-09-02'},{role:'super_admin',status:'active',version:1,grants:[],denials:[],scopes:{affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]}});
 expect(result.evaluations).toHaveLength(2);
 expect(result.evaluations.find(row=>row.affiliateId==='1')?.metrics).toEqual({clicks:212,sois:106,firstSales:0,rebills:0,coinEvents:0,payout:106,revenue:212,profit:106});
 expect(result.evaluations.find(row=>row.affiliateId==='2')?.metrics.sois).toBe(104);
 expect(result.coverage.sourceComplete).toBe(true);
 expect(result.coverage.cutoverReady).toBe(false);
 expect(result.stopCompliance).toEqual([]);
 expect(state.reads.every(size=>size<=8)).toBe(true);
 expect(result.writesPerformed).toBe(0);
});

it('does not retain every evaluation in the dashboard payload and searches past the first 250 sources',async()=>{
 state.distinct=true;
 const range={from:'2026-09-01',to:'2026-09-02'};
 const result=await getFraudDashboard(range,access);
 expect(result.totals.sources).toBe(600);
 expect(result.evaluations).toHaveLength(250);
 expect(result.filteredSources).toBe(600);
 const filtered=await getFraudDashboard(range,access,{q:'src-0599'});
 expect(filtered.totals.sources).toBe(600);
 expect(filtered.evaluations).toHaveLength(1);
 expect(filtered.evaluations[0].metrics.sois).toBe(2);
 expect(filtered.evaluations[0].source).toBe('src-0599');
 expect(state.signals.length).toBeGreaterThanOrEqual(state.reads.length);
 expect(state.signals.every(signal=>signal instanceof AbortSignal)).toBe(true);
});
