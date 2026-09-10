import {describe,expect,it,vi} from 'vitest';
import {boundedUpsert} from './bounded-upsert';

const timeout={code:'57014',message:'canceling statement due to statement timeout'};
describe('bounded idempotent cache upserts',()=>{
 it('recovers from the production 500-row timeout without dropping or duplicating rows',async()=>{
  const rows=Array.from({length:1237},(_,id)=>({id})),stored:number[]=[],sizes:number[]=[];
  await boundedUpsert(rows,async batch=>{sizes.push(batch.length);if(batch.length>100)return{error:timeout};stored.push(...batch.map(row=>row.id));return{error:null}},'conversions upsert');
  expect(stored).toEqual(rows.map(row=>row.id));
  expect(sizes[0]).toBe(500);expect(sizes.slice(1).every(size=>size<=100)).toBe(true);
 });
 it('retains a completed prefix when a later batch times out',async()=>{
  const rows=Array.from({length:1023},(_,id)=>id),stored:number[]=[],starts:number[]=[];
  await boundedUpsert(rows,async batch=>{starts.push(batch[0]);if(batch[0]===500&&batch.length===500)return{error:timeout};stored.push(...batch);return{error:null}},'conversions upsert');
  expect(stored).toEqual(rows);expect(starts.slice(0,3)).toEqual([0,500,500]);
 });
 it('stops after the minimum batch also times out',async()=>{
  const write=vi.fn(async()=>({error:timeout}));
  await expect(boundedUpsert(Array.from({length:500},(_,i)=>i),write,'conversions upsert')).rejects.toThrow('Supabase conversions upsert: canceling statement due to statement timeout');
  expect(write.mock.calls.map(call=>(call as unknown as [number[]])[0].length)).toEqual([500,100,25]);
 });
 it.each([{code:'42501',message:'permission denied'},{code:'23505',message:'duplicate key'},{code:'57014',message:'canceling statement due to user request'},{code:'55P03',message:'lock timeout'}])('does not retry other failures ($code)',async error=>{
  const write=vi.fn(async()=>({error}));await expect(boundedUpsert([1,2],write,'conversions upsert')).rejects.toThrow(error.message);expect(write).toHaveBeenCalledOnce();
 });
 it('does not issue requests for an empty import',async()=>{const write=vi.fn();await boundedUpsert([],write,'conversions upsert');expect(write).not.toHaveBeenCalled()});
 it('does not repeat a timed-out batch that is already smaller than the floor',async()=>{const write=vi.fn(async()=>({error:timeout}));await expect(boundedUpsert([1,2],write,'conversions upsert')).rejects.toThrow('statement timeout');expect(write).toHaveBeenCalledOnce()});
});
