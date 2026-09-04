import{timingSafeEqual}from'node:crypto';
import{NextResponse}from'next/server';
import{audit,securityStore}from'@/lib/access-store';
import{automationRuntimeDependencies}from'@/lib/automation-runtime';
import{executeAutomationRun}from'@/lib/automation-runner';
import{automationIsDue}from'@/lib/automation-scheduler';
import{automationDecisionSummary}from'@/lib/automation-notice';
import{getAutomationConfiguration,listAutomationConfigurations,type StoredAutomationConfiguration}from'@/lib/automation-store';
import{enqueuePushAlert}from'@/lib/push-notifications';
import{securityHeaders}from'@/lib/security';
export const dynamic='force-dynamic';export const maxDuration=300;
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...securityHeaders,'Cache-Control':'private, no-store'}});
function authorized(request:Request){const expected=process.env.CRON_SECRET||'',provided=request.headers.get('authorization')?.replace(/^Bearer\s+/,'')||'';if(!expected||expected.length!==provided.length)return false;return timingSafeEqual(Buffer.from(expected),Buffer.from(provided))}
const audience=(config:StoredAutomationConfiguration)=>({affiliateId:config.affiliateId,campaignId:config.campaignId,offerIds:config.offers.map(offer=>offer.offerId)});
type PendingAlert={dedupeId:string;payload:{title:string;body:string;path:string;tag:string};audience:ReturnType<typeof audience>};
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const configPath=(id:string)=>`/automation#config-${id}`;
const WRITE_DECISIONS=new Set(['replace_slot','rotate_round','promote']);
export async function GET(request:Request){
 if(!authorized(request))return json({error:'Nicht autorisiert'},401);
 const store=securityStore(),now=new Date(),configs=await listAutomationConfigurations(store),due=configs.filter(config=>automationIsDue(config,now)),results:unknown[]=[];
 for(const scheduled of due){
  const actorId='automation-scheduler',pendingIncident:{current:null|{incidentId:string;config:StoredAutomationConfiguration}}={current:null};let alert:PendingAlert|null=null;
  const runtime=automationRuntimeDependencies({authorize:async()=>{},beforeWrite:async value=>{await audit({actorId,action:'automation.scheduler_write_planned',targetId:scheduled.id,before:{baseline:value.config.acceptedBaselineFingerprint,slots:value.config.slots},after:{action:value.evaluation.action,targetSlots:value.evaluation.targetSlots}})},afterWrite:async value=>{await audit({actorId,action:'automation.scheduler_write_verified',targetId:scheduled.id,after:{fingerprint:value.afterFingerprint,action:value.evaluation.action}})},onIncident:async value=>{pendingIncident.current={incidentId:value.incident.incidentId,config:value.config};await audit({actorId,action:'automation.scheduler_incident',targetId:scheduled.id,after:{run:value.run,incident:value.incident}})}});
  try{
   const result=await executeAutomationRun(store,scheduled.id,'live',actorId,runtime,{requireDueAt:now}),action=result.evaluation.action,fresh=result.configuration;
   if(pendingIncident.current){const incident=pendingIncident.current;alert={dedupeId:`incident:${fresh.id}:${incident.incidentId}`,payload:{title:'Automation-Sicherheitsstopp',body:`Campaign ${incident.config.campaignId}: Ein Provider-Incident blockiert weitere Änderungen.`,path:configPath(fresh.id),tag:`automation-${fresh.id}`},audience:audience(incident.config)}}
   else if(result.writesPerformed>0&&WRITE_DECISIONS.has(action.type)){const runId=fresh.runs[0]?.runId||result.evaluation.evaluatedAt;alert={dedupeId:`write:${fresh.id}:${runId}`,payload:{title:'Automation hat rotiert',body:`Campaign ${fresh.campaignId}: ${automationDecisionSummary(action)} · ${result.writesPerformed} Writes`,path:configPath(fresh.id),tag:`automation-${fresh.id}`},audience:audience(fresh)}}
   else if(action.type==='hold')alert={dedupeId:`hold:${fresh.id}:${action.reasonCode}:${berlinDay(now)}`,payload:{title:'Automation wartet auf sichere Daten',body:`Campaign ${fresh.campaignId}: ${action.reasonCode}`,path:configPath(fresh.id),tag:`automation-${fresh.id}`},audience:audience(fresh)};
   results.push({id:scheduled.id,ok:true,decision:action.type,writesPerformed:result.writesPerformed});
  }catch(error){
   const errorMessage=error instanceof Error?error.message:'Unbekannter Schedulerfehler',incident=pendingIncident.current;
   if(incident)alert={dedupeId:`incident:${scheduled.id}:${incident.incidentId}`,payload:{title:'Automation-Sicherheitsstopp',body:`Campaign ${incident.config.campaignId}: Ein Provider-Incident blockiert weitere Änderungen.`,path:configPath(scheduled.id),tag:`automation-${scheduled.id}`},audience:audience(incident.config)};
   else{const fresh=await getAutomationConfiguration(store,scheduled.id).catch(()=>null);if(fresh)alert={dedupeId:`scheduler-failure:${fresh.id}`,payload:{title:'Automation-Schedulerfehler',body:`Campaign ${fresh.campaignId}: Automationslauf fehlgeschlagen. Details im Dashboard.`,path:configPath(fresh.id),tag:`automation-${fresh.id}`},audience:audience(fresh)}}
   results.push({id:scheduled.id,ok:false,error:errorMessage});
  }
  if(alert)try{await enqueuePushAlert(alert.dedupeId,alert.payload,alert.audience,store)}catch{try{await audit({actorId,action:'automation.notification_enqueue_failed',targetId:scheduled.id})}catch{}}
 }
 return json({ok:results.every(item=>typeof item==='object'&&item!==null&&'ok'in item&&(item as{ok:boolean}).ok),checked:configs.length,due:due.length,results});
}
