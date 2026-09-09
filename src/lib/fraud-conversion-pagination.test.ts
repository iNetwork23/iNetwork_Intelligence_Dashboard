import {beforeEach,expect,it,vi} from 'vitest';
import {loadFraudConversionsFromCache} from './fraud-service';
import {fraudConversionFromCacheRecord} from './fraud-adapters';
type Row=Parameters<typeof fraudConversionFromCacheRecord>[0];
const state=vi.hoisted(()=>({rows:[] as Row[],queries:[] as Array<{from:string;to:string;cursor:string;limit:number;offset:number;fields:string;signal?:AbortSignal}>,maxPage:1000,error:'',stalled:false}));
vi.mock('next/cache',()=>({unstable_cache:(fn:()=>unknown)=>fn}));
vi.mock('./fraud-backfill-service',()=>({loadFraudBackfillState:async()=>null}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
 if(table!=='conversions')throw Error('Unexpected table');
 const query={from:'',to:'',cursor:'',limit:1000,offset:0,fields:'',signal:undefined as AbortSignal|undefined};
 const run=()=>{
  state.queries.push({...query});
  if(state.error)return{data:null,error:{message:state.error}};
  if(query.offset>=1000||query.limit>state.maxPage)return{data:null,error:{message:'canceling statement due to statement timeout'}};
  let rows=state.rows.filter(row=>row.converted_at>=query.from&&row.converted_at<query.to).sort((a,b)=>a.converted_at.localeCompare(b.converted_at)||a.id.localeCompare(b.id));
  if(query.cursor&&!state.stalled){const match=query.cursor.match(/^converted_at\.gt\.("(?:[^"\\]|\\.)*"),and\(converted_at\.eq\.("(?:[^"\\]|\\.)*"),id\.gt\.("(?:[^"\\]|\\.)*")\)$/);if(!match)throw Error('Malformed database cursor');const time=JSON.parse(match[1]),id=JSON.parse(match[3]);rows=rows.filter(row=>row.converted_at>time||(row.converted_at===time&&row.id>id));}
  if(state.stalled)rows=state.rows;
  return{data:rows.slice(query.offset,query.offset+query.limit),error:null};
 };
 const chain={select:(value:string)=>{query.fields=value;return chain},gte:(_field:string,value:string)=>{query.from=value;return chain},lt:(_field:string,value:string)=>{query.to=value;return chain},order:()=>chain,or:(value:string)=>{query.cursor=value;return chain},limit:(value:number)=>{query.limit=value;return chain},abortSignal:(value:AbortSignal)=>{query.signal=value;return chain},range:async(from:number,to:number)=>{query.offset=from;query.limit=to-from+1;return run()},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(run()).then(resolve)};
 return chain;
}})}));
const row=(id:string,at='2026-09-01T12:00:00.123456+00:00'):Row=>({id,type:'soi',converted_at:at,click_at:null,affiliate_id:'6',affiliate_name:'Partner',offer_id:'8',offer_name:'Offer',campaign_id:'0',campaign_name:'Direct',offer_url_id:'0',offer_url_name:'Default',traffic_mode:'tracked_direct',source_id:'src',sub_source:'sub',source_dimension:'source_id',sub_source_dimension:'sub1',lead_id:`lead-${id}`,status:'approved',is_scrub:false,error_code:null,payout:1,revenue:2});
beforeEach(()=>{state.rows=[];state.queries=[];state.maxPage=1000;state.error='';state.stalled=false});
it('returns every identity across a large timestamp tie without scanning growing offsets or dropping unapproved events',async()=>{
 const special='z,"\\cursor';state.rows=[...Array.from({length:999},(_,i)=>row(`event-${String(i).padStart(4,'0')}`)),{...row(special),status:'rejected',is_scrub:true,error_code:'invalid'},{...row('zz-tail','2026-09-01T12:00:00.123457+00:00'),type:'rebill'}];
 const result=await loadFraudConversionsFromCache('2026-09-01','2026-09-01');
 expect(result.map(item=>item.id)).toEqual(state.rows.map(item=>item.id));expect(result[999]).toMatchObject({status:'rejected',isScrub:true,errorCode:'invalid'});expect(result[1000].type).toBe('rebill');
 expect(state.queries.every(query=>query.offset===0&&query.signal instanceof AbortSignal&&!query.fields.split(',').includes('raw'))).toBe(true);
 expect(state.queries[1].cursor).toContain('2026-09-01T12:00:00.123456+00:00');expect(state.queries[1].cursor).toContain(JSON.stringify(special));
});
it('retries the same unread page with smaller limits and preserves Berlin day boundaries',async()=>{
 state.maxPage=250;state.rows=[row('before','2026-08-31T21:59:59.999Z'),...Array.from({length:1001},(_,i)=>row(`event-${String(i).padStart(4,'0')}`)),row('after','2026-09-01T22:00:00.000Z')];
 const result=await loadFraudConversionsFromCache('2026-09-01','2026-09-01');expect(result).toHaveLength(1001);expect(new Set(result.map(item=>item.id)).size).toBe(1001);
 expect(state.queries.slice(0,3).map(query=>query.limit)).toEqual([1000,500,250]);expect(state.queries[0].from).toBe('2026-08-31T22:00:00.000Z');expect(state.queries.every(query=>query.to==='2026-09-01T22:00:00.000Z')).toBe(true);
});
it('rejects a repeated cursor instead of publishing duplicate or partial data',async()=>{
 state.stalled=true;state.rows=Array.from({length:1000},(_,i)=>row(String(i).padStart(4,'0')));
 await expect(loadFraudConversionsFromCache('2026-09-01','2026-09-01')).rejects.toThrow(/cursor/);
});
it('does not retry non-timeout failures or conceal them as an empty window',async()=>{
 state.error='permission denied';await expect(loadFraudConversionsFromCache('2026-09-01','2026-09-01')).rejects.toThrow('permission denied');expect(state.queries).toHaveLength(1);
});
it('returns an empty valid window without requesting another page',async()=>{
  expect(await loadFraudConversionsFromCache('2026-09-01','2026-09-01')).toEqual([]);expect(state.queries).toHaveLength(1);
});
it('continues past empty days and covers the 25-hour Berlin day exactly once',async()=>{
 state.rows=[row('start','2026-10-24T22:00:00.000Z'),row('extra-hour','2026-10-25T22:30:00.000Z'),row('next-day','2026-10-25T23:00:00.000Z'),row('outside','2026-10-26T23:00:00.000Z')];
 expect((await loadFraudConversionsFromCache('2026-10-24','2026-10-26')).map(item=>item.id)).toEqual(['start','extra-hour','next-day']);
 expect(state.queries.map(query=>[query.from,query.to])).toEqual([
  ['2026-10-23T22:00:00.000Z','2026-10-24T22:00:00.000Z'],
  ['2026-10-24T22:00:00.000Z','2026-10-25T23:00:00.000Z'],
  ['2026-10-25T23:00:00.000Z','2026-10-26T23:00:00.000Z'],
 ]);
});
