import {createHash} from 'node:crypto';
import type {AutomationSlot} from './automation-config';

const BASE='https://api.eflow.team/v1';
type Fetcher=typeof fetch;
type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
type Redirect={network_campaign_redirect_id?:number;redirect_network_offer_id:number;redirect_network_offer_url_id:number;routing_value:number;ruleset?:unknown};
type Labels={entries?:string[]}|string[];
export type AutomationCampaign={
 network_campaign_id:number;network_affiliate_id?:number;campaign_name:string;campaign_status:string;network_tracking_domain_id:number;redirect_routing_type:string;
 is_open_to_affiliates:boolean;is_use_secure_link:boolean;catch_all_network_offer_id?:number;data_collection_threshold?:number;data_lookback_window?:string;
 metric?:string;optimization_goal?:number;run_frequency?:string;conversion_method?:string;is_whitelist_check_enabled?:boolean;
 relationship:{redirects:{entries:Redirect[]};labels?:Labels};
};

const RUN_FREQUENCIES=['unknown','12_hours','24_hours','6_hours','3_hours','1_hours'] as const;
const METRICS=['unknown','profit','cvr','evr','conversions','payout','revenue','rpc','cpc','epc'] as const;
const LOOKBACK_WINDOWS=['unknown','12_hours','24_hours','48_hours'] as const;
const CONVERSION_METHODS=['server_postback','pixel_tracking'] as const;
const safeId=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
const enumValue=(value:unknown,allowed:readonly string[])=>typeof value==='string'&&allowed.includes(value);
const invalidSnapshot=()=>new Error('Everflow lieferte einen ungültigen Campaign-Snapshot');

function jsonValue(value:unknown,seen=new WeakSet<object>()):value is JsonValue{
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object')return false;
 if(seen.has(value))return false;
 seen.add(value);
 const valid=Array.isArray(value)?value.every(item=>jsonValue(item,seen)):Object.entries(value).every(([,item])=>jsonValue(item,seen));
 seen.delete(value);
 return valid;
}
function labelEntries(campaign:AutomationCampaign):string[]{
 const value=campaign.relationship?.labels;
 if(value===undefined)throw new Error('Everflow lieferte keinen vollständigen Campaign-Snapshot');
 const result=Array.isArray(value)?value:value.entries;
 if(!Array.isArray(result)||!result.every(label=>typeof label==='string'))throw invalidSnapshot();
 return result;
}
function assertCompleteCampaign(campaign:AutomationCampaign,id?:number,affiliateId?:number){
 if(id!==undefined&&campaign.network_campaign_id!==id)throw new Error('Everflow lieferte eine andere Campaign-ID');
 if(affiliateId!==undefined&&campaign.network_affiliate_id!==undefined&&campaign.network_affiliate_id!==affiliateId)throw new Error('Everflow Campaign gehört zu einem anderen Affiliate');
 if(!safeId(campaign.network_campaign_id)||(campaign.network_affiliate_id!==undefined&&!safeId(campaign.network_affiliate_id))||typeof campaign.campaign_name!=='string'||!campaign.campaign_name.trim())throw new Error('Everflow lieferte keinen vollständigen Campaign-Snapshot');
 if(!enumValue(campaign.campaign_status,['active','paused','deleted'])||!safeId(campaign.network_tracking_domain_id)||!enumValue(campaign.redirect_routing_type,['priority','weight','kpi']))throw invalidSnapshot();
 if(typeof campaign.is_open_to_affiliates!=='boolean'||typeof campaign.is_use_secure_link!=='boolean'||!Array.isArray(campaign.relationship?.redirects?.entries))throw new Error('Everflow lieferte keinen vollständigen Campaign-Snapshot');
 labelEntries(campaign);
 const identities=new Set<string>();
 for(const redirect of campaign.relationship.redirects.entries){
  if(!safeId(redirect.redirect_network_offer_id)||!safeId(redirect.redirect_network_offer_url_id)||typeof redirect.routing_value!=='number'||!Number.isFinite(redirect.routing_value))throw invalidSnapshot();
  if(redirect.ruleset!==undefined&&!jsonValue(redirect.ruleset))throw invalidSnapshot();
  const identity=redirectIdentity(redirect.redirect_network_offer_id,redirect.redirect_network_offer_url_id);
  if(identities.has(identity))throw new Error('Everflow lieferte mehrdeutige Redirect-Identitäten im Campaign-Snapshot');
  identities.add(identity);
 }
 if(campaign.catch_all_network_offer_id!==undefined&&!safeId(campaign.catch_all_network_offer_id))throw invalidSnapshot();
 if(campaign.data_collection_threshold!==undefined&&(!Number.isSafeInteger(campaign.data_collection_threshold)||campaign.data_collection_threshold<0))throw invalidSnapshot();
 if(campaign.data_lookback_window!==undefined&&!enumValue(campaign.data_lookback_window,LOOKBACK_WINDOWS))throw invalidSnapshot();
 if(campaign.metric!==undefined&&!enumValue(campaign.metric,METRICS))throw invalidSnapshot();
 if(campaign.optimization_goal!==undefined&&(typeof campaign.optimization_goal!=='number'||!Number.isFinite(campaign.optimization_goal)))throw invalidSnapshot();
 if(campaign.run_frequency!==undefined&&!enumValue(campaign.run_frequency,RUN_FREQUENCIES))throw invalidSnapshot();
 if(campaign.conversion_method!==undefined&&!enumValue(campaign.conversion_method,CONVERSION_METHODS))throw invalidSnapshot();
 if(campaign.is_whitelist_check_enabled!==undefined&&typeof campaign.is_whitelist_check_enabled!=='boolean')throw invalidSnapshot();
 if(campaign.redirect_routing_type==='kpi'&&(campaign.run_frequency===undefined||campaign.metric===undefined||campaign.optimization_goal===undefined||campaign.data_lookback_window===undefined||campaign.data_collection_threshold===undefined))throw new Error('Everflow lieferte unvollständige KPI-Routingdaten im Campaign-Snapshot');
}
function redirectIdentity(offerId:number,offerUrlId:number){return `${offerId}:${offerUrlId}`}
function redirectPayload(redirect:Redirect){return{redirect_network_offer_id:redirect.redirect_network_offer_id,redirect_network_offer_url_id:redirect.redirect_network_offer_url_id,routing_value:redirect.routing_value,...(redirect.ruleset!==undefined?{ruleset:redirect.ruleset as JsonValue}:{})}}
function fullPutFields(campaign:AutomationCampaign,redirects:ReturnType<typeof redirectPayload>[]){
 return{campaign_name:campaign.campaign_name,campaign_status:campaign.campaign_status,network_tracking_domain_id:campaign.network_tracking_domain_id,is_use_secure_link:campaign.is_use_secure_link,redirect_routing_type:campaign.redirect_routing_type,is_open_to_affiliates:campaign.is_open_to_affiliates,redirects,labels:labelEntries(campaign),...(campaign.catch_all_network_offer_id!==undefined?{catch_all_network_offer_id:campaign.catch_all_network_offer_id}:{}),...(campaign.data_collection_threshold!==undefined?{data_collection_threshold:campaign.data_collection_threshold}:{}),...(campaign.data_lookback_window!==undefined?{data_lookback_window:campaign.data_lookback_window}:{}),...(campaign.metric!==undefined?{metric:campaign.metric}:{}),...(campaign.optimization_goal!==undefined?{optimization_goal:campaign.optimization_goal}:{}),...(campaign.run_frequency!==undefined?{run_frequency:campaign.run_frequency}:{}),...(campaign.conversion_method!==undefined?{conversion_method:campaign.conversion_method}:{}),...(campaign.is_whitelist_check_enabled!==undefined?{is_whitelist_check_enabled:campaign.is_whitelist_check_enabled}:{})};
}
function canonicalJson(value:JsonValue):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
 return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
function semantic(campaign:AutomationCampaign):JsonValue{
 assertCompleteCampaign(campaign);
 return{campaignId:campaign.network_campaign_id,affiliateId:campaign.network_affiliate_id,...fullPutFields(campaign,campaign.relationship.redirects.entries.map(redirectPayload))} as JsonValue;
}
export const campaignAutomationFingerprint=(campaign:AutomationCampaign)=>`sha256:${createHash('sha256').update(canonicalJson(semantic(campaign))).digest('hex')}`;

function assertTarget(targetSlots:AutomationSlot[]){
 if(!targetSlots.length||targetSlots.length>100)throw new Error('Ungültiges Ziel-Routing');
 const identities=targetSlots.map(slot=>redirectIdentity(slot.offerId,slot.offerUrlId));
 if(new Set(identities).size!==identities.length)throw new Error('Doppelte Redirect-Identität im Ziel-Routing');
 const total=targetSlots.reduce((sum,slot)=>sum+slot.weight,0);
 if(!Number.isFinite(total)||Math.abs(total-100)>0.01||targetSlots.some(slot=>!safeId(slot.offerId)||!safeId(slot.offerUrlId)||!Number.isFinite(slot.weight)||slot.weight<=0))throw new Error('Zielgewichte müssen valide sein und 100 % ergeben');
}
export function buildAutomationCampaignPayload(campaign:AutomationCampaign,targetSlots:AutomationSlot[]){
 assertCompleteCampaign(campaign);assertTarget(targetSlots);
 const rulesets=new Map(campaign.relationship.redirects.entries.filter(row=>row.ruleset!==undefined).map(row=>[redirectIdentity(row.redirect_network_offer_id,row.redirect_network_offer_url_id),row.ruleset as JsonValue]));
 const redirects=targetSlots.map(slot=>{const ruleset=rulesets.get(redirectIdentity(slot.offerId,slot.offerUrlId));return{redirect_network_offer_id:slot.offerId,redirect_network_offer_url_id:slot.offerUrlId,routing_value:slot.weight,...(ruleset!==undefined?{ruleset}:{})}});
 return fullPutFields(campaign,redirects);
}

async function request<T>(fetcher:Fetcher,url:string,init:RequestInit){const response=await fetcher(url,{...init,signal:init.signal||AbortSignal.timeout(30_000)});if(!response.ok)throw new Error(`Everflow Automation API HTTP ${response.status}`);return response.json() as Promise<T>}
async function writeCampaign(fetcher:Fetcher,url:string,init:RequestInit){const response=await fetcher(url,{...init,signal:init.signal||AbortSignal.timeout(30_000)});if(!response.ok)throw new Error(`Everflow Automation API HTTP ${response.status}`)}
const headers=(apiKey:string)=>({'X-Eflow-API-Key':apiKey,'Content-Type':'application/json'});
async function readCampaign(campaignId:number,affiliateId:number,apiKey:string,fetcher:Fetcher){const campaign=await request<AutomationCampaign>(fetcher,`${BASE}/networks/campaigns/${campaignId}?relationship=redirects`,{headers:headers(apiKey)});assertCompleteCampaign(campaign,campaignId,affiliateId);return campaign}
const slotsFrom=(campaign:AutomationCampaign):AutomationSlot[]=>campaign.relationship.redirects.entries.map((row,index)=>({offerId:row.redirect_network_offer_id,offerUrlId:row.redirect_network_offer_url_id,familyKey:`rollback-${index}`,familyName:`Rollback ${index+1}`,offerUrlName:`LP #${row.redirect_network_offer_url_id}`,weight:Number(row.routing_value)}));
const intendedCampaign=(before:AutomationCampaign,targetSlots:AutomationSlot[]):AutomationCampaign=>({...before,relationship:{...before.relationship,redirects:{entries:buildAutomationCampaignPayload(before,targetSlots).redirects}}});
export class AutomationCampaignMutationError extends Error{
 readonly mutationMayHaveOccurred=true;
 readonly compensationAttempted=true;
 constructor(message:string,readonly compensationVerified:boolean,readonly originalFailure:unknown,readonly compensationFailure?:unknown){super(message);this.name='AutomationCampaignMutationError'}
}
export async function applyAutomationRouting(input:{campaignId:number;affiliateId:number;targetSlots:AutomationSlot[];expectedFingerprint:string;apiKey:string;fetcher?:Fetcher}){
 const fetcher=input.fetcher||fetch;
 if(!input.apiKey)throw new Error('EVERFLOW_API_KEY fehlt');
 assertTarget(input.targetSlots);
 const before=await readCampaign(input.campaignId,input.affiliateId,input.apiKey,fetcher),beforeFingerprint=campaignAutomationFingerprint(before);
 if(beforeFingerprint!==input.expectedFingerprint)throw new Error('Fremdänderung erkannt; Campaign-Baseline stimmt nicht überein');
 const url=`${BASE}/networks/campaigns/${input.campaignId}`,init=(body:unknown):RequestInit=>({method:'PUT',headers:headers(input.apiKey),body:JSON.stringify(body)});
 const payload=buildAutomationCampaignPayload(before,input.targetSlots),rollbackPayload=buildAutomationCampaignPayload(before,slotsFrom(before)),expectedAfter=campaignAutomationFingerprint(intendedCampaign(before,input.targetSlots));
 let originalFailure:unknown;
 try{
  await writeCampaign(fetcher,url,init(payload));
  const after=await readCampaign(input.campaignId,input.affiliateId,input.apiKey,fetcher);
  if(campaignAutomationFingerprint(after)!==expectedAfter)throw new Error('Campaign-Verifikation ergab nicht den exakt beabsichtigten Zustand');
  return{verified:true,writesPerformed:1,beforeFingerprint,afterFingerprint:expectedAfter,campaign:after,mutationMayHaveOccurred:true,compensationAttempted:false,compensationVerified:false};
 }catch(error){originalFailure=error}
 let compensationFailure:unknown,compensationVerified=false;
 try{await writeCampaign(fetcher,url,init(rollbackPayload))}catch(error){compensationFailure=error}
 try{
  const restored=await readCampaign(input.campaignId,input.affiliateId,input.apiKey,fetcher);
  compensationVerified=campaignAutomationFingerprint(restored)===beforeFingerprint;
  if(!compensationVerified&&!compensationFailure)compensationFailure=new Error('Rollback-Verifikation wich vom ursprünglichen Zustand ab');
 }catch(error){compensationFailure=compensationFailure??error}
 if(compensationVerified)throw new AutomationCampaignMutationError('Campaign-Write oder Verifikation fehlgeschlagen; ursprünglicher Zustand wurde wiederhergestellt und verifiziert',true,originalFailure,compensationFailure);
 throw new AutomationCampaignMutationError('Campaign-Write oder Verifikation und Rollback-Verifikation fehlgeschlagen; Zustand unklar',false,originalFailure,compensationFailure);
}
export async function readAutomationCampaignBaseline(campaignId:number,affiliateId:number,apiKey:string,fetcher:Fetcher=fetch){if(!apiKey)throw new Error('EVERFLOW_API_KEY fehlt');const campaign=await readCampaign(campaignId,affiliateId,apiKey,fetcher);return{campaign,fingerprint:campaignAutomationFingerprint(campaign)}}
