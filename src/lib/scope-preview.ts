import {filterPartnerRows,parseAccessMetadata,SCOPE_KEYS,STANDARD_ROLES,type ScopeKey,type StandardRole} from './rbac';
import type {PathRow} from './portfolio';

/**
 * Scope-Vorschau der Access-Konsole (Etappe 4, Abnahme G): Welche Partner und Offers würde ein Zugang mit dieser Rolle und diesen
 * Datenfreigaben sehen? Reine Funktion über die Pfadzeilen eines Portfolios; die Sichtbarkeit entscheidet ausschließlich
 * rbac.filterPartnerRows (Partner: leerer Scope → nichts, jede gesetzte Dimension muss passen; interne Rollen: alles – Scopes
 * schränken sie nicht ein, deshalb `scopesApply:false`). Nur Namen und SOI-Volumen, nie Geldwerte.
 */
export type ScopePreviewEntity={id:string;name:string;sois:number};
export type ScopePreview={affiliates:ScopePreviewEntity[];offers:ScopePreviewEntity[];paths:number;hidden:{affiliates:number;offers:number};/** false = die Rolle wird durch Datenfreigaben nicht eingeschränkt (interne Rollen). */scopesApply:boolean};
export type ScopePreviewInput={role:StandardRole;scopes:Partial<Record<ScopeKey,string[]>>};
export const SCOPE_PREVIEW_MAX_JSON=4000;

const rowOf=(p:PathRow)=>({affiliate_id:p.affiliateId,offer_id:p.offerId,campaign_id:p.campaignId,offer_url_id:p.offerUrlId,path:p});
const collect=(rows:{path:PathRow}[],field:'affiliate'|'offer'):ScopePreviewEntity[]=>{
 const map=new Map<string,ScopePreviewEntity>();
 for(const {path} of rows){const id=field==='affiliate'?path.affiliateId:path.offerId,name=field==='affiliate'?path.affiliate:path.offer;const entry=map.get(id)||{id,name,sois:0};entry.sois+=path.sois;map.set(id,entry)}
 return[...map.values()].sort((a,b)=>b.sois-a.sois||a.name.localeCompare(b.name,'de')||a.id.localeCompare(b.id));
};
export function previewScopeEntities(portfolio:{paths:PathRow[]},input:ScopePreviewInput):ScopePreview{
 const access=parseAccessMetadata({role:input.role,scopes:input.scopes}),all=portfolio.paths.map(rowOf),visible=filterPartnerRows(all,access);
 const affiliates=collect(visible,'affiliate'),offers=collect(visible,'offer');
 return{affiliates,offers,paths:visible.length,hidden:{affiliates:collect(all,'affiliate').length-affiliates.length,offers:collect(all,'offer').length-offers.length},scopesApply:access.role==='partner'};
}
const own=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
/** Query-Eingabe der Vorschau: Rolle aus STANDARD_ROLES, Scopes als JSON-Objekt {scopeKey:string[]} mit Längenbegrenzung; alles andere → null. */
export function parseScopePreviewInput(role:unknown,scopesJson:string|null):ScopePreviewInput|null{
 if(typeof role!=='string'||!Object.prototype.hasOwnProperty.call(STANDARD_ROLES,role))return null;
 const scopes:Partial<Record<ScopeKey,string[]>>={};
 if(scopesJson!==null&&scopesJson!==''){
  if(scopesJson.length>SCOPE_PREVIEW_MAX_JSON)return null;
  let parsed:unknown;try{parsed=JSON.parse(scopesJson)}catch{return null}
  if(!own(parsed))return null;
  for(const [key,value] of Object.entries(parsed)){
   if(!(SCOPE_KEYS as readonly string[]).includes(key)||!Array.isArray(value)||!value.every(x=>typeof x==='string'))return null;
   scopes[key as ScopeKey]=value.map(x=>x.trim()).filter(x=>x.length>0&&x.length<=200).slice(0,100);
  }
 }
 return{role:role as StandardRole,scopes};
}
