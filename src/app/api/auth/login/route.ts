import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getSupabasePasswordAuth} from '@/lib/supabase';
import {validCredentials} from '@/lib/auth';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {canonicalOrigin,checkCsrf,consumeRateLimit,createOpaqueSession,COOKIE_NAME,recordRateLimitFailure,resetRateLimit,securityHeaders} from '@/lib/security';
import {parseAccessMetadata} from '@/lib/rbac';

export const runtime='nodejs';
const failure=(origin:string,status=303,retryAfter?:number)=>{const response=status===429?NextResponse.json({error:'Zu viele Anmeldeversuche. Später erneut versuchen.'},{status,headers:securityHeaders}):NextResponse.redirect(new URL('/login?error=1',origin),status);if(retryAfter)response.headers.set('Retry-After',String(retryAfter));return response};
export async function POST(request:Request){
 let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch(error){console.error('Login origin configuration invalid',error);return NextResponse.json({error:'Serverkonfiguration ungültig'},{status:500,headers:securityHeaders})}
 if(!checkCsrf(request,origin))return NextResponse.json({error:'Anfrage abgelehnt'},{status:403,headers:securityHeaders});
 let text='';try{text=await request.text();if(Buffer.byteLength(text)>4096)return NextResponse.json({error:'Ungültige Anfrage'},{status:400,headers:securityHeaders})}catch{return NextResponse.json({error:'Ungültige Anfrage'},{status:400,headers:securityHeaders})}
 const form=new URLSearchParams(text),email=String(form.get('email')||form.get('username')||'').trim().slice(0,254),password=String(form.get('password')||'').slice(0,256);const evidence=requestEvidence(request),rateId=`${evidence.ip}:${email.toLowerCase()}`,now=Math.floor(Date.now()/1000),limit=await consumeRateLimit(securityStore(),rateId,now);if(!limit.allowed){await audit({actorId:'anonymous',action:'login.rate_limited',targetId:email,...evidence});return failure(origin,429,limit.retryAfter)}
 let userId='',metadataVersion=0,actorEmail=email;
 try{const {data,error}=await getSupabasePasswordAuth().auth.signInWithPassword({email,password});if(!error&&data.user){const access=parseAccessMetadata(data.user.app_metadata);if(access.status==='active'){userId=data.user.id;metadataVersion=access.version;actorEmail=data.user.email||email;}}}catch{/* generic failure; optional legacy auth is evaluated below */}
 if(!userId&&process.env.ALLOW_LEGACY_ADMIN==='true'){const config={username:process.env.DASHBOARD_USERNAME||'',password:process.env.DASHBOARD_PASSWORD||'',sessionSecret:process.env.SESSION_SECRET||'x'.repeat(32)};if(config.username&&config.password&&await validCredentials(email,password,config)){userId='legacy-admin';metadataVersion=1;actorEmail=config.username;}}
 if(!userId){await recordRateLimitFailure(securityStore(),rateId,now);await audit({actorId:'anonymous',action:'login.failed',targetId:email,...evidence});return failure(origin)}
 await resetRateLimit(securityStore(),rateId);const {token}=await createOpaqueSession(securityStore(),{userId,metadataVersion});(await cookies()).set(COOKIE_NAME,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:43_200});await audit({actorId:userId,action:'login.succeeded',targetId:actorEmail,...evidence});return NextResponse.redirect(new URL('/',origin),303);
}
