import{formatDelta}from'./verdict-vocabulary';
import{KILL_MATURITY_SOIS,type VerdictGate}from'./decision-engine';
import{isBlockableCandidate,sourceCandidateBlockKeys,sourceCandidateDomId,sourceCandidateKey}from'./source-candidate-link';
import type{SourceCandidate}from'./source-candidates';
import type{SourceBlockRecord}from'./source-blocks';
/** Reine Anzeige-Logik der partnerübergreifenden Quellenliste (/sources): Sperrzuordnung, Filter, Sortierung, Top-N, Deep-Link-Zeile, Mehrfachauswahl. Client-sicher. */
export type SourceCandidateAction=SourceCandidate['action'];
export type SourceCandidateActionFilter='all'|SourceCandidateAction;
export type SourceCandidateModeFilter='all'|SourceCandidate['trafficMode'];
export type SourceCandidateBlockFilter='all'|'open'|'blocked';
export type SourceCandidateSort='profit'|'payout'|'sois'|'clicks';
export type SourceCandidateFilters={action:SourceCandidateActionFilter;mode:SourceCandidateModeFilter;q:string;blocked:SourceCandidateBlockFilter};
export type SourceCandidateBlockState={id:string;status:'active'|'pending'|'error';effectiveAt:string;error:string|null};
/** Trend für den Client: ohne finance.view ohne Profitwerte (Geld darf nicht in den RSC-Payload). */
export type SourceCandidateTrendView={days:7;current:{sois:number;clicks:number;profit:number|null};previous:{sois:number;clicks:number;profit:number|null};soisDelta:number;clicksDelta:number;profitDelta:number|null};
export type SourceCandidateRow=Omit<SourceCandidate,'revenue'|'payout'|'profit'|'trend'>&{key:string;domId:string;revenue:number|null;payout:number|null;profit:number|null;block:SourceCandidateBlockState|null;blockable:boolean;trend?:SourceCandidateTrendView};
export const projectCandidateTrend=(trend:SourceCandidate['trend'],finance:boolean):SourceCandidateTrendView|undefined=>trend?{days:7,current:{sois:trend.current.sois,clicks:trend.current.clicks,profit:finance?trend.current.profit:null},previous:{sois:trend.previous.sois,clicks:trend.previous.clicks,profit:finance?trend.previous.profit:null},soisDelta:trend.soisDelta,clicksDelta:trend.clicksDelta,profitDelta:finance?trend.profitDelta:null}:undefined;
export const SOURCE_CANDIDATE_PAGE_SIZE=50;
export const BULK_BLOCK_LIMIT=5;
export const DEFAULT_SOURCE_CANDIDATE_FILTERS:SourceCandidateFilters={action:'all',mode:'all',q:'',blocked:'all'};
export const isSourceCandidateAction=(value:unknown):value is SourceCandidateAction=>value==='AUSSCHALTEN'||value==='SKALIEREN'||value==='BEOBACHTEN';
export const isSourceCandidateMode=(value:unknown):value is SourceCandidate['trafficMode']=>value==='tracked'||value==='api';
export const isSourceCandidateBlockFilter=(value:unknown):value is SourceCandidateBlockFilter=>value==='all'||value==='open'||value==='blocked';
export const isSourceCandidateSort=(value:unknown):value is SourceCandidateSort=>value==='profit'||value==='payout'||value==='sois'||value==='clicks';
/** D13: ein Urteilswort auf allen Ebenen – die Projektion liefert bereits AUSSCHALTEN. */
export const verdictLabel=(action:SourceCandidateAction)=>action;
/** Eine Reifeaussage je Zeile: mit Gate (D3) nur „n von m SOIs reif“, sonst die Volumenschwelle. */
export const maturityLabel=(m:{sois:number;clicks:number;gate?:VerdictGate|null},gate:VerdictGate|null|undefined=m.gate)=>gate?`${gate.matureSois} von ${gate.totalSois} SOIs reif${gate.maturityReached?'':` · Schwelle ${gate.requiredSois}`}`:m.sois>=KILL_MATURITY_SOIS?`reif · ${m.sois} SOIs`:`unreif · ${m.sois} von ${KILL_MATURITY_SOIS} SOIs`;
export const firstSaleRate=(m:{sois:number;firstSales:number})=>m.sois>0?`${(m.firstSales/m.sois*100).toFixed(1).replace('.',',')} %`:'–';
const blockState=(record:SourceBlockRecord|undefined):SourceCandidateBlockState|null=>record&&record.status!=='inactive'?{id:record.id,status:record.status,effectiveAt:record.effectiveAt,error:record.error??null}:null;
/** Sperrzustand der Zeile: eigene Ebene zuerst, dann die Hauptquelle (eine Hauptquellen-Sperre deckt Unterquellen ab). */
export function resolveCandidateBlock(row:Pick<SourceCandidate,'affiliateId'|'offerId'|'offerUrlId'|'trafficMode'|'level'|'mainValue'|'subValue'>,index:Map<string,SourceBlockRecord>):SourceCandidateBlockState|null{for(const key of sourceCandidateBlockKeys(row)){const state=blockState(index.get(key));if(state)return state}return null}
/** Zeilen für den Client: gemeinsamer Schlüssel/DOM-Id, aktiver Sperr-Record aus loadBlockIndex, Geldwerte nur mit finance.view. */
export function prepareSourceCandidateRows(rows:SourceCandidate[],index:Map<string,SourceBlockRecord>,options:{finance:boolean}):SourceCandidateRow[]{
 return rows.map(row=>({...row,key:sourceCandidateKey(row),domId:sourceCandidateDomId(row),revenue:options.finance?row.revenue:null,payout:options.finance?row.payout:null,profit:options.finance?row.profit:null,block:resolveCandidateBlock(row,index),blockable:isBlockableCandidate(row),trend:projectCandidateTrend(row.trend,options.finance)}));
}
const haystack=(row:SourceCandidateRow)=>[row.affiliate,`#${row.affiliateId}`,row.affiliateId,row.offer,`#${row.offerId}`,row.offerId,row.offerUrl,row.mainValue??'',row.subValue??''].join(' ').toLowerCase();
export const matchesSourceCandidateFilters=(row:SourceCandidateRow,filters:SourceCandidateFilters)=>{
 if(filters.action!=='all'&&row.action!==filters.action)return false;
 if(filters.mode!=='all'&&row.trafficMode!==filters.mode)return false;
 if(filters.blocked==='blocked'&&!row.block)return false;
 if(filters.blocked==='open'&&row.block)return false;
 const query=filters.q.trim().toLowerCase();
 return!query||haystack(row).includes(query);
};
const desc=(pick:(row:SourceCandidateRow)=>number|null)=>(a:SourceCandidateRow,b:SourceCandidateRow)=>(pick(b)??Number.NEGATIVE_INFINITY)-(pick(a)??Number.NEGATIVE_INFINITY);
/** Standard profit aufsteigend (ohne Geldwerte bleibt die Snapshot-Reihenfolge, die bereits profit-aufsteigend ist); sonst absteigend nach Volumen. */
export function sortSourceCandidates(rows:SourceCandidateRow[],sort:SourceCandidateSort):SourceCandidateRow[]{
 const sorted=[...rows];
 if(sort==='profit')return sorted.sort((a,b)=>(a.profit??0)-(b.profit??0));
 return sorted.sort(desc(row=>sort==='payout'?row.payout:sort==='sois'?row.sois:row.clicks));
}
export type SourceCandidateSelection={rows:SourceCandidateRow[];total:number;matched:number;hidden:number;openIncluded:boolean};
/** Filter → Sortierung → Top-N; die per ?open verlinkte Zeile wird immer gezeigt, auch außerhalb des Filters oder der Top-N (dann angehängt). */
export function selectSourceCandidates(rows:SourceCandidateRow[],filters:SourceCandidateFilters,sort:SourceCandidateSort,limit:number,openKey:string|null):SourceCandidateSelection{
 const matched=sortSourceCandidates(rows.filter(row=>matchesSourceCandidateFilters(row,filters)),sort),visible=matched.slice(0,Math.max(0,limit));
 const open=openKey?rows.find(row=>row.key===openKey):undefined;
 if(open&&!visible.some(row=>row.key===open.key))visible.push(open);
 return{rows:visible,total:rows.length,matched:matched.length,hidden:Math.max(0,matched.length-visible.length),openIncluded:Boolean(open)};
}
/** Mehrfachauswahl: maximal BULK_BLOCK_LIMIT Schlüssel; ein sechster wird abgelehnt (rejected), Abwahl ist immer möglich. */
export function toggleBulkSelection(selected:string[],key:string,limit=BULK_BLOCK_LIMIT):{selected:string[];rejected:boolean}{
 if(selected.includes(key))return{selected:selected.filter(item=>item!==key),rejected:false};
 if(selected.length>=limit)return{selected,rejected:true};
 return{selected:[...selected,key],rejected:false};
}
/** URL-Zustand der Liste (Filter/Sortierung teilbar); Default-Werte werden weggelassen, range und open bleiben erhalten. */
export function buildSourceCandidateQuery(range:string,filters:SourceCandidateFilters,sort:SourceCandidateSort,openKey:string|null):string{
 const params=new URLSearchParams({range});
 if(filters.action!=='all')params.set('action',filters.action);if(filters.mode!=='all')params.set('mode',filters.mode);if(filters.q.trim())params.set('q',filters.q.trim().slice(0,100));if(filters.blocked!=='all')params.set('blocked',filters.blocked);if(sort!=='profit')params.set('sort',sort);
 if(openKey)params.set('open',openKey);
 return params.toString();
}
export function parseSourceCandidateFilters(params:{action?:string;mode?:string;q?:string;blocked?:string;sort?:string}):{filters:SourceCandidateFilters;sort:SourceCandidateSort}{
 return{filters:{action:isSourceCandidateAction(params.action)?params.action:'all',mode:isSourceCandidateMode(params.mode)?params.mode:'all',q:String(params.q??'').slice(0,100),blocked:isSourceCandidateBlockFilter(params.blocked)?params.blocked:'all'},sort:isSourceCandidateSort(params.sort)?params.sort:'profit'};
}
/** Trendtext für den Sperr-Dialog: 7 Tage gegen 7 Tage davor; Vorzeichen nur bei reifem Volumen beider Perioden (Reife-Gate D15), Geld nur mit finance. */
export function trendLabel(row:{trend?:SourceCandidateTrendView|SourceCandidate['trend']},finance:boolean):string|null{
 const trend=row.trend;if(!trend)return null;
 const maturity={clicks:Math.min(trend.current.clicks,trend.previous.clicks),sois:Math.min(trend.current.sois,trend.previous.sois)};
 const parts:string[]=[];
 if(finance&&trend.current.profit!==null&&trend.previous.profit!==null){const profit=formatDelta(trend.current.profit,trend.previous.profit,{maturity,unit:' €',digits:2});parts.push(profit.reason?`Profit – (${profit.reason})`:`Profit ${profit.text}`)}
 const sois=formatDelta(trend.current.sois,trend.previous.sois,{maturity});parts.push(sois.reason?`SOIs – (${sois.reason})`:`SOIs ${sois.text}`);
 return`${parts.join(' · ')} · 7 Tage vs. 7 Tage davor`;
}
