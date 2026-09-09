import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({batches:[] as string[][],rawReads:0,stored:new Map<string,unknown>()}));
vi.mock('server-only',()=>({}));
const dates=Array.from({length:128},(_,i)=>new Date(Date.UTC(2026,4,1+i)).toISOString().slice(0,10));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>{
 let keys:string[]|undefined;
 const query={select:()=>query,gte:()=>query,lte:()=>query,order:()=>query,eq:()=>query,abortSignal:()=>query,
  in:(_field:string,value:string[])=>{keys=value;return query},
  maybeSingle:async()=>({data:null,error:null}),upsert:async()=>({error:null}),
  then:async(resolve:(x:unknown)=>unknown)=>{
   if(!keys)return resolve({data:dates.map(date=>({value:{version:5,timezoneId:56,date,generation:`g-${date}`}})),error:null});
   if(keys.every(key=>key.startsWith('source_activity_day:'))){state.batches.push(keys);return resolve({data:keys.filter(key=>state.stored.has(key)).map(key=>({key,value:state.stored.get(key)})),error:null})}
   state.rawReads++;return resolve({data:[],error:null});
  }
 };return query;
}})}));
import {loadAffiliateActivityIndex} from './cached-evaluations';
beforeEach(()=>{state.batches=[];state.rawReads=0;state.stored.clear();for(const date of dates)state.stored.set(`source_activity_day:berlin-v5:${date}:6`,{version:1,date,affiliateId:'6',generation:`g-${date}`,entries:[['2','6','0','tracked','source','nested',date]]})});
it('reads 128 compact valid daily memos in two bounded requests without reopening raw history',async()=>{
 const result=await loadAffiliateActivityIndex('6',{from:dates[0],to:dates.at(-1)!});
 expect(result).toHaveLength(1);expect(result[0].lastLeadDate).toBe(dates.at(-1));expect(result[0].identity).toMatchObject({affiliateId:'6',mainValue:'source',subValue:'nested'});
 expect(state.batches.map(batch=>batch.length)).toEqual([64,64]);expect(state.rawReads).toBe(0);
});
it('reopens only the one missing day and does not turn absent raw rows into a fictitious lead',async()=>{
 state.stored.delete(`source_activity_day:berlin-v5:${dates.at(-1)}:6`);
 const result=await loadAffiliateActivityIndex('6',{from:dates[0],to:dates.at(-1)!});
 expect(result[0].lastLeadDate).toBe(dates.at(-2));expect(state.rawReads).toBe(1);expect(state.batches).toHaveLength(2);
});
