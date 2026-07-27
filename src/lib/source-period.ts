import{resolveAffiliatePeriod}from'./affiliate-period';
export type SourcePeriod='today'|'7d'|'30d'|'90d'|'custom';
export type SourcePeriodQuery={sourcePeriod?:string;sourceFrom?:string;sourceTo?:string};
export const SOURCE_PERIODS:[SourcePeriod,string][]=[['today','Heute'],['7d','7 Tage'],['30d','30 Tage'],['90d','90 Tage'],['custom','Individuell']];
const allowed=new Set<SourcePeriod>(SOURCE_PERIODS.map(([id])=>id));
export function resolveSourcePeriod(query:SourcePeriodQuery,now=new Date()){const requested=allowed.has(query.sourcePeriod as SourcePeriod)?query.sourcePeriod as SourcePeriod:'30d',resolved=resolveAffiliatePeriod({period:requested,from:query.sourceFrom,to:query.sourceTo},now);return{...resolved,period:resolved.period as SourcePeriod}}
export type ResolvedSourcePeriod=ReturnType<typeof resolveSourcePeriod>;
export function buildSourcePeriodQuery(current:string|URLSearchParams,period:SourcePeriod,from?:string,to?:string){const params=new URLSearchParams(current);params.set('sourcePeriod',period);params.delete('sourceFrom');params.delete('sourceTo');if(period==='custom'){if(from)params.set('sourceFrom',from);if(to)params.set('sourceTo',to)}return params.toString()}
