import {describe,expect,it} from 'vitest';
import {advanceSyncState,canonicalMetricRows,conversionReportBody,conversionToCacheRow,initialSyncState,loadDailyReportSlices,metricRows,refreshConversionRange,refreshHistoryRange,resolveManualSourceRange,runHistorySync,selectSyncWindow,staleMetricIds,type EverflowConversion,type ReportRow,type SyncStore} from './history-cache';

describe('history cache sync windows',()=>{
  const now=new Date('2026-07-22T12:00:00Z');
  it('starts a resumable 365-day backfill with a maximum seven-day chunk',()=>{
    const state=initialSyncState(now);
    expect(state).toEqual({phase:'backfill',backfill_start:'2025-07-23',next_end:'2026-07-22',last_success_at:null});
    expect(selectSyncWindow(state,now)).toEqual({mode:'backfill',from:'2026-07-16',to:'2026-07-22'});
  });
  it('moves backwards and switches to a two-day hot window after the final chunk',()=>{
    const state={phase:'backfill' as const,backfill_start:'2025-07-23',next_end:'2025-07-25',last_success_at:null};
    const window=selectSyncWindow(state,now);
    expect(window).toEqual({mode:'backfill',from:'2025-07-23',to:'2025-07-25'});
    const next=advanceSyncState(state,window,now);
    expect(next.phase).toBe('rolling');
    expect(selectSyncWindow(next,now)).toEqual({mode:'rolling',from:'2026-07-21',to:'2026-07-22'});
  });
  it('uses the Berlin calendar day around UTC midnight',()=>{
    const berlinAfterMidnight=new Date('2026-07-24T22:30:00Z');
    const state=initialSyncState(berlinAfterMidnight);
    expect(state.next_end).toBe('2026-07-25');
    expect(selectSyncWindow({...state,phase:'rolling'},berlinAfterMidnight)).toEqual({mode:'rolling',from:'2026-07-24',to:'2026-07-25'});
  });
  it('loads daily report slices with bounded concurrency while preserving date order',async()=>{let active=0,peak=0;const rows=await loadDailyReportSlices('2026-07-20','2026-07-24',async day=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,day.endsWith('20')?8:1));active--;return[day]},10_000,2);expect(peak).toBe(2);expect(rows).toEqual(['2026-07-20','2026-07-21','2026-07-22','2026-07-23','2026-07-24'])});
});

describe('Everflow conversion mapping',()=>{
  it('limits a historical conversion backfill to the requested affiliate',()=>{expect(conversionReportBody('2026-01-01','2026-01-07','30').query.filters).toEqual([{resource_type:'affiliate',filter_id_value:'30'}])});
  const base:EverflowConversion={conversion_id:'cv-1',transaction_id:'lead-1',click_unix_timestamp:1784743080,conversion_unix_timestamp:1784743200,is_event:false,event:'SOI',status:'approved',payout:3,revenue:0,source_id:'src',sub1:'sub',sub2:'child',sub3:'leaf',adv1:'publisher',adv2:'placement',country:'DE',relationship:{affiliate:{network_affiliate_id:6,name:'Partner'},offer:{network_offer_id:57,name:'Singles69'},offer_url:{network_offer_url_id:2774,name:'LP'}}};
  it('preserves tracked identity while failing closed on contradictory source signals',()=>{
    expect(conversionToCacheRow(base)).toMatchObject({id:'cv-1',type:'soi',source_id:null,sub_source:null,source_dimension:'unknown',sub_source_dimension:'unknown',traffic_mode:'unknown',click_at:'2026-07-22T17:58:00.000Z',affiliate_id:'6',offer_id:'57',offer_url_id:'2774',status:'approved',payout:3,revenue:0,raw:{transaction_id:'lead-1',event:'SOI',is_event:false,traffic_mode:'unknown',relationship:{offer:{network_offer_id:57},offer_url:{network_offer_url_id:2774}}}});
    expect(conversionToCacheRow(base)?.lead_id).toMatch(/^unjoinable-sha256:/);
    expect(conversionToCacheRow(base)?.raw).not.toHaveProperty('conversion_id');
    expect(conversionToCacheRow(base)?.raw).not.toHaveProperty('adv2');
  });
  it('keeps the deepest tracked sub dimension when no API signal conflicts',()=>{
    const tracked={...base,adv1:undefined,adv2:undefined};
    expect(conversionToCacheRow(tracked)).toMatchObject({traffic_mode:'tracked_direct',source_id:'src',sub_source:'leaf',source_dimension:'source_id',sub_source_dimension:'sub3'});
  });
  it('maps Coin Spend, Sale and Rebill events and excludes unrelated events',()=>{
    expect(conversionToCacheRow({...base,conversion_id:'coin',is_event:true,event:'Coin Spend'})?.type).toBe('coin_spend');
    expect(conversionToCacheRow({...base,conversion_id:'sale',is_event:true,event:'Sale'})?.type).toBe('first_sale');
    expect(conversionToCacheRow({...base,conversion_id:'rebill',is_event:true,event:'Rebill'})?.type).toBe('rebill');
    expect(conversionToCacheRow({...base,conversion_id:'other',is_event:true,event:'Other'})).toBeNull();
  });
  it('maps API ADV1 and ADV2 into the canonical conversion source fields',()=>{
    const api={...base,click_unix_timestamp:undefined,source_id:'',sub1:'',adv1:'publisher-a',adv2:'placement-b',relationship:{...base.relationship,offer:{network_offer_id:20,name:'XLOVES API'}}};
    expect(conversionToCacheRow(api)).toMatchObject({source_id:'publisher-a',sub_source:'placement-b',raw:{traffic_mode:'api',adv1:'publisher-a',adv2:'placement-b'}});
  });
  it('derives API customer identity from canonical clickless mode even when the offer name has no API label',()=>{
    const api={...base,click_unix_timestamp:undefined,source_id:'',sub1:'',adv1:'publisher',adv2:'placement',adv4:'customer-42',relationship:{...base.relationship,offer:{network_offer_id:999,name:'Neutral offer name'}}};
    const mapped=conversionToCacheRow(api);expect(mapped).toMatchObject({traffic_mode:'clickless_api',raw:{traffic_mode:'api'}});expect(mapped?.lead_id).toMatch(/^api-customer-sha256:/);expect(mapped?.lead_id).not.toContain('customer-42');
  });
  it('uses a unique non-empty unjoinable identity for clickless events without a verified customer key',()=>{
    const api={...base,click_unix_timestamp:undefined,source_id:'',sub1:'',adv1:'publisher',adv2:'placement',adv4:undefined,email:undefined,relationship:{...base.relationship,offer:{network_offer_id:999,name:'Neutral offer name'}}};
    const first=conversionToCacheRow(api),second=conversionToCacheRow({...api,conversion_id:'cv-2'});expect(first?.lead_id).toMatch(/^unjoinable-sha256:/);expect(first?.lead_id).not.toBe('');expect(second?.lead_id).not.toBe(first?.lead_id);
  });
  it('uses one irreversible customer identity for API Sale and Rebill rows with the same ADV4 customer id',()=>{const sale={...base,click_unix_timestamp:undefined,conversion_id:'api-sale',transaction_id:'event-sale',is_event:true,event:'Sale',adv4:' Customer-4711 ',relationship:{...base.relationship,offer:{network_offer_id:20,name:'XLOVES - API'}}}as EverflowConversion,rebill={...sale,conversion_id:'api-rebill',transaction_id:'event-rebill',event:'Rebill'};const saleRow=conversionToCacheRow(sale),rebillRow=conversionToCacheRow(rebill);expect(saleRow?.lead_id).toMatch(/^api-customer-sha256:/);expect(rebillRow?.lead_id).toBe(saleRow?.lead_id);expect(JSON.stringify(saleRow?.raw)).not.toContain('Customer-4711')});
  it('normalizes API customer identities case-insensitively like the historical migration',()=>{const api={...base,click_unix_timestamp:undefined,source_id:'',sub1:'',adv1:'publisher',adv2:'placement',adv4:' Customer-4711 ',relationship:{...base.relationship,offer:{network_offer_id:20,name:'XLOVES API'}}};expect(conversionToCacheRow(api)?.lead_id).toBe(conversionToCacheRow({...api,conversion_id:'cv-2',adv4:'customer-4711'})?.lead_id)});
});

describe('daily metric mapping',()=>{
  const columns=[
    {column_type:'date',id:'1784692800',label:'1784692800'},
    {column_type:'affiliate',id:'6',label:'Partner'},
    {column_type:'offer',id:'57',label:'Offer'},
    {column_type:'campaign',id:'2',label:'Campaign'},
    {column_type:'offer_url',id:'2774',label:'LP'},
    {column_type:'source_id',id:'src',label:'src'},
    {column_type:'sub1',id:'sub',label:'sub'},
  ];
  it('merges base and event reports into one deduplicated daily fact',()=>{
    const base:ReportRow={columns,reporting:{total_click:100,cv:10,payout:30,revenue:80,profit:50}};
    const sale:ReportRow={columns:[...columns,{column_type:'event_name',id:'1',label:'Sale'}],reporting:{event:2}};
    const rebill:ReportRow={columns:[...columns,{column_type:'event_name',id:'2',label:'Rebill'}],reporting:{event:3}};
    const [row]=metricRows([base],[sale,rebill]);
    expect(row).toMatchObject({metric_date:'2026-07-22',affiliate_id:'6',offer_id:'57',campaign_id:'2',offer_url_id:'2774',source_id:'src',sub_source:'sub',clicks:100,sois:10,first_sales:2,rebills:3,payout:30,revenue:80,profit:50});
    expect(row.raw).toMatchObject({traffic_mode:'tracked',adv1:'',adv2:''});
    expect(row.id).toMatch(/^metric:/);
  });
  it('uses the same deepest tracked sub dimension for report metrics and conversion cohorts',()=>{
    const deep=[...columns,{column_type:'sub3',id:'leaf',label:'leaf'}],base:ReportRow={columns:deep,reporting:{total_click:20,cv:2,payout:6}},sale:ReportRow={columns:[...deep,{column_type:'event_name',id:'1',label:'Sale'}],reporting:{event:1}};
    const [row]=metricRows([base],[sale]);
    expect(row).toMatchObject({source_id:'src',sub_source:'leaf',first_sales:1,raw:{source_dimension:'source_id',sub_source_dimension:'sub3'}});
  });
  it('preserves event-only API groups as zero-traffic facts instead of dropping monetization',()=>{
    const apiColumns=[...columns.map(column=>column.column_type==='offer'?{...column,id:'20',label:'XLOVES API'}:column.column_type==='campaign'||column.column_type==='offer_url'?{...column,id:'0'}:column).filter(column=>!['source_id','sub1'].includes(column.column_type)),{column_type:'adv1',id:'publisher-a',label:'publisher-a'},{column_type:'adv2',id:'placement-b',label:'placement-b'}];
    const coin:ReportRow={columns:[...apiColumns,{column_type:'event_name',id:'3',label:'Coin Spend'}],reporting:{event:4}};
    const [row]=metricRows([],[coin]);
    expect(row).toMatchObject({clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:4,payout:0,revenue:0,raw:{traffic_mode:'api',adv1:'publisher-a',adv2:'placement-b'}});
    const sale:ReportRow={columns:apiColumns.map(column=>column).concat({column_type:'event_name',id:'4',label:'Sale'}),reporting:{event:2,payout:2,revenue:10}};
    const rebill:ReportRow={columns:apiColumns.map(column=>column).concat({column_type:'event_name',id:'5',label:'Rebill'}),reporting:{event:3,payout:3,revenue:12}};
    const forward=metricRows([],[coin,sale,rebill])[0],reverse=metricRows([],[rebill,sale,coin])[0];
    expect(forward).toMatchObject({coin_spend:4,first_sales:2,rebills:3,payout:5,revenue:22,profit:17});
    expect(reverse).toMatchObject({coin_spend:4,first_sales:2,rebills:3,payout:5,revenue:22,profit:17});
  });
  it('normalizes empty and N/A dimension sentinels when joining base and event rows',()=>{
    const base:ReportRow={columns:columns.filter(column=>column.column_type!=='sub1'),reporting:{cv:2,payout:6}};
    const event:ReportRow={columns:[...columns.map(column=>column.column_type==='sub1'?{...column,id:'N/A',label:'N/A'}:column),{column_type:'event_name',id:'1',label:'Sale'}],reporting:{event:1}};
    expect(metricRows([base],[event])).toHaveLength(1);
    expect(metricRows([base],[event])[0]).toMatchObject({sois:2,first_sales:1});
  });
  it('keeps delimiter-bearing source tuples collision-free at the real metric grouping boundary',()=>{
    const first=columns.map(column=>column.column_type==='source_id'?{...column,id:'A|B',label:'A|B'}:column.column_type==='sub1'?{...column,id:'C',label:'C'}:column),second=columns.map(column=>column.column_type==='source_id'?{...column,id:'A',label:'A'}:column.column_type==='sub1'?{...column,id:'B|C',label:'B|C'}:column);
    const rows=metricRows([{columns:first,reporting:{cv:1}},{columns:second,reporting:{cv:1}}],[]);
    expect(rows).toHaveLength(2);expect(rows.map(row=>[row.source_id,row.sub_source])).toEqual([['A|B','C'],['A','B|C']]);
  });
  it('preserves ADV1 and ADV2 as distinct API source dimensions',()=>{
    const apiColumns=[
      {column_type:'date',id:'1784692800',label:'1784692800'},
      {column_type:'affiliate',id:'30',label:'API Partner'},
      {column_type:'offer',id:'20',label:'XLOVES API'},
      {column_type:'campaign',id:'0',label:'Direct'},
      {column_type:'offer_url',id:'0',label:'API'},
      {column_type:'adv1',id:'publisher-a',label:'publisher-a'},
      {column_type:'adv2',id:'placement-b',label:'placement-b'},
    ];
    const [row]=metricRows([{columns:apiColumns,reporting:{cv:12,payout:36,revenue:90,profit:54}}],[]);
    expect(row).toMatchObject({raw:{traffic_mode:'api',adv1:'publisher-a',adv2:'placement-b'},source_id:'',sub_source:'',sois:12,profit:54});
    expect(row.id).toContain('publisher-a');
    expect(row.id).toContain('placement-b');
  });
  it('keeps ADV rows granular for source snapshots but aggregates canonical portfolio totals into the legacy id',()=>{
    const columns=[{column_type:'date',id:'1784692800',label:'1784692800'},{column_type:'affiliate',id:'30',label:'API Partner'},{column_type:'offer',id:'20',label:'XLOVES API'},{column_type:'campaign',id:'0',label:'Direct'},{column_type:'offer_url',id:'0',label:'API'},{column_type:'adv1',id:'N/A',label:'N/A'}];
    const granular=metricRows([{columns:[...columns,{column_type:'adv2',id:'placement-a',label:'placement-a'}],reporting:{cv:4,payout:12,revenue:30,profit:18}},{columns:[...columns,{column_type:'adv2',id:'placement-b',label:'placement-b'}],reporting:{cv:6,payout:18,revenue:45,profit:27}}],[]),canonical=canonicalMetricRows(granular);
    expect(granular).toHaveLength(2);expect(canonical).toHaveLength(1);expect(canonical[0]).toMatchObject({sois:10,payout:30,revenue:75,profit:45,raw:{}});expect(canonical[0].id).not.toContain('placement');
  });
  it('identifies canonical ids that disappeared so replacement can tombstone them without deleting the range',()=>{
    const current=[{id:'kept'}]as Parameters<typeof staleMetricIds>[1];expect(staleMetricIds(['kept','removed'],current)).toEqual(['removed']);expect(staleMetricIds(['removed'],[])).toEqual(['removed']);
  });
});

describe('sync orchestration',()=>{
  it('refreshes and deduplicates conversion-only history without touching daily metrics',async()=>{
    const calls:string[]=[];
    const conversion:EverflowConversion={conversion_id:'coin',transaction_id:'lead',conversion_unix_timestamp:1784743200,is_event:true,event:'Coin Spend'};
    const store:SyncStore={getState:async()=>null,upsertConversions:async rows=>{calls.push(`conversions:${rows.length}:${rows[0]?.type}`)},upsertMetrics:async()=>{calls.push('metrics')},replaceMetrics:async()=>{calls.push('replace')},setState:async()=>{}};
    const result=await refreshConversionRange({store,from:'2026-06-01',to:'2026-07-30',loadConversions:async()=>[conversion,conversion]});
    expect(calls).toEqual(['conversions:1:coin_spend']);
    expect(result).toMatchObject({from:'2026-06-01',to:'2026-07-30',upsertedConversions:1});
    expect(result.identityDigest).toMatch(/^[a-f0-9]{64}$/);
    const changed=await refreshConversionRange({store,from:'2026-06-01',to:'2026-07-30',loadConversions:async()=>[{...conversion,conversion_id:'different-event'}]});
    expect(changed.identityDigest).not.toBe(result.identityDigest);
  });

  it('atomically replaces the conversion window when the store supports authoritative repair',async()=>{
    const calls:string[]=[];
    const conversion:EverflowConversion={conversion_id:'fresh',transaction_id:'lead',conversion_unix_timestamp:1784743200,is_event:false,event:'SOI'};
    const store:SyncStore={getState:async()=>null,upsertConversions:async()=>{calls.push('upsert')},replaceConversions:async(from,to,rows)=>{calls.push(`replace:${from}:${to}:${rows[0]?.id}`)},upsertMetrics:async()=>{},setState:async()=>{}};
    await refreshConversionRange({store,from:'2026-07-01',to:'2026-07-07',loadConversions:async()=>[conversion]});
    expect(calls).toEqual(['replace:2026-07-01:2026-07-07:fresh']);
  });

  it('accepts only bounded non-future manual Source ranges',()=>{const now=new Date('2026-07-27T08:30:00Z');expect(resolveManualSourceRange(new URLSearchParams('from=2026-04-29&to=2026-05-28'),now)).toEqual({from:'2026-04-29',to:'2026-05-28'});expect(()=>resolveManualSourceRange(new URLSearchParams('from=2026-04-29&to=2026-05-30'),now)).toThrow('höchstens 31');expect(()=>resolveManualSourceRange(new URLSearchParams('from=2026-07-28&to=2026-07-28'),now)).toThrow('Zukunft');expect(()=>resolveManualSourceRange(new URLSearchParams('from=broken&to=2026-07-27'),now)).toThrow('Ungültiger')});
  it('refreshes the complete rolling 30-day report window before continuing an older backfill window',async()=>{
    const state={phase:'backfill' as const,backfill_start:'2025-07-23',next_end:'2025-12-17',last_success_at:'2026-07-23T06:00:00.000Z'};
    const loaded:string[]=[],written:string[]=[];
    const store:SyncStore={getState:async()=>state,upsertConversions:async rows=>{written.push(`conversions:${rows.length}`)},upsertMetrics:async rows=>{written.push(`metrics:${rows.length}`)},setState:async()=>{written.push('state')}};
    await runHistorySync({store,now:new Date('2026-07-23T11:00:00Z'),loadConversions:async(from,to)=>{loaded.push(`conversions:${from}:${to}`);return[]},loadReports:async(from,to)=>{loaded.push(`reports:${from}:${to}`);return{base:[],events:[]}}});
    expect(loaded).toEqual(['reports:2026-06-24:2026-07-23','conversions:2025-12-11:2025-12-17','reports:2025-12-11:2025-12-17']);
    expect(written).toEqual(['conversions:0','metrics:0','conversions:0','metrics:0','state']);
  });
  it('finishes an expired final backfill day report-only and switches to rolling',async()=>{const state={phase:'backfill' as const,backfill_start:'2025-07-23',next_end:'2025-07-23',last_success_at:'2026-07-25T05:17:32.256Z'},loaded:string[]=[];let saved:typeof state|ReturnType<typeof advanceSyncState>|null=null;const store:SyncStore={getState:async()=>state,upsertConversions:async()=>{},upsertMetrics:async()=>{},setState:async next=>{saved=next}};const result=await runHistorySync({store,now:new Date('2026-07-27T08:30:00Z'),loadConversions:async()=>{throw new Error('Invalid conversion filters')},loadReports:async(from,to)=>{loaded.push(`${from}:${to}`);return{base:[],events:[]}}});expect(loaded).toEqual(['2026-06-28:2026-07-27','2025-07-23:2025-07-23']);expect(saved).toMatchObject({phase:'rolling'});expect(result).toMatchObject({mode:'backfill',from:'2025-07-23',to:'2025-07-23',upsertedConversions:0})});
  it('persists conversions, daily metrics and progress only after both writes succeed',async()=>{
    const calls:string[]=[];
    let savedState:ReturnType<typeof initialSyncState>|null=null;
    const store:SyncStore={
      getState:async()=>null,
      upsertConversions:async rows=>{calls.push(`conversions:${rows.length}`)},
      upsertMetrics:async rows=>{calls.push(`metrics:${rows.length}`)},
      setState:async state=>{savedState=state;calls.push('state')},
    };
    const conversion:EverflowConversion={conversion_id:'cv',transaction_id:'lead',conversion_unix_timestamp:1784743200,is_event:false,event:'SOI'};
    const columns=[{column_type:'date',id:'1784692800',label:'1784692800'}];
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>[conversion,conversion],loadReports:async()=>({base:[{columns,reporting:{cv:1}}],events:[]})});
    expect(calls).toEqual(['conversions:0','metrics:1','conversions:1','metrics:1','state']);
    expect(savedState).toMatchObject({phase:'backfill',next_end:'2026-07-15'});
    expect(result).toMatchObject({mode:'backfill',from:'2026-07-16',to:'2026-07-22',upsertedConversions:1,upsertedMetrics:1});
    expect(result.conversionRows).toHaveLength(1);
  });
  it('replaces a refreshed metric range so old collapsed source rows cannot double-count',async()=>{
    const calls:string[]=[];
    const store:SyncStore={getState:async()=>null,upsertConversions:async()=>{calls.push('conversions')},upsertMetrics:async()=>{throw new Error('must replace')},replaceMetrics:async(from,to,rows)=>{calls.push(`replace:${from}:${to}:${rows.length}`)},setState:async()=>{}};
    const columns=[{column_type:'date',id:'1784692800',label:'1784692800'},{column_type:'offer',id:'20',label:'XLOVES API'},{column_type:'adv2',id:'placement',label:'placement'}];
    await refreshHistoryRange({store,from:'2026-07-22',to:'2026-07-22',loadConversions:async()=>[],loadReports:async()=>({base:[{columns,reporting:{cv:1}}],events:[]})});
    expect(calls).toEqual(['conversions','replace:2026-07-22:2026-07-22:1']);
  });
  it('can refresh report snapshots without re-downloading immutable historical conversions',async()=>{let conversionLoads=0,conversionWrites=0;const store:SyncStore={getState:async()=>null,upsertConversions:async()=>{conversionWrites++},upsertMetrics:async()=>{},replaceMetrics:async()=>{},setState:async()=>{}};const result=await refreshHistoryRange({store,from:'2026-06-24',to:'2026-07-23',includeConversions:false,loadConversions:async()=>{conversionLoads++;return[]},loadReports:async()=>({base:[],events:[]})});expect(conversionLoads).toBe(0);expect(conversionWrites).toBe(1);expect(result.conversions).toEqual([])});
  it('lets the ten-minute cron skip rolling syncs until one hour has elapsed',async()=>{
    const state={phase:'rolling' as const,backfill_start:'2025-07-23',next_end:'2025-07-22',last_success_at:'2026-07-22T11:30:00.000Z'};
    const store:SyncStore={getState:async()=>state,upsertConversions:async()=>{throw new Error('unexpected')},upsertMetrics:async()=>{throw new Error('unexpected')},setState:async()=>{throw new Error('unexpected')}};
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>{throw new Error('unexpected')},loadReports:async()=>{throw new Error('unexpected')}});
    expect(result).toMatchObject({mode:'rolling',skipped:true});
  });
});
