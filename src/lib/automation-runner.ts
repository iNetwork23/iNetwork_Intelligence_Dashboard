import type{SecurityStore}from'./security';
import{evaluateAutomation,type AutomationEvaluation,type AutomationVariantMetrics}from'./automation-engine';
import{commitAutomationTarget,getAutomationConfiguration,holdAutomationAfterFailure,recordAutomationRun,transitionAutomation,type AutomationIncident,type AutomationRun,type StoredAutomationConfiguration,withAutomationLock}from'./automation-store';
import{automationIsDue}from'./automation-scheduler';
type Preflight={verified:boolean;fingerprint:string|null;blockers:string[]};
type ApplyResult={verified:boolean;writesPerformed:number;afterFingerprint:string};
type Dependencies={
 loadMetrics:(config:StoredAutomationConfiguration)=>Promise<AutomationVariantMetrics[]>;
 preflight:(config:StoredAutomationConfiguration)=>Promise<Preflight>;
 applyRouting:(input:{config:StoredAutomationConfiguration;evaluation:AutomationEvaluation;expectedFingerprint:string})=>Promise<ApplyResult>;
 compensateRouting?:(input:{config:StoredAutomationConfiguration;expectedFingerprint:string})=>Promise<ApplyResult>;
 authorize:(config:StoredAutomationConfiguration)=>Promise<void>;
 beforeWrite:(input:{config:StoredAutomationConfiguration;evaluation:AutomationEvaluation;actorId:string})=>Promise<void>;
 afterWrite?:(input:{config:StoredAutomationConfiguration;evaluation:AutomationEvaluation;actorId:string;afterFingerprint:string})=>Promise<void>;
 afterDryRun?:(input:{before:StoredAutomationConfiguration;after:StoredAutomationConfiguration;actorId:string})=>Promise<void>;
 onIncident?:(input:{config:StoredAutomationConfiguration;run:AutomationRun;incident:AutomationIncident;actorId:string})=>Promise<void>;
};
export class AutomationNotDueError extends Error{constructor(){super('Automation ist nach erneuter Prüfung nicht fällig.');this.name='AutomationNotDueError'}}
const messageOf=(error:unknown)=>error instanceof Error?error.message:'Unbekannter Automationsfehler';
export async function executeAutomationRun(store:SecurityStore,id:string,mode:'dry_run'|'live',actorId:string,deps:Dependencies,options:{requireDueAt?:Date}={}){
 return withAutomationLock(store,id,async lease=>{
  let config=await getAutomationConfiguration(store,id);if(!config)throw new Error('Automation nicht gefunden.');
  if(options.requireDueAt&&!automationIsDue(config,options.requireDueAt))throw new AutomationNotDueError();
  await deps.authorize(config);
  if(mode==='live'&&(config.status!=='active'||!config.writeEnabled||!config.acceptedBaselineFingerprint))throw new Error('Automation ist nicht live freigegeben.');
  const original=config,runId=crypto.randomUUID(),startedAt=new Date().toISOString();let providerMutated=false,afterFingerprint:string|undefined,evaluation:AutomationEvaluation|undefined,writesPerformed=0;
  try{
   const metrics=await deps.loadMetrics(config);evaluation=evaluateAutomation(config,metrics);
   if(mode==='live'){
    const preflight=await deps.preflight(config);if(!preflight.verified||!preflight.fingerprint)throw new Error(`Live-Preflight fehlgeschlagen: ${preflight.blockers.join(' ')}`);if(preflight.fingerprint!==config.acceptedBaselineFingerprint)throw new Error('Campaign-Baseline hat sich seit der Live-Freigabe geändert.');
    if(evaluation.writesPlanned){
     await deps.beforeWrite({config,evaluation,actorId});await lease.assertOwned();
     const applied=await deps.applyRouting({config,evaluation,expectedFingerprint:preflight.fingerprint});providerMutated=applied.writesPerformed>0;afterFingerprint=applied.afterFingerprint;
     if(!applied.verified||applied.writesPerformed!==1)throw new Error('Everflow-Write wurde nicht vollständig verifiziert.');
     await lease.assertOwned();config=await commitAutomationTarget(store,id,config.version,evaluation.targetSlots,applied.afterFingerprint,actorId,lease);writesPerformed=1;
     if(deps.afterWrite)await deps.afterWrite({config,evaluation,actorId,afterFingerprint:applied.afterFingerprint});
    }
   }
   const completedAt=new Date().toISOString(),run:AutomationRun={runId,startedAt,completedAt,mode,decision:evaluation.action.type,writesPerformed,verified:true,summary:`${evaluation.action.reasonCode} · ${writesPerformed} Writes`};
   await recordAutomationRun(store,id,run,lease);let current=await getAutomationConfiguration(store,id);if(!current)throw new Error('Automation verschwand nach dem Lauf.');if(mode==='dry_run'&&current.status==='draft'){const before=current;current=await transitionAutomation(store,id,current.version,'dry_run',actorId,{},lease);if(deps.afterDryRun)await deps.afterDryRun({before,after:current,actorId})}return{configuration:current,evaluation,writesPerformed};
  }catch(error){
   const failureMessage=messageOf(error),completedAt=new Date().toISOString();
   const mutation=error&&typeof error==='object'?error as{mutationMayHaveOccurred?:boolean;compensationAttempted?:boolean;compensationVerified?:boolean}:null;
   if(mode!=='live'){
    const run:AutomationRun={runId,startedAt,completedAt,mode:'dry_run',decision:evaluation?.action.type||'failure',writesPerformed:0,verified:false,summary:`FEHLER: ${failureMessage}`},incident:AutomationIncident={incidentId:crypto.randomUUID(),at:completedAt,runId,message:failureMessage,providerMutated:false,compensation:'not_needed'};
    await recordAutomationRun(store,id,run,lease);if(deps.onIncident)await deps.onIncident({config:original,run,incident,actorId});throw error;
   }
   if(mutation?.mutationMayHaveOccurred)providerMutated=true;
   let compensation:AutomationIncident['compensation']=mutation?.compensationAttempted?(mutation.compensationVerified?'verified':'failed'):(providerMutated?'uncertain':'not_needed');
   if(providerMutated&&!mutation?.compensationAttempted&&afterFingerprint&&deps.compensateRouting){
    try{await lease.assertOwned();const restored=await deps.compensateRouting({config:original,expectedFingerprint:afterFingerprint});compensation=restored.verified&&restored.writesPerformed===1&&restored.afterFingerprint===original.acceptedBaselineFingerprint?'verified':'failed'}catch{compensation='failed'}
   }
   const run:AutomationRun={runId,startedAt,completedAt,mode:'live',decision:evaluation?.action.type||'failure',writesPerformed:providerMutated?1:0,verified:false,summary:`FEHLER: ${failureMessage}`},incident:AutomationIncident={incidentId:crypto.randomUUID(),at:completedAt,runId,message:failureMessage,providerMutated,compensation};
   await holdAutomationAfterFailure(store,id,actorId,run,incident,original,lease);
   try{await recordAutomationRun(store,id,run,lease)}catch{}
   if(deps.onIncident)await deps.onIncident({config:original,run,incident,actorId});
   throw error;
  }
 });
}
