import {NextResponse} from 'next/server';
import {requirePermission} from '@/lib/session';
import {can} from '@/lib/rbac';
import {securityHeaders} from '@/lib/security';
import journal from '@/data/automation-journal';
export const dynamic='force-dynamic';
export async function GET(){const auth=await requirePermission('campaigns.edit');if(!auth.ok)return NextResponse.json({error:auth.status===401?'Unauthorized':'Forbidden'},{status:auth.status,headers:securityHeaders});if(auth.user.access.role==='partner'||!can(auth.user.access,'finance.view'))return NextResponse.json({error:'Forbidden'},{status:403,headers:securityHeaders});return NextResponse.json(journal,{headers:securityHeaders});}
