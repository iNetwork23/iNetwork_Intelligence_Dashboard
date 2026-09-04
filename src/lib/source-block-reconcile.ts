import type{SecurityStore}from'./security';
import{listSourceBlocks}from'./source-block-service';
import{recordSourceBlockHistory}from'./source-block-history';
import{sourceBlockIdentityKey,sourceBlockLabel,type EverflowBlockVariable,type SourceBlockRecord}from'./source-blocks';
import type{BlockEffect}from'./block-effects';
/** Sperr-Abgleich (D8): Everflow wird nur gelesen, der Sperr-Record nie geschrieben; Ergebnis landet im Marker source_block_reconcile:{blockId} und append-only in der Historie. */
export type ReconcileStatus='ok'|'mismatch'|'unreachable';
export type SourceBlockReconcileMarker={at:string;status:ReconcileStatus;detail:string;okEventDay?:string};
export type EverflowSettingView={network_custom_payout_revenue_setting_id?:number;network_affiliate_ids?:number[]|null;is_apply_all_affiliates?:boolean;network_offer_id?:number;custom_setting_status?:string;is_custom_payout_enabled?:boolean;payout_type?:string;payout_amount?:number;payout_percentage?:number;is_postback_disabled?:boolean;relationship?:{variables?:{entries?:Array<EverflowBlockVariable&Record<string,unknown>>}}};
export const SOURCE_BLOCK_RECONCILE_PREFIX='source_block_reconcile:';
export const SOURCE_BLOCK_RECONCILE_LOCK='source-block-reconcile';
export const RECONCILE_BATCH_LIMIT=40,RECONCILE_TIME_BUDGET_MS=60_000,RECONCILE_ACTOR='system:reconcile';
const STATUSES:ReconcileStatus[]=['ok','mismatch','unreachable'];
export const sourceBlockReconcileKey=(blockId:string)=>`${SOURCE_BLOCK_RECONCILE_PREFIX}${blockId}`;
export const berlinDay=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const berlinDate=(iso:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium'}).format(new Date(iso));
const isMarker=(value:unknown):value is SourceBlockReconcileMarker=>Boolean(value)&&typeof value==='object'&&typeof(value as SourceBlockReconcileMarker).at==='string'&&STATUSES.includes((value as SourceBlockReconcileMarker).status)&&typeof(value as SourceBlockReconcileMarker).detail==='string';
/** Kopie der Vergleichslogik aus everflow-source-blocks.ts (variablesEqual): Reihenfolge und Zusatzfelder sind irrelevant. */
const normalizedVariables=(items:Array<EverflowBlockVariable&Record<string,unknown>>=[])=>items.map(item=>({variable:item.variable,variable_value:item.variable_value,variable_secondary_value:item.variable_secondary_value||'',comparison_method:item.comparison_method})).sort((a,b)=>`${a.variable}\0${a.variable_value}`.localeCompare(`${b.variable}\0${b.variable_value}`));
const variablesEqual=(left:Array<EverflowBlockVariable&Record<string,unknown>>|undefined,right:EverflowBlockVariable[])=>JSON.stringify(normalizedVariables(left))===JSON.stringify(normalizedVariables(right));
/** Reine Prüfung: entspricht das gelesene Setting noch der gespeicherten Sperre? detail listet jede Abweichung. */
export function compareEverflowSettingWithBlock(setting:EverflowSettingView|null,record:Pick<SourceBlockRecord,'affiliateId'|'offerId'|'variables'>):{status:'ok'|'mismatch';detail:string}{
 if(!setting)return{status:'mismatch',detail:'Setting nicht vorhanden (HTTP 404)'};
 const issues:string[]=[];
 if(setting.custom_setting_status!=='active')issues.push(`Status ${setting.custom_setting_status??'unbekannt'} statt active`);
 if(setting.is_custom_payout_enabled!==true)issues.push('Custom Payout nicht aktiv');
 if(setting.payout_type!=='cpa')issues.push(`Payout-Typ ${setting.payout_type??'unbekannt'} statt cpa`);
 if(Number(setting.payout_amount)!==0)issues.push(`Payout ${setting.payout_amount??'unbekannt'} statt 0`);
 if(Number(setting.payout_percentage)!==0)issues.push(`Payout-Prozent ${setting.payout_percentage??'unbekannt'} statt 0`);
 if(setting.is_postback_disabled!==true)issues.push('Postback nicht deaktiviert');
 if(!(setting.network_affiliate_ids||[]).includes(record.affiliateId))issues.push(`Affiliate ${record.affiliateId} nicht im Setting`);
 if(setting.network_offer_id!==record.offerId)issues.push(`Offer ${setting.network_offer_id??'unbekannt'} statt ${record.offerId}`);
 if(!variablesEqual(setting.relationship?.variables?.entries,record.variables))issues.push('Variablen weichen ab');
 return issues.length?{status:'mismatch',detail:issues.join('; ')}:{status:'ok',detail:''};
}
/** Aktive Sperren mit Everflow-Setting, die am längsten nicht geprüft wurden (ohne Marker zuerst), höchstens limit. */
export function selectBlocksForReconcile(blocks:SourceBlockRecord[],markers:Map<string,SourceBlockReconcileMarker>,limit=RECONCILE_BATCH_LIMIT):SourceBlockRecord[]{
 const checkedAt=(block:SourceBlockRecord)=>markers.get(block.id)?.at??'';
 return blocks.filter(block=>block.status==='active'&&Number(block.everflowSettingId)>0).sort((a,b)=>checkedAt(a).localeCompare(checkedAt(b))||a.effectiveAt.localeCompare(b.effectiveAt)||a.id.localeCompare(b.id)).slice(0,Math.max(0,limit));
}
export async function loadReconcileMarkers(store:SecurityStore):Promise<Map<string,SourceBlockReconcileMarker>>{
 const markers=new Map<string,SourceBlockReconcileMarker>();
 for(const row of await store.list(SOURCE_BLOCK_RECONCILE_PREFIX))if(isMarker(row.value))markers.set(row.key.slice(SOURCE_BLOCK_RECONCILE_PREFIX.length),row.value);
 return markers;
}
export type ReconcileRunOptions={store:SecurityStore;readSetting:(settingId:number)=>Promise<EverflowSettingView|null>;now?:()=>Date;timeBudgetMs?:number;limit?:number};
export type ReconcileRunResult={checked:number;ok:number;mismatch:number;unreachable:number;budgetExhausted:boolean};
/** Runner: je Sperre Setting lesen → vergleichen → Marker schreiben; reconcile_ok höchstens einmal je Berlin-Tag, reconcile_mismatch bei jeder Abweichung, unreachable nur im Marker. */
export async function runSourceBlockReconcile(options:ReconcileRunOptions):Promise<ReconcileRunResult>{
 const{store,readSetting}=options,now=options.now??(()=>new Date()),budget=options.timeBudgetMs??RECONCILE_TIME_BUDGET_MS,started=now().getTime(),result:ReconcileRunResult={checked:0,ok:0,mismatch:0,unreachable:0,budgetExhausted:false};
 const markers=await loadReconcileMarkers(store),selected=selectBlocksForReconcile(await listSourceBlocks(store),markers,options.limit);
 for(const block of selected){
  if(now().getTime()-started>=budget){result.budgetExhausted=true;break}
  const previous=markers.get(block.id),at=now(),today=berlinDay(at),identityKey=sourceBlockIdentityKey(block);
  let marker:SourceBlockReconcileMarker;
  try{
   const outcome=compareEverflowSettingWithBlock(await readSetting(Number(block.everflowSettingId)),block);
   marker={at:at.toISOString(),status:outcome.status,detail:outcome.detail,...(previous?.okEventDay?{okEventDay:previous.okEventDay}:{})};
   if(outcome.status==='mismatch'){await recordSourceBlockHistory({blockId:block.id,identityKey,actorId:RECONCILE_ACTOR,action:'reconcile_mismatch',error:outcome.detail},store)}
   else if(previous?.okEventDay!==today){await recordSourceBlockHistory({blockId:block.id,identityKey,actorId:RECONCILE_ACTOR,action:'reconcile_ok'},store);marker.okEventDay=today}
  }catch(error){marker={at:at.toISOString(),status:'unreachable',detail:(error instanceof Error?error.message:'Everflow nicht erreichbar').slice(0,300),...(previous?.okEventDay?{okEventDay:previous.okEventDay}:{})}}
  await store.set(sourceBlockReconcileKey(block.id),marker);
  result.checked++;result[marker.status]++;
 }
 return result;
}
export type PayoutDespiteBlockAlert={dedupeId:string;payload:{title:string;body:string;path:string}};
const BODY_LIMIT=240;
/** Alarm „Payout trotz Sperre“: eine Meldung je Sperre und Berlin-Tag, nur bei payoutSince > 0. */
export function buildPayoutDespiteBlockAlerts(effects:BlockEffect[],now:Date):PayoutDespiteBlockAlert[]{
 const day=berlinDay(now);
 return effects.filter(effect=>effect.payoutSince>0).map(effect=>{
  const{record}=effect,tail=`: ${effect.payoutSince.toFixed(2).replace('.',',')} € seit ${berlinDate(record.effectiveAt)}`;
  let head=`${record.affiliateName} · ${record.offerName} · ${sourceBlockLabel(record)}`;
  if(head.length+tail.length>BODY_LIMIT)head=`${head.slice(0,BODY_LIMIT-tail.length-1)}…`;
  return{dedupeId:`payout_despite_block:${record.id}:${day}`,payload:{title:'Payout trotz Sperre',body:`${head}${tail}`,path:'/source-blocks'}};
 });
}
export type PayoutAlertRunOptions={loadEffects:()=>Promise<BlockEffect[]>;enqueue:(dedupeId:string,payload:PayoutDespiteBlockAlert['payload'])=>Promise<boolean>;now?:()=>Date};
/** Liefert die Zahl neu eingereihter Alarme (Dedupe je Tag übernimmt die Outbox). */
export async function runPayoutDespiteBlockAlerts(options:PayoutAlertRunOptions):Promise<number>{
 const alerts=buildPayoutDespiteBlockAlerts(await options.loadEffects(),(options.now??(()=>new Date()))());
 let queued=0;
 for(const alert of alerts)if(await options.enqueue(alert.dedupeId,alert.payload))queued++;
 return queued;
}
