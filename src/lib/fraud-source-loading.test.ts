import {beforeEach,expect,it,vi} from 'vitest';
import type {SourceSnapshotRow} from './affiliate-source-cache';
import {getFraudDashboard} from './fraud-service';

const state=vi.hoisted(()=>({reads:[] as number[]}));
vi.mock('next/cache',()=>({unstable_cache:(fn:()=>unknown)=>fn}));
vi.mock('./fraud-backfill-service',()=>({loadFraudBackfillState:async()=>null}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
 let fields='',lower='';
 const chain={select:(value:string)=>{fields=value;return chain},gte:(_key:string,value:string)=>{lower=value;return chain},lte:()=>chain,lt:()=>chain,order:()=>chain,is:()=>chain,
  range:async(from:number,to:number)=>{state.reads.push(to-from+1);if(to-from+1>100)return{data:null,error:{message:'Snapshot response budget exceeded'}};return{data:Array.from({length:105},(_,index)=>({value:{affiliate_id:String(index%2+1),affiliate_name:'Partner',rows:[{o:'50',on:'Offer',c:'0',cn:'Direct',u:'5',un:'LP',s:'src',ss:'sub',m:'tracked',s1:'sub',cl:2,cv:1,fs:0,rb:0,cs:0,p:1,r:2,pr:1} satisfies SourceSnapshotRow]}})).slice(from,to+1),error:null}},
  then:(done:(value:unknown)=>unknown)=>Promise.resolve(done(table==='fraud_stop_requests'?{data:[],error:null}:fields==='key,value'&&lower.startsWith('source_day_generation:')?{data:[{value:{version:4,date:'2026-09-01',generation:'one'}},{value:{version:4,date:'2026-09-02',generation:'two'}}],error:null}:{data:[],error:null}))};return chain;
}})}));
beforeEach(()=>{state.reads=[]});
it('reads bounded snapshot pages and retains exact totals across chunks, days and affiliates',async()=>{
 const result=await getFraudDashboard({from:'2026-09-01',to:'2026-09-02'},{role:'super_admin',status:'active',version:1,grants:[],denials:[],scopes:{affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]}});
 expect(result.evaluations).toHaveLength(2);
 expect(result.evaluations.find(row=>row.affiliateId==='1')?.metrics).toEqual({clicks:212,sois:106,firstSales:0,rebills:0,coinEvents:0,payout:106,revenue:212,profit:106});
 expect(result.evaluations.find(row=>row.affiliateId==='2')?.metrics.sois).toBe(104);
 expect(result.coverage.sourceComplete).toBe(true);
 expect(result.coverage.cutoverReady).toBe(false);
 expect(result.stopCompliance).toEqual([]);
 expect(state.reads.every(size=>size<=100)).toBe(true);
 expect(result.writesPerformed).toBe(0);
});
