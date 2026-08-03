import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '@/lib/session';
import {createEverflowHistorySource} from '@/lib/everflow-history';
import {runHistorySync} from '@/lib/history-cache';
import {createSupabaseSyncStore} from '@/lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

async function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(secret&&request.headers.get('authorization')===`Bearer ${secret}`)return true;
  return Boolean(await currentUser());
}

export async function GET(request:NextRequest){
  if(!await authorized(request))return NextResponse.json({error:'Nicht autorisiert'},{status:401});
  try{
    const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||'');
    const result=await runHistorySync({store:createSupabaseSyncStore(),loadConversions:source.loadConversions,loadReports:source.loadReports,loadHourlyReports:source.loadHourlyReports});
    return NextResponse.json(result);
  }catch(error){
    console.error('Everflow history sync failed',error);
    return NextResponse.json({error:error instanceof Error?error.message:'Sync fehlgeschlagen'},{status:500});
  }
}
