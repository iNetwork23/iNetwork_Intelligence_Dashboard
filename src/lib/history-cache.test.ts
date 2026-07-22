import {describe,expect,it} from 'vitest';
import {advanceSyncState,conversionToCacheRow,initialSyncState,metricRows,runHistorySync,selectSyncWindow,type EverflowConversion,type ReportRow,type SyncStore} from './history-cache';

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
    expect(conversionToCacheRow(base)).toMatchObject({id:'cv-1',type:'soi',lead_id:'lead-1',source_id:'src',sub_source:'sub',affiliate_id:'6',offer_id:'57',offer_url_id:'2774',status:'approved',payout:3,revenue:0});
  });
  it('maps Sale and Rebill events and excludes unrelated events',()=>{
    expect(conversionToCacheRow({...base,conversion_id:'sale',is_event:true,event:'Sale'})?.type).toBe('first_sale');
    expect(conversionToCacheRow({...base,conversion_id:'rebill',is_event:true,event:'Rebill'})?.type).toBe('rebill');
    expect(conversionToCacheRow({...base,conversion_id:'coin',is_event:true,event:'Coin Spend'})).toBeNull();
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
    expect(row).toMatchObject({metric_date:'2026-07-22',affiliate_id:'6',offer_id:'57',campaign_id:'2',offer_url_id:'2774',source_id:'src',sub_source:'sub',clicks:100,sois:10,first_sales:2,rebills:3,payout:30,revenue:80,profit:50});
    expect(row.id).toMatch(/^metric:/);
  });
});

describe('sync orchestration',()=>{
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
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>[conversion],loadReports:async()=>({base:[{columns,reporting:{cv:1}}],events:[]})});
    expect(calls).toEqual(['conversions:1','metrics:1','state']);
    expect(savedState).toMatchObject({phase:'backfill',next_end:'2026-07-15'});
    expect(result).toMatchObject({mode:'backfill',from:'2026-07-16',to:'2026-07-22',upsertedConversions:1,upsertedMetrics:1});
  });
  it('lets the ten-minute cron skip rolling syncs until one hour has elapsed',async()=>{
    const state={phase:'rolling' as const,backfill_start:'2025-07-23',next_end:'2025-07-22',last_success_at:'2026-07-22T11:30:00.000Z'};
    const store:SyncStore={getState:async()=>state,upsertConversions:async()=>{throw new Error('unexpected')},upsertMetrics:async()=>{throw new Error('unexpected')},setState:async()=>{throw new Error('unexpected')}};
    const result=await runHistorySync({store,now:new Date('2026-07-22T12:00:00Z'),loadConversions:async()=>{throw new Error('unexpected')},loadReports:async()=>{throw new Error('unexpected')}});
    expect(result).toMatchObject({mode:'rolling',skipped:true});
  });
});
