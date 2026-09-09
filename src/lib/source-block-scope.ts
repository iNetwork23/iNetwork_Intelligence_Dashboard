import{filterPartnerRows,type AccessMetadata}from'./rbac';
import type{SourceBlockRecord}from'./source-blocks';
type ScopeRecord=Pick<SourceBlockRecord,'affiliateId'|'offerId'|'level'|'mainValue'|'subValue'>;
/** A provider block covers all campaigns; originCampaignId is only provenance.
 * Main-source blocks also cover every sub-source. A matching child is not
 * sufficient authority to inspect the full record or change its wider scope. */
export function sourceBlockInScope(record:ScopeRecord,access:AccessMetadata):boolean{
 if(access.scopes.campaign.length||access.scopes.account.length)return false;
 if(access.scopes.sub_source.length&&record.level!=='sub_source')return false;
 return filterPartnerRows([{affiliate_id:record.affiliateId,offer_id:record.offerId,source_id:record.mainValue??'',sub_source:record.subValue??''}],access).length===1;
}
export const scopeSourceBlocks=<T extends ScopeRecord>(records:T[],access:AccessMetadata):T[]=>records.filter(record=>sourceBlockInScope(record,access));
