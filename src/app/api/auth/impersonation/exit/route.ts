import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {currentUser} from '@/lib/session';
import {getSupabaseAdmin} from '@/lib/supabase';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {checkCsrf,createOpaqueSession,COOKIE_NAME,securityHeaders} from '@/lib/security';
import {parseAccessMetadata} from '@/lib/rbac';

export async function POST(request:Request){
 const current=await currentUser();
 if(!current)return NextResponse.json({error:'Nicht angemeldet'},{status:401,headers:securityHeaders});
 if(!current.impersonating)return NextResponse.redirect(new URL('/',request.url),303);
 const origin=process.env.APP_ORIGIN||new URL(request.url).origin;
 if(!checkCsrf(request,origin))return NextResponse.json({error:'Anfrage abgelehnt'},{status:403,headers:securityHeaders});
 let made;
 if(current.actorId==='legacy-admin'){
  if(process.env.ALLOW_LEGACY_ADMIN!=='true')return NextResponse.json({error:'Akteur nicht verfügbar'},{status:403,headers:securityHeaders});
  made=await createOpaqueSession(securityStore(),{userId:'legacy-admin',metadataVersion:1});
 }else{
  const {data,error}=await getSupabaseAdmin().auth.admin.getUserById(current.actorId);
  if(error||!data.user)return NextResponse.json({error:'Akteur nicht verfügbar'},{status:403,headers:securityHeaders});
  const access=parseAccessMetadata(data.user.app_metadata);
  if(access.status!=='active')return NextResponse.json({error:'Akteur nicht aktiv'},{status:403,headers:securityHeaders});
  made=await createOpaqueSession(securityStore(),{userId:data.user.id,metadataVersion:access.version});
 }
 (await cookies()).set(COOKIE_NAME,made.token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:43_200});
 await audit({actorId:current.actorId,action:'impersonation.exit',targetId:current.id,...requestEvidence(request)});
 return NextResponse.redirect(new URL('/',request.url),303);
}
