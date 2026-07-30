import 'server-only';
import{loadAffiliateSmartlinkInsightsFromCache}from'./cached-smartlinks';
import{loadAffiliateConversionsFromCache}from'./cached-evaluations';
import{buildAutomationVariantMetrics}from'./automation-metrics';
import{runAutomationPreflight}from'./automation-preflight';
import{applyAutomationRouting}from'./everflow-automation';
import type{AutomationIncident,AutomationRun,StoredAutomationConfiguration}from'./automation-store';
import type{AutomationEvaluation}from'./automation-engine';
type Hooks={
 authorize:(config:StoredAutomationConfiguration)=>Promise<void>;
 beforeWrite:(value:{config:StoredAutomationConfiguration;evaluation:AutomationEvaluation;actorId:string})=>Promise<void>;
 afterWrite?:(value:{config:StoredAutomationConfiguration;evaluation:AutomationEvaluation;actorId:string;afterFingerprint:string})=>Promise<void>;
 afterDryRun?:(value:{before:StoredAutomationConfiguration;after:StoredAutomationConfiguration;actorId:string})=>Promise<void>;
 onIncident?:(value:{config:StoredAutomationConfiguration;run:AutomationRun;incident:AutomationIncident;actorId:string})=>Promise<void>;
};
export function automationRuntimeDependencies(input:Hooks){const apiKey=process.env.EVERFLOW_API_KEY||'';return{
 authorize:input.authorize,beforeWrite:input.beforeWrite,afterWrite:input.afterWrite,afterDryRun:input.afterDryRun,onIncident:input.onIncident,
 loadMetrics:async(config:StoredAutomationConfiguration)=>{const now=new Date(),[insights,conversions]=await Promise.all([loadAffiliateSmartlinkInsightsFromCache(String(config.affiliateId),[config.campaignId],now),loadAffiliateConversionsFromCache(String(config.affiliateId),Math.max(90,Math.ceil(config.thresholds.maturityHours/24)),now)]);const insight=insights[0];if(!insight)throw new Error('Campaign-Reporting fehlt.');return buildAutomationVariantMetrics(config,insight,conversions,now)},
 preflight:(config:StoredAutomationConfiguration)=>runAutomationPreflight(config,apiKey),
 applyRouting:async({config,evaluation,expectedFingerprint}:{config:StoredAutomationConfiguration;evaluation:AutomationEvaluation;expectedFingerprint:string})=>applyAutomationRouting({campaignId:config.campaignId,affiliateId:config.affiliateId,targetSlots:evaluation.targetSlots,expectedFingerprint,apiKey}),
 compensateRouting:async({config,expectedFingerprint}:{config:StoredAutomationConfiguration;expectedFingerprint:string})=>applyAutomationRouting({campaignId:config.campaignId,affiliateId:config.affiliateId,targetSlots:config.slots,expectedFingerprint,apiKey})
}}
