/**
 * Deal-Register (D9): partnerspezifische Regeln, die früher als Konstanten im Code lagen.
 * Client-sicher (keine Server-Importe). Laden/Speichern in ./deal-register-store.ts.
 * Ohne gespeicherten Eintrag gelten DEFAULT_DEAL_RULES = die bisherigen Konstanten (kein Verhaltenswechsel).
 */
export type DealRule={affiliateId:number;campaignId?:number;testQuotaSois?:number;maturityHours?:number;cvrFloorPct?:number;note:string;updatedAt:string;updatedBy:string};
export type DealRuleInput=Omit<DealRule,'updatedAt'|'updatedBy'>;
export type DealRegisterState={rules:DealRule[];source:'stored'|'defaults'};
export const DEAL_REGISTER_STORE_KEY='deal_register:v1';
export const DEAL_REGISTER_CACHE_TAG='deal-register';
export const DEAL_RULE_LIMITS={testQuotaSois:{min:1,max:10_000},maturityHours:{min:1,max:8_760},cvrFloorPct:{min:0.01,max:100},noteLength:200,maxRules:200} as const;
const DEFAULT_STAMP='2026-09-04T00:00:00.000Z';
/** Bisherige Konstanten: smartlink.ts (436 → 50-SOI-Testquote), automation-config.ts/automation-import.ts (436 → Reife 336 h statt 168 h), smartlink.ts (6/2 → 1-%-CVR-Leitplanke). */
export const DEFAULT_DEAL_RULES:readonly DealRule[]=Object.freeze([
 Object.freeze({affiliateId:436,testQuotaSois:50,maturityHours:336,note:'Traffic Company: 50-SOI-Testquote je Landingpage, Reifefenster 336 h (bisherige Konstante).',updatedAt:DEFAULT_STAMP,updatedBy:'system'}),
 Object.freeze({affiliateId:6,campaignId:2,cvrFloorPct:1,note:'TrafficPartner Campaign 2: 1-%-CVR-Leitplanke, CVR-starke Slots nicht reduzieren (bisherige Konstante).',updatedAt:DEFAULT_STAMP,updatedBy:'system'}),
]);
const NUMERIC_FIELDS=['testQuotaSois','maturityHours','cvrFloorPct'] as const;
type NumericField=typeof NUMERIC_FIELDS[number];
const positiveInt=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const isRule=(value:unknown):value is DealRule=>{if(!value||typeof value!=='object')return false;const rule=value as Record<string,unknown>;return positiveInt(rule.affiliateId)&&(rule.campaignId===undefined||positiveInt(rule.campaignId))&&typeof rule.note==='string'&&typeof rule.updatedAt==='string'&&typeof rule.updatedBy==='string'&&NUMERIC_FIELDS.every(field=>rule[field]===undefined||(typeof rule[field]==='number'&&Number.isFinite(rule[field] as number)))};
/** Gespeicherte Werte werden streng gelesen: ungültige Einträge fallen weg, damit ein beschädigter Datensatz nie das Verdikt verändert. */
export function normalizeStoredDealRules(raw:unknown):DealRule[]|null{const rules=raw&&typeof raw==='object'&&Array.isArray((raw as{rules?:unknown}).rules)?(raw as{rules:unknown[]}).rules:null;if(!rules)return null;return rules.filter(isRule).map(rule=>({...rule}))}
/** Feldweise Auflösung: die Partnerregel (ohne Campaign) liefert die Basis, eine Campaign-Regel überschreibt nur die Felder, die sie selbst setzt. Ohne passende Regel null. */
export function resolveDealRule(rules:readonly DealRule[],affiliateId:number,campaignId?:number):DealRule|null{
 const base=rules.find(rule=>rule.affiliateId===affiliateId&&rule.campaignId===undefined)||null,specific=campaignId===undefined?null:rules.find(rule=>rule.affiliateId===affiliateId&&rule.campaignId===campaignId)||null;
 if(!base&&!specific)return null;if(!specific)return{...base as DealRule};if(!base)return{...specific};
 const merged:DealRule={...specific};for(const field of NUMERIC_FIELDS)if(merged[field]===undefined&&base[field]!==undefined)merged[field]=base[field];return merged;
}
const inRange=(field:NumericField,value:number)=>{const limit=DEAL_RULE_LIMITS[field];return value>=limit.min&&value<=limit.max};
const numberField=(value:unknown):number|undefined|'invalid'=>{if(value===undefined||value===null||value==='')return undefined;const n=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value.replace(',','.')):Number.NaN;return Number.isFinite(n)?n:'invalid'};
const LABELS:Record<NumericField,string>={testQuotaSois:'Testquote (SOIs)',maturityHours:'Reife (Stunden)',cvrFloorPct:'CVR-Untergrenze (%)'};
/** Validiert Formular-/API-Eingaben. Gibt entweder die bereinigten Regeln (ohne Zeitstempel) oder einen deutschen Fehlertext zurück. */
export function validateDealRules(raw:unknown):{ok:true;rules:DealRuleInput[]}|{ok:false;error:string}{
 if(!Array.isArray(raw))return{ok:false,error:'Regeln fehlen oder sind kein Array.'};
 if(raw.length>DEAL_RULE_LIMITS.maxRules)return{ok:false,error:`Höchstens ${DEAL_RULE_LIMITS.maxRules} Regeln.`};
 const rules:DealRuleInput[]=[],seen=new Set<string>();
 for(const[index,item]of raw.entries()){
  const at=`Regel ${index+1}`;if(!item||typeof item!=='object'||Array.isArray(item))return{ok:false,error:`${at}: ungültiges Format.`};
  const input=item as Record<string,unknown>,affiliateId=numberField(input.affiliateId),campaignId=numberField(input.campaignId);
  if(affiliateId===undefined||affiliateId==='invalid'||!positiveInt(affiliateId))return{ok:false,error:`${at}: Partner-ID muss eine positive ganze Zahl sein.`};
  if(campaignId==='invalid'||(campaignId!==undefined&&!positiveInt(campaignId)))return{ok:false,error:`${at}: Campaign-ID muss leer oder eine positive ganze Zahl sein.`};
  const rule:DealRuleInput={affiliateId,...(campaignId!==undefined?{campaignId}:{}),note:''};
  for(const field of NUMERIC_FIELDS){const value=numberField(input[field]);if(value==='invalid')return{ok:false,error:`${at}: ${LABELS[field]} ist keine Zahl.`};if(value===undefined)continue;if(field!=='cvrFloorPct'&&!Number.isSafeInteger(value))return{ok:false,error:`${at}: ${LABELS[field]} muss eine ganze Zahl sein.`};if(!inRange(field,value))return{ok:false,error:`${at}: ${LABELS[field]} muss zwischen ${DEAL_RULE_LIMITS[field].min} und ${DEAL_RULE_LIMITS[field].max} liegen.`};rule[field]=field==='cvrFloorPct'?Number(value.toFixed(2)):value}
  if(NUMERIC_FIELDS.every(field=>rule[field]===undefined))return{ok:false,error:`${at}: mindestens ein Wert (Testquote, Reife oder CVR-Untergrenze) ist erforderlich.`};
  if(input.note!==undefined&&input.note!==null&&typeof input.note!=='string')return{ok:false,error:`${at}: Notiz ist ungültig.`};
  rule.note=typeof input.note==='string'?input.note.trim():'';if(rule.note.length>DEAL_RULE_LIMITS.noteLength)return{ok:false,error:`${at}: Notiz ist zu lang (max. ${DEAL_RULE_LIMITS.noteLength} Zeichen).`};
  const key=`${rule.affiliateId}:${rule.campaignId??''}`;if(seen.has(key))return{ok:false,error:`${at}: Partner ${rule.affiliateId}${rule.campaignId?` / Campaign ${rule.campaignId}`:''} ist doppelt.`};seen.add(key);rules.push(rule);
 }
 return{ok:true,rules};
}
export const dealRuleKey=(rule:Pick<DealRule,'affiliateId'|'campaignId'>)=>`${rule.affiliateId}:${rule.campaignId??''}`;
export const sameDealRuleValues=(a:DealRuleInput,b:DealRuleInput)=>a.affiliateId===b.affiliateId&&a.campaignId===b.campaignId&&a.note===b.note&&NUMERIC_FIELDS.every(field=>a[field]===b[field]);
/** Kürzel für Tabellen und Listen: „Testquote 50 SOIs · Reife 336 h · CVR ≥ 1 %“. */
export function describeDealRule(rule:DealRuleInput){const parts:string[]=[];if(rule.testQuotaSois!==undefined)parts.push(`Testquote ${rule.testQuotaSois} SOIs`);if(rule.maturityHours!==undefined)parts.push(`Reife ${rule.maturityHours} h`);if(rule.cvrFloorPct!==undefined)parts.push(`CVR ≥ ${new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(rule.cvrFloorPct)} %`);return parts.join(' · ')}
