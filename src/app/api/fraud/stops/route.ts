import {NextResponse} from 'next/server';
import {revalidateTag} from 'next/cache';
import {requestEvidence} from '@/lib/access-store';
import {assertFraudAccess} from '@/lib/fraud-service';
import {canonicalOrigin,checkCsrf,parseBoundedJson,securityHeaders} from '@/lib/security';
import {requirePermission} from '@/lib/session';
import {normalizeFraudStopInput} from '@/lib/fraud-stops';
import {getSupabaseAdmin} from '@/lib/supabase';

export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...securityHeaders,'Cache-Control':'private, no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request){
 const auth=await requirePermission('api.manage');if(!auth.ok)return json({error:auth.status===401?'Nicht angemeldet':'Keine Berechtigung'},auth.status);try{assertFraudAccess(auth.user.access)}catch{return json({error:'Keine Berechtigung'},403)}
 let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch{return json({error:'Serverkonfiguration ungültig'},500)}if(!checkCsrf(request,origin))return json({error:'Anfrage abgelehnt'},403);
 let input:Record<string,unknown>;try{input=await parseBoundedJson(request)}catch{return json({error:'Ungültige Anfrage'},400)}
 const action=input.action==='deactivate'?'deactivate':input.action===undefined||input.action==='create'?'create':null;if(!action)return json({error:'Aktion ist ungültig'},400);const evidence=requestEvidence(request),auditPayload={actorId:auth.user.actorId,...evidence};let stop:Record<string,unknown>;
 if(action==='deactivate'){const id=String(input.id||'');if(!uuid.test(id))return json({error:'Stop-ID ist ungültig'},400);stop={id}}
 else try{stop=normalizeFraudStopInput(input,auth.user.actorId)}catch(error){return json({error:error instanceof Error?error.message:'Ungültige Stop-Daten'},400)}
 const result=await getSupabaseAdmin().rpc('manage_fraud_stop',{p_action:action,p_stop:stop,p_audit:auditPayload});
 if(result.error){console.error('Atomic fraud stop mutation failed',{code:result.error.code,action});if(result.error.code==='P0002')return json({error:'Aktiver Stop nicht gefunden'},404);return json({error:'Stop konnte nicht gespeichert werden'},500)}
 revalidateTag('fraud-dashboard',{expire:0});return json({ok:true,id:String(result.data)},action==='create'?201:200);
}
