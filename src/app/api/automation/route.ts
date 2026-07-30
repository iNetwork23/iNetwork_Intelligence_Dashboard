import{NextResponse}from'next/server';
import AUTOMATION_JOURNAL from'@/data/automation-journal';
import{audit,requestEvidence,securityStore}from'@/lib/access-store';
import{normalizeAutomationDraft}from'@/lib/automation-config';
import{assertAutomationCampaignAffiliateMapping,runAutomationPreflight}from'@/lib/automation-preflight';
import{buildImportedAutomationDraft}from'@/lib/automation-import';
import{automationScopeAllowed,mayConfigureAutomation,mayRunLiveAutomation}from'@/lib/automation-policy';
import{automationRuntimeDependencies}from'@/lib/automation-runtime';
import{executeAutomationRun}from'@/lib/automation-runner';
import{createAutomationConfiguration,getAutomationConfiguration,listAutomationConfigurations,transitionAutomation,updateAutomationConfigurationAuthorized,withAutomationLock}from'@/lib/automation-store';
import{resolveCurrentUserUncached,requirePermission,type CurrentUser}from'@/lib/session';
import{can}from'@/lib/rbac';
import{canonicalOrigin,checkCsrf,parseBoundedJson,securityHeaders}from'@/lib/security';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...securityHeaders,'Cache-Control':'private, no-store'}});
const scopeInput=(config:{affiliateId:number;campaignId:number;offers:{offerId:number}[]})=>({affiliateId:config.affiliateId,campaignId:config.campaignId,offerIds:config.offers.map(offer=>offer.offerId)});
function assertScoped(user:CurrentUser,config:{affiliateId:number;campaignId:number;offers:{offerId:number}[]},live=false){if(!(live?mayRunLiveAutomation(user.access):mayConfigureAutomation(user.access))||!automationScopeAllowed(user.access,scopeInput(config)))throw new Error('Keine Berechtigung für diese Affiliate-/Campaign-/Offer-Kombination.');}
async function fresh(original:CurrentUser,config:{affiliateId:number;campaignId:number;offers:{offerId:number}[]},live=false){const user=await resolveCurrentUserUncached();if(!user||user.id!==original.id||user.actorId!==original.actorId)throw new Error('Keine Berechtigung');assertScoped(user,config,live);return user}
export async function GET(){const auth=await requirePermission('campaigns.edit');if(!auth.ok)return json({error:auth.status===401?'Unauthorized':'Forbidden'},auth.status);if(auth.user.access.role==='partner'||!can(auth.user.access,'finance.view'))return json({error:'Forbidden'},403);try{const configurations=mayConfigureAutomation(auth.user.access)?(await listAutomationConfigurations(securityStore())).filter(config=>automationScopeAllowed(auth.user.access,scopeInput(config))):[];return json({...AUTOMATION_JOURNAL,configurations,canRunLive:mayRunLiveAutomation(auth.user.access)})}catch(error){return json({error:error instanceof Error?error.message:'Automationen konnten nicht geladen werden'},500)}}
export async function POST(request:Request){
 const auth=await requirePermission('campaigns.edit');if(!auth.ok)return json({error:auth.status===401?'Unauthorized':'Forbidden'},auth.status);if(!can(auth.user.access,'finance.view')||!mayConfigureAutomation(auth.user.access))return json({error:'Forbidden'},403);
 let origin:string;try{origin=canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url)}catch{return json({error:'Serverkonfiguration ungültig'},500)}if(!checkCsrf(request,origin))return json({error:'Anfrage abgelehnt'},403);
 let input:Record<string,unknown>;try{input=await parseBoundedJson(request)}catch{return json({error:'Ungültige Anfrage'},400)}
 const action=String(input.action||''),store=securityStore(),evidence=requestEvidence(request);
 try{
  if(action==='import_legacy'){
   const campaignId=Number(input.campaignId),affiliateId=Number(input.affiliateId);if(!automationScopeAllowed(auth.user.access,{campaignId,affiliateId,offerIds:[]}))throw new Error('Keine Berechtigung');
   await assertAutomationCampaignAffiliateMapping(campaignId,affiliateId);const config=await buildImportedAutomationDraft({campaignId,affiliateId,apiKey:process.env.EVERFLOW_API_KEY||''});assertScoped(auth.user,config);
   const created=await withAutomationLock(store,config.id,async lease=>{await fresh(auth.user,config);const result=await createAutomationConfiguration(store,config,auth.user.actorId,lease);await audit({actorId:auth.user.actorId,action:'automation.import_legacy',targetId:result.id,after:result,...evidence});return result});return json({ok:true,configuration:created},201);
  }
  if(action==='create'){
   const config=normalizeAutomationDraft(input.config);assertScoped(auth.user,config);
   const created=await withAutomationLock(store,config.id,async lease=>{await fresh(auth.user,config);const result=await createAutomationConfiguration(store,config,auth.user.actorId,lease);await audit({actorId:auth.user.actorId,action:'automation.create',targetId:result.id,after:result,...evidence});return result});return json({ok:true,configuration:created},201);
  }
  const id=String(input.id||''),existing=await getAutomationConfiguration(store,id);if(!existing)return json({error:'Automation nicht gefunden'},404);assertScoped(auth.user,existing);
  if(action==='update'){
   const normalized=normalizeAutomationDraft({...((input.config&&typeof input.config==='object')?input.config:{}),id:existing.id,createdAt:existing.createdAt});assertScoped(auth.user,normalized);
   const updated=await updateAutomationConfigurationAuthorized(store,normalized,Number(input.version),auth.user.actorId,async(candidate,current)=>{const freshUser=await fresh(auth.user,candidate);assertScoped(freshUser,current)},async(result,current)=>{await audit({actorId:auth.user.actorId,action:'automation.update',targetId:id,before:current,after:result,...evidence})});return json({ok:true,configuration:updated});
  }
  if(action==='dry_run'||action==='live_run'){
   const live=action==='live_run';assertScoped(auth.user,existing,live);
   const runtime=automationRuntimeDependencies({authorize:async config=>{await fresh(auth.user,config,live)},beforeWrite:async value=>{await audit({actorId:auth.user.actorId,action:'automation.write_planned',targetId:id,before:{baseline:value.config.acceptedBaselineFingerprint,slots:value.config.slots},after:{action:value.evaluation.action,targetSlots:value.evaluation.targetSlots},...evidence})},afterWrite:async value=>{await audit({actorId:auth.user.actorId,action:'automation.write_verified',targetId:id,after:{fingerprint:value.afterFingerprint,action:value.evaluation.action},...evidence})},afterDryRun:async value=>{await audit({actorId:auth.user.actorId,action:'automation.dry_run',targetId:id,before:value.before,after:value.after,...evidence})},onIncident:async value=>{await audit({actorId:auth.user.actorId,action:'automation.incident',targetId:id,after:{run:value.run,incident:value.incident},...evidence})}}),result=await executeAutomationRun(store,id,live?'live':'dry_run',auth.user.actorId,runtime);
   return json({ok:true,...result});
  }
  const transitions=new Set(['request_live','activate_live','pause','resume','complete']);if(!transitions.has(action))return json({error:'Unbekannte Aktion'},400);const live=['activate_live','resume'].includes(action);assertScoped(auth.user,existing,live);
  const updated=await withAutomationLock(store,id,async lease=>{const current=await getAutomationConfiguration(store,id);if(!current)throw new Error('Automation nicht gefunden.');await fresh(auth.user,current,live);let options:{preflightVerified?:boolean;baselineFingerprint?:string}={};if(live){const preflight=await runAutomationPreflight(current,process.env.EVERFLOW_API_KEY||'');if(!preflight.verified||!preflight.fingerprint)throw new Error(`Live-Preflight fehlgeschlagen: ${preflight.blockers.join(' ')}`);options={preflightVerified:true,baselineFingerprint:preflight.fingerprint}}const result=await transitionAutomation(store,id,Number(input.version),action as 'request_live'|'activate_live'|'pause'|'resume'|'complete',auth.user.actorId,options,lease);await audit({actorId:auth.user.actorId,action:`automation.${action}`,targetId:id,before:current,after:result,...evidence});return result});return json({ok:true,configuration:updated});
 }catch(error){const message=error instanceof Error?error.message:'Automation konnte nicht geändert werden',status=/Keine Berechtigung/.test(message)?403:/zwischenzeitlich/.test(message)?409:400;return json({error:message},status)}
}
