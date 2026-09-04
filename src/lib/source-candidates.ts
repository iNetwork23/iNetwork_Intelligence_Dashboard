import{unstable_cache}from'next/cache';
import{getSupabaseAdmin}from'./supabase';
import{loadPortfolioFromCache}from'./supabase-reporting';
import{loadAffiliateActivityIndex,loadAffiliateConversionsFromCache,loadAffiliateSourceRowsRangeFromCache,loadSourceSnapshotFreshness}from'./cached-evaluations';
import{analyzeLeadLatency}from'./lead-latency';
import{buildLeadMaturityIndex,leadMaturitySummaryKey,noLeadMaturityIndex,summarizeLeadMaturity,type LeadMaturityIndex}from'./lead-maturity';
import type{ConversionRow}from'./everflow';
import type{VerdictGate}from'./decision-engine';
import{resolveActivityCoverage}from'./snapshot-generation';
import{resolveSourcePeriod}from'./source-period';
import{aggregateSourceRows,attachSourceActivityFromIndex,attachSourceMaturity,groupSources,leadActivityStatus,mergeSourceWindows,type SourceBreakdownRow,type TrafficLeaf}from'./source-breakdown';
import{filterPartnerRows,type AccessMetadata}from'./rbac';
import type{ReportRow}from'./portfolio';

/** Accountweite Quell-Kandidaten (Blätter mit Handlungsbedarf) für den Leitstand – im Rollups-Cron je Zeitraum vorberechnet. */
export type SourceCandidate={affiliateId:string;affiliate:string;offerId:string;offer:string;offerUrlId:string;offerUrl:string;trafficMode:'tracked'|'api';level:'main_source'|'sub_source';mainValue:string|null;subValue:string|null;action:'SKALIEREN'|'BEOBACHTEN'|'AUSSCHALTEN';severity:'positive'|'neutral'|'warning'|'critical';reason:string;clicks:number;sois:number;firstSales:number;rebills:number;revenue:number;payout:number;profit:number;lastLeadDate:string|null;leadStatus:string|null;/** „Trauen oder nicht, und warum“ (Etappe 3); ältere Snapshots tragen kein gate. */gate?:VerdictGate;/** Letzte 7 Tage gegen die 7 Tage davor (aus den Tageszeilen des Rollups); ältere Snapshots tragen keinen trend. */trend?:SourceCandidateTrend};
export type SourceCandidateTrend={days:7;current:{sois:number;clicks:number;profit:number};previous:{sois:number;clicks:number;profit:number};profitDelta:number;soisDelta:number;clicksDelta:number};
export type SourceCandidatesSnapshot={version:1;range:{from:string;to:string};generatedAt:string;affiliates:number;affiliatesProcessed:number;coverageComplete:boolean;rows:SourceCandidate[];rowsTruncated?:boolean;/** Partner, deren Reife (Conversions) nicht ladbar war – ihre Ausschalt-Kandidaten stehen fail-closed auf BEOBACHTEN. */maturityUnavailable?:number};
export type SourceCandidateBuildOptions={now?:Date;timeBudgetMs?:number;/** Conversions je Partner (Memo über mehrere Zeiträume eines Cron-Laufs); Default loadAffiliateConversionsFromCache. */conversionsFor?:(affiliateId:string,now:Date)=>Promise<ConversionRow[]>;/** Reife-Kurzfassung je Partner persistieren (lead_maturity:v1:{affiliateId}) – einmal je Cron-Lauf. */persistMaturity?:boolean;/** Reserve, um die ein laufender Partner-Load das Budget überziehen darf (Default AFFILIATE_LOAD_GRACE_MS). */loadGraceMs?:number};
/** D10: Deckel je Aktion (Verluste zuerst), damit Snapshot, Cache-Eintrag und RSC-Payload begrenzt bleiben. */
export const CANDIDATE_ROW_LIMITS:Record<SourceCandidate['action'],number>={AUSSCHALTEN:800,BEOBACHTEN:400,SKALIEREN:300};
export function capSourceCandidates(rows:SourceCandidate[]):{rows:SourceCandidate[];truncated:boolean}{const kept:SourceCandidate[]=[],seen:Record<string,number>={};let truncated=false;for(const row of rows){const count=seen[row.action]??0;if(count>=CANDIDATE_ROW_LIMITS[row.action]){truncated=true;continue}seen[row.action]=count+1;kept.push(row)}return{rows:kept,truncated}}
export const sourceCandidatesKey=(range:{from:string;to:string})=>`source_candidates:v1:${range.from}:${range.to}`;
export const DEFAULT_CANDIDATE_TIME_BUDGET_MS=150_000,CANDIDATE_CONCURRENCY=4;
const WINDOW='days30' as const;
const money=(value:number)=>Math.round(value*100)/100;
const isCandidate=(leaf:TrafficLeaf)=>leaf.assessment.action!=='BEOBACHTEN'||leaf.metric.profit<0;
const label=(row:ReportRow,type:string)=>row.columns.find(c=>c.column_type===type);
type Labels={affiliate:string;paths:Map<string,{offer:string;offerUrl:string}>};
/** Offer-/URL-Namen aus den Tageszeilen (aggregateSourceRows behält nur IDs). */
export function collectSourceLabels(rows:ReportRow[],fallbackAffiliate=''):Labels{const paths=new Map<string,{offer:string;offerUrl:string}>();let affiliate=fallbackAffiliate;for(const row of rows){const offer=label(row,'offer'),url=label(row,'offer_url'),aff=label(row,'affiliate');if(aff?.label&&aff.label!=='N/A')affiliate=aff.label;if(!offer||!url)continue;const key=`${offer.id}|${url.id}`;if(!paths.has(key)||paths.get(key)!.offer==='N/A')paths.set(key,{offer:offer.label||offer.id,offerUrl:url.label||url.id})}return{affiliate,paths}}
const DAY_MS=86_400_000,shiftDay=(day:string,days:number)=>new Date(Date.parse(`${day}T12:00:00Z`)+days*DAY_MS).toISOString().slice(0,10);
const trendKey=(row:{pathKey:string;trafficMode:string;mainValue:string|null;subValue:string|null})=>`${row.pathKey}|${row.trafficMode}|${row.mainValue||''}|${row.subValue||''}`;
/** Beide Trendfenster (14 Kalendertage bis `to`) müssen im geladenen Zeitraum liegen; sonst gäbe es keine Vorperiode. */
export const rangeCoversTrend=(range:{from:string;to:string})=>range.from<=shiftDay(range.to,-13);
/** Trend je Blatt aus den Tageszeilen: letzte 7 Kalendertage bis `to` gegen die 7 Tage davor (Schlüssel wie candidateItemKey). */
export function sourceTrendsFromRows(raw:ReportRow[],to:string):Map<string,SourceCandidateTrend>{
 const currentFrom=shiftDay(to,-6),previousFrom=shiftDay(to,-13),previousTo=shiftDay(to,-7),current:ReportRow[]=[],previous:ReportRow[]=[];
 for(const row of raw){const date=label(row,'date')?.id||'';if(date>=currentFrom&&date<=to)current.push(row);else if(date>=previousFrom&&date<=previousTo)previous.push(row)}
 const sum=(rows:ReportRow[])=>new Map(aggregateSourceRows(rows).map(leaf=>[trendKey(leaf),{sois:leaf.metric.sois,clicks:leaf.metric.clicks,profit:money(leaf.metric.profit)}]));
 const now=sum(current),before=sum(previous),zero={sois:0,clicks:0,profit:0},out=new Map<string,SourceCandidateTrend>();
 for(const key of new Set([...now.keys(),...before.keys()])){const a=now.get(key)||zero,b=before.get(key)||zero;out.set(key,{days:7,current:a,previous:b,profitDelta:money(a.profit-b.profit),soisDelta:a.sois-b.sois,clicksDelta:a.clicks-b.clicks})}
 return out;
}
/** Reine Bewertung: dieselbe Blattlogik wie die Partnerseite (groupSources je Offer-URL auf dem 30-Tage-Fenster), gefiltert auf Handlungsbedarf; trends (optional) hängt den 7-Tage-Vergleich an. */
export function evaluateSourceCandidates(rows:SourceBreakdownRow[],labels:Labels,trends?:Map<string,SourceCandidateTrend>):SourceCandidate[]{
 const byUrl=new Map<string,SourceBreakdownRow[]>();for(const row of rows){const key=`${row.trafficMode}|${row.offerId}|${row.offerUrlId}`;const bucket=byUrl.get(key);if(bucket)bucket.push(row);else byUrl.set(key,[row])}
 const out:SourceCandidate[]=[];
 for(const bucket of byUrl.values()){const first=bucket[0],names=labels.paths.get(`${first.offerId}|${first.offerUrlId}`)||{offer:first.offerId,offerUrl:first.offerUrlId};
  for(const group of groupSources(bucket,WINDOW,'sois'))for(const leaf of group.leaves){if(!isCandidate(leaf))continue;
   const source=leaf.subSource===null?bucket.find(row=>row.sourceId===group.sourceId):bucket.find(row=>row.sourceId===group.sourceId&&row.subSource===leaf.subSource),m=leaf.metric,severity=leaf.assessment.action==='BEOBACHTEN'?'warning':leaf.assessment.severity;
   out.push({affiliateId:first.affiliateId,affiliate:labels.affiliate,offerId:first.offerId,offer:names.offer,offerUrlId:first.offerUrlId,offerUrl:names.offerUrl,trafficMode:first.trafficMode,level:leaf.subSource===null?'main_source':'sub_source',mainValue:source?.mainValue??null,subValue:leaf.subSource===null?null:source?.subValue??null,action:leaf.assessment.action,severity,reason:leaf.assessment.reason,clicks:m.clicks,sois:m.sois,firstSales:m.firstSales,rebills:m.rebills,revenue:money(m.revenue),payout:money(m.payout),profit:money(m.profit),lastLeadDate:leaf.activity.lastLeadDate,leadStatus:leaf.activity.asOf?leadActivityStatus(leaf.activity).label:null,...(leaf.assessment.gate?{gate:leaf.assessment.gate}:{}),...(()=>{const trend=trends?.get(trendKey({pathKey:first.pathKey,trafficMode:first.trafficMode,mainValue:source?.mainValue??null,subValue:leaf.subSource===null?null:source?.subValue??null}));return trend?{trend}:{}})()})}}
 return out.sort((a,b)=>a.profit-b.profit||a.affiliateId.localeCompare(b.affiliateId)||a.offerUrlId.localeCompare(b.offerUrlId));
}
/** Accountweit mit Systemzugriff (ohne Partner-Scope): Affiliates aus dem Portfolio des Zeitraums, je Affiliate bestehende Cache-Leser; Fehler je Affiliate überspringen, Zeitbudget einhalten. */
/** Ein Partner-Load darf das Restbudget nur um diese Reserve überziehen; danach zählt er als übersprungen (coverageComplete=false). */
export const AFFILIATE_LOAD_GRACE_MS=15_000;
const rejectAfter=(ms:number,message:string)=>new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error(message)),Math.max(1_000,ms)).unref?.());
export async function buildSourceCandidatesSnapshot(range:{from:string;to:string},options?:SourceCandidateBuildOptions):Promise<SourceCandidatesSnapshot>{
 const now=options?.now||new Date(),budget=options?.timeBudgetMs??DEFAULT_CANDIDATE_TIME_BUDGET_MS,started=Date.now(),exhausted=()=>Date.now()-started>=budget,remaining=()=>budget-(Date.now()-started),conversionsFor=options?.conversionsFor??((affiliateId:string,at:Date)=>loadAffiliateConversionsFromCache(affiliateId,90,at));
 const yearly=resolveSourcePeriod({sourcePeriod:'12m'},now),activityRange={from:yearly.from,to:yearly.to};
 const[portfolio,freshness]=await Promise.all([loadPortfolioFromCache('custom',getSupabaseAdmin(),now,range),loadSourceSnapshotFreshness(activityRange)]);
 const coverage=resolveActivityCoverage(activityRange.from,freshness),affiliates=[...portfolio.affiliates].sort((a,b)=>b.sois-a.sois||b.clicks-a.clicks||a.id.localeCompare(b.id)),rows:SourceCandidate[]=[];
 let processed=0,failed=0,maturityUnavailable=0,cursor=0;
 /** Reife-Index (D3) aus den Conversions des Partners; Fehler → „keine Daten“ (fail-closed, gezählt), der Partner wird trotzdem bewertet. */
 const loadMaturity=async(affiliateId:string):Promise<{index:LeadMaturityIndex;unavailable:boolean}>=>{try{const conversions=await conversionsFor(affiliateId,now);return{index:buildLeadMaturityIndex(conversions,analyzeLeadLatency(conversions,now),range,now),unavailable:false}}catch(error){console.error(`Source candidates: lead maturity unavailable for affiliate ${affiliateId}`,error);return{index:noLeadMaturityIndex(range,now),unavailable:true}}};
 const persistMaturity=async(affiliateId:string,index:LeadMaturityIndex)=>{if(!options?.persistMaturity||index.confidence==='keine Daten')return;try{const{error}=await getSupabaseAdmin().from('sync_state').upsert({key:leadMaturitySummaryKey(affiliateId),value:summarizeLeadMaturity(index,affiliateId)},{onConflict:'key'});if(error)throw new Error(error.message)}catch(error){console.error(`Source candidates: lead maturity summary not persisted for affiliate ${affiliateId}`,error)}};
 const worker=async()=>{while(cursor<affiliates.length&&!exhausted()){const affiliate=affiliates[cursor++];
  try{const[raw,index,maturity]=await Promise.race([Promise.all([loadAffiliateSourceRowsRangeFromCache(range,affiliate.id),loadAffiliateActivityIndex(affiliate.id,activityRange),loadMaturity(affiliate.id)]),rejectAfter(remaining()+(options?.loadGraceMs??AFFILIATE_LOAD_GRACE_MS),`Zeitbudget für Partner ${affiliate.id} überschritten`)]),evaluated=attachSourceMaturity(attachSourceActivityFromIndex(mergeSourceWindows([],[],raw),index,coverage),maturity.index);rows.push(...evaluateSourceCandidates(evaluated,collectSourceLabels(raw,affiliate.name),rangeCoversTrend(range)?sourceTrendsFromRows(raw,range.to):undefined));processed++;if(maturity.unavailable)maturityUnavailable++;else await persistMaturity(affiliate.id,maturity.index)}
  catch(error){failed++;console.error(`Source candidates skipped affiliate ${affiliate.id}`,error)}}};
 await Promise.all(Array.from({length:Math.min(CANDIDATE_CONCURRENCY,Math.max(1,affiliates.length))},worker));
 rows.sort((a,b)=>a.profit-b.profit||a.affiliateId.localeCompare(b.affiliateId)||a.offerUrlId.localeCompare(b.offerUrlId));
 const capped=capSourceCandidates(rows.filter(row=>row.action!=='SKALIEREN').concat([...rows.filter(row=>row.action==='SKALIEREN')].sort((a,b)=>b.profit-a.profit)));
 capped.rows.sort((a,b)=>a.profit-b.profit||a.affiliateId.localeCompare(b.affiliateId)||a.offerUrlId.localeCompare(b.offerUrlId));
 return{version:1,range:{from:range.from,to:range.to},generatedAt:new Date().toISOString(),affiliates:affiliates.length,affiliatesProcessed:processed,coverageComplete:processed===affiliates.length&&failed===0,rows:capped.rows,...(capped.truncated?{rowsTruncated:true}:{}),...(maturityUnavailable?{maturityUnavailable}:{})};
}
/** build + upsert sync_state {key:sourceCandidatesKey(range),value:snapshot}. */
/** Ein unvollständiger Lauf (Zeitbudget) überschreibt einen vollständigen Snapshot erst, wenn dieser älter als 6 h ist; der Leitstand zeigt das Rollup-Alter ohnehin an. */
export const INCOMPLETE_OVERWRITE_AFTER_MS=6*60*60_000;
export async function publishSourceCandidates(range:{from:string;to:string},options?:SourceCandidateBuildOptions):Promise<{rows:number;coverageComplete:boolean;kept?:boolean;maturityUnavailable?:number}>{
 const snapshot=await buildSourceCandidatesSnapshot(range,options);
 if(!snapshot.coverageComplete){const previous=await readStoredSnapshot(range).catch(()=>null);if(previous?.coverageComplete&&Date.parse(snapshot.generatedAt)-Date.parse(previous.generatedAt)<INCOMPLETE_OVERWRITE_AFTER_MS)return{rows:previous.rows.length,coverageComplete:true,kept:true}}
 const{error}=await getSupabaseAdmin().from('sync_state').upsert({key:sourceCandidatesKey(range),value:snapshot},{onConflict:'key'});
 if(error)throw new Error(`Supabase source candidates: ${error.message}`);
 return{rows:snapshot.rows.length,coverageComplete:snapshot.coverageComplete,...(snapshot.maturityUnavailable?{maturityUnavailable:snapshot.maturityUnavailable}:{})};
}
export const isValidSourceCandidatesSnapshot=(value:unknown,range:{from:string;to:string}):value is SourceCandidatesSnapshot=>{const s=value as SourceCandidatesSnapshot|undefined;return Boolean(s&&s.version===1&&s.range?.from===range.from&&s.range?.to===range.to&&Array.isArray(s.rows)&&typeof s.generatedAt==='string')};
const scopedRow=(row:SourceCandidate)=>({row,affiliate_id:row.affiliateId,offer_id:row.offerId,campaign_id:'0',source_id:row.mainValue??'',sub_source:row.subValue??''});
/** Partner-Scope wie rbac.filterPartnerRows: leerer Scope → keine Zeilen; jede gesetzte Scope-Dimension muss passen. */
export const scopeSourceCandidates=(rows:SourceCandidate[],access:AccessMetadata)=>access.role==='partner'?filterPartnerRows(rows.map(scopedRow),access).map(x=>x.row):rows;
/** Snapshots vor der Vokabular-Umstellung (D13) tragen noch das alte Urteilswort; beim Lesen wird es angeglichen. */
const LEGACY_KILL_WORD='AB'+'SCHALTEN';
export const normalizeSourceCandidatesSnapshot=(snapshot:SourceCandidatesSnapshot):SourceCandidatesSnapshot=>snapshot.rows.some(row=>(row.action as string)===LEGACY_KILL_WORD)?{...snapshot,rows:snapshot.rows.map(row=>(row.action as string)===LEGACY_KILL_WORD?{...row,action:'AUSSCHALTEN'}:row)}:snapshot;
async function readStoredSnapshot(range:{from:string;to:string}):Promise<SourceCandidatesSnapshot|null>{
 const{data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key',sourceCandidatesKey(range)).maybeSingle();
 if(error)throw new Error(`Supabase source candidates: ${error.message}`);
 return isValidSourceCandidatesSnapshot(data?.value,range)?normalizeSourceCandidatesSnapshot(data.value):null;
}
const loadSnapshot=(range:{from:string;to:string})=>unstable_cache(()=>readStoredSnapshot(range),['source-candidates-v1',range.from,range.to],{revalidate:120,tags:['source-candidates']})();
/** Liest den vorberechneten Key (120 s Cache); fehlt er → null (fail-closed). Partner sehen nur Zeilen im eigenen Scope. */
export async function loadSourceCandidates(range:{from:string;to:string},access:AccessMetadata):Promise<SourceCandidatesSnapshot|null>{
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 const snapshot=await loadSnapshot(range);
 if(!snapshot)return null;
 return access.role==='partner'?{...snapshot,rows:scopeSourceCandidates(snapshot.rows,access)}:snapshot;
}

/** Memo für einen Cron-Lauf: Conversions je Partner einmal laden (beide Zeiträume nutzen dieselben 90 Tage); Fehler werden nicht memoisiert. */
export function memoizedConversionsLoader(load:(affiliateId:string,now:Date)=>Promise<ConversionRow[]>=(affiliateId,now)=>loadAffiliateConversionsFromCache(affiliateId,90,now)){
 const memo=new Map<string,Promise<ConversionRow[]>>();
 const conversionsFor=(affiliateId:string,now:Date)=>{let pending=memo.get(affiliateId);if(!pending){pending=load(affiliateId,now);memo.set(affiliateId,pending);pending.catch(()=>memo.delete(affiliateId))}return pending};
 return{conversionsFor,clear:()=>memo.clear(),size:()=>memo.size};
}
