#!/usr/bin/env node
import{readFile,stat,writeFile}from'node:fs/promises';
import{pathToFileURL}from'node:url';

const text=(value)=>String(value??'').trim();
const positiveId=(value,label)=>{const result=text(value);if(!/^\d+$/.test(result)||Number(result)<=0)throw new Error(`${label} muss eine positive numerische ID sein.`);return result};
const sourceValue=(value,label)=>{const result=text(value);if(!result||result.length>200||['N/A','Nicht übermittelt','Ohne Source-ID','Ohne Sub-Source'].includes(result))throw new Error(`${label} muss ein expliziter technischer Wert sein.`);return result};

export function assertSafeScope(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Scope-Datei muss ein JSON-Objekt enthalten.');
 positiveId(input.affiliateId,'affiliateId');positiveId(input.offerId,'offerId');positiveId(input.campaignId,'campaignId');
 if(!['tracked','api'].includes(input.trafficMode))throw new Error('trafficMode muss tracked oder api sein.');
 if(!['main_source','sub_source'].includes(input.level))throw new Error('level muss main_source oder sub_source sein.');
 sourceValue(input.mainValue,'mainValue');if(input.level==='sub_source')sourceValue(input.subValue,'subValue');
 const expected=input.level==='sub_source'?sourceValue(input.subValue,'subValue'):sourceValue(input.mainValue,'mainValue');
 if(text(input.expectedConfirmation)!==expected)throw new Error('expectedConfirmation stimmt nicht mit dem technischen Sperrwert überein.');
 if(input.allowDestructive!==true)throw new Error('allowDestructive muss in der Scope-Datei ausdrücklich true sein.');
 return input;
}

export const approvalPhrase=(scope)=>`ACTIVATE-AND-ROLLBACK:${positiveId(scope.affiliateId,'affiliateId')}:${positiveId(scope.offerId,'offerId')}:${positiveId(scope.campaignId,'campaignId')}:${scope.trafficMode}:${scope.level}:${sourceValue(scope.mainValue,'mainValue')}:${scope.level==='sub_source'?sourceValue(scope.subValue,'subValue'):'∅'}`;
const same=(block,scope)=>Number(block.affiliateId)===Number(scope.affiliateId)&&Number(block.offerId)===Number(scope.offerId)&&Number(block.originCampaignId)===Number(scope.campaignId)&&block.trafficMode===scope.trafficMode&&block.level===scope.level&&(block.mainValue??null)===(scope.mainValue??null)&&(block.subValue??null)===(scope.level==='sub_source'?(scope.subValue??null):null);
export const matchingActiveBlocks=(blocks,scope)=>(Array.isArray(blocks)?blocks:[]).filter(block=>block?.status==='active'&&same(block,scope));
export const activeBlockInventory=(blocks)=>JSON.stringify((Array.isArray(blocks)?blocks:[]).filter(block=>block?.status==='active').map(block=>({id:text(block.id),affiliateId:text(block.affiliateId),offerId:text(block.offerId),originCampaignId:text(block.originCampaignId),trafficMode:text(block.trafficMode),level:text(block.level),mainValue:text(block.mainValue),subValue:block.subValue==null?null:text(block.subValue),everflowSettingId:block.everflowSettingId==null?null:text(block.everflowSettingId),status:text(block.status)})).sort((left,right)=>left.id.localeCompare(right.id)||JSON.stringify(left).localeCompare(JSON.stringify(right))));

async function secretFile(path,label){if(!path)throw new Error(`${label} fehlt.`);const info=await stat(path);if((info.mode&0o077)!==0)throw new Error(`${label} muss Dateirechte 600 oder restriktiver haben.`);const value=(await readFile(path,'utf8')).trim();if(!value)throw new Error(`${label} ist leer.`);return value}
async function fetchJson(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);try{const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'}),body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`HTTP ${response.status}: ${body.error||'unbekannter Fehler'}`);return body}finally{clearTimeout(timer)}}
const activeCount=(blocks)=>blocks.filter(block=>block?.status==='active').length;
const apiInput=(scope)=>({affiliateId:text(scope.affiliateId),affiliateName:text(scope.affiliateName)||`Affiliate #${scope.affiliateId}`,offerId:text(scope.offerId),offerName:text(scope.offerName)||`Offer #${scope.offerId}`,campaignId:text(scope.campaignId),trafficMode:scope.trafficMode,level:scope.level,mainValue:text(scope.mainValue),subValue:scope.level==='sub_source'?text(scope.subValue):'',reason:`[CONTROLLED E2E] ${text(scope.reason)||'Temporäre Produktionsabnahme mit sofortigem Rollback'}`});

export async function runControlledSourceBlockE2E(env=process.env){
 const scopePath=env.SOURCE_BLOCK_TEST_SCOPE_FILE;if(!scopePath)throw new Error('SOURCE_BLOCK_TEST_SCOPE_FILE fehlt.');
 const scope=assertSafeScope(JSON.parse(await readFile(scopePath,'utf8'))),origin=text(env.SOURCE_BLOCK_ORIGIN||'https://wlx-railway-dashboard.vercel.app').replace(/\/$/,'');
 if(!origin.startsWith('https://')&&env.SOURCE_BLOCK_ALLOW_HTTP!=='1')throw new Error('Produktions-E2E verlangt HTTPS.');
 const cookie=await secretFile(env.SOURCE_BLOCK_SESSION_COOKIE_FILE,'SOURCE_BLOCK_SESSION_COOKIE_FILE'),headers={accept:'application/json',cookie,origin},input=apiInput(scope);
 const beforeBody=await fetchJson(`${origin}/api/source-blocks`,{headers}),before=beforeBody.blocks||[],beforeInventory=activeBlockInventory(before);
 if(matchingActiveBlocks(before,scope).length)throw new Error('Der exakte Testscope ist bereits aktiv gesperrt; Abnahme verweigert Änderungen an bestehendem Zustand.');
 const previewParams=new URLSearchParams({action:'preview_across_offers',...input});
 const preview=await fetchJson(`${origin}/api/source-blocks?${previewParams}`,{headers});
 if(text(preview.requiredConfirmation)!==text(scope.expectedConfirmation))throw new Error('Preview-Bestätigung stimmt nicht mit der freigegebenen Scope-Datei überein.');
 if(!Array.isArray(preview.offers)||!preview.offers.some(offer=>String(offer.offerId)===String(scope.offerId)))throw new Error('Freigegebenes Offer fehlt in der serverseitigen Preview.');
 const report={origin,mode:env.SOURCE_BLOCK_EXECUTE==='1'?'execute':'preview_only',scope:{affiliateId:scope.affiliateId,offerId:scope.offerId,campaignId:scope.campaignId,trafficMode:scope.trafficMode,level:scope.level,mainValue:scope.mainValue,subValue:scope.level==='sub_source'?scope.subValue:null},preview:{offers:preview.offers,requiredConfirmation:preview.requiredConfirmation},before:{activeCount:activeCount(before)},activation:null,rollback:null,after:null};
 if(env.SOURCE_BLOCK_EXECUTE!=='1'){if(env.SOURCE_BLOCK_E2E_REPORT)await writeFile(env.SOURCE_BLOCK_E2E_REPORT,JSON.stringify(report,null,2)+'\n',{mode:0o600});return report}
 const requiredApproval=approvalPhrase(scope);if(env.CONFIRM_SOURCE_BLOCK_E2E!==requiredApproval)throw new Error(`Destruktive Bestätigung fehlt. Erforderlich ist die scopegebundene Phrase aus approvalPhrase(scope).`);
 let activatedId=null,primaryError=null;
 try{
  const activated=await fetchJson(`${origin}/api/source-blocks`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({action:'activate',...input,confirmation:scope.expectedConfirmation})});
  activatedId=activated.block?.id||null;
  const during=(await fetchJson(`${origin}/api/source-blocks`,{headers})).blocks||[],matches=matchingActiveBlocks(during,scope);
  if(matches.length!==1)throw new Error(`Aktivierungs-Read-back ist nicht eindeutig (${matches.length} exakte aktive Treffer).`);
  if(activatedId&&matches[0].id!==activatedId)throw new Error('Aktivierungsantwort und Read-back referenzieren verschiedene Block-IDs.');
  activatedId=matches[0].id;report.activation={id:activatedId,status:matches[0].status,everflowSettingId:matches[0].everflowSettingId,lastVerifiedAt:matches[0].lastVerifiedAt};
 }catch(error){primaryError=error;
 }finally{
  try{
   if(!activatedId){const current=(await fetchJson(`${origin}/api/source-blocks`,{headers})).blocks||[],matches=matchingActiveBlocks(current,scope);if(matches.length===1)activatedId=matches[0].id;else if(matches.length>1)throw new Error(`Rollback-Scope ist mehrdeutig (${matches.length} Treffer).`)}
   if(activatedId){const rolled=await fetchJson(`${origin}/api/source-blocks`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({action:'deactivate',id:activatedId})});report.rollback={id:activatedId,status:rolled.block?.status||null,lastVerifiedAt:rolled.block?.lastVerifiedAt||null}}
  }catch(error){throw new AggregateError([...(primaryError?[primaryError]:[]),error],'Source-Block-E2E oder verpflichtender Rollback fehlgeschlagen. Incidentprüfung erforderlich.');}
 }
 const afterBlocks=(await fetchJson(`${origin}/api/source-blocks`,{headers})).blocks||[],afterInventory=activeBlockInventory(afterBlocks);report.after={activeCount:activeCount(afterBlocks),exactActiveCount:matchingActiveBlocks(afterBlocks,scope).length};
 if(afterInventory!==beforeInventory||report.after.exactActiveCount!==0)throw new Error('Kanonischer aktiver Sperrbestand wurde nach Rollback nicht exakt wiederhergestellt oder parallel verändert.');
 if(primaryError)throw primaryError;
 if(!report.activation||report.rollback?.status!=='inactive')throw new Error('Aktivierung und Rollback wurden nicht vollständig belegt.');
 if(env.SOURCE_BLOCK_E2E_REPORT)await writeFile(env.SOURCE_BLOCK_E2E_REPORT,JSON.stringify(report,null,2)+'\n',{mode:0o600});return report;
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){runControlledSourceBlockE2E().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1})}
