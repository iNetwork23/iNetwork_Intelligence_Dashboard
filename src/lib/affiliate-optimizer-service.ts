import{unstable_cache}from'next/cache';
import{getDashboard}from'./dashboard-service';
import{DAILY_SERIES_MAX_DAYS,loadPortfolioDailyVariantProfitFromCache,rangeDayCount,type ReportingPeriod}from'./supabase-reporting';
import{candidateDailyKey,dailySeriesByKey,dateRange,type DailyByKey}from'./daily-series';
import{analyzeAffiliateTraffic}from'./affiliate-optimizer';
import{loadAffiliateActivityIndex,loadAffiliateConversionsFromCache,loadAffiliateSourceRowsRangeFromCache,loadSourceSnapshotFreshness}from'./cached-evaluations';
import{analyzeLeadLatency}from'./lead-latency';
import{buildLeadMaturityIndex,isLeadYoungSummary,LEAD_MATURITY_SUMMARY_PREFIX,noLeadMaturityIndex,urlLeadMaturityForReport,urlLeadMaturityFromSummary,type LeadMaturityIndex,type LeadYoungSummary}from'./lead-maturity';
import type{LeadMaturityInput}from'./decision-engine';
import{applyLeadMaturity,type VerdictGate}from'./decision-engine';
import type{AffiliateAnalysis,AffiliateVariant,RecommendationAction}from'./affiliate-optimizer';
import{resolveSourcePeriod}from'./source-period';
import{attachSourceActivityFromIndex,attachSourceMaturity,mergeSourceWindows,aggregateSourceRows}from'./source-breakdown';
import{resolveActivityCoverage,sourceScopeCoverageComplete}from'./snapshot-generation';
import{assertScopesSupported,foreignScopeRequested,scopeFingerprint,type AccessMetadata}from'./rbac';
import{assertAffiliateOptimizerAggregateAccess,sourceRowsForAccess}from'./service-scopes';
import{lastLeadByAffiliate,previousWindow,variantTrend,type AffiliateAnalysisWithTrend,type TrendVerdict}from'./affiliate-trend';
import{getSupabaseAdmin}from'./supabase';

/** options.leadMaturityFor: Partner, dessen URL-Verdikte an die Lead-Reife gekoppelt werden (D3) – nur der ausgewählte Partner, damit die Liste keine Conversions je Partner lädt. */
export type LeadMaturityOptions={leadMaturityFor?:string};
export async function getAffiliateOptimizations(period:ReportingPeriod='30d',custom:{from:string;to:string}|undefined,access:AccessMetadata,options?:LeadMaturityOptions){
 assertAffiliateOptimizerAggregateAccess(access);
 const selected=await getDashboard(period,custom,access);
 return gateAffiliates(analyzeAffiliateTraffic(selected),{from:selected.range.from,to:selected.range.to},access,options);
}

/** Reife-Index je Partner und Zeitraum (300 s); Ladefehler → „keine Daten“ (fail-closed in der Engine), wirft nie. */
const maturityWindow=(affiliateId:string,range:{from:string;to:string}):Promise<LeadMaturityIndex>=>unstable_cache(async()=>{const now=new Date(),rows=await loadAffiliateConversionsFromCache(affiliateId,90,now);return buildLeadMaturityIndex(rows,analyzeLeadLatency(rows,now),range,now)},['affiliate-lead-maturity-v2',affiliateId,range.from,range.to],{revalidate:300,tags:['affiliate-source',`affiliate-latency-${affiliateId}`,`affiliate-source-${affiliateId}`]})().catch((error:unknown)=>{console.error(`Lead maturity unavailable for affiliate ${affiliateId}`,error);return noLeadMaturityIndex(range)});
export async function getAffiliateLeadMaturity(affiliateId:string,range:{from:string;to:string},access:AccessMetadata):Promise<LeadMaturityIndex>{
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate']);
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 return maturityWindow(affiliateId,range);
}
export type GatedRecommendation=AffiliateVariant['recommendation']&{gate?:VerdictGate};
const ACTION_ORDER:Record<RecommendationAction,number>={SKALIEREN:0,WEITERLAUFEN:1,'WEITER TESTEN':2,BEOBACHTEN:3,AUSSCHALTEN:4};
/** Spiegelt den Median aus affiliate-optimizer.recommendation (Varianten mit ≥ 10 SOIs und First-Sale-Rate > 0). */
const urlBenchmarkRate=(variants:AffiliateVariant[])=>{const rates=variants.map(v=>v.days30).filter(x=>x.sois>=10&&x.firstSaleRate>0).map(x=>x.firstSaleRate).sort((a,b)=>a-b),median=rates.length?rates[Math.floor(rates.length/2)]:0;return median>0?median/100:undefined};
/** URL-Verdikte eines Partners durch das Reife-Gate D3 (applyLeadMaturity) – gate an jeder Empfehlung, Reihenfolge und Zusammenfassung wie analyzeAffiliateTraffic. */
/** Reife-Auflösung je Offer-URL gegen die SOIs der Berichtszeile; undefined = ungegated (Gate „nicht geprüft“). */
export type UrlMaturityResolver=(offerId:string,offerUrlId:string,reportSois:number)=>LeadMaturityInput|undefined;
export const resolverFromIndex=(index:LeadMaturityIndex):UrlMaturityResolver=>(offerId,offerUrlId,sois)=>urlLeadMaturityForReport(index,offerId,offerUrlId,sois);
export const resolverFromSummary=(summary:LeadYoungSummary):UrlMaturityResolver=>(offerId,offerUrlId,sois)=>urlLeadMaturityFromSummary(summary,offerId,offerUrlId,sois);
/** URL-Verdikte eines Partners durch das Reife-Gate D3 (applyLeadMaturity) – gate an jeder Empfehlung, Reihenfolge und Zusammenfassung wie analyzeAffiliateTraffic. */
export function gateAffiliateAnalysis<T extends AffiliateAnalysis>(analysis:T,maturity:LeadMaturityIndex|UrlMaturityResolver):T{
 const resolve:UrlMaturityResolver=typeof maturity==='function'?maturity:resolverFromIndex(maturity),benchmarkRate=urlBenchmarkRate(analysis.variants);
 const variants=analysis.variants.map(v=>{const m=v.days30,verdict=applyLeadMaturity(v.recommendation,{clicks:m.clicks,sois:m.sois,firstSales:m.firstSales,rebills:m.rebills,profit:m.profit},{api:v.trafficMode==='api',benchmarkRate,leadMaturity:resolve(v.offerId,v.offerUrlId,m.sois)}),recommendation:GatedRecommendation={...v.recommendation,action:verdict.action,severity:verdict.severity,reason:verdict.reason,gate:verdict.gate};return{...v,recommendation}}).sort((a,b)=>ACTION_ORDER[a.recommendation.action]-ACTION_ORDER[b.recommendation.action]||b.days30.profit-a.days30.profit);
 const stop=variants.filter(x=>x.recommendation.action==='AUSSCHALTEN').length,scale=variants.filter(x=>x.recommendation.action==='SKALIEREN').length;
 return{...analysis,variants,bestVariantKey:variants[0]?.key??analysis.bestVariantKey,summary:`${variants.length} direkte Offer-/URL-Varianten · ${stop} Ausschaltkandidaten · ${scale} Skalierungskandidaten`};
}
/** Persistierte Reife-Kurzfassungen aller Partner (Rollups-Cron), 300 s gecacht unter Tag 'lead-maturity'; Fehler → leere Map (Übersicht bleibt ungegated, Gate „nicht geprüft“). */
export const loadLeadYoungSummaries=():Promise<Record<string,LeadYoungSummary>>=>unstable_cache(async()=>{
 const{data,error}=await getSupabaseAdmin().from('sync_state').select('value').gte('key',LEAD_MATURITY_SUMMARY_PREFIX).lt('key',`${LEAD_MATURITY_SUMMARY_PREFIX.slice(0,-1)};`);
 if(error)throw new Error(`Supabase lead maturity summaries: ${error.message}`);
 const out:Record<string,LeadYoungSummary>={};
 for(const item of data||[]){const value=(item as{value:unknown}).value;if(isLeadYoungSummary(value))out[value.affiliateId]=value}
 return out;
},['lead-maturity-summaries-v1'],{revalidate:300,tags:['lead-maturity']})().catch((error:unknown)=>{console.error('Lead maturity summaries unavailable',error);return{} as Record<string,LeadYoungSummary>});
/** Gate für alle sichtbaren Partner: der gewählte Partner (options.leadMaturityFor) bekommt den frischen Index aus seinen Conversions, alle anderen die Kurzfassung des letzten Rollups; ohne Kurzfassung bleibt der Partner ungegated. */
async function gateAffiliates<T extends AffiliateAnalysis>(analyses:T[],range:{from:string;to:string},access:AccessMetadata,options?:LeadMaturityOptions):Promise<T[]>{
 if(!analyses.length)return analyses;
 const selectedId=options?.leadMaturityFor,selectedVisible=Boolean(selectedId&&analyses.some(a=>a.affiliateId===selectedId)&&!foreignScopeRequested(access,{affiliate:selectedId}));
 const[summaries,selectedIndex]=await Promise.all([loadLeadYoungSummaries(),selectedVisible?maturityWindow(selectedId!,range):Promise.resolve(null)]);
 return analyses.map(a=>{if(selectedIndex&&a.affiliateId===selectedId)return gateAffiliateAnalysis(a,selectedIndex);const summary=summaries[a.affiliateId];return summary?gateAffiliateAnalysis(a,resolverFromSummary(summary)):a});
}

const freshnessWindow=(range:{from:string;to:string})=>unstable_cache(()=>loadSourceSnapshotFreshness(range),['affiliate-source-freshness-v1',range.from,range.to],{revalidate:300,tags:['affiliate-source-freshness']})();
const sourceWindow=(affiliateId:string,range:{from:string;to:string},access:AccessMetadata)=>unstable_cache(async()=>sourceRowsForAccess(await loadAffiliateSourceRowsRangeFromCache(range,affiliateId),access),['affiliate-source-supabase-v5',affiliateId,range.from,range.to,scopeFingerprint(access)],{revalidate:300,tags:['affiliate-source',`affiliate-source-${affiliateId}`]})();
const sourceEvaluation=(affiliateId:string,range:{from:string;to:string},activityRange:{from:string;to:string},access:AccessMetadata)=>unstable_cache(async()=>{
 // Aktivität kommt aus dem persistierten Index (eine kleine Abfrage) statt aus 365 Tages-Snapshots; die Reife (D3) aus den Conversions des Partners.
 const [selected,index,freshness,maturity]=await Promise.all([sourceWindow(affiliateId,range,access),loadAffiliateActivityIndex(affiliateId,activityRange),freshnessWindow(activityRange),maturityWindow(affiliateId,range)]);
 return attachSourceMaturity(attachSourceActivityFromIndex(mergeSourceWindows(selected,selected,selected),index,resolveActivityCoverage(activityRange.from,freshness)),maturity);
},['affiliate-source-evaluation-v8',affiliateId,range.from,range.to,activityRange.from,activityRange.to,scopeFingerprint(access)],{revalidate:300,tags:[`affiliate-source-${affiliateId}`,'affiliate-source']})();

export async function getAffiliateSourceBreakdown(affiliateId:string,range:{from:string;to:string},access:AccessMetadata,now=new Date()){
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate','offer','campaign','source','sub_source']);
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 const yearly=resolveSourcePeriod({sourcePeriod:'12m'},now);
 return sourceEvaluation(affiliateId,range,{from:yearly.from,to:yearly.to},access);
}

export async function getAffiliateSourceScopeRows(affiliateId:string,range:{from:string;to:string},access:AccessMetadata){
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate','offer','campaign','source','sub_source']);
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 const[rows,freshness]=await Promise.all([loadAffiliateSourceRowsRangeFromCache(range,affiliateId).then(items=>sourceRowsForAccess(items,access)),freshnessWindow(range)]);
 if(!sourceScopeCoverageComplete(range,freshness))throw new Error('Source-Historie ist unvollständig. Keine Änderung durchgeführt.');
 return rows;
}

export async function getAffiliateSourceFreshness(range:{from:string;to:string}){
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 return freshnessWindow(range);
}

export const getAffiliateLeadLatency=(affiliateId:string,access:AccessMetadata)=>{
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate']);
 return unstable_cache(async()=>analyzeLeadLatency(await loadAffiliateConversionsFromCache(affiliateId,90)),['affiliate-lead-latency-cache',affiliateId,scopeFingerprint(access),'90d'],{revalidate:900,tags:[`affiliate-latency-${affiliateId}`]})();
};

const NO_COMPARISON:TrendVerdict={status:'insufficient',reason:'Kein Vergleichszeitraum in der 365-Tage-Historie'};

export async function getAffiliateOptimizationsWithTrend(period:ReportingPeriod,custom:{from:string;to:string}|undefined,access:AccessMetadata,range:{from:string;to:string},options?:LeadMaturityOptions):Promise<AffiliateAnalysisWithTrend[]>{
 assertAffiliateOptimizerAggregateAccess(access);
 return gateAffiliates(await optimizationsWithTrend(period,custom,access,range),range,access,options);
}
async function optimizationsWithTrend(period:ReportingPeriod,custom:{from:string;to:string}|undefined,access:AccessMetadata,range:{from:string;to:string}):Promise<AffiliateAnalysisWithTrend[]>{
 const comparable=period!=='12m'&&period!=='all',prev=comparable?previousWindow(range.from,range.to):null;
 // Vorfenster ist historisch: eigener Langzeit-Cache statt der 60s des Live-Portfolios,
 // und parallel zum Hauptfenster geladen statt danach.
 const previousPortfolioCached=prev?unstable_cache(()=>getDashboard('custom',prev,access),['affiliate-trend-previous-v1',prev.from,prev.to,scopeFingerprint(access)],{revalidate:3600,tags:['supabase-portfolio']}):null;
 const[current,previousPortfolio]=await Promise.all([getDashboard(period,custom,access),previousPortfolioCached?previousPortfolioCached():Promise.resolve(null)]);
 const analyses=analyzeAffiliateTraffic(current);
 if(!previousPortfolio)
  return analyses.map(a=>({...a,variants:a.variants.map(v=>({...v,trendVerdict:NO_COMPARISON}))}));
 const before=new Map(analyzeAffiliateTraffic(previousPortfolio)
  .flatMap(a=>a.variants.map(v=>[`${a.affiliateId}|${v.key}`,v.days30] as const)));
 return analyses.map(a=>({...a,variants:a.variants.map(v=>({...v,trendVerdict:variantTrend(v.days30,before.get(`${a.affiliateId}|${v.key}`))}))}));
}

/** Jüngster SOI-Tag je Affiliate im Zeitraum — für die "Letzter Lead"-Badges der Partnerlisten. */
export function getAffiliateLastLeadDates(range:{from:string;to:string}){
 return unstable_cache(async()=>{
  const rows:Array<{affiliate_id:string;metric_date:string;sois:number|string}>=[];
  for(let start=0;;start+=1000){
   const{data,error}=await getSupabaseAdmin().from('daily_metrics').select('affiliate_id,metric_date,sois').gt('sois',0).gte('metric_date',range.from).lte('metric_date',range.to).order('metric_date',{ascending:false}).order('id').range(start,start+999);
   if(error)throw new Error(`Supabase last-lead dates: ${error.message}`);
   rows.push(...(data||[]));
   if(!data||data.length<1000)break;
   if(rows.length>=20000)break;
  }
  return Object.fromEntries(lastLeadByAffiliate(rows));
 },['affiliate-last-lead-v1',range.from,range.to],{revalidate:300,tags:['supabase-portfolio']})();
}

/** Etappe 3: Tagesprofit je Tracker-Kandidat des Partners (Schlüssel wie candidateItemKey) für Sparklines – nur Fenster ≤ 45 Tage, 300 s gecacht, wirft bei fremdem Scope. */
export async function getAffiliateDailyByKey(affiliateId:string,range:{from:string;to:string},access:AccessMetadata):Promise<DailyByKey|undefined>{
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate','offer','campaign','source','sub_source']);
 if(!range.from||!range.to||rangeDayCount({from:range.from,to:range.to})>DAILY_SERIES_MAX_DAYS)return undefined;
 return unstable_cache(async()=>{
  const rows=await sourceWindow(affiliateId,range,access),byDate=new Map<string,typeof rows>();
  for(const row of rows){const date=row.columns.find(column=>column.column_type==='date')?.id||'';if(!date)continue;(byDate.get(date)??byDate.set(date,[]).get(date)!).push(row)}
  const dates=dateRange(range.from,range.to),points:Array<{date:string;key:string;value:number}>=[];
  for(const[date,dayRows]of byDate)for(const leaf of aggregateSourceRows(dayRows))points.push({date,key:candidateDailyKey(leaf),value:leaf.metric.profit});
  return dailySeriesByKey(points,dates);
 },['affiliate-daily-by-key-v1',affiliateId,range.from,range.to,scopeFingerprint(access)],{revalidate:300,tags:['affiliate-source',`affiliate-source-${affiliateId}`]})();
}
/** Etappe 3: Tagesprofit je Direkt-Variante aller sichtbaren Partner (Cockpit-Sparklines), 300 s gecacht; undefined für Fenster > 45 Tage oder ohne lückenlose Tages-Snapshots. */
export async function getPortfolioDailyByVariant(range:{from:string;to:string},access:AccessMetadata):Promise<DailyByKey|undefined>{
 if(!range.from||!range.to||rangeDayCount({from:range.from,to:range.to})>DAILY_SERIES_MAX_DAYS)return undefined;
 return unstable_cache(()=>loadPortfolioDailyVariantProfitFromCache(getSupabaseAdmin(),{from:range.from,to:range.to,label:''},access),['portfolio-daily-variant-v1',range.from,range.to,scopeFingerprint(access)],{revalidate:300,tags:['supabase-portfolio']})();
}
