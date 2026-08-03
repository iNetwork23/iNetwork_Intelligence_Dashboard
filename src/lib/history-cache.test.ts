import {describe,expect,it} from 'vitest';
import {advanceSyncState,conversionToCacheRow,hourlyMetricRows,hourlyRetentionCutoff,initialSyncState,metricRows,runHistorySync,selectHourlyWindow,selectSyncWindow,type ConversionCacheRow,type DailyMetricRow,type EverflowConversion,type HourlyMetricRow,type ReportRow,type SyncState,type SyncStore} from './history-cache';

describe('history cache sync windows',()=>{
  const now=new Date('2026-07-22T12:00:00Z');
  it('starts a resumable 365-day backfill with a maximum seven-day chunk',()=>{
    const state=initialSyncState(now);
    expect(state).toEqual({phase:'backfill',backfill_start:'2025-07-23',next_end:'2026-07-22',last_success_at:null});
    expect(selectSyncWindow(state,now)).toEqual({mode:'backfill',from:'2026-07-16',to:'2026-07-22'});
  });
  it('moves backwards and switches to the rolling 30-day window after the final chunk',()=>{
    const state={phase:'backfill' as const,backfill_start:'2025-07-23',next_end:'2025-07-25',last_success_at:null};
    const window=selectSyncWindow(state,now);
    expect(window).toEqual({mode:'backfill',from:'2025-07-23',to:'2025-07-25'});
    const next=advanceSyncState(state,window,now);
    expect(next.phase).toBe('rolling');
    expect(selectSyncWindow(next,now)).toEqual({mode:'rolling',from:'2026-06-23',to:'2026-07-22'});
  });
});

describe('Everflow conversion mapping',()=>{
  const base:EverflowConversion={conversion_id:'cv-1',transaction_id:'lead-1',conversion_unix_timestamp:1784743200,is_event:false,event:'SOI',status:'approved',payout:3,revenue:0,source_id:'src',sub1:'sub',relationship:{affiliate:{network_affiliate_id:6,name:'Partner'},offer:{network_offer_id:57,name:'Singles69'},offer_url:{network_offer_url_id:2774,name:'LP'}}};
  it('uses the stable conversion id and transaction id for the LTV chain',()=>{
    expect(conversionToCacheRow(base)).toMatchObject({id:'cv-1',type:'soi',lead_id:'lead-1',source_id:'src',sub_source:'sub',affiliate_id:'6',offer_id:'57',offer_url_id:'2774',status:'approved',payout:3,revenue:0,raw:{}});
    expect(conversionToCacheRow(base)?.raw).toEqual({});
  });
  it('maps Sale and Rebill events and excludes unrelated events',()=>{
    expect(conversionToCacheRow({...base,conversion_id:'sale',is_event:true,event:'Sale'})?.type).toBe('first_sale');
    expect(conversionToCacheRow({...base,conversion_id:'rebill',is_event:true,event:'Rebill'})?.type).toBe('rebill');
    expect(conversionToCacheRow({...base,conversion_id:'coin',is_event:true,event:'Coin Spend'})).toBeNull();
  });
  // ltv_cohorts gruppiert und joint über lead_id. Ein leerer Wert würde alle betroffenen
  // Zeilen zu einem Sammel-Lead verschmelzen und die Kohortenumsätze verfälschen.
  it('drops conversions that carry no transaction id',()=>{
    expect(conversionToCacheRow({...base,transaction_id:''})).toBeNull();
    expect(conversionToCacheRow({...base,transaction_id:'   '})).toBeNull();
    expect(conversionToCacheRow({...base,transaction_id:undefined as unknown as string})).toBeNull();
  });
  it('trims a padded transaction id instead of storing it verbatim',()=>{
    expect(conversionToCacheRow({...base,transaction_id:' lead-1 '})).toMatchObject({lead_id:'lead-1'});
  });
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
    expect(row).toMatchObject({metric_date:'2026-07-22',affiliate_id:'6',offer_id:'57',campaign_id:'2',offer_url_id:'2774',source_id:'src',sub_source:'sub',clicks:100,sois:10,first_sales:2,rebills:3,payout:30,revenue:80,profit:50,raw:{}});
    expect(row.raw).toEqual({});
    expect(row.id).toMatch(/^metric:/);
  });
});

describe('hourly metric rows',()=>{
  const hourColumns=(epoch:string)=>[
    {column_type:'hour',id:epoch,label:epoch},{column_type:'affiliate',id:'6',label:'TrafficPartner'},
    {column_type:'offer',id:'57',label:'Singles69'},{column_type:'campaign',id:'146',label:'Traffic Company'},
    {column_type:'offer_url',id:'10',label:'LP A'},
  ];
  it('keeps one row per hour and merges the event report into it',()=>{
    const base=[{columns:hourColumns('1784692800'),reporting:{total_click:40,cv:4,payout:12,revenue:30,profit:18}},
                {columns:hourColumns('1784696400'),reporting:{total_click:10,cv:1,payout:3,revenue:0,profit:-3}}];
    const events=[{columns:[...hourColumns('1784692800'),{column_type:'event_name',id:'Sale',label:'Sale'}],reporting:{event:2}},
                  {columns:[...hourColumns('1784692800'),{column_type:'event_name',id:'Rebill',label:'Rebill'}],reporting:{event:3}}];
    const rows=hourlyMetricRows(base,events);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({metric_hour:'2026-07-22T04:00:00.000Z',clicks:40,sois:4,first_sales:2,rebills:3,campaign_id:'146',offer_url_id:'10'});
    expect(rows[1]).toMatchObject({metric_hour:'2026-07-22T05:00:00.000Z',clicks:10,first_sales:0,rebills:0});
    expect(rows[0].id).toMatch(/^hour:/);
    expect(rows[0].id).not.toBe(rows[1].id);
  });
  it('drops rows without a usable hour dimension instead of bucketing them at the epoch',()=>{
    expect(hourlyMetricRows([{columns:[{column_type:'campaign',id:'146',label:'x'}],reporting:{total_click:5}}],[])).toEqual([]);
  });
  it('covers the full Smartlink decision window regardless of the backfill position',()=>{
    expect(selectHourlyWindow(new Date('2026-07-22T12:00:00Z'))).toEqual({from:'2026-07-09',to:'2026-07-22'});
    expect(hourlyRetentionCutoff(new Date('2026-07-22T12:00:00Z'))).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('sync orchestration',()=>{
  const hourRow={columns:[{column_type:'hour',id:'1784692800',label:'1784692800'},{column_type:'campaign',id:'146',label:'Traffic Company'}],reporting:{total_click:7,cv:1}};
  function recordingStore(calls:string[],onState:(state:SyncState)=>void){
    return{
      getState:async()=>null,
      upsertConversions:async(rows:ConversionCacheRow[])=>{calls.push(`conversions:${rows.length}`)},
      upsertMetrics:async(rows:DailyMetricRow[])=>{calls.push(`metrics:${rows.length}`)},
      upsertHourlyMetrics:async(rows:HourlyMetricRow[])=>{calls.push(`hourly:${rows.length}`)},
      pruneHourlyMetrics:async(before:string)=>{calls.push(`prune:${before}`)},
      setState:async(state:SyncState)=>{onState(state);calls.push('state')},
    } satisfies SyncStore;
  }
  it('persists conversions, daily metrics, hourly metrics and progress only after the writes succeed',async()=>{
    const calls:string[]=[];
    let savedState:SyncState|null=null;
    const store=recordingStore(calls,state=>{savedState=state});
    const conversion:EverflowConversion={conversion_id:'cv',transaction_id:'lead',conversion_unix_timestamp:1784743200,is_event:false,event:'SOI'};
    const columns=[{column_type:'date',id:'1784692800',label:'1784692800'}];
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>[conversion,conversion],loadReports:async()=>({base:[{columns,reporting:{cv:1}}],events:[]}),loadHourlyReports:async()=>({base:[hourRow],events:[]})});
    expect(calls).toEqual(['conversions:1','metrics:1','hourly:1','prune:2026-07-01T12:00:00.000Z','state']);
    expect(savedState).toMatchObject({phase:'backfill',next_end:'2026-07-15'});
    expect(result).toMatchObject({mode:'backfill',from:'2026-07-16',to:'2026-07-22',upsertedConversions:1,upsertedMetrics:1,upsertedHourlyMetrics:1,hourlyError:null});
  });
  it('loads the hourly window independently of the backfill window',async()=>{
    const windows:string[]=[];
    const store=recordingStore([],()=>{});
    await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>[],loadReports:async(from,to)=>{windows.push(`daily:${from}..${to}`);return{base:[],events:[]}},loadHourlyReports:async(from,to)=>{windows.push(`hourly:${from}..${to}`);return{base:[],events:[]}}});
    expect(windows).toContain('daily:2026-07-16..2026-07-22');
    expect(windows).toContain('hourly:2026-07-09..2026-07-22');
  });
  it('reports a failing hourly report without losing the daily sync',async()=>{
    const calls:string[]=[];
    const store=recordingStore(calls,()=>{});
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>[],loadReports:async()=>({base:[],events:[]}),loadHourlyReports:async()=>{throw new Error('Everflow HTTP 429')}});
    expect(result).toMatchObject({hourlyError:'Everflow HTTP 429',upsertedHourlyMetrics:0});
    expect(calls).toEqual(['conversions:0','metrics:0','state']);
  });
  it('lets the ten-minute cron skip rolling syncs until one hour has elapsed',async()=>{
    const state={phase:'rolling' as const,backfill_start:'2025-07-23',next_end:'2025-07-22',last_success_at:'2026-07-22T11:30:00.000Z'};
    const fail=()=>{throw new Error('unexpected')};
    const store:SyncStore={getState:async()=>state,upsertConversions:fail,upsertMetrics:fail,upsertHourlyMetrics:fail,pruneHourlyMetrics:fail,setState:fail};
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:fail,loadReports:fail,loadHourlyReports:fail});
    expect(result).toMatchObject({mode:'rolling',skipped:true});
  });
});
