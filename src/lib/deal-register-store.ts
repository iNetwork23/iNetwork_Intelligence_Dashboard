import {createHash,randomUUID} from 'node:crypto';
import{revalidateTag,unstable_cache}from'next/cache';
import{securityStore}from'./access-store';
import type{SecurityStore}from'./security';
import{DEAL_REGISTER_CACHE_TAG,DEAL_REGISTER_STORE_KEY,DEFAULT_DEAL_RULES,normalizeStoredDealRules,sameDealRuleValues,validateDealRules,type DealRegisterState,type DealRule} from './deal-register';
export type StoredDealRegister={version:1;revision?:string;rules:DealRule[];updatedAt:string;updatedBy:string};
/** Ungecachte Leseseite: gespeicherter Datensatz (auch leer) gewinnt, sonst die Defaults. Wirft bei Store-Fehlern. */
export async function readDealRegisterState(store:SecurityStore=securityStore()):Promise<DealRegisterState>{const stored=normalizeStoredDealRules(await store.get(DEAL_REGISTER_STORE_KEY));return stored?{rules:stored,source:'stored'}:{rules:DEFAULT_DEAL_RULES.map(rule=>({...rule})),source:'defaults'}}
export const loadDealRegisterState=():Promise<DealRegisterState>=>unstable_cache(()=>readDealRegisterState(securityStore()),['deal-register-v1'],{revalidate:60,tags:[DEAL_REGISTER_CACHE_TAG]})();
/** Engine-Ladestelle: fällt bei Store-Fehlern auf die bisherigen Konstanten zurück, damit Verdikte nie ausfallen. */
export async function loadDealRegister():Promise<DealRule[]>{try{return(await loadDealRegisterState()).rules}catch(error){console.error('Deal register unavailable, falling back to defaults',error);return DEFAULT_DEAL_RULES.map(rule=>({...rule}))}}
export const expireDealRegisterCache=()=>{try{revalidateTag(DEAL_REGISTER_CACHE_TAG,{expire:0})}catch(error){console.error('Deal register cache could not be expired',error)}};
export class DealRegisterValidationError extends Error{}
export class DealRegisterConflictError extends Error{
 constructor(){super('Das Deal-Register wurde zwischenzeitlich geändert oder nicht vollständig geladen. Bitte neu laden und die Änderungen erneut prüfen.')}
}
export type EditableDealRegister=DealRegisterState&{revision:string};
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Die Verwaltung liest frisch und verweigert beschädigte Bestände statt ersatzweise Defaults zu speichern. */
async function readEditableSnapshot(store:SecurityStore):Promise<{raw:StoredDealRegister|null;state:EditableDealRegister}>{
 const raw=await store.get(DEAL_REGISTER_STORE_KEY);
 if(raw===null)return{raw:null,state:{rules:DEFAULT_DEAL_RULES.map(rule=>({...rule})),source:'defaults',revision:`defaults:${fingerprint(DEFAULT_DEAL_RULES)}`}};
 const record=raw as StoredDealRegister,normalized=normalizeStoredDealRules(raw),checked=validateDealRules(record.rules);
 if(record.version!==1||!normalized||normalized.length!==record.rules?.length||!checked.ok||(record.revision!==undefined&&(typeof record.revision!=='string'||!record.revision||record.revision.length>128)))throw new Error('Gespeichertes Deal-Register ist ungültig. Speichern ist gesperrt.');
 return{raw:record,state:{rules:normalized,source:'stored',revision:record.revision??`legacy:${fingerprint(record)}`}};
}
export async function readEditableDealRegister(store:SecurityStore=securityStore()):Promise<EditableDealRegister>{return(await readEditableSnapshot(store)).state}
/** Vollständiger Ersatz nur für den gelesenen Stand, einschließlich der ersten Speicherung eines alten Registers. */
export async function saveDealRegister(rules:unknown,actor:string,expectedRevision:unknown,store:SecurityStore=securityStore(),now=new Date()):Promise<{before:DealRegisterState;after:DealRule[];revision:string}>{
 const checked=validateDealRules(rules);if(!checked.ok)throw new DealRegisterValidationError(checked.error);
 if(typeof expectedRevision!=='string'||!expectedRevision||expectedRevision.length>160)throw new DealRegisterConflictError();
 const {raw,state}=await readEditableSnapshot(store);if(state.revision!==expectedRevision)throw new DealRegisterConflictError();
 const before:DealRegisterState={rules:state.rules,source:state.source},previous=before.source==='stored'?before.rules:[],stamp=now.toISOString(),actorId=actor.trim().slice(0,100)||'unbekannt';
 const after:DealRule[]=checked.rules.map(rule=>{const match=previous.find(item=>sameDealRuleValues(item,rule));return match?{...rule,updatedAt:match.updatedAt,updatedBy:match.updatedBy}:{...rule,updatedAt:stamp,updatedBy:actorId}});
 const revision=randomUUID(),record:StoredDealRegister={version:1,revision,rules:after,updatedAt:stamp,updatedBy:actorId};
 const saved=raw===null?await store.setIfAbsent(DEAL_REGISTER_STORE_KEY,record):await store.replaceIfRevision(DEAL_REGISTER_STORE_KEY,raw.revision??null,record);
 if(!saved)throw new DealRegisterConflictError();
 expireDealRegisterCache();return{before,after,revision};
}
