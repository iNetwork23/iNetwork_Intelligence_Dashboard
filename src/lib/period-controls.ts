import type{ReportingPeriod}from'./supabase-reporting';
import type{SourcePeriod}from'./source-period';
import{dashboardMonthRange}from'./dashboard-months';
import{STATE_WORDS}from'./verdict-vocabulary';
/**
 * Reine URL-Logik der einen Zeitraum-Komponente (Entscheidung D5): zwei Dimensionen in einer Form.
 * global  = period/from/to (Berichtszeitraum aller Bereiche, Standard 30 Tage, wandert über Sidebar-Links mit)
 * source  = sourcePeriod/sourceFrom/sourceTo (Quellenauswertung im Cockpit, eigener Vertrag aus source-period.ts)
 * Fremde Parameter (affiliate, offer, sourceOpen, sourceSort, view, company, …) bleiben unangetastet. Client-sicher.
 */
export type PeriodDimension='global'|'source';
export type PeriodSelection={period:string;from?:string;to?:string};
export const DEFAULT_PERIOD:ReportingPeriod='30d';
export const REPORTING_PERIODS:readonly ReportingPeriod[]=['today','7d','30d','90d','12m','all','custom'];
export const GLOBAL_PERIOD_PRESETS:readonly(readonly[ReportingPeriod,string])[]=[['today','Heute'],['7d','7 Tage'],['30d','30 Tage'],['90d','90 Tage'],['12m','12 Monate'],['all','365 Tage']];
export const SOURCE_PERIOD_PRESETS:readonly(readonly[SourcePeriod,string])[]=[['today','Heute'],['7d','7 Tage'],['30d','30 Tage'],['90d','90 Tage']];
/** Beim Setzen der globalen Dimension werden auch die Kalender-Altparameter der Affiliate-Seite entfernt. */
export const GLOBAL_PERIOD_KEYS=['period','from','to','calendarYear','calendarMonth']as const;
export const SOURCE_PERIOD_KEYS=['sourcePeriod','sourceFrom','sourceTo']as const;
const validDay=(value?:string|null):value is string=>/^\d{4}-\d{2}-\d{2}$/.test(value||'');
export const isReportingPeriod=(value:unknown):value is ReportingPeriod=>typeof value==='string'&&(REPORTING_PERIODS as readonly string[]).includes(value);
/** Ungültige oder fehlende Werte fallen auf den Standard von 30 Tagen zurück (D5). */
export const resolveGlobalPeriod=(value?:string|null):ReportingPeriod=>isReportingPeriod(value)?value:DEFAULT_PERIOD;
/** Baut die Query für eine Zeitraumwahl; nur die Schlüssel der eigenen Dimension werden ersetzt. */
export function buildPeriodQuery(current:string|URLSearchParams,dimension:PeriodDimension,selection:PeriodSelection){
 const params=new URLSearchParams(current);
 if(dimension==='global'){for(const key of GLOBAL_PERIOD_KEYS)params.delete(key);params.set('period',selection.period);if(selection.period==='custom'){if(selection.from)params.set('from',selection.from);if(selection.to)params.set('to',selection.to)}}
 else{for(const key of SOURCE_PERIOD_KEYS)params.delete(key);params.set('sourcePeriod',selection.period);if(selection.period==='custom'||selection.period==='calendar'){if(selection.from)params.set('sourceFrom',selection.from);if(selection.to)params.set('sourceTo',selection.to)}}
 return params.toString();
}
/** Kalenderjahr (month 'all') oder Kalendermonat, gedeckelt auf maxDate; null für Zukunft oder ungültige Eingaben. */
export function periodCalendarRange(year:string,month:string,maxDate:string){
 if(month!=='all')return dashboardMonthRange(year,month,maxDate);
 if(!/^\d{4}$/.test(year)||!validDay(maxDate))return null;
 const from=`${year}-01-01`,naturalTo=`${year}-12-31`;if(from>maxDate)return null;return{from,to:naturalTo>maxDate?maxDate:naturalTo};
}
export type PeriodEditor='months'|'custom'|null;
/** Welcher Editor zur aktuellen Auswahl gehört: Monat/Jahr-Raster, freier Bereich oder keiner (Preset). */
export function detectPeriodEditor(period:string,from:string|undefined,to:string|undefined,maxDate:string):{editor:PeriodEditor;year:string|null;month:string|null}{
 if(period!=='custom'&&period!=='calendar')return{editor:null,year:null,month:null};
 if(validDay(from)&&validDay(to)){const year=from.slice(0,4),month=from.slice(5,7);const monthRange=periodCalendarRange(year,month,maxDate);if(monthRange&&monthRange.from===from&&monthRange.to===to)return{editor:'months',year,month};const yearRange=periodCalendarRange(year,'all',maxDate);if(yearRange&&yearRange.from===from&&yearRange.to===to)return{editor:'months',year,month:'all'}}
 return{editor:'custom',year:null,month:null};
}
/** Globaler Zeitraum aus der aktuellen URL – nur wenn gesetzt und gültig; custom nur mit beiden Datumsgrenzen. */
export function globalPeriodParams(current:string|URLSearchParams):Record<string,string>{
 const params=new URLSearchParams(current),period=params.get('period');
 if(!isReportingPeriod(period))return{};
 if(period!=='custom')return{period};
 const from=params.get('from'),to=params.get('to');return validDay(from)&&validDay(to)?{period,from,to}:{};
}
/** Hängt den globalen Zeitraum an einen internen Link, sofern der Link keinen eigenen period-Parameter trägt. */
export function withGlobalPeriod(href:string,current:string|URLSearchParams){
 const carry=globalPeriodParams(current);if(!Object.keys(carry).length||!href.startsWith('/'))return href;
 const[base,hash='']=href.split('#'),[path,query='']=base.split('?'),params=new URLSearchParams(query);
 if(params.has('period'))return href;
 for(const[key,value]of Object.entries(carry))params.set(key,value);
 return`${path}?${params}${hash?`#${hash}`:''}`;
}
/** /sources kennt nur die Rollup-Fenster 7d und 30d: 7d bleibt 7d, alles andere wird 30d. */
export const sourcesRangeFromPeriod=(period?:string|null):'7d'|'30d'=>period==='7d'?'7d':'30d';
const berlinTime=(value:string)=>{const time=Date.parse(value);return Number.isFinite(time)?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(time)):null};
/** Teiltag-Marker für „Heute“ (D5, D11): bis zur Sync-Zeit vollständig, ohne weitere Zusage. */
export function todayPartialNote(status:{todayPartial:boolean;syncAt:string|null}|null|undefined){
 const time=status?.syncAt?berlinTime(status.syncAt):null;
 return status?.todayPartial&&time?`${STATE_WORDS.partialDay} bis ${time} Uhr`:`${STATE_WORDS.partialDay} bis Sync-Zeit`;
}
