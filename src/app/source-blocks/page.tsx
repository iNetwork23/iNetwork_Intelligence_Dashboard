import{redirect}from'next/navigation';
import{currentUser}from'@/lib/session';
import{can}from'@/lib/rbac';
import{securityStore}from'@/lib/access-store';
import{listSourceBlocks}from'@/lib/source-block-service';
import{loadBlockEffects,type BlockEffect}from'@/lib/block-effects';
import{signTone,type SignTone}from'@/lib/verdict-vocabulary';
import{loadReconcileMarkers,type SourceBlockReconcileMarker}from'@/lib/source-block-reconcile';
import{isSourceBlockReasonCategory,SOURCE_BLOCK_REASON_CATEGORIES,SOURCE_BLOCK_REASON_LABELS}from'@/lib/source-block-reasons';
import{reportingRange}from'@/lib/supabase-reporting';
import type{SourceBlockRecord}from'@/lib/source-blocks';
import SourceBlockButton from'../affiliates/SourceBlockButton';
import SourceBlockHistoryPanel from'./SourceBlockHistoryPanel';
import DashboardPageHeader from'../components/DashboardPageHeader';import AccessDeniedHint from'../components/AccessDeniedHint';
import DataStatusBar from'../components/DataStatusBar';
import{getDataStatus}from'@/lib/data-status';
import{berlinDateTime,berlinDay}from'@/lib/format-berlin';
export const dynamic='force-dynamic';
/** Sperr-Bilanz (Etappe 2, Prinzip C): Verstoßsummen aus block-effects, Abgleich-Marker aus dem Reconcile-Cron, Historie lazy je Sperre. */
const PAGE_SIZE=100;
const STATUSES=['active','inactive','error','pending'] as const;
type Params={status?:string;category?:string;q?:string;limit?:string};
const fmt=(value:string)=>berlinDateTime(value);
const day=(value:string)=>berlinDay(value);
const euro=(value:number)=>`${value.toFixed(2).replace('.',',')} €`;
/** Vorzeichenfarbe nur über signTone (D15): Reife aus dem Referenzfenster zum Sperrzeitpunkt; 0 und unreife Referenz bleiben neutral. */
const toneClass=(tone:SignTone)=>tone==='positive'?'up':tone==='negative'?'down':undefined;
const balanceTone=(effect:BlockEffect,value:number)=>signTone(value,{clicks:effect.record.metricsAtBlock?.clicks??0,sois:effect.record.metricsAtBlock?.sois??0});
/** Sperre ohne Bilanz: vor Etappe 4 gesperrt (keine Referenzwerte) oder Referenzfenster ohne SOIs. */
const noBalanceReason=(block:SourceBlockRecord)=>!block.metricsAtBlock?'vor Etappe 4 gesperrt':'keine SOIs im Referenzfenster';
const RECONCILE_LABELS:Record<SourceBlockReconcileMarker['status'],string>={ok:'übereinstimmend',mismatch:'Abweichung',unreachable:'Everflow nicht erreichbar'};
const effectsRange=()=>{const range=reportingRange('30d');return{from:range.from!,to:range.to}};
const query=(params:Record<string,string>)=>{const search=new URLSearchParams();for(const[key,value]of Object.entries(params))if(value)search.set(key,value);const text=search.toString();return text?`?${text}`:'?'};
export default async function SourceBlocksPage({searchParams}:{searchParams:Promise<Params>}){
 const user=await currentUser();if(!user)redirect('/login');
 const allowed=user.access.role!=='partner'&&can(user.access,'landingpages.manage')&&can(user.access,'api.manage');
 if(!allowed)return <main className="fatal"><h1>403 · Keine Berechtigung</h1><AccessDeniedHint permission="landingpages.manage und api.manage"/></main>;
 const finance=can(user.access,'finance.view'),filters=await searchParams,store=securityStore();
 const status=(STATUSES as readonly string[]).includes(filters.status||'')?filters.status!:'all',category=isSourceBlockReasonCategory(filters.category)?filters.category:filters.category==='none'?'none':'all',search=(filters.q||'').trim().slice(0,100),limit=Math.min(2000,Math.max(PAGE_SIZE,Math.floor(Number(filters.limit)||PAGE_SIZE)));
 const dataStatus=await getDataStatus().catch(()=>null);
 const[blocks,effects,markers]=await Promise.all([listSourceBlocks(store),loadBlockEffects(effectsRange()).catch(error=>{console.error('Block effects failed',error);return null}),loadReconcileMarkers(store).catch(error=>{console.error('Reconcile markers failed',error);return new Map<string,SourceBlockReconcileMarker>()})]);
 const effectById=new Map<string,BlockEffect>((effects||[]).map(effect=>[effect.record.id,effect])),needle=search.toLowerCase();
 const matches=(block:SourceBlockRecord)=>(status==='all'||block.status===status)&&(category==='all'||(category==='none'?!block.reasonCategory:block.reasonCategory===category))&&(!needle||[block.affiliateName,String(block.affiliateId),block.offerName,String(block.offerId),block.mainValue||'',block.subValue||''].some(value=>value.toLowerCase().includes(needle)));
 const rows=blocks.filter(matches),visible=rows.slice(0,limit),activeCount=rows.filter(block=>block.status==='active').length,totals=rows.reduce((sum,block)=>{const effect=effectById.get(block.id);if(!effect)return sum;const balance=effect.balance;return{sois:sum.sois+effect.soisSince,payout:sum.payout+effect.payoutSince,savedPayout:sum.savedPayout+(balance?.savedPayout??0),lostRevenue:sum.lostRevenue+(balance?.lostRevenue??0),net:sum.net+(balance?.net??0),withBalance:sum.withBalance+(balance?1:0),withoutBalance:sum.withoutBalance+(balance?0:1),clicks:sum.clicks+(balance?effect.record.metricsAtBlock?.clicks??0:0),refSois:sum.refSois+(balance?effect.record.metricsAtBlock?.sois??0:0)}},{sois:0,payout:0,savedPayout:0,lostRevenue:0,net:0,withBalance:0,withoutBalance:0,clicks:0,refSois:0});
 const balanceTotalTone=signTone(totals.net,{clicks:totals.clicks,sois:totals.refSois});
 const params={status:status==='all'?'':status,category:category==='all'?'':category,q:search},lastReconcileAt=[...markers.values()].map(marker=>marker.at).sort().pop()??null;
 return <main className="dashboard sourceBlocksPage"><DashboardPageHeader kicker="Traffic-Kontrolle" title="Sperr-Bilanz" status={`${blocks.filter(block=>block.status==='active').length} aktiv`} tone="live" icon="automation" description="Offer-spezifische Payout- und Postback-Sperren mit Verstoßsummen, stündlichem Everflow-Abgleich und lückenloser Historie."/>
  {dataStatus&&<DataStatusBar status={dataStatus}/>}
  <p className="sourceBlockReconcileRun" role="status">Letzter Everflow-Abgleich: {lastReconcileAt?fmt(lastReconcileAt):'noch nie gelaufen (Cron stündlich um :27)'}</p>
  <p className="sourceBlockNotice">Traffic wird nicht verworfen. Neue SOIs nach der Sperre bleiben sichtbar; Everflow setzt für die exakte Kombination den Payout auf 0 und unterdrückt den Affiliate-Postback. Tagesdaten am Sperrtag können auch frühere Leads desselben Tages enthalten.{effects===null&&' Verstoßsummen sind gerade nicht verfügbar.'}</p>
  <form className="fraudFilters sourceBlockFilters" method="get"><label>Status<select name="status" defaultValue={status}><option value="all">Alle</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option><option value="error">Zustand unklar</option><option value="pending">Verifizierung läuft</option></select></label><label>Kategorie<select name="category" defaultValue={category}><option value="all">Alle</option>{SOURCE_BLOCK_REASON_CATEGORIES.map(item=><option key={item} value={item}>{SOURCE_BLOCK_REASON_LABELS[item]}</option>)}<option value="none">ohne Kategorie</option></select></label><label>Partner<input name="q" defaultValue={search} placeholder="Partner, Offer oder Quelle" maxLength={100}/></label><button type="submit">Filtern</button></form>
  <dl className="sourceBlockSummary withBalance" aria-label="Summen der gefilterten Sperren"><div><dt>Aktive Sperren</dt><dd>{activeCount}</dd></div><div><dt>Payout trotz Sperre</dt><dd className={finance&&totals.payout>0?'down':undefined}>{finance?euro(totals.payout):'nur mit finance.view'}</dd></div><div><dt>SOIs seit Sperre</dt><dd>{totals.sois}</dd></div><div><dt>Maßnahmen-Bilanz</dt><dd className={finance&&totals.withBalance?toneClass(balanceTotalTone):undefined}>{!finance?'nur mit finance.view':totals.withBalance?euro(totals.net):'–'}{finance&&<small className="sourceBlockBalanceNote">{totals.withBalance?`vermieden ${euro(totals.savedPayout)} · entgangen ${euro(totals.lostRevenue)} · ${totals.withBalance} Sperren`:'keine Sperre mit Referenzwerten'}{totals.withoutBalance?` · ${totals.withoutBalance} ohne Bilanz (vor Etappe 4 gesperrt)`:''}</small>}</dd></div></dl>
  <section className="sourceBlockAuditList">{visible.length?visible.map(block=>{const effect=effectById.get(block.id),marker=markers.get(block.id);return <article key={block.id} className={`sourceBlockAuditCard ${block.status}`}><header><div><span>{block.status==='active'?'GESPERRT':block.status==='pending'?'VERIFIZIERUNG LÄUFT':block.status==='error'?'ZUSTAND UNKLAR':'WIEDER AKTIV'}</span><h2>{block.affiliateName} · {block.offerName}</h2></div><SourceBlockButton affiliateId={String(block.affiliateId)} affiliateName={block.affiliateName} offerId={String(block.offerId)} offerName={block.offerName} trafficMode={block.trafficMode} level={block.level} mainValue={block.mainValue} subValue={block.subValue}/></header>
   <dl><div><dt>Partner</dt><dd>{block.affiliateName} · #{block.affiliateId}</dd></div><div><dt>Offer</dt><dd>{block.offerName} · #{block.offerId}</dd></div><div><dt>Quelle</dt><dd>{block.mainField}={block.mainValue||'nicht übermittelt'}{block.level==='sub_source'?` · ${block.subField}=${block.subValue}`:' · alle Unterquellen'}</dd></div>
    <div><dt>Kategorie</dt><dd>{block.reasonCategory?SOURCE_BLOCK_REASON_LABELS[block.reasonCategory]:'ohne Kategorie'}</dd></div><div><dt>Begründung</dt><dd>{block.reason||'–'}</dd></div><div><dt>Gesperrt seit</dt><dd>{fmt(block.effectiveAt)}</dd></div>
    <div><dt>Everflow</dt><dd>{block.everflowSettingId?`Setting #${block.everflowSettingId} · Payout 0 · Postback aus`:'Kein aktives Setting'}</dd></div><div><dt>SOIs seit Sperre</dt><dd>{effect?effect.soisSince:'–'}</dd></div><div><dt>Payout trotz Sperre</dt><dd className={effect&&finance?(effect.payoutSince>0?'down':'up'):undefined}>{!effect?'–':finance?euro(effect.payoutSince):'nur mit finance.view'}</dd></div>
    <div><dt>Vermiedener Payout</dt><dd>{!effect?'–':!finance?'nur mit finance.view':effect.balance?euro(effect.balance.savedPayout):<span className="sourceBlockBalanceNote">– · {noBalanceReason(block)}</span>}</dd></div><div><dt>Entgangener Umsatz</dt><dd>{!effect?'–':!finance?'nur mit finance.view':effect.balance?euro(effect.balance.lostRevenue):<span className="sourceBlockBalanceNote">– · {noBalanceReason(block)}</span>}</dd></div><div><dt>Bilanz</dt><dd className={effect&&finance&&effect.balance?toneClass(balanceTone(effect,effect.balance.net)):undefined}>{!effect?'–':!finance?'nur mit finance.view':effect.balance?euro(effect.balance.net):<span className="sourceBlockBalanceNote">– · {noBalanceReason(block)}</span>}</dd></div><div><dt>Letzter Traffic</dt><dd>{!effect?'–':effect.lastTrafficDate?day(effect.lastTrafficDate):'kein Traffic seit Sperre'}</dd></div><div><dt>Letzter Abgleich</dt><dd className={marker?.status==='mismatch'?'down':undefined}>{marker?`${fmt(marker.at)} · ${RECONCILE_LABELS[marker.status]}${marker.detail?` · ${marker.detail}`:''}`:'noch nicht abgeglichen'}</dd></div></dl>
   {block.status==='error'&&<p className="sourceBlockIncident" role="alert"><b>Zustand unklar:</b> {block.error||'Everflow-Antwort nicht bestätigt'} · Zuletzt verifiziert: {block.lastVerifiedAt?fmt(block.lastVerifiedAt):'nie'}<br/>Kein zweiter Aktivierungsversuch ohne manuelle Prüfung in Everflow.</p>}
   <SourceBlockHistoryPanel blockId={block.id}/><small>Geändert von {block.updatedBy} · {fmt(block.updatedAt)}</small></article>}):<p className="noSourceData">{blocks.length?'Keine Sperre entspricht dem Filter.':'Noch keine Quelle wurde über das Dashboard gesperrt.'}</p>}</section>
  {rows.length>visible.length&&<a className="showMoreSources" href={query({...params,limit:String(limit+PAGE_SIZE)})}>Mehr anzeigen · {rows.length-visible.length} weitere</a>}
 </main>;
}
