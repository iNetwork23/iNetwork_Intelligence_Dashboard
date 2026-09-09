import {beforeEach, expect, it, vi} from 'vitest';
const state=vi.hoisted(()=>({stored:new Map<string,unknown>(),generations:['a','b','c'],reads:[] as string[],failure:'',removedLead:false,cacheFailure:false,missingDay:'',foreignDay:''}));
vi.mock('server-only',()=>({}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>{
 let exact='',keys:string[]|undefined;
 const query={select:()=>query,gte:()=>query,lte:()=>query,order:()=>query,abortSignal:()=>query,
  eq:(_field:string,value:string)=>{exact=value;return query},in:(_field:string,value:string[])=>{keys=value;return query},
  maybeSingle:async()=>({data:state.stored.has(exact)?{value:state.stored.get(exact)}:null,error:null}),
  upsert:async(input:{key:string;value:unknown}|Array<{key:string;value:unknown}>)=>{for(const row of Array.isArray(input)?input:[input])state.stored.set(row.key,structuredClone(row.value));return{error:null}},
  then:async(resolve:(x:unknown)=>unknown)=>{
   if(!keys)return resolve({data:state.generations.map((generation,i)=>({value:{version:5,timezoneId:56,date:`2026-08-0${i+1}`,generation}})),error:null});
   if(keys.every(key=>key.startsWith('source_activity_day:')))return resolve(state.cacheFailure?{data:null,error:{message:'cache read failed'}}:{data:keys.filter(key=>state.stored.has(key)).map(key=>({key,value:state.stored.get(key)})),error:null});
   const data=[];
   for(const key of keys){state.reads.push(key);if(state.failure&&key.includes(state.failure))return resolve({data:null,error:{message:'source read unavailable'}});
    const date=key.split(':')[1],day=Number(date.slice(-2));
    if(date===state.missingDay)continue;
    data.push({value:{date,affiliate_id:date===state.foreignDay?'6':'154',affiliate_name:'Partner',rows:[{o:'73',on:'Offer',c:'0',cn:'Direct',u:'0',un:'Default',s:'same-source',ss:null,m:'tracked',cl:2,cv:day===2&&state.removedLead?0:1,fs:0,rb:0,cs:0,p:0,r:0,pr:0}]}});
   }
   return resolve({data,error:null});
  }
 };return query;
}})}));
import {loadAffiliateActivityIndex} from './cached-evaluations';
const range={from:'2026-08-01',to:'2026-08-03'};
beforeEach(()=>{state.stored.clear();state.generations=['a','b','c'];state.reads=[];state.failure='';state.removedLead=false;state.cacheFailure=false;state.missingDay='';state.foreignDay=''});

it('loads only the changed immutable day after a refresh instead of repeating annual raw reads',async()=>{
 await loadAffiliateActivityIndex('154',range);expect(state.reads).toHaveLength(3);
 state.reads=[];state.generations[1]='b2';
 const result=await loadAffiliateActivityIndex('154',range);
 expect(state.reads).toEqual(['source_day:2026-08-02:b2:154']);
 expect(result).toHaveLength(1);expect(result[0].lastLeadDate).toBe('2026-08-03');
});
it('recomputes the maximum after a corrected day removes a lead and ignores days outside the current markers',async()=>{
 state.generations=['a','b'];await loadAffiliateActivityIndex('154',range);
 state.generations[1]='b2';state.removedLead=true;state.reads=[];
 const result=await loadAffiliateActivityIndex('154',range);
 expect(result[0].lastLeadDate).toBe('2026-08-01');expect(state.reads).toHaveLength(1);
 state.generations=['a'];state.reads=[];
 expect((await loadAffiliateActivityIndex('154',range))[0].lastLeadDate).toBe('2026-08-01');expect(state.reads).toEqual([]);
});
it('does not use a daily memo with a foreign affiliate or malformed entries',async()=>{
 await loadAffiliateActivityIndex('154',range);
 state.stored.delete('source_activity_memo:berlin-v5:154:2026-08-01:2026-08-03');
 state.stored.set('source_activity_day:berlin-v5:2026-08-02:154',{version:1,date:'2026-08-02',affiliateId:'6',generation:'b',entries:[['73','6','0','tracked','foreign',null,'2026-08-02']]});
 state.reads=[];const result=await loadAffiliateActivityIndex('154',range);
 expect(state.reads).toEqual(['source_day:2026-08-02:b:154']);expect(result.every(entry=>entry.identity.affiliateId==='154')).toBe(true);
});
it('rejects a failed changed day without publishing a replacement annual memo',async()=>{
 await loadAffiliateActivityIndex('154',range);const before=structuredClone(state.stored.get('source_activity_memo:berlin-v5:154:2026-08-01:2026-08-03'));
 state.generations[1]='b2';state.failure='2026-08-02';
 await expect(loadAffiliateActivityIndex('154',range)).rejects.toThrow('source read unavailable');
 expect(state.stored.get('source_activity_memo:berlin-v5:154:2026-08-01:2026-08-03')).toEqual(before);
});
it('rebuilds from raw data on cache failure and caches legitimately absent affiliate days',async()=>{
 state.cacheFailure=true;state.missingDay='2026-08-03';
 expect((await loadAffiliateActivityIndex('154',range))[0].lastLeadDate).toBe('2026-08-02');
 state.cacheFailure=false;state.reads=[];state.generations[0]='a2';
 expect((await loadAffiliateActivityIndex('154',range))[0].lastLeadDate).toBe('2026-08-02');
 expect(state.reads).toEqual(['source_day:2026-08-01:a2:154']);
});
it('rejects a foreign raw snapshot and never publishes its activity',async()=>{
 state.foreignDay='2026-08-02';
 await expect(loadAffiliateActivityIndex('154',range)).rejects.toThrow('invalid snapshot');
 expect(state.stored.has('source_activity_memo:berlin-v5:154:2026-08-01:2026-08-03')).toBe(false);
});
