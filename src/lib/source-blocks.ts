export type SourceTrafficMode='tracked'|'api';
export type SourceBlockLevel='main_source'|'sub_source';
export type EverflowBlockVariable={variable:string;variable_value:string;variable_secondary_value:string;comparison_method:'exact_match'|'not_present'};
export type SourceBlockInput={affiliateId:string;affiliateName:string;offerId:string;offerName:string;campaignId?:string;trafficMode:SourceTrafficMode;level:SourceBlockLevel;mainValue?:string|null;subValue?:string|null;reason?:string};
export type NormalizedSourceBlock={affiliateId:number;affiliateName:string;offerId:number;offerName:string;originCampaignId:number|null;trafficMode:SourceTrafficMode;level:SourceBlockLevel;mainField:'source_id'|'adv1';mainValue:string|null;subField:'sub1'|'adv2';subValue:string|null;variables:EverflowBlockVariable[];reason:string};
export type SourceBlockRecord=NormalizedSourceBlock&{id:string;status:'pending'|'active'|'inactive'|'error';effectiveAt:string;createdAt:string;createdBy:string;updatedAt:string;updatedBy:string;everflowSettingId:number|null;lastVerifiedAt:string|null;error:string|null};

const normalizedValue=(value:unknown)=>{if(value===undefined||value===null)return null;const text=String(value).trim();if(!text||['N/A','Ohne Source-ID','Ohne Sub-Source','Nicht übermittelt'].includes(text))return null;if(text.length>200)throw new Error('Quellenwert ist zu lang');return text};
const positiveId=(value:unknown,label:string)=>{const text=String(value??'').trim();if(!/^\d+$/.test(text)||Number(text)<=0)throw new Error(`${label} fehlt oder ist ungültig`);return Number(text)};
const label=(value:unknown,fallback:string)=>{const text=String(value??'').trim();return(text||fallback).slice(0,160)};
const exact=(variable:string,value:string):EverflowBlockVariable=>({variable,variable_value:value,variable_secondary_value:'',comparison_method:'exact_match'});
const missing=(variable:string):EverflowBlockVariable=>({variable,variable_value:'',variable_secondary_value:'',comparison_method:'not_present'});

export function normalizeSourceBlockInput(input:SourceBlockInput):NormalizedSourceBlock{
 const affiliateId=positiveId(input.affiliateId,'Affiliate'),offerId=positiveId(input.offerId,'Offer');
 if(input.trafficMode!=='api'&&input.trafficMode!=='tracked')throw new Error('Trafficmodus ist ungültig');
 if(input.level!=='main_source'&&input.level!=='sub_source')throw new Error('Sperr-Ebene ist ungültig');
 const mainValue=normalizedValue(input.mainValue),subValue=normalizedValue(input.subValue),mainField=input.trafficMode==='api'?'adv1':'source_id',subField=input.trafficMode==='api'?'adv2':'sub1';
 if(input.level==='sub_source'&&!subValue)throw new Error('Unterquelle fehlt');
 const variables:EverflowBlockVariable[]=[];
 if(input.level==='main_source')variables.push(mainValue?exact(mainField,mainValue):missing(mainField));
 else{variables.push(mainValue?exact(mainField,mainValue):missing(mainField));variables.push(exact(subField,subValue!));}
 const originCampaignId=input.campaignId?positiveId(input.campaignId,'Campaign'):null;
 return{affiliateId,affiliateName:label(input.affiliateName,`Affiliate #${affiliateId}`),offerId,offerName:label(input.offerName,`Offer #${offerId}`),originCampaignId,trafficMode:input.trafficMode,level:input.level,mainField,mainValue,subField,subValue:input.level==='sub_source'?subValue:null,variables,reason:String(input.reason??'').trim().slice(0,500)};
}

const identityParts=(block:Pick<NormalizedSourceBlock,'affiliateId'|'offerId'|'trafficMode'|'level'|'mainField'|'mainValue'|'subField'|'subValue'>)=>[block.affiliateId,block.offerId,block.trafficMode,block.level,block.mainField,block.mainValue??'∅',block.subField,block.subValue??'∅'];
export const sourceBlockIdentityKey=(block:Pick<NormalizedSourceBlock,'affiliateId'|'offerId'|'trafficMode'|'level'|'mainField'|'mainValue'|'subField'|'subValue'>)=>identityParts(block).map(value=>encodeURIComponent(String(value))).join(':');
export const sourceBlockStoreKey=(block:Pick<NormalizedSourceBlock,'affiliateId'|'offerId'|'trafficMode'|'level'|'mainField'|'mainValue'|'subField'|'subValue'>)=>`source-block:v1:${sourceBlockIdentityKey(block)}`;
export const sourceBlockLabel=(block:Pick<NormalizedSourceBlock,'mainValue'|'subValue'|'level'>)=>block.level==='sub_source'?`${block.mainValue||'nicht übermittelt'} → ${block.subValue}`:(block.mainValue||'nicht übermittelt');
export const sourceBlockRequiredConfirmation=(block:Pick<NormalizedSourceBlock,'mainValue'|'subValue'|'level'>)=>(block.level==='sub_source'?block.subValue:block.mainValue)||'NICHT ÜBERMITTELT';

export type SourceBlockMetricRow={metric_date:string;affiliate_id:string;offer_id:string;source_id:string;sub_source:string;sois:number;payout:number;raw?:Record<string,unknown>};
const rowValue=(row:SourceBlockMetricRow,field:string)=>{if(field==='source_id')return normalizedValue(row.source_id);if(field==='sub1')return normalizedValue(row.sub_source);return normalizedValue(row.raw?.[field])};
export function metricMatchesSourceBlock(row:SourceBlockMetricRow,block:Pick<NormalizedSourceBlock,'affiliateId'|'offerId'|'level'|'mainField'|'mainValue'|'subField'|'subValue'>){if(row.affiliate_id!==String(block.affiliateId)||row.offer_id!==String(block.offerId))return false;const main=rowValue(row,block.mainField),sub=rowValue(row,block.subField);if(block.level==='main_source')return main===block.mainValue;return(block.mainValue===null||main===block.mainValue)&&sub===block.subValue}
export function summarizeSourceBlockViolations(rows:SourceBlockMetricRow[],block:Pick<NormalizedSourceBlock,'affiliateId'|'offerId'|'level'|'mainField'|'mainValue'|'subField'|'subValue'>&{effectiveAt:string}){const cutoff=block.effectiveAt.slice(0,10),matches=rows.filter(row=>row.metric_date>=cutoff&&metricMatchesSourceBlock(row,block));return{sois:matches.reduce((sum,row)=>sum+Number(row.sois||0),0),payout:matches.reduce((sum,row)=>sum+Number(row.payout||0),0),lastTrafficDate:matches.filter(row=>Number(row.sois)>0).map(row=>row.metric_date).sort().at(-1)||null}}
