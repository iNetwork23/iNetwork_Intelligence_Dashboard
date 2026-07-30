import 'server-only';
import {getSupabaseAdmin} from './supabase';
import type {CampaignShape} from './smartlink';
import{campaignDirectoryViewFromSnapshot,type CampaignDirectoryView}from'./campaign-picker';
import{newSnapshotGeneration,snapshotGenerationCreatedAt}from'./snapshot-generation';

const BASE='https://api.eflow.team/v1';
const LEGACY_PREFIX='campaign_snapshot:';
const GENERATION_PREFIX='campaign_snapshot_generation:';
const ACTIVE_KEY='campaign_snapshot_active';
type CampaignSummary={network_campaign_id:number;campaign_name:string;campaign_status:string};
export type CampaignDirectoryItem=CampaignDirectoryView;
type SnapshotValue={campaign_id:string;campaign_name:string;campaign_status:string;payload:CampaignShape|Record<string,never>;synced_at:string};
type SnapshotRow={key:string;value:SnapshotValue};

const headers=(apiKey:string)=>({'X-Eflow-API-Key':apiKey,'Content-Type':'application/json'});
async function everflowJson<T>(url:string,apiKey:string,attempt=1):Promise<T>{
  const response=await fetch(url,{headers:headers(apiKey),signal:AbortSignal.timeout(30_000)});
  if(response.status===429&&attempt<4){await new Promise(resolve=>setTimeout(resolve,attempt*1_000));return everflowJson<T>(url,apiKey,attempt+1)}
  if(!response.ok)throw new Error(`Everflow campaign sync HTTP ${response.status}: ${(await response.text()).slice(0,180)}`);
  return response.json() as Promise<T>;
}
async function activeGeneration(){const{data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key',ACTIVE_KEY).maybeSingle();if(error)throw new Error(`Supabase campaign generation: ${error.message}`);return(data?.value as{generation?:string}|undefined)?.generation||null}
async function loadRowsWithPrefix(prefix:string):Promise<SnapshotRow[]>{const rows:SnapshotRow[]=[];for(let start=0;;start+=1000){const{data,error}=await getSupabaseAdmin().from('sync_state').select('key,value').like('key',`${prefix}%`).order('key').range(start,start+999);if(error)throw new Error(`Supabase campaign snapshot read: ${error.message}`);rows.push(...((data||[])as SnapshotRow[]));if((data||[]).length<1000)break}return rows}
async function loadAllSnapshotRows():Promise<SnapshotRow[]>{const generation=await activeGeneration();return loadRowsWithPrefix(generation?`${GENERATION_PREFIX}${generation}:`:LEGACY_PREFIX)}
function validDirectory(value:unknown):value is CampaignSummary[]{if(!Array.isArray(value)||!value.length)return false;const ids=new Set<number>();for(const item of value){if(!item||!Number.isInteger(item.network_campaign_id)||item.network_campaign_id<=0||typeof item.campaign_name!=='string'||!item.campaign_name.trim()||typeof item.campaign_status!=='string'||!item.campaign_status.trim()||ids.has(item.network_campaign_id))return false;ids.add(item.network_campaign_id)}return true}
function validShape(value:unknown,expectedId:number):value is CampaignShape{if(!value||typeof value!=='object')return false;const shape=value as CampaignShape,entries=shape.relationship?.redirects?.entries;return shape.network_campaign_id===expectedId&&typeof shape.campaign_name==='string'&&Boolean(shape.campaign_name.trim())&&typeof shape.campaign_status==='string'&&Boolean(shape.campaign_status.trim())&&typeof shape.redirect_routing_type==='string'&&Array.isArray(entries)&&entries.every(entry=>Number.isInteger(entry.redirect_network_offer_id)&&entry.redirect_network_offer_id>0&&Number.isInteger(entry.redirect_network_offer_url_id)&&entry.redirect_network_offer_url_id>=0&&Number.isFinite(entry.routing_value))}

async function pruneCampaignGenerations(){const active=await activeGeneration(),cutoff=Date.now()-24*60*60_000,rows=await loadRowsWithPrefix(GENERATION_PREFIX),stale=rows.map(row=>row.key).filter(key=>{const generation=key.slice(GENERATION_PREFIX.length).split(':')[0],created=snapshotGenerationCreatedAt(generation);return generation!==active&&created!==null&&created<cutoff});for(let start=0;start<stale.length;start+=200){const latest=await activeGeneration(),safe=stale.slice(start,start+200).filter(key=>key.slice(GENERATION_PREFIX.length).split(':')[0]!==latest);if(!safe.length)continue;const result=await getSupabaseAdmin().from('sync_state').delete().in('key',safe);if(result.error)throw new Error(`Supabase stale campaign generation delete: ${result.error.message}`)}}

export async function loadCampaignDirectoryFromCache():Promise<CampaignDirectoryItem[]>{const data=await loadAllSnapshotRows();if(!data.length)throw new Error('Campaign-Metadaten-Generation fehlt');const summaries=data.map(row=>row.value).map(value=>({network_campaign_id:Number(value.campaign_id),campaign_name:value.campaign_name,campaign_status:value.campaign_status}));if(!validDirectory(summaries))throw new Error('Campaign-Metadaten-Generation ist beschädigt');return data.map((row,index)=>{const id=summaries[index].network_campaign_id;if(!validShape(row.value.payload,id))throw new Error(`Campaign #${id}: Cache fehlt oder ist beschädigt`);return campaignDirectoryViewFromSnapshot(summaries[index],row.value.payload)}).sort((a,b)=>a.network_campaign_id-b.network_campaign_id)}

export async function loadCampaignShapesFromCache(ids:number[]):Promise<CampaignShape[]>{
  const wanted=Array.from(new Set(ids.filter(id=>Number.isInteger(id)&&id>0)));if(!wanted.length)return[];
  const generation=await activeGeneration(),prefix=generation?`${GENERATION_PREFIX}${generation}:`:LEGACY_PREFIX,data:SnapshotRow[]=[];
  for(let start=0;start<wanted.length;start+=100){const result=await getSupabaseAdmin().from('sync_state').select('key,value').in('key',wanted.slice(start,start+100).map(id=>`${prefix}${id}`));if(result.error)throw new Error(`Supabase campaign snapshots: ${result.error.message}`);data.push(...((result.data||[])as SnapshotRow[]))}
  const byId=new Map(data.map(row=>[row.value.campaign_id,row.value.payload]));return wanted.map(id=>{const payload=byId.get(String(id));if(!validShape(payload,id))throw new Error(`Campaign #${id}: Cache fehlt oder ist beschädigt`);return payload});
}

export async function syncCampaignSnapshots(apiKey:string,limit=60){
  if(!apiKey)throw new Error('EVERFLOW_API_KEY fehlt');
  await pruneCampaignGenerations();
  const directoryResponse=await everflowJson<{campaigns?:CampaignSummary[]}>(`${BASE}/networks/campaigns`,apiKey);if(!validDirectory(directoryResponse.campaigns))throw new Error('Campaign-Verzeichnis ist leer, doppelt oder unvollständig');const directory=directoryResponse.campaigns,supabase=getSupabaseAdmin(),existing=await loadAllSnapshotRows(),existingMap=new Map(existing.map(row=>[row.value.campaign_id,row.value])),staleBefore=Date.now()-24*60*60_000;
  const candidates=directory.filter(item=>{const current=existingMap.get(String(item.network_campaign_id));return!current||!validShape(current.payload,item.network_campaign_id)||Date.parse(current.synced_at)<staleBefore}),details:CampaignShape[]=[],batchSize=Math.max(1,Math.min(6,limit||1));
  for(let start=0;start<candidates.length;start+=batchSize){const requested=candidates.slice(start,start+batchSize),batch=await Promise.allSettled(requested.map(item=>everflowJson<CampaignShape>(`${BASE}/networks/campaigns/${item.network_campaign_id}?relationship=redirects`,apiKey)));for(let index=0;index<batch.length;index++){const result=batch[index],expected=requested[index].network_campaign_id;if(result.status==='rejected')throw new Error(`Campaign #${expected}: Detailabruf fehlgeschlagen: ${result.reason instanceof Error?result.reason.message:'unbekannter Fehler'}`);if(!validShape(result.value,expected))throw new Error(`Campaign #${expected}: Detailantwort unvollständig oder falsche Campaign-ID`);details.push(result.value)}}
  const detailMap=new Map(details.map(shape=>[shape.network_campaign_id,shape])),now=new Date().toISOString(),generation=newSnapshotGeneration(),rows=directory.map(item=>{const previous=existingMap.get(String(item.network_campaign_id)),fresh=detailMap.get(item.network_campaign_id);return{key:`${GENERATION_PREFIX}${generation}:${item.network_campaign_id}`,value:{campaign_id:String(item.network_campaign_id),campaign_name:item.campaign_name,campaign_status:item.campaign_status,payload:fresh||previous?.payload||{},synced_at:fresh?now:(previous?.synced_at||now)} satisfies SnapshotValue}}),pending=rows.filter(row=>!validShape(row.value.payload,Number(row.value.campaign_id))).length;
  if(pending)throw new Error(`Campaign-Metadaten unvollständig: ${pending} Campaigns ohne Details`);
  for(let start=0;start<rows.length;start+=100){const{error}=await supabase.from('sync_state').upsert(rows.slice(start,start+100),{onConflict:'key'});if(error)throw new Error(`Supabase campaign snapshot upsert: ${error.message}`)}
  const{error}=await supabase.from('sync_state').upsert({key:ACTIVE_KEY,value:{version:1,generation,directory:rows.length,synced_at:now}},{onConflict:'key'});if(error)throw new Error(`Supabase campaign generation switch: ${error.message}`);
  await pruneCampaignGenerations();
  return{directory:directory.length,refreshed:details.length,pending:0};
}
