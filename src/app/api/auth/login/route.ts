import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getSupabasePasswordAuth} from '@/lib/supabase';
import {validCredentials} from '@/lib/auth';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {hasMfa,verifyMfaChallenge} from '@/lib/mfa';
import {canonicalOrigin,checkCsrf,consumeRateLimit,createOpaqueSession,COOKIE_NAME,recordRateLimitFailure,resetRateLimit,revokeSession,securityHeaders,validateOpaqueSession} from '@/lib/security';
import {parseAccessMetadata} from '@/lib/rbac';

export const runtime='nodejs';
const failure=(origin:string,status=303,retryAfter?:number,mfa=false)=>{const response=status===429?NextResponse.json({error:'Zu viele Anmeldeversuche. Später erneut versuchen.'},{status,headers:securityHeaders}):NextResponse.redirect(new URL(mfa?'/login?mfa=1&error=1':'/login?error=1',origin),status);if(retryAfter)response.headers.set('Retry-After',String(retryAfter));return response};
const setSessionCookie=async(token:string,maxAge:number)=>{(await cookies()).set(COOKIE_NAME,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge})};

export async function POST(request:Request){
 let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch(error){console.error('Login origin configuration invalid',error);return NextResponse.json({error:'Serverkonfiguration ungültig'},{status:500,headers:securityHeaders})}
 if(!checkCsrf(request,origin))return NextResponse.json({error:'Anfrage abgelehnt'},{status:403,headers:securityHeaders});
 let text='';try{text=await request.text();if(Buffer.byteLength(text)>4096)return NextResponse.json({error:'Ungültige Anfrage'},{status:400,headers:securityHeaders})}catch{return NextResponse.json({error:'Ungültige Anfrage'},{status:400,headers:securityHeaders})}
 const form=new URLSearchParams(text),evidence=requestEvidence(request),now=Math.floor(Date.now()/1000),store=securityStore(),mfaCode=String(form.get('mfa_code')||'').trim();
 if(mfaCode){
  const token=(await cookies()).get(COOKIE_NAME)?.value,session=await validateOpaqueSession(store,token,now);
  if(!session?.mfaSetupOnly){await audit({actorId:'anonymous',action:'login.mfa_session_missing',targetId:'unknown',...evidence});return failure(origin,303,undefined,true)}
  const rateId=`${evidence.ip}:mfa:${session.userId}`,limit=await consumeRateLimit(store,rateId,now);
  if(!limit.allowed){await audit({actorId:session.userId,action:'login.mfa_rate_limited',targetId:session.userId,...evidence});return failure(origin,429,limit.retryAfter,true)}
  let verified=false;try{verified=await verifyMfaChallenge(store,session.userId,mfaCode,process.env.MFA_ENCRYPTION_KEY||'',now)}catch{/* invalid encryption configuration fails closed */}
  if(!verified){await recordRateLimitFailure(store,rateId,now);await audit({actorId:session.userId,action:'login.mfa_failed',targetId:session.userId,...evidence});return failure(origin,303,undefined,true)}
  await resetRateLimit(store,rateId);await revokeSession(store,token);const {token:fullToken}=await createOpaqueSession(store,{userId:session.userId,metadataVersion:session.metadataVersion},now);await setSessionCookie(fullToken,43_200);await audit({actorId:session.userId,action:'login.succeeded',targetId:session.userId,...evidence});return NextResponse.redirect(new URL('/',origin),303);
 }
 const email=String(form.get('email')||form.get('username')||'').trim().slice(0,254),password=String(form.get('password')||'').slice(0,256),rateId=`${evidence.ip}:${email.toLowerCase()}`,limit=await consumeRateLimit(store,rateId,now);
 if(!limit.allowed){await audit({actorId:'anonymous',action:'login.rate_limited',targetId:email,...evidence});return failure(origin,429,limit.retryAfter)}
 let userId='',metadataVersion=0,actorEmail=email;
 try{const {data,error}=await getSupabasePasswordAuth().auth.signInWithPassword({email,password});if(!error&&data.user){const access=parseAccessMetadata(data.user.app_metadata);if(access.status==='active'){userId=data.user.id;metadataVersion=access.version;actorEmail=data.user.email||email;}}}catch{/* generic failure; optional legacy auth is evaluated below */}
 if(!userId&&process.env.ALLOW_LEGACY_ADMIN==='true'){const config={username:process.env.DASHBOARD_USERNAME||'',password:process.env.DASHBOARD_PASSWORD||'',sessionSecret:process.env.SESSION_SECRET||'x'.repeat(32)};if(config.username&&config.password&&await validCredentials(email,password,config)){userId='legacy-admin';metadataVersion=1;actorEmail=config.username;}}
 if(!userId){await recordRateLimitFailure(store,rateId,now);await audit({actorId:'anonymous',action:'login.failed',targetId:email,...evidence});return failure(origin)}
 await resetRateLimit(store,rateId);const requiresMfa=await hasMfa(store,userId),{token}=await createOpaqueSession(store,{userId,metadataVersion,mfaSetupOnly:requiresMfa},now);await setSessionCookie(token,requiresMfa?300:43_200);if(requiresMfa){await audit({actorId:userId,action:'login.password_succeeded_mfa_required',targetId:actorEmail,...evidence});return NextResponse.redirect(new URL('/login?mfa=1',origin),303)}await audit({actorId:userId,action:'login.succeeded',targetId:actorEmail,...evidence});return NextResponse.redirect(new URL('/',origin),303);
}
