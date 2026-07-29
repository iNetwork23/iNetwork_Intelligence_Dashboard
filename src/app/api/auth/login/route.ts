import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getSupabasePasswordAuth} from '@/lib/supabase';
import {validCredentials} from '@/lib/auth';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {canonicalOrigin,checkCsrf,consumeRateLimit,createOpaqueSession,COOKIE_NAME,recordRateLimitFailure,resetRateLimit,securityHeaders} from '@/lib/security';
import {parseAccessMetadata} from '@/lib/rbac';
import {resolveLoginEmail} from '@/lib/user-provisioning';

export const runtime='nodejs';
const failure=(origin:string,status=303,retryAfter?:number)=>{const response=status===429?NextResponse.json({error:'Zu viele Anmeldeversuche. Später erneut versuchen.'},{status,headers:securityHeaders}):NextResponse.redirect(new URL('/login?error=1',origin),status);if(retryAfter)response.headers.set('Retry-After',String(retryAfter));return response};
export async function POST(request:Request){
 let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch(error){console.error('Login origin configuration invalid',error);return NextResponse.json({error:'Serverkonfiguration ungültig'},{status:500,headers:securityHeaders})}
 if(!checkCsrf(request,origin))return NextResponse.json({error:'Anfrage abgelehnt'},{status:403,headers:securityHeaders});
 let text='';try{text=await request.text();if(Buffer.byteLength(text)>4096)return NextResponse.json({error:'Ungültige Anfrage'},{status:400,headers:securityHeaders})}catch{return NextResponse.json({error:'Ungültige Anfrage'},{status:400,headers:securityHeaders})}
 const form=new URLSearchParams(text),identifier=String(form.get('email')||form.get('username')||'').trim().slice(0,254),password=String(form.get('password')||'').slice(0,256),store=securityStore();const evidence=requestEvidence(request),rateId=`${evidence.ip}:${identifier.toLowerCase()}`,now=Math.floor(Date.now()/1000),limit=await consumeRateLimit(store,rateId,now);if(!limit.allowed){await audit({actorId:'anonymous',action:'login.rate_limited',targetId:identifier,...evidence});return failure(origin,429,limit.retryAfter)}
 let userId='',metadataVersion=0,actorEmail=identifier;
 const resolvedEmail=await resolveLoginEmail(store,identifier),authEmail=resolvedEmail||'invalid-login@invalid.local';
 try{const {data,error}=await getSupabasePasswordAuth().auth.signInWithPassword({email:authEmail,password});if(!error&&data.user){const access=parseAccessMetadata(data.user.app_metadata);if(access.status==='active'){userId=data.user.id;metadataVersion=access.version;actorEmail=data.user.email||authEmail;}}}catch{/* generic failure; optional legacy auth is evaluated below */}
 if(!userId&&process.env.ALLOW_LEGACY_ADMIN==='true'){const config={username:process.env.DASHBOARD_USERNAME||'',password:process.env.DASHBOARD_PASSWORD||'',sessionSecret:process.env.SESSION_SECRET||'x'.repeat(32)};if(config.username&&config.password&&await validCredentials(identifier,password,config)){userId='legacy-admin';metadataVersion=1;actorEmail=config.username;}}
 if(!userId){await recordRateLimitFailure(store,rateId,now);await audit({actorId:'anonymous',action:'login.failed',targetId:identifier,...evidence});return failure(origin)}
 await resetRateLimit(securityStore(),rateId);const {token}=await createOpaqueSession(securityStore(),{userId,metadataVersion});(await cookies()).set(COOKIE_NAME,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:43_200});await audit({actorId:userId,action:'login.succeeded',targetId:actorEmail,...evidence});return NextResponse.redirect(new URL('/',origin),303);
}
