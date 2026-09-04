import{NextRequest,NextResponse}from'next/server';
import{revalidateTag}from'next/cache';
import{acquireHistorySyncLock,getSupabaseAdmin}from'@/lib/supabase';
import{refreshLongPortfolioRangeSnapshots,reportingRange}from'@/lib/supabase-reporting';
import{publishSourceCandidates}from'@/lib/source-candidates';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=240;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);
/** Quell-Kandidaten laufen nach den Portfolio-Rollups im Restbudget der Route (maxDuration 240): 30 Tage zuerst (Leitstand-Standard, D5); das Restbudget bis 200 s Gesamtlaufzeit wird gleichmäßig auf die verbleibenden Zeiträume verteilt, mindestens 15 s je Zeitraum. */
export const sourceCandidateBudgetMs=(elapsedMs:number,rangesLeft=1)=>Math.max(15_000,Math.floor(Math.max(0,200_000-elapsedMs)/Math.max(1,rangesLeft)));
const CANDIDATE_PERIODS=['30d','7d']as const;
type CandidateResult={rows:number;coverageComplete:boolean}|{error:string};
async function publishSourceCandidateRanges(started:number){
 const sourceCandidates:Record<'7d'|'30d',CandidateResult>={'7d':{error:'nicht gestartet'},'30d':{error:'nicht gestartet'}};
 for(const[index,period]of CANDIDATE_PERIODS.entries()){
  try{const range=reportingRange(period);sourceCandidates[period]=await publishSourceCandidates({from:range.from!,to:range.to},{timeBudgetMs:sourceCandidateBudgetMs(Date.now()-started,CANDIDATE_PERIODS.length-index)})}
  catch(error){console.error(`Source candidates ${period} failed`,error);sourceCandidates[period]={error:error instanceof Error?error.message:'Quell-Kandidaten konnten nicht berechnet werden'}}
 }
 try{revalidateTag('source-candidates',{expire:0})}catch(error){console.error('Source candidates revalidate failed',error)}
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
