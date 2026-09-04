import{NextRequest,NextResponse}from'next/server';
import{acquireHistorySyncLock,getSupabaseAdmin}from'@/lib/supabase';
import{refreshLongPortfolioRangeSnapshots,reportingRange}from'@/lib/supabase-reporting';
import{publishSourceCandidates}from'@/lib/source-candidates';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=240;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);
/** Quell-Kandidaten laufen nach den Portfolio-Rollups im Restbudget der Route (maxDuration 240): mindestens 30 s, sonst bis 200 s Gesamtlaufzeit. */
export const sourceCandidateBudgetMs=(elapsedMs:number)=>Math.max(30_000,200_000-elapsedMs);
type CandidateResult={rows:number;coverageComplete:boolean}|{error:string};
async function publishSourceCandidateRanges(started:number){
 const sourceCandidates:Record<'7d'|'30d',CandidateResult>={'7d':{error:'nicht gestartet'},'30d':{error:'nicht gestartet'}};
 for(const period of['7d','30d']as const){
  try{const range=reportingRange(period);sourceCandidates[period]=await publishSourceCandidates({from:range.from!,to:range.to},{timeBudgetMs:sourceCandidateBudgetMs(Date.now()-started)})}
  catch(error){console.error(`Source candidates ${period} failed`,error);sourceCandidates[period]={error:error instanceof Error?error.message:'Quell-Kandidaten konnten nicht berechnet werden'}}
 }
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
