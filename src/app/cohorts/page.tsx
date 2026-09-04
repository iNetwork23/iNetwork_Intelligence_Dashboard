import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/session';
import {can} from '@/lib/rbac';
import {getLtvCohorts} from '@/lib/cohorts';
import {paginateLtvCohorts,revenuePerRegistration} from '@/lib/cohort-pagination';
import InstantLink from '../affiliates/InstantLink';
import DashboardPageHeader from '../components/DashboardPageHeader';
import DataStatusBar from '../components/DataStatusBar';
import AccessDeniedHint from '../components/AccessDeniedHint';
import {getDataStatus,ltvHeaderStatus} from '@/lib/data-status';
export const dynamic='force-dynamic';
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const id=(value:string)=>value?`#${value}`:'–';
const month=(value:string)=>new Intl.DateTimeFormat('de-DE',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
export default async function CohortsPage({searchParams}:{searchParams:Promise<{source?:string;sub_source?:string;affiliate?:string;page?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  if(!can(user.access,'statistics.view'))return <main className="fatal"><h1>403 · Keine Berechtigung</h1><AccessDeniedHint permission="statistics.view"/></main>;
  if(!can(user.access,'finance.view'))return <main className="fatal"><h1>403 · Finanzdaten nicht freigegeben</h1><AccessDeniedHint permission="finance.view"/></main>;
  const filters=await searchParams;
  let allRows;try{allRows=await getLtvCohorts({source:filters.source,subSource:filters.sub_source},user.access)}catch(error){console.error(error);if(error instanceof Error&&error.message.includes('403'))return <main className="fatal"><h1>403 · Fremder oder nicht auswertbarer Scope</h1><AccessDeniedHint/></main>;return <main className="fatal"><h1>Kohorten konnten nicht geladen werden</h1><p>Migration und Supabase-Umgebungsvariablen prüfen.</p></main>}
  const result=paginateLtvCohorts(allRows,Number(filters.page||1),100,{affiliate:filters.affiliate}),rows=result.rows,pageHref=(page:number)=>{const params=new URLSearchParams();if(filters.source)params.set('source',filters.source);if(filters.sub_source)params.set('sub_source',filters.sub_source);if(filters.affiliate)params.set('affiliate',filters.affiliate);params.set('page',String(page));return`/cohorts?${params}`};
  const dataStatus=await getDataStatus(),header=ltvHeaderStatus(dataStatus);
  return <main className="dashboard"><DashboardPageHeader kicker="ME Media · LTV-Analyse" title="Umsatzkohorten" status={header.label} tone={header.tone} icon="cohorts" description="Registrierungsmonat und kumulierter Umsatz nach Lead-Alter vergleichen."/>
  <DataStatusBar status={dataStatus}/>
  <form className="cohortFilters"><label>Source<input name="source" defaultValue={filters.source||''} placeholder="alle"/></label><label>Sub-Source<input name="sub_source" defaultValue={filters.sub_source||''} placeholder="alle"/></label><label>Affiliate-ID<input name="affiliate" defaultValue={filters.affiliate||''} placeholder="alle"/></label><button>Filtern</button><InstantLink href="/cohorts">Zurücksetzen</InstantLink></form>
  <div className="tableWrap"><table className="performanceTable cohortTable"><caption className="srOnly">LTV-Kohorten nach Registrierungsmonat, Affiliate, Offer, Campaign, Source und Sub-Source</caption><thead><tr><th>Monat</th><th>Affiliate</th><th>Offer</th><th>Campaign</th><th>Source / Sub-Source</th><th>Registrierungen</th><th>Umsatz je Registrierung (90 Tage)</th><th>Umsatz 30d</th><th>60d</th><th>90d</th><th>180d</th><th>365d</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.registration_month}|${row.affiliate_id}|${row.offer_id}|${row.campaign_id}|${row.source_id}|${row.sub_source}`}><td data-label="Monat"><b>{month(row.registration_month)}</b></td><td data-label="Affiliate">{id(row.affiliate_id)}</td><td data-label="Offer">{id(row.offer_id)}</td><td data-label="Campaign">{row.campaign_id==='0'?'Direkt':id(row.campaign_id)}</td><td data-label="Source"><b>{row.source_id||'–'}</b><small>{row.sub_source||'ohne Sub-Source'}</small></td><td data-label="Registrierungen">{row.registrations}</td><td data-label="Umsatz je Registrierung (90 Tage)">{(value=>value===null?'–':euro(value))(revenuePerRegistration(row))}</td><td data-label="Umsatz 30d">{euro(row.revenue_30d)}</td><td data-label="60d">{euro(row.revenue_60d)}</td><td data-label="90d">{euro(row.revenue_90d)}</td><td data-label="180d">{euro(row.revenue_180d)}</td><td data-label="365d">{euro(row.revenue_365d)}</td></tr>)}</tbody></table></div>
  {result.total>0&&<nav className="cohortPager" aria-label="Kohortenseiten"><span>{result.total.toLocaleString('de-DE')} Gruppen · Seite {result.page} von {result.pages}</span><div>{result.page>1?<InstantLink href={pageHref(result.page-1)}>← Zurück</InstantLink>:<span/>}{result.page<result.pages?<InstantLink href={pageHref(result.page+1)}>Weiter →</InstantLink>:<span/>}</div></nav>}
  {!result.total&&<section className="smartEmpty"><h2>Noch keine Kohorten vorhanden</h2><p>Nach den ersten erfolgreichen Sync-Chunks erscheinen die Daten hier.</p></section>}</main>;
}
