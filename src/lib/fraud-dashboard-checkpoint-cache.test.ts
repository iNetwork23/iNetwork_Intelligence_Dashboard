import {beforeEach,expect,it,vi} from 'vitest';
import {getFraudDashboard} from './fraud-service';
import {initialFraudBackfillState,invalidateFraudBackfillState,type FraudBackfillState} from './fraud-backfill';

const fixture=vi.hoisted(()=>({checkpoint:null as FraudBackfillState|null,cache:new Map<string,Promise<unknown>>(),reads:0,readError:false,duringDataRead:null as (()=>void)|null}));
vi.mock('next/cache',()=>({unstable_cache:(fn:()=>Promise<unknown>,key:string[])=>async()=>{const id=JSON.stringify(key);if(!fixture.cache.has(id))fixture.cache.set(id,fn());return fixture.cache.get(id)}}));
vi.mock('./fraud-backfill-service',()=>({loadFraudBackfillState:async()=>{fixture.reads++;if(fixture.readError)throw new Error('checkpoint unavailable');return structuredClone(fixture.checkpoint)}}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>{
 const chain={select:()=>chain,gte:()=>chain,lte:()=>chain,lt:()=>chain,order:()=>chain,is:()=>chain,abortSignal:()=>chain,
 range:async()=>({data:[],error:null}),then:(done:(value:unknown)=>unknown)=>{const change=fixture.duringDataRead;fixture.duringDataRead=null;change?.();return Promise.resolve(done({data:[],error:null}))}};return chain;
}})}));
const access={role:'super_admin' as const,status:'active' as const,version:1,grants:[],denials:[],scopes:{affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]}},range={from:'2026-09-07',to:'2026-09-08'};
beforeEach(()=>{fixture.cache.clear();fixture.reads=0;fixture.readError=false;fixture.duringDataRead=null;fixture.checkpoint={...initialFraudBackfillState(new Date('2026-09-08T12:00Z')),phase:'rolling',coveredFrom:'2026-05-12',coveredThrough:'2026-09-08',parityVerifiedThrough:'2026-09-08',readyAt:'2026-09-08T11:00Z',lastSuccessAt:'2026-09-08T11:00Z'}});

it('does not serve a warm ready dashboard after a partial import invalidates its checkpoint',async()=>{
 expect((await getFraudDashboard(range,access)).coverage.cutoverReady).toBe(true);
 expect((await getFraudDashboard(range,access)).coverage.cutoverReady).toBe(true);
 expect(fixture.cache.size).toBe(1);
 fixture.checkpoint=invalidateFraudBackfillState(fixture.checkpoint!);
 const invalidated=await getFraudDashboard(range,access);
 expect(invalidated.coverage.cutoverReady).toBe(false);expect(invalidated.coverage.conversionJoin).toBeNull();expect(invalidated.stopCompliance).toEqual([]);expect(fixture.reads).toBe(6);expect(fixture.cache.size).toBe(2);
});

it('fails closed on an unavailable fresh checkpoint even with a warm ready dashboard',async()=>{
 expect((await getFraudDashboard(range,access)).coverage.cutoverReady).toBe(true);
 fixture.readError=true;
 await expect(getFraudDashboard(range,access)).rejects.toThrow('checkpoint unavailable');
});

it('uses a new dashboard generation after a successfully reverified import',async()=>{
 await getFraudDashboard(range,access);
 fixture.checkpoint={...fixture.checkpoint!,lastSuccessAt:'2026-09-08T12:00Z'};
 expect((await getFraudDashboard(range,access)).coverage.cutoverReady).toBe(true);expect(fixture.cache.size).toBe(2);
});

it('rejects a checkpoint invalidated while an already-started dashboard is loading',async()=>{
 fixture.duringDataRead=()=>{fixture.checkpoint=invalidateFraudBackfillState(fixture.checkpoint!)};
 await expect(getFraudDashboard(range,access)).rejects.toThrow('während');
});

it('rejects an unavailable final checkpoint instead of returning a completed ready calculation',async()=>{
 fixture.duringDataRead=()=>{fixture.readError=true};
 await expect(getFraudDashboard(range,access)).rejects.toThrow('checkpoint unavailable');
});
