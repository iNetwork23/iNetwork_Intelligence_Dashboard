import{NextRequest,NextResponse}from'next/server';
import{revalidateTag}from'next/cache';
import{runFraudConversionSync}from'@/lib/fraud-backfill-service';
import{acquireHistorySyncLock}from'@/lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);

export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Nicht autorisiert'},{status:401});
 try{
  const release=await acquireHistorySyncLock();
  try{const fraud=await runFraudConversionSync();revalidateTag('affiliate-source',{expire:0});revalidateTag('affiliate-source-freshness',{expire:0});revalidateTag('fraud-dashboard',{expire:0});return NextResponse.json({operation:'scheduled-fraud-conversion-backfill',...fraud})}
  finally{await release()}
 }
 catch(error){console.error('Everflow fraud sync failed',error);return NextResponse.json({error:'Fraud-Sync fehlgeschlagen'},{status:500})}
}