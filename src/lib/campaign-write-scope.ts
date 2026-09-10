import type {AccessMetadata} from './rbac';

/** Campaign PUTs affect all affiliates, offers and sources of the campaign. */
export function campaignWriteScopeAllowed(access:AccessMetadata,campaignId?:number){
 if(access.role==='partner'||(['affiliate','offer','account','source','sub_source'] as const).some(key=>access.scopes[key].length))return false;
 return campaignId===undefined||!access.scopes.campaign.length||access.scopes.campaign.includes(String(campaignId));
}
