import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '@/lib/session';
import {getLtvCohorts} from '@/lib/cohorts';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  if(!await currentUser())return NextResponse.json({error:'Nicht autorisiert'},{status:401});
  try{
    const source=request.nextUrl.searchParams.get('source')||undefined;
    const subSource=request.nextUrl.searchParams.get('sub_source')||undefined;
    return NextResponse.json({cohorts:await getLtvCohorts({source,subSource})});
  }catch(error){
    console.error(error);
    return NextResponse.json({error:error instanceof Error?error.message:'Kohorten konnten nicht geladen werden'},{status:500});
  }
}
