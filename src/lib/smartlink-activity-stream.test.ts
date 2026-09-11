import {beforeEach,expect,it,vi} from 'vitest';
import type {ReportRow} from './portfolio';
const state=vi.hoisted(()=>({bulk:vi.fn(),visit:vi.fn(),stored:new Map<string,unknown>(),writes:[] as string[],generation:'g1',fail:false}));
vi.mock('server-only',()=>({}));
vi.mock('./cached-evaluations',async original=>({...await original<typeof import('./cached-evaluations')>(),loadAffiliateSourceRowsRangeFromCache:state.bulk,visitAffiliateSourceRowsRangeFromCache:state.visit}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>{
 let key='';const q={select:()=>q,gte:()=>q,lte:()=>q,order:()=>q,eq:(_field:string,value:string)=>{key=value;return q},maybeSingle:async()=>({data:state.stored.has(key)?{value:state.stored.get(key)}:null,error:null}),upsert:async(value:{key:string;value:unknown})=>{state.stored.set(value.key,value.value);state.writes.push(value.key);return{error:null}},then:(resolve:(x:unknown)=>unknown)=>resolve({data:['2026-09-09','2026-09-10'].map(date=>({value:{version:5,timezoneId:56,date,generation:state.generation}})),error:null})};return q;
}})}));
import {loadSmartlinkActivityEntries} from './cached-smartlinks';
const range={from:'2026-09-09',to:'2026-09-10'};
const row=(date:string,campaign='2',sois=1,source='s',mode='tracked'):ReportRow=>({columns:[['date',date],['campaign',campaign],['offer','17'],['offer_url','2751'],['source_id',source],['sub1','sub'],['traffic_mode',mode]].map(([column_type,id])=>({column_type,id,label:id})),reporting:{cv:sois}});
beforeEach(()=>{state.bulk.mockReset();state.visit.mockReset();state.stored.clear();state.writes=[];state.generation='g1';state.fail=false;state.bulk.mockResolvedValue([row(range.from),row(range.to),row(range.to,'66')]);state.visit.mockImplementation(async(_range:unknown,_affiliate:string,visit:(rows:ReportRow[])=>void)=>{visit([row(range.from),row(range.from,'2',0,'zero'),row(range.from,'2',1,'s','api')]);if(state.fail)throw Error('snapshot failed');visit([row(range.to),row(range.to,'66')]);});});
it('reduces each streamed batch to latest activity without retaining expanded annual rows or other campaigns',async()=>{
 const result=await loadSmartlinkActivityEntries('6',range,[2]);
 expect(state.bulk).not.toHaveBeenCalled();expect(state.visit).toHaveBeenCalledOnce();
 expect(result).toHaveLength(3);expect(result.every(entry=>entry.campaignId==='2')).toBe(true);
 expect(result.find(entry=>entry.fact.raw?.traffic_mode==='tracked'&&entry.fact.source_id==='s')?.lastLeadDate).toBe(range.to);
 expect(result.find(entry=>entry.fact.source_id==='zero')?.lastLeadDate).toBeNull();
 expect(result.find(entry=>entry.fact.raw?.traffic_mode==='api')?.lastLeadDate).toBe(range.from);
 expect(result.every(entry=>entry.fact.sois===0&&entry.fact.revenue===0)).toBe(true);
});
it('reuses a generation-matched memo only for the same canonical campaign set',async()=>{
 await loadSmartlinkActivityEntries('6',range,[2]);await loadSmartlinkActivityEntries('6',range,[2,2]);
 expect(state.visit).toHaveBeenCalledOnce();
 const other=await loadSmartlinkActivityEntries('6',range,[66]);
 expect(state.visit).toHaveBeenCalledTimes(2);expect(other).toHaveLength(1);expect(other[0].campaignId).toBe('66');
 state.generation='g2';await loadSmartlinkActivityEntries('6',range,[2]);expect(state.visit).toHaveBeenCalledTimes(3);
});
it('does not publish partially reduced activity when a later snapshot fails',async()=>{
 state.fail=true;
 await expect(loadSmartlinkActivityEntries('6',range,[2])).rejects.toThrow('snapshot failed');
 expect(state.writes).toEqual([]);
});
