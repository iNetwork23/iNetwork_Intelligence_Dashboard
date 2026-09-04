import{redirect}from'next/navigation';
import{currentUser}from'@/lib/session';
import{can}from'@/lib/rbac';
import{loadSourceCandidates}from'@/lib/source-candidates';
import{loadBlockIndex}from'@/lib/block-effects';
import{reportingRange}from'@/lib/supabase-reporting';
import{getDataStatus,headerStatus}from'@/lib/data-status';
import{isSourceCandidateRange,parseSourceCandidateKey,SOURCE_CANDIDATE_RANGES,sourceCandidateKey}from'@/lib/source-candidate-link';
import{parseSourceCandidateFilters,prepareSourceCandidateRows}from'@/lib/source-candidate-view';
import type{SourceBlockRecord}from'@/lib/source-blocks';
import DashboardPageHeader from'../components/DashboardPageHeader';
import DataStatusBar from'../components/DataStatusBar';
import AccessDeniedHint from'../components/AccessDeniedHint';
import InstantLink from'../affiliates/InstantLink';
import SourceCandidateList from'./SourceCandidateList';
export const dynamic='force-dynamic';
const dateTime=(value:string)=>new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(value));
const RANGE_LABEL={'7d':'7 Tage','30d':'30 Tage'} as const;
type Params={range?:string;open?:string;action?:string;mode?:string;q?:string;blocked?:string;sort?:string};
/** Partnerübergreifende Quellenliste aus dem Rollup-Snapshot (Cron :47); Gate wie die anderen internen Datenseiten, Partner sehen nichts (D7). */
export default async function SourcesPage({searchParams}:{searchParams:Promise<Params>}){
 const user=await currentUser();if(!user)redirect('/login');
 if(user.access.role==='partner'||!can(user.access,'dashboard.view'))return <main className="fatal"><h1>403 · Keine Berechtigung</h1><AccessDeniedHint permission="dashboard.view (interne Rolle)"/></main>;
 const params=await searchParams,range=isSourceCandidateRange(params.range)?params.range:'30d',period=reportingRange(range),finance=can(user.access,'finance.view'),{filters,sort}=parseSourceCandidateFilters(params);
 let mayBlock=can(user.access,'landingpages.manage')&&can(user.access,'api.manage');
 const openIdentity=params.open?parseSourceCandidateKey(params.open):null,openKey=openIdentity?sourceCandidateKey(openIdentity):null;
 const dataStatus=await getDataStatus(),header=headerStatus(dataStatus);
 let snapshot;try{snapshot=await loadSourceCandidates({from:period.from!,to:period.to},user.access)}catch(error){console.error('Source candidates page failed',error);return <main className="fatal"><h1>Quellenliste konnte nicht geladen werden</h1><p>Supabase-Verbindung und Rollups-Cron prüfen.</p></main>}
 let index=new Map<string,SourceBlockRecord>(),blockIndexError=false;
 if(snapshot?.rows.length){try{index=await loadBlockIndex()}catch(error){console.error('Source block index unavailable',error);blockIndexError=true;mayBlock=false}}
 const rows=snapshot?prepareSourceCandidateRows(snapshot.rows,index,{finance}):[];
 const rangeSwitch=<nav className="sourcesRange" aria-label="Zeitraum der Quellenliste">{SOURCE_CANDIDATE_RANGES.map(item=><InstantLink key={item} href={`/sources?range=${item}`} aria-current={item===range?'page':undefined} className={item===range?'current':''}>{RANGE_LABEL[item]}</InstantLink>)}<span>{period.label}</span></nav>;
 return <main className="dashboard sourcesPage"><DashboardPageHeader kicker="Traffic-Kontrolle" title="Quellen" status={header.label} tone={header.tone} icon="affiliate" description="Partnerübergreifende Quellen mit Handlungsbedarf – Verdikt, Volumen und Sperrstatus in einer Liste, Sperre direkt aus der Zeile."/>
  <DataStatusBar status={dataStatus}/>
  {rangeSwitch}
  {snapshot?<>
   <p className="sourcesRollup" role="status">Rollup vom {dateTime(snapshot.generatedAt)} · {snapshot.affiliatesProcessed} von {snapshot.affiliates} Partnern · {rows.length} Kandidaten</p>
   {!snapshot.coverageComplete&&<section className="sourcesWarning" role="alert"><strong>Rollup unvollständig</strong><span>{snapshot.affiliatesProcessed} von {snapshot.affiliates} Partnern wurden innerhalb des Zeitbudgets ausgewertet. Quellen fehlender Partner sind nicht bewertet und fehlen in dieser Liste.</span></section>}
   {blockIndexError&&<section className="sourcesWarning" role="alert"><strong>Sperrstatus nicht lesbar</strong><span>Der Sperr-Index konnte nicht geladen werden. Sperrstatus und Sperr-Aktionen sind deshalb ausgeblendet.</span></section>}
   <SourceCandidateList rows={rows} range={range} openKey={openKey} initialFilters={filters} initialSort={sort} mayBlock={mayBlock} finance={finance} blockStatusUnknown={blockIndexError}/>
  </>:<div className="smartEmpty sourcesEmpty"><h3>Noch kein Rollup für {RANGE_LABEL[range]}</h3><p>Die Quellenliste wird im Rollups-Cron stündlich um Minute 47 vorberechnet (Zeitraum {period.label}). Bis zum ersten erfolgreichen Lauf gibt es hier keine Kandidaten – Quellen je Partner bleiben im Affiliate-Bereich sichtbar.</p></div>}
 </main>;
}
