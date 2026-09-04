/** Tagesreihen für Sparklines (Etappe 3): reine Helfer, Schlüssel wie cockpitItemKey / candidateItemKey in affiliate-priority.ts. */
export type DailyByKey=Record<string,number[]>;
const DAY=86_400_000;
const shift=(day:string,days:number)=>new Date(Date.parse(`${day}T12:00:00Z`)+days*DAY).toISOString().slice(0,10);
/** Alle Kalendertage von from bis to (inklusive); leer bei ungültiger Reihenfolge. */
export function dateRange(from:string,to:string):string[]{if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return[];const days:string[]=[];for(let day=from;day<=to;day=shift(day,1))days.push(day);return days}
/** Summiert Punkte je Schlüssel auf die Tage der Reihe; fehlende Tage bleiben 0, fremde Tage werden ignoriert. */
export function dailySeriesByKey(points:Array<{date:string;key:string;value:number}>,dates:string[]):DailyByKey{const index=new Map(dates.map((day,i)=>[day,i] as const)),out:DailyByKey={};for(const point of points){const i=index.get(point.date);if(i===undefined||!Number.isFinite(point.value))continue;(out[point.key]??=Array.from({length:dates.length},()=>0))[i]+=point.value}return out}
/** Cockpit-Schlüssel einer Portfolio-Zeile: `${affiliateId}|${variantKey}` mit variantKey = affiliate|offer|offerUrl (affiliate-optimizer key()). */
export const variantDailyKey=(row:{affiliate_id:string;offer_id:string;offer_url_id:string})=>`${row.affiliate_id}|${row.affiliate_id}|${row.offer_id}|${row.offer_url_id}`;
/** Tracker-Schlüssel eines aggregierten Quell-Blatts (candidateItemKey). */
export const candidateDailyKey=(row:{pathKey:string;trafficMode:string;mainValue:string|null;subValue:string|null})=>`${row.pathKey}|${row.trafficMode}|${row.mainValue||''}|${row.subValue||''}`;
