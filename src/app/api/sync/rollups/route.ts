import{NextRequest,NextResponse}from'next/server';
import{revalidateTag}from'next/cache';
import{acquireHistorySyncLock,getSupabaseAdmin}from'@/lib/supabase';
import{refreshLongPortfolioRangeSnapshots,reportingRange}from'@/lib/supabase-reporting';
import{publishSourceCandidatesBatch}from'@/lib/source-candidates';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=240;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);
/** Both source ranges share one affiliate read pass within the remaining 180-second budget; the route retains its existing 240-second limit. */
export const CANDIDATE_TOTAL_BUDGET_MS=180_000;
export const sourceCandidateBudgetMs=(elapsedMs:number,rangesLeft=1)=>Math.max(15_000,Math.floor(Math.max(0,CANDIDATE_TOTAL_BUDGET_MS-elapsedMs)/Math.max(1,rangesLeft)));
const CANDIDATE_PERIODS=['30d','7d']as const;
type CandidateResult={rows:number;coverageComplete:boolean}|{error:string};
async function publishSourceCandidateRanges(started:number){
 const sourceCandidates:Record<'7d'|'30d',CandidateResult>={'7d':{error:'nicht gestartet'},'30d':{error:'nicht gestartet'}};
 const rangeStarted=Date.now();
 try{
  const ranges=CANDIDATE_PERIODS.map(period=>{const range=reportingRange(period);return{from:range.from!,to:range.to}});
  const results=await publishSourceCandidatesBatch(ranges,{timeBudgetMs:sourceCandidateBudgetMs(rangeStarted-started),persistMaturity:true});
  for(const[index,period]of CANDIDATE_PERIODS.entries()){
   sourceCandidates[period]=results[index];
   if('error'in results[index])console.error(`Source candidates ${period} failed`,results[index]);
   else console.info(`Source candidates ${period}: ${JSON.stringify(results[index])} in shared pass ${Date.now()-rangeStarted} ms (route elapsed ${Date.now()-started} ms)`);
  }
 }catch(error){
  console.error('Shared source candidate pass failed',error);
  for(const period of CANDIDATE_PERIODS)sourceCandidates[period]={error:error instanceof Error?error.message:'Quell-Kandidaten konnten nicht berechnet werden'};
 }
 try{revalidateTag('source-candidates',{expire:0});revalidateTag('lead-maturity',{expire:0})}catch(error){console.error('Source candidates revalidate failed',error)}
 return sourceCandidates;
}

export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Nicht autorisiert'},{status:401});
 try{
  const release=await acquireHistorySyncLock();
  try{
   const started=Date.now(),{snapshots,incompleteRanges}=await refreshLongPortfolioRangeSnapshots(getSupabaseAdmin());
   const portfolioComplete=incompleteRanges.length===0;
   return NextResponse.json({snapshots,incompleteRanges,portfolioComplete,sourceCandidates:await publishSourceCandidateRanges(started)},{status:portfolioComplete?200:503});
  }
  finally{await release()}
 }
 catch(error){console.error('Supabase range rollup failed',error);return NextResponse.json({error:'Range-Snapshots konnten nicht aktualisiert werden'},{status:500})}
}
