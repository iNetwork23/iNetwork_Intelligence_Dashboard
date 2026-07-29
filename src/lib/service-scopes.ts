import {assertScopesSupported,type AccessMetadata,type ScopeKey} from './rbac';

type ScopedSourceRow={columns:Array<{column_type:string;id:string}>};
const SOURCE_COLUMN_TYPES:Partial<Record<ScopeKey,string[]>>={affiliate:['affiliate'],offer:['offer'],campaign:['campaign'],source:['source_id'],sub_source:['sub1']};
export function sourceRowsForAccess<T extends ScopedSourceRow>(rows:T[],access:AccessMetadata):T[]{
 if(access.role!=='partner')return rows;
 if(!(['affiliate','offer','campaign','source','sub_source']as const).some(key=>access.scopes[key].length))return[];
 return rows.filter(row=>(Object.entries(SOURCE_COLUMN_TYPES)as Array<[ScopeKey,string[]]>).every(([key,types])=>!access.scopes[key].length||access.scopes[key].includes(row.columns.find(column=>types.includes(column.column_type))?.id||'')));
}

export function campaignDirectoryForAccess<T extends {network_campaign_id:number}>(campaigns:T[],access:AccessMetadata):T[]{
 if(access.role!=='partner')return campaigns;
 const allowed=new Set(access.scopes.campaign);
 return campaigns.filter(campaign=>allowed.has(String(campaign.network_campaign_id)));
}
export function partnerAffiliateForSmartlink(access:AccessMetadata):string|undefined{
 assertScopesSupported(access,['affiliate','campaign']);
 if(access.role!=='partner')return undefined;
 if(access.scopes.affiliate.length!==1)throw new Error('403 · Smartlink-Aggregation erfordert genau einen Affiliate-Scope');
 return access.scopes.affiliate[0];
}
export function assertAffiliateOptimizerAggregateAccess(access:AccessMetadata){assertScopesSupported(access,['affiliate','offer','campaign']);}