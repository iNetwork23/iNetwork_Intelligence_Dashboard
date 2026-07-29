import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/session';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {beginMfaEnrollment,confirmMfaEnrollment,disableMfa,hasMfa} from '@/lib/mfa';
import {canonicalOrigin,checkCsrf,parseBoundedJson,revokeUserSessions,securityHeaders} from '@/lib/security';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:securityHeaders});
export async function GET(){const user=await currentUser();if(!user)return json({error:'Nicht angemeldet'},401);if(user.impersonating||user.id==='legacy-admin')return json({error:'MFA ist für diesen Sitzungstyp nicht verfügbar'},403);return json({enabled:await hasMfa(securityStore(),user.id)});}
export async function POST(request:Request){const user=await currentUser();if(!user)return json({error:'Nicht angemeldet'},401);if(user.impersonating||user.id==='legacy-admin')return json({error:'MFA ist für diesen Sitzungstyp nicht verfügbar'},403);let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch{return json({error:'Serverkonfiguration ungültig'},500)}if(!checkCsrf(request,origin))return json({error:'Anfrage abgelehnt'},403);let input:Record<string,unknown>;try{input=await parseBoundedJson(request,4096)}catch{return json({error:'Ungültige Anfrage'},400)}const action=String(input.action||''),code=String(input.code||'').trim(),key=process.env.MFA_ENCRYPTION_KEY||'',evidence=requestEvidence(request);try{
 if(action==='enroll'){const enrollment=await beginMfaEnrollment(securityStore(),user.id,key);await audit({actorId:user.actorId,action:'mfa.enrollment_started',targetId:user.id,...evidence});return json(enrollment,201)}
 if(action==='confirm'){if(!await confirmMfaEnrollment(securityStore(),user.id,code,key))return json({error:'Ungültiger MFA-Code'},400);await revokeUserSessions(securityStore(),user.id);await audit({actorId:user.actorId,action:'mfa.enabled',targetId:user.id,...evidence});return json({ok:true})}
 if(action==='disable'){if(!await disableMfa(securityStore(),user.id,code,key))return json({error:'Ungültiger MFA-Code'},400);await revokeUserSessions(securityStore(),user.id);await audit({actorId:user.actorId,action:'mfa.disabled',targetId:user.id,...evidence});return json({ok:true})}
 return json({error:'Ungültige Anfrage'},400);
 }catch(error){console.error('MFA action failed',error);return json({error:'MFA-Aktion fehlgeschlagen'},500)}
}
