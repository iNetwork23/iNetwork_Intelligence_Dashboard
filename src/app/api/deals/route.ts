import {NextResponse} from 'next/server';
import {audit,requestEvidence,securityStore} from '@/lib/access-store';
import {DEFAULT_DEAL_RULES} from '@/lib/deal-register';
import {DealRegisterValidationError,loadDealRegisterState,saveDealRegister} from '@/lib/deal-register-store';
import {requirePermission} from '@/lib/session';
import {canonicalOrigin,checkCsrf,parseBoundedJson,securityHeaders} from '@/lib/security';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...securityHeaders,'Cache-Control':'private, no-store'}});
/** Deal-Register (D9): nur interne Rollen mit settings.manage; Partner sehen nichts Neues (D7). */
async function authorize(){const auth=await requirePermission('settings.manage');if(!auth.ok)return{ok:false as const,response:json({error:auth.status===401?'Nicht angemeldet':'Keine Berechtigung'},auth.status)};if(auth.user.access.role==='partner')return{ok:false as const,response:json({error:'Keine Berechtigung'},403)};return{ok:true as const,user:auth.user}}
export async function GET(){const auth=await authorize();if(!auth.ok)return auth.response;try{const state=await loadDealRegisterState();return json({rules:state.rules,defaults:DEFAULT_DEAL_RULES,source:state.source})}catch(error){console.error('Deal register could not be loaded',error);return json({error:'Deal-Register konnte nicht geladen werden'},503)}}
export async function PUT(request:Request){const auth=await authorize();if(!auth.ok)return auth.response;let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch{return json({error:'Serverkonfiguration ungültig'},500)}if(!checkCsrf(request,origin))return json({error:'Anfrage abgelehnt'},403);let input:Record<string,unknown>;try{input=await parseBoundedJson(request)}catch{return json({error:'Ungültige Anfrage'},400)}
 const evidence=requestEvidence(request),actorId=auth.user.actorId;
 try{const{before,after}=await saveDealRegister(input.rules,actorId,securityStore());await audit({actorId,action:'deal_register.update',targetId:'deal_register:v1',before:{source:before.source,rules:before.rules},after:{source:'stored',rules:after},...evidence});return json({ok:true,rules:after,defaults:DEFAULT_DEAL_RULES,source:'stored'})}
 catch(error){if(error instanceof DealRegisterValidationError)return json({error:error.message},400);console.error('Deal register update failed',error);await audit({actorId,action:'deal_register.update_failed',targetId:'deal_register:v1',after:{error:error instanceof Error?error.message:'unbekannt'},...evidence}).catch(()=>{});return json({error:'Deal-Register konnte nicht gespeichert werden'},503)}}
