export type ExportFilters={from?:string|null;to?:string|null;affiliate?:string;offer?:string;campaign?:string;source?:string;sub_source?:string};
type QueryResult={data:unknown[]|null;error:{message:string}|null;count?:number|null};
export interface ExportQuery extends PromiseLike<QueryResult>{select(columns:string,options?:{count?:'exact'}):ExportQuery;order(column:string,options:{ascending:boolean}):ExportQuery;limit(count:number):ExportQuery;range(from:number,to:number):ExportQuery;gte(column:string,value:string):ExportQuery;lte(column:string,value:string):ExportQuery;eq(column:string,value:string):ExportQuery;in(column:string,values:string[]):ExportQuery}
type Client={from(table:string):ExportQuery};
type Scopes=Partial<Record<'affiliate'|'offer'|'campaign'|'source'|'sub_source',string[]>>;
export type ExportRow=Record<string,unknown>;
export type ExportGranularity='day'|'month';
export const EXPORT_COLUMNS='metric_date,affiliate_id,affiliate_name,offer_id,offer_name,campaign_id,campaign_name,offer_url_id,offer_url_name,source_id,sub_source,clicks,sois,first_sales,rebills,coin_spend,payout,revenue,profit';
/** Eigenes Zeilenlimit des Tagesexports; Supabase kappt zusätzlich per max-rows (Default 1000) – deshalb wird die Kappung über count:'exact' erkannt, nicht über das Limit allein. */
export const EXPORT_ROW_LIMIT=10_000;
/** Monatsaggregat: Tageszeilen werden seitenweise (PostgREST-Default 1000) gelesen und im Speicher summiert; harte Obergrenze als Zeitbudget je Request. */
export const EXPORT_PAGE_SIZE=1000;
export const EXPORT_MONTH_MAX_ROWS=25_000;
export const EXPORT_DIMENSION_COLUMNS=['affiliate_id','affiliate_name','offer_id','offer_name','campaign_id','campaign_name','offer_url_id','offer_url_name','source_id','sub_source'] as const;
export const EXPORT_SUM_COLUMNS=['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit'] as const;
const MONEY_COLUMNS=new Set<string>(['coin_spend','payout','revenue','profit']);
/** Stabile Sortierung: Datum absteigend plus Dimensionsschlüssel, damit seitenweises Lesen weder Zeilen doppelt noch auslässt. */
const ORDER_TIEBREAKERS=['affiliate_id','offer_id','campaign_id','offer_url_id','source_id','sub_source'] as const;
export const parseExportGranularity=(value:string|null|undefined):ExportGranularity|null=>value===null||value===undefined||value===''||value==='day'?'day':value==='month'?'month':null;
export const exportTruncationNotice=(rows:number,granularity:ExportGranularity='day')=>granularity==='month'?`# gekappt bei ${rows} Tageszeilen (älteste Monate unvollständig) – Zeitraum verkleinern`:`# gekappt bei ${rows} Zeilen – Zeitraum verkleinern oder granularity=month nutzen`;
function applyExportFilters(query:ExportQuery,filters:ExportFilters,scopes?:Scopes){let next=query;if(filters.from)next=next.gte('metric_date',filters.from);if(filters.to)next=next.lte('metric_date',filters.to);const columns={affiliate:'affiliate_id',offer:'offer_id',campaign:'campaign_id',source:'source_id',sub_source:'sub_source'} as const;for(const key of Object.keys(columns) as Array<keyof typeof columns>){const allowed=scopes?.[key];if(allowed?.length)next=next.in(columns[key],allowed);const requested=filters[key];if(requested)next=next.eq(columns[key],requested)}return next}
const orderedSelect=(client:Client,count=true)=>{let query=client.from('daily_metrics').select(EXPORT_COLUMNS,count?{count:'exact'}:undefined).order('metric_date',{ascending:false});for(const column of ORDER_TIEBREAKERS)query=query.order(column,{ascending:true});return query};
export function buildDailyMetricsExportQuery(client:Client,filters:ExportFilters,scopes?:Scopes){return applyExportFilters(orderedSelect(client).limit(EXPORT_ROW_LIMIT),filters,scopes)}
/** Eine Seite Tageszeilen (range statt limit) für das Monatsaggregat. */
export function buildDailyMetricsExportPageQuery(client:Client,filters:ExportFilters,scopes:Scopes|undefined,page:{offset:number;size:number}){return applyExportFilters(orderedSelect(client,page.offset===0).range(page.offset,page.offset+page.size-1),filters,scopes)}
/** Gekappt, wenn Supabase mehr Treffer meldet als geliefert (max-rows) oder das eigene Limit erreicht ist. */
export function exportTruncated(result:{data:unknown[]|null;count?:number|null},limit=EXPORT_ROW_LIMIT){const delivered=(result.data||[]).length;if(typeof result.count==='number'&&Number.isFinite(result.count))return result.count>delivered;return delivered>=limit}
const numeric=(value:unknown)=>{const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?n:0};
const monthOf=(value:unknown)=>String(value??'').slice(0,7);
const round2=(value:number)=>Math.round(value*100)/100;
/** Monatsaggregat je Dimension: metric_month statt metric_date, Zahlenfelder summiert; Sortierung Monat absteigend, Dimensionen aufsteigend. */
export function aggregateExportRowsByMonth(rows:ExportRow[]):ExportRow[]{
 const groups=new Map<string,ExportRow>();
 for(const row of rows){const month=monthOf(row.metric_date);if(!/^\d{4}-\d{2}$/.test(month))continue;const dims=EXPORT_DIMENSION_COLUMNS.map(column=>String(row[column]??'')),key=[month,...dims].join('\u001f');let entry=groups.get(key);if(!entry){entry={metric_month:month};for(const column of EXPORT_DIMENSION_COLUMNS)entry[column]=row[column]??'';for(const column of EXPORT_SUM_COLUMNS)entry[column]=0;groups.set(key,entry)}for(const column of EXPORT_SUM_COLUMNS)entry[column]=numeric(entry[column])+numeric(row[column])}
 const result=[...groups.values()].map(entry=>{for(const column of EXPORT_SUM_COLUMNS)if(MONEY_COLUMNS.has(column))entry[column]=round2(numeric(entry[column]));return entry});
 const dimKey=(row:ExportRow)=>EXPORT_DIMENSION_COLUMNS.map(column=>String(row[column]??'')).join('\u001f');
 return result.sort((a,b)=>String(b.metric_month).localeCompare(String(a.metric_month))||dimKey(a).localeCompare(dimKey(b)));
}
export type MonthlyExportResult={rows:ExportRow[];error:{message:string}|null;truncated:boolean;dailyRows:number};
/** Liest Tageszeilen seitenweise bis maxRows und aggregiert je Monat; truncated, wenn Supabase mehr Treffer meldet als gelesen wurden. */
export async function loadMonthlyExportRows(client:Client,filters:ExportFilters,scopes?:Scopes,options:{maxRows?:number;pageSize?:number}={}):Promise<MonthlyExportResult>{
 const maxRows=options.maxRows??EXPORT_MONTH_MAX_ROWS,pageSize=Math.max(1,Math.min(options.pageSize??EXPORT_PAGE_SIZE,maxRows)),daily:ExportRow[]=[];let total:number|null=null,offset=0;
 // Offset wächst um die tatsächliche Seitenlänge: liefert Supabase per max-rows weniger als angefragt, wird trotzdem bis zum exakten count weitergelesen.
 while(offset<maxRows){
  const size=Math.min(pageSize,maxRows-offset),result=await buildDailyMetricsExportPageQuery(client,filters,scopes,{offset,size});
  if(result.error)return{rows:[],error:result.error,truncated:false,dailyRows:daily.length};
  const page=(result.data||[]) as ExportRow[];if(total===null&&typeof result.count==='number'&&Number.isFinite(result.count))total=result.count;daily.push(...page);
  if(!page.length)break;
  offset+=page.length;
  if(total!==null?daily.length>=total:page.length<size)break;
 }
 const truncated=total!==null?total>daily.length:offset>=maxRows;
 return{rows:aggregateExportRowsByMonth(daily),error:null,truncated,dailyRows:daily.length};
}
