import {NextRequest,NextResponse} from 'next/server';
import {requirePermission} from '@/lib/session';
import {can} from '@/lib/rbac';
import {getLtvCohorts} from '@/lib/cohorts';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const auth=await requirePermission('statistics.view');if(!auth.ok)return NextResponse.json({error:auth.status===401?'Nicht autorisiert':'Keine Berechtigung'},{status:auth.status});
  if(!can(auth.user.access,'finance.view'))return NextResponse.json({error:'Finanzdaten nicht freigegeben'},{status:403});
  try{
    const source=request.nextUrl.searchParams.get('source')||undefined;
    const subSource=request.nextUrl.searchParams.get('sub_source')||undefined;
    return NextResponse.json({cohorts:await getLtvCohorts({source,subSource},auth.user.access)});
  }catch(error){
    console.error(error);
    const forbidden=error instanceof Error&&error.message.includes('403');
    return NextResponse.json({error:forbidden?'Scope nicht freigegeben':error instanceof Error?error.message:'Kohorten konnten nicht geladen werden'},{status:forbidden?403:500});
  }
}
