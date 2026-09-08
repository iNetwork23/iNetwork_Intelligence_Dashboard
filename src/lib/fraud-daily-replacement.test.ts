import {beforeEach,expect,it,vi} from 'vitest';
import {runFraudConversionSync} from './fraud-backfill-service';
import {initialFraudBackfillState,type FraudBackfillState} from './fraud-backfill';
import {berlinRangeUtcBounds} from './reporting-day';
import type {ConversionCacheRow,EverflowConversion} from './history-cache';

const fixture=vi.hoisted(()=>({checkpoint:null as FraudBackfillState|null,raw:[] as EverflowConversion[],rows:new Map<string,ConversionCacheRow>(),writes:[] as FraudBackfillState[],replacements:[] as {from:string;to:string;ids:string[]}[],reads:[] as {from:string;to:string}[],tags:[] as string[],failDay:'',corrupt:false,active:0,peak:0}));
vi.mock('next/cache',()=>({revalidateTag:(tag:string)=>{fixture.tags.push(tag)}}));
vi.mock('./everflow-history',()=>({createEverflowHistorySource:()=>({loadConversions:async()=>fixture.raw,loadReports:async()=>({base:[],events:[]})})}));
vi.mock('./supabase',()=>({
 getSupabaseAdmin:()=>({from:(table:string)=>{
  let from='',to='';
  const chain={select:()=>chain,eq:()=>chain,is:()=>chain,order:()=>chain,limit:()=>chain,
   gte:(_field:string,value:string)=>{from=value;return chain},lt:(_field:string,value:string)=>{to=value;return chain},
   maybeSingle:async()=>({data:table==='sync_state'?{value:fixture.checkpoint}:null,error:null}),
   upsert:async(record:{value:FraudBackfillState})=>{fixture.checkpoint=structuredClone(record.value);fixture.writes.push(structuredClone(record.value));return{error:null}},
   range:async(start:number,end:number)=>{fixture.reads.push({from,to});const rows=[...fixture.rows.values()].filter(row=>row.converted_at>=from&&row.converted_at<to).sort((a,b)=>a.converted_at.localeCompare(b.converted_at)||a.id.localeCompare(b.id));return{data:rows.slice(start,end+1),error:null}},
  };return chain;
 }}),
 createSupabaseSyncStore:()=>({getState:async()=>null,setState:async()=>{},upsertMetrics:async()=>{},replaceMetrics:async()=>{},
  upsertConversions:async(rows:ConversionCacheRow[])=>{for(const row of rows)fixture.rows.set(row.id,row)},
  replaceConversions:async(from:string,to:string,rows:ConversionCacheRow[])=>{
   fixture.replacements.push({from,to,ids:rows.map(row=>row.id)});fixture.active++;fixture.peak=Math.max(fixture.peak,fixture.active);
   try{
    if(from!==to)throw new Error('statement timeout on multi-day replacement');
    if(from===fixture.failDay)throw new Error('day replacement failed');
    await Promise.resolve();
    const bounds=berlinRangeUtcBounds(from,to);for(const [id,row] of fixture.rows)if(row.converted_at>=bounds.from&&row.converted_at<bounds.toExclusive)fixture.rows.delete(id);
    for(const row of rows)fixture.rows.set(row.id,row);
    if(fixture.corrupt&&fixture.replacements.length===3){const first=[...fixture.rows.values()].sort((a,b)=>a.converted_at.localeCompare(b.converted_at))[0];fixture.rows.delete(first.id);fixture.rows.set('wrong-identity',{...first,id:'wrong-identity'})}
   }finally{fixture.active--}
  },
 }),
}));

const now=new Date('2026-09-08T12:00Z');
const raw=(id:string,time:string):EverflowConversion=>({conversion_id:id,transaction_id:`lead-${id}`,conversion_unix_timestamp:Date.parse(time)/1000,is_event:false,event:'SOI',status:'approved',payout:1,revenue:2,source_id:'s',relationship:{affiliate:{network_affiliate_id:1},offer:{network_offer_id:2},campaign:{network_campaign_id:3},offer_url:{network_offer_url_id:4}}});
beforeEach(()=>{fixture.checkpoint=initialFraudBackfillState(now);fixture.raw=['12','13','14'].map(day=>raw(`may-${day}`,`2026-05-${day}T12:00Z`));fixture.rows.clear();fixture.writes=[];fixture.replacements=[];fixture.reads=[];fixture.tags=[];fixture.failDay='';fixture.corrupt=false;fixture.active=0;fixture.peak=0});

it('fits three sequential daily transactions while retaining one complete readback and cursor advance',async()=>{
 const result=await runFraudConversionSync(now);
 expect(fixture.replacements.map(({from,to})=>[from,to])).toEqual(['12','13','14'].map(day=>[`2026-05-${day}`,`2026-05-${day}`]));
 expect(fixture.peak).toBe(1);
 expect(fixture.reads).toEqual([{from:'2026-05-11T22:00:00.000Z',to:'2026-05-14T22:00:00.000Z'}]);
 expect(result).toMatchObject({parity:{verified:true}});expect(result.upsertedConversions).toBe(3);
 expect(fixture.writes).toHaveLength(2);expect(fixture.writes[0].parityVerifiedThrough).toBeNull();expect(fixture.writes[1].nextFrom).toBe('2026-05-15');
 expect(fixture.writes[1].parityVerifiedThrough).toBe('2026-05-14');
 expect(fixture.tags.filter(tag=>tag==='fraud-dashboard')).toHaveLength(2);
});

it.each(['2026-05-13','2026-05-14'])('keeps failed %s invalidated and repairs the same full window on retry',async failDay=>{
 fixture.failDay=failDay;
 await expect(runFraudConversionSync(now)).rejects.toThrow('day replacement failed');
 expect(fixture.reads).toHaveLength(0);expect(fixture.writes).toHaveLength(1);expect(fixture.checkpoint).toMatchObject({nextFrom:'2026-05-12',readyAt:null,parityVerifiedThrough:null,lastParity:null});
 expect(fixture.replacements.at(-1)?.from).toBe(failDay);
 expect(fixture.tags.filter(tag=>tag==='fraud-dashboard')).toHaveLength(2);
 fixture.failDay='';fixture.replacements=[];
 expect(await runFraudConversionSync(now)).toMatchObject({parity:{verified:true}});
 expect(fixture.replacements).toHaveLength(3);expect(fixture.checkpoint?.nextFrom).toBe('2026-05-15');
});

it('rejects matching counts with a wrong identity in an earlier replaced day',async()=>{
 fixture.corrupt=true;
 await expect(runFraudConversionSync(now)).rejects.toThrow('Parity');
 expect(fixture.reads).toHaveLength(1);expect(fixture.writes).toHaveLength(1);expect(fixture.checkpoint?.nextFrom).toBe('2026-05-12');expect(fixture.checkpoint?.parityVerifiedThrough).toBeNull();
 expect(fixture.tags.filter(tag=>tag==='fraud-dashboard')).toHaveLength(2);
});

it('atomically replaces an empty provider day so stale canonical rows are removed',async()=>{
 fixture.raw=fixture.raw.filter(row=>row.conversion_id!=='may-13');
 fixture.rows.set('stale',{id:'stale',type:'soi',converted_at:'2026-05-13T12:00:00.000Z'} as ConversionCacheRow);
 const result=await runFraudConversionSync(now);
 expect(fixture.replacements[1]).toEqual({from:'2026-05-13',to:'2026-05-13',ids:[]});expect(fixture.rows.has('stale')).toBe(false);expect(result).toMatchObject({parity:{verified:true}});
});

it.each([
 {from:'2026-03-28',to:'2026-03-30',boundary:'2026-03-29T22:00:00Z'},
 {from:'2026-10-24',to:'2026-10-26',boundary:'2026-10-25T23:00:00Z'},
])('partitions both sides of Berlin DST midnight for $from',async({from,to,boundary})=>{
 fixture.checkpoint={...initialFraudBackfillState(now),windowFrom:from,windowTo:to,nextFrom:from};
 fixture.raw=[raw('before',new Date(Date.parse(boundary)-1000).toISOString()),raw('after',boundary)];
 const result=await runFraudConversionSync(now);
 expect(fixture.replacements).toHaveLength(3);expect(fixture.replacements[0].ids).toEqual([]);expect(fixture.replacements[1].ids).toEqual(['before']);expect(fixture.replacements[2].ids).toEqual(['after']);expect(result).toMatchObject({parity:{verified:true}});expect(result.ready).toBe(true);
});
