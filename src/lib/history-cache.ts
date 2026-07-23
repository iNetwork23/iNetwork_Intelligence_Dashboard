export type SyncPhase='backfill'|'rolling';
export type SyncState={phase:SyncPhase;backfill_start:string;next_end:string;last_success_at:string|null};
export type SyncWindow={mode:SyncPhase;from:string;to:string};
export type ReportRow={columns:{column_type:string;id:string;label:string}[];reporting:Record<string,number>};

export type EverflowConversion={
  conversion_id?:string;transaction_id:string;conversion_unix_timestamp:number;is_event:boolean;event:string;status?:string;
  payout?:number;revenue?:number;cost?:number;source_id?:string;sub1?:string;is_scrub?:boolean;
  relationship?:{
    affiliate?:{network_affiliate_id:number;name?:string};offer?:{network_offer_id:number;name?:string};
    offer_url?:{network_offer_url_id:number;name?:string};campaign?:{network_campaign_id:number;name?:string};
  };
  [key:string]:unknown;
};

export type ConversionCacheRow={
  id:string;type:'soi'|'first_sale'|'rebill';converted_at:string;offer_url_id:string|null;source_id:string|null;sub_source:string|null;
  cost:number;revenue:number;payout:number;lead_id:string;raw:Record<string,unknown>;status:string|null;affiliate_id:string|null;affiliate_name:string|null;
  offer_id:string|null;offer_name:string|null;offer_url_name:string|null;campaign_id:string|null;campaign_name:string|null;
};

export type DailyMetricRow={
  id:string;metric_date:string;affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;
  offer_url_id:string;offer_url_name:string;source_id:string;sub_source:string;clicks:number;sois:number;first_sales:number;rebills:number;
  coin_spend:number;payout:number;revenue:number;profit:number;raw:Record<string,unknown>;
};

const DAY=86_400_000;
const isoDay=(value:Date)=>value.toISOString().slice(0,10);
const fromDay=(value:string)=>new Date(`${value}T12:00:00Z`);
const shift=(value:string,days:number)=>isoDay(new Date(fromDay(value).getTime()+days*DAY));

export async function loadDailyReportSlices<T>(from:string,to:string,loadDay:(day:string)=>Promise<T[]>,rowCap=10_000){
  const rows:T[]=[];
  for(let day=from;day<=to;day=shift(day,1)){
    const batch=await loadDay(day);
    if(batch.length>=rowCap)throw new Error(`Everflow daily entity report reached the ${rowCap.toLocaleString('en-US')}-row cap for ${day}`);
    rows.push(...batch);
  }
  return rows;
}

export function initialSyncState(now=new Date()):SyncState{
  const end=isoDay(now);
  return{phase:'backfill',backfill_start:shift(end,-364),next_end:end,last_success_at:null};
}

export function selectSyncWindow(state:SyncState,now=new Date()):SyncWindow{
  if(state.phase==='rolling'){
    const to=isoDay(now);
    return{mode:'rolling',from:shift(to,-29),to};
  }
  const to=state.next_end;
  const candidate=shift(to,-6);
  return{mode:'backfill',from:candidate<state.backfill_start?state.backfill_start:candidate,to};
}

export function advanceSyncState(state:SyncState,window:SyncWindow,now=new Date()):SyncState{
  if(window.mode==='rolling')return{...state,phase:'rolling',last_success_at:now.toISOString()};
  const nextEnd=shift(window.from,-1);
  return{...state,phase:nextEnd<state.backfill_start?'rolling':'backfill',next_end:nextEnd,last_success_at:now.toISOString()};
}

const text=(value:unknown)=>value===undefined||value===null||value===''?null:String(value);
const amount=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;

export function conversionToCacheRow(row:EverflowConversion):ConversionCacheRow|null{
  const normalized=row.event.trim().toLowerCase();
  const type=(!row.is_event&&(normalized==='soi'||normalized==='cpl soi'))?'soi':row.is_event&&normalized==='sale'?'first_sale':row.is_event&&normalized==='rebill'?'rebill':null;
  if(!type)return null;
  const relationship=row.relationship||{};
  const fallback=[row.transaction_id,type,row.event,row.conversion_unix_timestamp].map(encodeURIComponent).join(':');
  return{
    id:text(row.conversion_id)||fallback,type,converted_at:new Date(row.conversion_unix_timestamp*1000).toISOString(),
    offer_url_id:text(relationship.offer_url?.network_offer_url_id),source_id:text(row.source_id),sub_source:text(row.sub1),cost:amount(row.cost),
    revenue:amount(row.revenue),payout:amount(row.payout),lead_id:row.transaction_id,raw:{},status:text(row.status),
    affiliate_id:text(relationship.affiliate?.network_affiliate_id),affiliate_name:text(relationship.affiliate?.name),offer_id:text(relationship.offer?.network_offer_id),
    offer_name:text(relationship.offer?.name),offer_url_name:text(relationship.offer_url?.name),campaign_id:text(relationship.campaign?.network_campaign_id),
    campaign_name:text(relationship.campaign?.name),
  };
}

const dim=(row:ReportRow,type:string)=>row.columns.find(column=>column.column_type===type)||{id:'',label:''};
const metricKey=(row:ReportRow)=>['date','affiliate','offer','campaign','offer_url','source_id','sub1'].map(type=>dim(row,type).id||'').join('|');
const dayFromDimension=(row:ReportRow)=>new Date(Number(dim(row,'date').id)*1000).toISOString().slice(0,10);
const stableMetricId=(row:ReportRow)=>`metric:${['date','affiliate','offer','campaign','offer_url','source_id','sub1'].map(type=>encodeURIComponent(dim(row,type).id||'')).join(':')}`;

export type SyncStore={
  getState:()=>Promise<SyncState|null>;
  upsertConversions:(rows:ConversionCacheRow[])=>Promise<void>;
  upsertMetrics:(rows:DailyMetricRow[])=>Promise<void>;
  setState:(state:SyncState)=>Promise<void>;
};

export async function runHistorySync(input:{
  store:SyncStore;now?:Date;
  loadConversions:(from:string,to:string)=>Promise<EverflowConversion[]>;
  loadReports:(from:string,to:string)=>Promise<{base:ReportRow[];events:ReportRow[]}>;
}){
  const now=input.now||new Date();
  const state=await input.store.getState()||initialSyncState(now);
  if(state.phase==='rolling'&&state.last_success_at&&now.getTime()-Date.parse(state.last_success_at)<55*60_000){
    const window=selectSyncWindow(state,now);
    return{mode:'rolling' as const,from:window.from,to:window.to,upsertedConversions:0,upsertedMetrics:0,backfillComplete:true,skipped:true};
  }
  const window=selectSyncWindow(state,now);
  const persist=async(from:string,to:string)=>{
    const [rawConversions,reports]=await Promise.all([input.loadConversions(from,to),input.loadReports(from,to)]);
    const mappedConversions=rawConversions.map(conversionToCacheRow).filter((row):row is ConversionCacheRow=>row!==null);
    const conversions=Array.from(new Map(mappedConversions.map(row=>[row.id,row])).values());
    const metrics=metricRows(reports.base,reports.events);
    await input.store.upsertConversions(conversions);
    await input.store.upsertMetrics(metrics);
    return{conversions,metrics};
  };
  const today=isoDay(now);
  if(window.mode==='backfill'&&window.to<today)await persist(today,today);
  const{conversions,metrics}=await persist(window.from,window.to);
  const next=advanceSyncState(state,window,now);
  await input.store.setState(next);
  return{mode:window.mode,from:window.from,to:window.to,upsertedConversions:conversions.length,upsertedMetrics:metrics.length,backfillComplete:next.phase==='rolling'};
}

export function metricRows(baseRows:ReportRow[],eventRows:ReportRow[]):DailyMetricRow[]{
  const map=new Map<string,DailyMetricRow>();
  for(const row of baseRows){
    const q=row.reporting;
    map.set(metricKey(row),{
      id:stableMetricId(row),metric_date:dayFromDimension(row),affiliate_id:dim(row,'affiliate').id||'0',affiliate_name:dim(row,'affiliate').label||'N/A',
      offer_id:dim(row,'offer').id||'0',offer_name:dim(row,'offer').label||'N/A',campaign_id:dim(row,'campaign').id||'0',campaign_name:dim(row,'campaign').label||'N/A',
      offer_url_id:dim(row,'offer_url').id||'0',offer_url_name:dim(row,'offer_url').label||'N/A',source_id:dim(row,'source_id').id||'',sub_source:dim(row,'sub1').id||'',
      clicks:amount(q.total_click),sois:amount(q.cv),first_sales:0,rebills:0,coin_spend:0,payout:amount(q.payout),revenue:amount(q.revenue),
      profit:amount(q.profit??(amount(q.revenue)-amount(q.payout))),raw:{},
    });
  }
  for(const row of eventRows){
    const target=map.get(metricKey(row));
    if(!target)continue;
    const count=amount(row.reporting.event),event=dim(row,'event_name').label;
    if(event==='Sale')target.first_sales+=count;
    else if(event==='Rebill')target.rebills+=count;
    else if(event==='Coin Spend')target.coin_spend+=count;
  }
  return Array.from(map.values());
}
