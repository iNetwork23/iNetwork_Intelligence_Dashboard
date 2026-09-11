import {expect,it,vi} from 'vitest';
import {createEverflowHistorySource} from './everflow-history';
import {metricRows,runHistorySync,type ReportRow,type SyncStore} from './history-cache';

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const partition=['affiliate','offer','campaign'];
const isDiscovery=(body:{columns:{column:string}[]})=>body.columns.some(({column})=>column==='affiliate');
const dim=(column_type:string,id:string,label=id)=>({column_type,id,label});
const metric={total_click:10,cv:2,event:1,payout:6,revenue:15};
const identities=[['6','57','2'],['30','20','0']];
const identitiesRow=(ids:string[]):ReportRow=>({columns:ids.map((id,i)=>dim(partition[i],id,['Partner','Offer','Campaign'][i]+' '+id)),reporting:metric});
const fixture=(override?:(body:{columns:{column:string}[];query:{filters:{resource_type:string;filter_id_value:string}[]}})=>Response|undefined)=>vi.fn<typeof fetch>(async(_url,init)=>{
 const body=JSON.parse(String(init?.body));
 if(body.columns.length>10)return new Response(JSON.stringify({error:'Too many columns requested, limit is 10'}),{status:400});
 const changed=override?.(body);if(changed)return changed;
 if(isDiscovery(body))return json({table:identities.map(ids=>{const row=identitiesRow(ids);if(body.columns.some((c:{column:string})=>c.column==='offer_url'))row.columns.push(dim('offer_url','3052','LP'));return body.columns.some((c:{column:string})=>c.column==='event_name')?{...row,columns:[...row.columns,dim('event_name','sale','Sale')]}:row})});
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
 const fetcher=fixture(body=>isDiscovery(body)?json({table:[identitiesRow(identities[0])],incomplete_results:true}):undefined);
 await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow('incomplete_results');
});

it('rejects a truncated detailed partition and a conflicting returned identity',async()=>{
 for(const mode of ['cap','identity']as const){
  const fetcher=fixture(body=>isDiscovery(body)?undefined:json({table:mode==='cap'?Array.from({length:10_000},()=>({columns:[],reporting:{}})):[{columns:[dim('affiliate','999')],reporting:metric}]}));
  await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow(mode==='cap'?'10,000-row cap':'partition identity');
 }
});

it('rejects a partition whose detailed totals do not reconcile to discovery',async()=>{
 const fetcher=fixture(body=>isDiscovery(body)?undefined:json({table:[{columns:[],reporting:{...metric,revenue:14}}]}));
 await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow('partition totals mismatch for 2025-09-11: revenue; diagnostics={"report":"base","affiliate":"6","offer":"57","campaign":"2","expected":15,"actual":14,"rows":1,"duplicates":0,"uniqueActual":14}');
});

it('advances expired history only after reconciled report rows have been written, without requesting expired conversions',async()=>{
 for(const valid of [false,true]){
  const state={phase:'backfill' as const,backfill_start:'2025-09-11',backfill_end:'2025-09-11',next_end:'2025-09-11',last_hot_at:'2026-09-11T02:00:00Z',last_success_at:'2026-09-11T02:00:00Z',snapshot_version:5};
  const store:SyncStore={getState:async()=>state,upsertConversions:vi.fn(async()=>{}),upsertMetrics:vi.fn(async()=>{}),setState:vi.fn(async()=>{})},loadConversions=vi.fn(async()=>[]);
  const fetcher=fixture(body=>!valid&&!isDiscovery(body)?json({table:[]}):undefined);
  const pending=runHistorySync({store,now:new Date('2026-09-11T03:00:00Z'),loadConversions,loadReports:createEverflowHistorySource('key',fetcher).loadReports});
  if(valid){await expect(pending).resolves.toMatchObject({backfillComplete:true,upsertedConversions:0,upsertedMetrics:2});expect(store.setState).toHaveBeenCalledWith(expect.objectContaining({phase:'rolling'}))}
  else{await expect(pending).rejects.toThrow('partition totals');expect(store.upsertMetrics).not.toHaveBeenCalled();expect(store.setState).not.toHaveBeenCalled()}
  expect(loadConversions).not.toHaveBeenCalled();
 }
});

it('accepts exact duplicate aggregate rows only after a matching second read and reconciled unique totals',async()=>{
 let confirmations=0;
 const fetcher=fixture(body=>{
  if(isDiscovery(body))return undefined;
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
   if(isDiscovery(body))return undefined;
   const key=JSON.stringify(body);counts.set(key,(counts.get(key)||0)+1);
   const row={columns:body.columns.map(({column})=>dim(column,'value')),reporting:{...metric,revenue:reason==='unreconciled'?14:15}};
   return json({table:[row,{...row,reporting:reason==='changed'&&counts.get(key)!>1?{...metric,revenue:16}:row.reporting}]});
  });
  await expect(createEverflowHistorySource('key',fetcher).loadReports('2025-09-11','2025-09-11',{includeEvents:true})).rejects.toThrow(reason==='changed'?'duplicate confirmation changed':'partition totals');
 }
});

it('compares detailed source totals with the same granular reporting backend instead of the simple entity counters',async()=>{
 const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
  const body=JSON.parse(String(init?.body)),names=body.columns.map((c:{column:string})=>c.column),discovery=names.includes('affiliate');
  const columns=discovery?[...identitiesRow(identities[0]).columns,...(names.includes('offer_url')?[dim('offer_url','3052','LP')]:[]),...(names.includes('event_name')?[dim('event_name','sale','Sale')]:[])]:names.map((name:string)=>dim(name,name==='event_name'?'sale':'value',name==='event_name'?'Sale':'value'));
  // Provider diagnosis: identical closed day and identity, simple counter3908
  // versus granular source counter3909. Offer URL selects granular reporting.
  return json({table:[{columns,reporting:{...metric,total_click:discovery&&!names.includes('offer_url')?3908:3909}}]});
 });
 const result=await createEverflowHistorySource('key',fetcher).loadReports('2025-09-09','2025-09-09',{includeEvents:true});
 expect(result.base[0].reporting.total_click).toBe(3909);
 expect(fetcher.mock.calls.every(([,init])=>JSON.parse(String(init?.body)).columns.some((c:{column:string})=>c.column==='offer_url'))).toBe(true);
});

it('reconciles multiple discovered landingpages within one affiliate/offer/campaign partition',async()=>{
 const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
  const body=JSON.parse(String(init?.body)),names=body.columns.map((c:{column:string})=>c.column),discovery=isDiscovery(body);
  return json({table:['3052','3053'].map(lp=>({columns:[...(discovery?identitiesRow(identities[0]).columns:[]),dim('offer_url',lp,'LP '+lp),...(names.includes('event_name')?[dim('event_name','sale','Sale')]:[])],reporting:metric}))});
 });
 const result=await createEverflowHistorySource('key',fetcher).loadReports('2025-09-09','2025-09-09',{includeEvents:true});
 expect(result.base.map(row=>row.columns.find(c=>c.column_type==='offer_url')?.id)).toEqual(['3052','3053']);
 expect(metricRows(result.base,result.events).reduce((sum,row)=>sum+row.revenue,0)).toBe(30);
 expect(fetcher).toHaveBeenCalledTimes(4);
});
