import{NextRequest,NextResponse}from'next/server';
import{revalidateTag}from'next/cache';
import{acquireHistorySyncLock,getSupabaseAdmin}from'@/lib/supabase';
import{refreshLongPortfolioRangeSnapshots,reportingRange}from'@/lib/supabase-reporting';
import{memoizedConversionsLoader,publishSourceCandidates}from'@/lib/source-candidates';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=240;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);
/** Quell-Kandidaten laufen nach den Portfolio-Rollups im Restbudget der Route (maxDuration 240): 30 Tage zuerst (Leitstand-Standard, D5); das Restbudget bis 180 s Gesamtlaufzeit wird gleichmäßig auf die verbleibenden Zeiträume verteilt, mindestens 15 s je Zeitraum; 60 s bleiben als Reserve für laufende Partner-Loads und den Upsert. */
export const CANDIDATE_TOTAL_BUDGET_MS=180_000;
export const sourceCandidateBudgetMs=(elapsedMs:number,rangesLeft=1)=>Math.max(15_000,Math.floor(Math.max(0,CANDIDATE_TOTAL_BUDGET_MS-elapsedMs)/Math.max(1,rangesLeft)));
const CANDIDATE_PERIODS=['30d','7d']as const;
type CandidateResult={rows:number;coverageComplete:boolean}|{error:string};
async function publishSourceCandidateRanges(started:number){
 const sourceCandidates:Record<'7d'|'30d',CandidateResult>={'7d':{error:'nicht gestartet'},'30d':{error:'nicht gestartet'}};
 // Conversions je Partner nur einmal je Lauf laden (beide Zeiträume nutzen dieselben 90 Tage); Reife-Kurzfassung nur im ersten Zeitraum persistieren; Memo nach dem letzten Zeitraum freigeben.
 const memo=memoizedConversionsLoader(),conversionsFor=memo.conversionsFor;
 for(const[index,period]of CANDIDATE_PERIODS.entries()){
  const rangeStarted=Date.now();
  try{const range=reportingRange(period);sourceCandidates[period]=await publishSourceCandidates({from:range.from!,to:range.to},{timeBudgetMs:sourceCandidateBudgetMs(rangeStarted-started,CANDIDATE_PERIODS.length-index),conversionsFor,persistMaturity:index===0});console.info(`Source candidates ${period}: ${JSON.stringify(sourceCandidates[period])} in ${Date.now()-rangeStarted} ms (route elapsed ${Date.now()-started} ms)`)}
  catch(error){console.error(`Source candidates ${period} failed`,error);sourceCandidates[period]={error:error instanceof Error?error.message:'Quell-Kandidaten konnten nicht berechnet werden'}}
 }
 memo.clear();
 try{revalidateTag('source-candidates',{expire:0});revalidateTag('lead-maturity',{expire:0})}catch(error){console.error('Source candidates revalidate failed',error)}
 return sourceCandidates;
}

export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Nicht autorisiert'},{status:401});
 try{
  const release=await acquireHistorySyncLock();
  try{const started=Date.now(),snapshots=await refreshLongPortfolioRangeSnapshots(getSupabaseAdmin());return NextResponse.json({snapshots,sourceCandidates:await publishSourceCandidateRanges(started)})}
  finally{await release()}
 }
 catch(error){console.error('Supabase range rollup failed',error);return NextResponse.json({error:'Range-Snapshots konnten nicht aktualisiert werden'},{status:500})}
}
