import{revalidateTag,unstable_cache}from'next/cache';
import{securityStore}from'./access-store';
import type{SecurityStore}from'./security';
import{DEAL_REGISTER_CACHE_TAG,DEAL_REGISTER_STORE_KEY,DEFAULT_DEAL_RULES,normalizeStoredDealRules,sameDealRuleValues,validateDealRules,type DealRegisterState,type DealRule} from './deal-register';
export type StoredDealRegister={version:1;rules:DealRule[];updatedAt:string;updatedBy:string};
/** Ungecachte Leseseite: gespeicherter Datensatz (auch leer) gewinnt, sonst die Defaults. Wirft bei Store-Fehlern. */
export async function readDealRegisterState(store:SecurityStore=securityStore()):Promise<DealRegisterState>{const stored=normalizeStoredDealRules(await store.get(DEAL_REGISTER_STORE_KEY));return stored?{rules:stored,source:'stored'}:{rules:DEFAULT_DEAL_RULES.map(rule=>({...rule})),source:'defaults'}}
export const loadDealRegisterState=():Promise<DealRegisterState>=>unstable_cache(()=>readDealRegisterState(securityStore()),['deal-register-v1'],{revalidate:60,tags:[DEAL_REGISTER_CACHE_TAG]})();
/** Engine-Ladestelle: fällt bei Store-Fehlern auf die bisherigen Konstanten zurück, damit Verdikte nie ausfallen. */
export async function loadDealRegister():Promise<DealRule[]>{try{return(await loadDealRegisterState()).rules}catch(error){console.error('Deal register unavailable, falling back to defaults',error);return DEFAULT_DEAL_RULES.map(rule=>({...rule}))}}
export const expireDealRegisterCache=()=>{try{revalidateTag(DEAL_REGISTER_CACHE_TAG,{expire:0})}catch(error){console.error('Deal register cache could not be expired',error)}};
export class DealRegisterValidationError extends Error{}
/** Ersetzt das Register vollständig (additiver sync_state-Namensraum). Unveränderte Regeln behalten ihren Stempel, geänderte/neue bekommen actor + now. */
export async function saveDealRegister(rules:unknown,actor:string,store:SecurityStore=securityStore(),now=new Date()):Promise<{before:DealRegisterState;after:DealRule[]}>{
 const checked=validateDealRules(rules);if(!checked.ok)throw new DealRegisterValidationError(checked.error);
 const before=await readDealRegisterState(store),previous=before.source==='stored'?before.rules:[],stamp=now.toISOString(),actorId=actor.trim().slice(0,100)||'unbekannt';
 const after:DealRule[]=checked.rules.map(rule=>{const match=previous.find(item=>sameDealRuleValues(item,rule));return match?{...rule,updatedAt:match.updatedAt,updatedBy:match.updatedBy}:{...rule,updatedAt:stamp,updatedBy:actorId}});
 const record:StoredDealRegister={version:1,rules:after,updatedAt:stamp,updatedBy:actorId};await store.set(DEAL_REGISTER_STORE_KEY,record);expireDealRegisterCache();return{before,after};
}
