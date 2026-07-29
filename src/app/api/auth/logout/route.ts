import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {currentUser} from '@/lib/session';
import {checkCsrf,COOKIE_NAME,revokeSession,securityHeaders} from '@/lib/security';
export async function POST(request:Request){const origin=process.env.APP_ORIGIN||new URL(request.url).origin;if(!checkCsrf(request,origin))return NextResponse.json({error:'Anfrage abgelehnt'},{status:403,headers:securityHeaders});const jar=await cookies(),token=jar.get(COOKIE_NAME)?.value,user=await currentUser();await revokeSession(securityStore(),token);jar.set(COOKIE_NAME,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});if(user)await audit({actorId:user.actorId,action:'logout',targetId:user.id,...requestEvidence(request)});return NextResponse.redirect(new URL('/login',request.url),303)}
