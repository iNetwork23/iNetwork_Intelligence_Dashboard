import {automationScopeAllowed} from './automation-policy';
import type {AccessMetadata} from './rbac';

type Journal={campaigns:readonly{campaignId:number;affiliateId:number}[];rotations:readonly{campaignId:number}[];evaluations:readonly{campaignId:number}[]};
/** Legacy entries carry no offer/source detail, so those scopes cannot be proven. */
export function automationJournalForAccess<T extends Journal>(journal:T,access:AccessMetadata){
 const campaigns=journal.campaigns.filter(campaign=>!access.scopes.offer.length&&automationScopeAllowed(access,{affiliateId:campaign.affiliateId,campaignId:campaign.campaignId,offerIds:[]}));
 const allowed=new Set(campaigns.map(row=>row.campaignId));
 // Entries without an affiliate key are safe only when every journal owner of
 // that campaign is visible. Unknown campaigns never inherit authorization.
 for(const campaign of journal.campaigns)if(!campaigns.includes(campaign))allowed.delete(campaign.campaignId);
 return{...journal,campaigns,rotations:journal.rotations.filter(row=>allowed.has(row.campaignId)),evaluations:journal.evaluations.filter(row=>allowed.has(row.campaignId))};
}
