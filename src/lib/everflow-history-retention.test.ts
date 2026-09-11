import {expect,it,vi} from 'vitest';
import {createEverflowHistorySource} from './everflow-history';
import {metricRows,runHistorySync,type ReportRow,type SyncStore} from './history-cache';

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const partition=['affiliate','offer','campaign'];
const dim=(column_type:string,id:string,label=id)=>({column_type,id,label});
const metric={total_click:10,cv:2,event:1,payout:6,revenue:15};
const identities=[['6','57','2'],['30','20','0']];
const identitiesRow=(ids:string[]):ReportRow=>({columns:ids.map((id,i)=>dim(partition[i],id,['Partner','Offer','Campaign'][i]+' '+id)),reporting:metric});
const fixture=(override?:(body:{columns:{column:string}[];query:{filters:{resource_type:string;filter_id_value:string}[]}})=>Response|undefined)=>vi.fn<typeof fetch>(async(_url,init)=>{
 const body=JSON.parse(String(init?.body));
 if(body.columns.length>10)return new Response(JSON.stringify({error:'Too many columns requested, limit is 10'}),{status:400});
 const changed=override?.(body);if(changed)return changed;
 if(body.columns.length<=4)return json({table:identities.map(ids=>{const row=identitiesRow(ids);return body.columns.some((c:{column:string})=>c.column==='event_name')?{...row,columns:[...row.columns,dim('event_name','sale','Sale')]}:row})});
 const ids=partition.map(type=>body.query.filters.find((filter:{resource_type:string})=>filter.resource_type===type)?.filter_id_value);
 expect(identities).toContainEqual(ids);
 return json({table:[{columns:body.columns.map(({column}:{column:string})=>dim(column,column==='event_name'?'sale':column==='offer_url'?'3052':column+'-value',column==='event_name'?'Sale':column+' label')),reporting:metric}]});
});

it('imports expired history under the ten-column limit with complete tracked/API identities, money and events',async()=>{
 const fetcher=fixture();
 const result=await createEverflowHistorySource('test-key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true});
 expect(result.base).toHaveLength(2);expect(result.events).toHaveLength(2);
 for(const row of [...result.base,...result.events]){
  expect(row.columns.find(d=>d.column_type==='date')?.label).toBe('2025-09-11');
  for(const type of ['affiliate','offer','campaign','offer_url','source_id','sub1','sub2','sub3','sub4','sub5','adv1','adv2'])expect(row.columns.some(d=>d.column_type===type)).toBe(true);
 }
 expect(result.base[1].columns.find(d=>d.column_type==='campaign')).toEqual(dim('campaign','0','Campaign 0'));
 const rows=metricRows(result.base,result.events);
 expect(rows.reduce((sum,row)=>sum+row.sois,0)).toBe(4);
 expect(rows.reduce((sum,row)=>sum+row.first_sales,0)).toBe(2);
 expect(rows.reduce((sum,row)=>sum+row.revenue,0)).toBe(30);
 expect(rows.reduce((sum,row)=>sum+row.payout,0)).toBe(12);
 expect(fetcher.mock.calls.every(([,init])=>JSON.parse(String(init?.body)).columns.length<=10)).toBe(true);
});

it('rejects truncated partition discovery without publishing partial report-only history',async()=>{
 const fetcher=fixture(body=>body.columns.length<=4?json({table:[identitiesRow(identities[0])],incomplete_results:true}):undefined);
 await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow('incomplete_results');
});

it('rejects a truncated detailed partition and a conflicting returned identity',async()=>{
 for(const mode of ['cap','identity']as const){
  const fetcher=fixture(body=>body.columns.length<=4?undefined:json({table:mode==='cap'?Array.from({length:10_000},()=>({columns:[],reporting:{}})):[{columns:[dim('affiliate','999')],reporting:metric}]}));
  await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow(mode==='cap'?'10,000-row cap':'partition identity');
 }
});

it('rejects a partition whose detailed totals do not reconcile to discovery',async()=>{
 const fetcher=fixture(body=>body.columns.length<=4?undefined:json({table:[{columns:[],reporting:{...metric,revenue:14}}]}));
 await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow('partition totals mismatch for 2025-09-11: revenue; diagnostics={"report":"base","affiliate":"6","offer":"57","campaign":"2","expected":15,"actual":14,"rows":1,"duplicates":0,"uniqueActual":14}');
});

it('advances expired history only after reconciled report rows have been written, without requesting expired conversions',async()=>{
 for(const valid of [false,true]){
  const state={phase:'backfill' as const,backfill_start:'2025-09-11',backfill_end:'2025-09-11',next_end:'2025-09-11',last_hot_at:'2026-09-11T02:00:00Z',last_success_at:'2026-09-11T02:00:00Z',snapshot_version:5};
  const store:SyncStore={getState:async()=>state,upsertConversions:vi.fn(async()=>{}),upsertMetrics:vi.fn(async()=>{}),setState:vi.fn(async()=>{})},loadConversions=vi.fn(async()=>[]);
  const fetcher=fixture(body=>!valid&&body.columns.length>4?json({table:[]}):undefined);
  const pending=runHistorySync({store,now:new Date('2026-09-11T03:00:00Z'),loadConversions,loadReports:createEverflowHistorySource('key',fetcher).loadReports});
  if(valid){await expect(pending).resolves.toMatchObject({backfillComplete:true,upsertedConversions:0,upsertedMetrics:2});expect(store.setState).toHaveBeenCalledWith(expect.objectContaining({phase:'rolling'}))}
  else{await expect(pending).rejects.toThrow('partition totals');expect(store.upsertMetrics).not.toHaveBeenCalled();expect(store.setState).not.toHaveBeenCalled()}
  expect(loadConversions).not.toHaveBeenCalled();
 }
});

it('accepts exact duplicate aggregate rows only after a matching second read and reconciled unique totals',async()=>{
 let confirmations=0;
 const fetcher=fixture(body=>{
  if(body.columns.length<=4)return undefined;
  confirmations++;
  const row={columns:body.columns.map(({column})=>dim(column,column==='event_name'?'sale':'value',column==='event_name'?'Sale':'value')),reporting:metric};
  return json({table:[row,row]});
 });
 const result=await createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true});
 expect(result.base).toHaveLength(2);expect(result.events).toHaveLength(2);expect(confirmations).toBe(8);
 expect(metricRows(result.base,result.events).reduce((sum,row)=>sum+row.revenue,0)).toBe(30);
});

it('rejects duplicate recovery when confirmation changes or unique rows still disagree',async()=>{
 for(const reason of ['changed','unreconciled']as const){
  const counts=new Map<string,number>();
  const fetcher=fixture(body=>{
   if(body.columns.length<=4)return undefined;
   const key=JSON.stringify(body);counts.set(key,(counts.get(key)||0)+1);
   const row={columns:body.columns.map(({column})=>dim(column,'value')),reporting:{...metric,revenue:reason==='unreconciled'?14:15}};
   return json({table:[row,{...row,reporting:reason==='changed'&&counts.get(key)!>1?{...metric,revenue:16}:row.reporting}]});
  });
  await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow(reason==='changed'?'duplicate confirmation changed':'partition totals');
 }
});
