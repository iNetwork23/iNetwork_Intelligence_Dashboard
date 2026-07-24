import{NextRequest,NextResponse}from'next/server';
import{acquireHistorySyncLock,getSupabaseAdmin}from'@/lib/supabase';
import{refreshLongPortfolioRangeSnapshots}from'@/lib/supabase-reporting';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=240;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);

export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Nicht autorisiert'},{status:401});
 try{
  const release=await acquireHistorySyncLock();
  try{return NextResponse.json({snapshots:await refreshLongPortfolioRangeSnapshots(getSupabaseAdmin())})}
  finally{await release()}
 }
 catch(error){console.error('Supabase range rollup failed',error);return NextResponse.json({error:'Range-Snapshots konnten nicht aktualisiert werden'},{status:500})}
}
