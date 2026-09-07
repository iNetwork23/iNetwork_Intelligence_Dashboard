import type {SupabaseClient} from '@supabase/supabase-js';
import {EVERFLOW_BERLIN_TIMEZONE_ID} from './everflow-timezone';

export const BERLIN_REPORTING_VERSION=5;
export type BerlinDayMarker={version:number;timezoneId:number;date:string;generation:string};
const validDay=(day:unknown):day is string=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(`${day}T12:00Z`))&&new Date(`${day}T12:00Z`).toISOString().slice(0,10)===day;
export function isBerlinDayMarker(value:unknown):value is BerlinDayMarker{
 if(!value||typeof value!=='object')return false;
 const marker=value as Partial<BerlinDayMarker>;
 return marker.version===BERLIN_REPORTING_VERSION&&marker.timezoneId===EVERFLOW_BERLIN_TIMEZONE_ID&&validDay(marker.date)&&typeof marker.generation==='string'&&marker.generation.length>0;
}
export function reportingDays(from:string,to:string){
 if(!validDay(from)||!validDay(to)||from>to)throw new Error('Ungültiger Berlin-Berichtszeitraum');
 const days:string[]=[];for(let day=from;day<=to;day=new Date(Date.parse(`${day}T12:00Z`)+86400000).toISOString().slice(0,10))days.push(day);return days;
}
/** A range cache or daily_metrics fallback is usable only after every day was rebuilt in Berlin. */
export async function assertBerlinReportingRange(client:{from?:SupabaseClient['from']},range:{from:string|null;to:string|null}){
 if(!client.from)throw new Error('Berlin-Tagesnachweise nicht verfügbar');
 let from=range.from,to=range.to;
 for(const edge of ['from','to'] as const){if(edge==='from'?from:to)continue;const result=await client.from('daily_metrics').select('metric_date').order('metric_date',{ascending:edge==='from'}).limit(1).maybeSingle();if(result.error)throw new Error('Berlin-Berichtszeitraum nicht lesbar');const day=result.data?.metric_date as string|undefined;if(!day)throw new Error('Berlin-Tagesdaten noch nicht verfügbar');if(edge==='from')from=day;else to=day}
 const days=reportingDays(from!,to!),prefix='portfolio_day_generation:';
 const result=await client.from('sync_state').select('value').gte('key',`${prefix}${from}`).lte('key',`${prefix}${to}`).order('key');
 if(result.error)throw new Error(`Berlin-Tagesnachweise nicht lesbar: ${result.error.message}`);
 const markers=new Map<string,BerlinDayMarker>();for(const row of result.data||[])if(isBerlinDayMarker(row.value))markers.set(row.value.date,row.value);
 if(!days.every(day=>markers.has(day)))throw new Error(`Berlin-Tagesdaten müssen neu synchronisiert werden (${days.filter(day=>markers.has(day)).length}/${days.length} Tage bestätigt)`);
 return markers;
}
