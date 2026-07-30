import 'server-only';
import {getSupabaseAdmin} from './supabase';
import type {SecurityStore} from './security';
export class SyncStateSecurityStore implements SecurityStore{
 async get(key:string){const {data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key',key).maybeSingle();if(error)throw new Error('Sicherheitsstatus nicht verfügbar');return data?.value??null}
 async set(key:string,value:unknown){const {error}=await getSupabaseAdmin().from('sync_state').upsert({key,value},{onConflict:'key'});if(error)throw new Error('Sicherheitsstatus nicht verfügbar')}
 async setIfAbsent(key:string,value:unknown){const {error}=await getSupabaseAdmin().from('sync_state').insert({key,value});if(!error)return true;if(error.code==='23505')return false;throw new Error('Sicherheitsstatus nicht verfügbar')}
 async tryAcquireLease(key:string,owner:string,expiresAt:number,now:number){const client=getSupabaseAdmin(),{error}=await client.from('sync_state').insert({key,value:{owner,expiresAt}});if(!error)return true;if(error.code!=='23505')throw new Error('Sicherheitsstatus nicht verfügbar');const {data,error:updateError}=await client.from('sync_state').update({value:{owner,expiresAt}}).eq('key',key).or(`value->>expiresAt.lt.${now},value->>expiresAt.is.null`).select('key').maybeSingle();if(updateError)throw new Error('Sicherheitsstatus nicht verfügbar');return Boolean(data)}
 async renewLease(key:string,owner:string,expiresAt:number,now:number){const {data,error}=await getSupabaseAdmin().from('sync_state').update({value:{owner,expiresAt}}).eq('key',key).eq('value->>owner',owner).gt('value->>expiresAt',String(now)).select('key').maybeSingle();if(error)throw new Error('Sicherheitsstatus nicht verfügbar');return Boolean(data)}
 async deleteIfOwner(key:string,owner:string){const {data,error}=await getSupabaseAdmin().from('sync_state').delete().eq('key',key).eq('value->>owner',owner).select('key').maybeSingle();if(error)throw new Error('Sicherheitsstatus nicht verfügbar');return Boolean(data)}
 async delete(key:string){const {error}=await getSupabaseAdmin().from('sync_state').delete().eq('key',key);if(error)throw new Error('Sicherheitsstatus nicht verfügbar')}
 async list(prefix:string){const {data,error}=await getSupabaseAdmin().from('sync_state').select('key,value').like('key',`${prefix.replace(/[%_]/g,'\\$&')}%`).limit(1000);if(error)throw new Error('Sicherheitsstatus nicht verfügbar');return (data||[]) as Array<{key:string;value:unknown}>}
}
let singleton:SyncStateSecurityStore|undefined;
export const securityStore=()=>singleton??(singleton=new SyncStateSecurityStore());
export type AuditEvent={id:string;at:string;actorId:string;action:string;targetId?:string;before?:unknown;after?:unknown;ip?:string;userAgent?:string};
export async function audit(event:Omit<AuditEvent,'id'|'at'>){const record:AuditEvent={...event,id:crypto.randomUUID(),at:new Date().toISOString()};await securityStore().set(`rbac:audit:${record.at}:${record.id}`,record);return record;}
export async function listAudit(){return (await securityStore().list('rbac:audit:')).map(x=>x.value as AuditEvent).sort((a,b)=>b.at.localeCompare(a.at));}
export const requestEvidence=(request:Request)=>({ip:(request.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,64),userAgent:(request.headers.get('user-agent')||'').slice(0,500)});
