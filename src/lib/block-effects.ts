import {unstable_cache} from 'next/cache';
import type {SecurityStore} from './security';
import {securityStore} from './access-store';
import {loadAffiliateSourceRowsRangeFromCache} from './cached-evaluations';
import {listSourceBlocks} from './source-block-service';
import {sourceBlockIdentityKey,summarizeSourceBlockViolations,type SourceBlockMetricRow,type SourceBlockRecord} from './source-blocks';
/** Maßnahmen-Bilanz je Sperre (Etappe 4): vermiedener Payout und entgangener Umsatz aus SOIs seit Sperre × Referenzraten zum Sperrzeitpunkt. */
export type BlockBalance={savedPayout:number;lostRevenue:number;net:number};
export type BlockEffect={record:SourceBlockRecord;identityKey:string;soisSince:number;payoutSince:number;lastTrafficDate:string|null;balance?:BlockBalance|null};
const cents=(value:number)=>Math.round(value*100)/100;
/** savedPayout = soisSince × payoutAtBlock/soisAtBlock · lostRevenue = soisSince × revenueAtBlock/soisAtBlock · net = savedPayout − lostRevenue; null ohne metricsAtBlock (vor Etappe 4 gesperrt) oder ohne SOIs im Referenzfenster. */
export function blockBalance(record:Pick<SourceBlockRecord,'metricsAtBlock'>,soisSince:number):BlockBalance|null{
 const m=record.metricsAtBlock;if(!m||!(m.sois>0)||!Number.isFinite(soisSince))return null;
 const savedPayout=cents(soisSince*m.payout/m.sois),lostRevenue=cents(soisSince*m.revenue/m.sois);
 return{savedPayout,lostRevenue,net:cents(savedPayout-lostRevenue)};
}
export const BLOCK_EFFECTS_CACHE_TAG='source-blocks';
type SnapshotRow={columns:Array<{column_type:string;id:string;label:string}>;reporting:Record<string,number>};
const dim=(row:SnapshotRow,type:string)=>row.columns.find(item=>item.column_type===type)?.id||'';
/** Gleiche Abbildung wie /source-blocks heute: Snapshot-Zeile → Verstoßzeile (adv1/adv2 aus source_id/sub1). */
export const metricRowsFromSnapshotRows=(rows:SnapshotRow[]):SourceBlockMetricRow[]=>rows.map(row=>({metric_date:dim(row,'date'),affiliate_id:dim(row,'affiliate'),offer_id:dim(row,'offer'),source_id:dim(row,'source_id'),sub_source:dim(row,'sub1'),sois:Number(row.reporting.cv||0),payout:Number(row.reporting.payout||0),raw:{adv1:dim(row,'source_id'),adv2:dim(row,'sub1')}}));
/** identityKey (sourceBlockIdentityKey) → Record, alle Status; bei Dubletten gewinnt der zuletzt geänderte Record. */
async function computeBlockIndex(store:SecurityStore):Promise<Array<[string,SourceBlockRecord]>>{
 const index=new Map<string,SourceBlockRecord>();
 for(const record of await listSourceBlocks(store)){const key=sourceBlockIdentityKey(record);if(!index.has(key))index.set(key,record)}
 return[...index.entries()];
}
/** Ohne injizierten Store 60 s gecacht (Tag 'source-blocks', von der Sperr-Route nach jeder Mutation invalidiert) – der Prefix-Scan läuft so nicht je Request. */
export async function loadBlockIndex(store?:SecurityStore):Promise<Map<string,SourceBlockRecord>>{
 if(store)return new Map(await computeBlockIndex(store));
 return new Map(await unstable_cache(()=>computeBlockIndex(securityStore()),['block-index-v1'],{revalidate:60,tags:[BLOCK_EFFECTS_CACHE_TAG]})());
}
export function blockEffectsFromRows(blocks:SourceBlockRecord[],rowsByAffiliate:Map<string,SourceBlockMetricRow[]>):BlockEffect[]{
 return blocks.filter(record=>record.status==='active').map(record=>{const violations=summarizeSourceBlockViolations(rowsByAffiliate.get(String(record.affiliateId))||[],record);return{record,identityKey:sourceBlockIdentityKey(record),soisSince:violations.sois,payoutSince:violations.payout,lastTrafficDate:violations.lastTrafficDate,balance:blockBalance(record,violations.sois)}});
}
async function computeBlockEffects(range:{from:string;to:string},affiliateId?:string):Promise<BlockEffect[]>{
 const blocks=(await listSourceBlocks(securityStore())).filter(record=>record.status==='active'&&(!affiliateId||String(record.affiliateId)===affiliateId)),rowsByAffiliate=new Map<string,SourceBlockMetricRow[]>();
 await Promise.all([...new Set(blocks.map(record=>String(record.affiliateId)))].map(async id=>{
  const earliest=blocks.filter(record=>String(record.affiliateId)===id).map(record=>record.effectiveAt.slice(0,10)).sort()[0],from=earliest&&earliest<range.from?earliest:range.from;
  rowsByAffiliate.set(id,from>range.to?[]:metricRowsFromSnapshotRows(await loadAffiliateSourceRowsRangeFromCache({from,to:range.to},id)));
 }));
 return blockEffectsFromRows(blocks,rowsByAffiliate);
}
/** Aktive Sperren mit Verstoßsummen seit effectiveAt (Zeilen ab min(range.from, effectiveAt) bis range.to), 120 s gecacht unter Tag 'source-blocks'. */
export async function loadBlockEffects(range:{from:string;to:string},affiliateId?:string):Promise<BlockEffect[]>{
 return unstable_cache(()=>computeBlockEffects(range,affiliateId),['block-effects-v1',range.from,range.to,affiliateId||'all'],{revalidate:120,tags:[BLOCK_EFFECTS_CACHE_TAG]})();
}
