import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/session';
import {getLtvCohorts} from '@/lib/cohorts';
import InstantLink from '../affiliates/InstantLink';
import ThemeToggle from '../components/ThemeToggle';
export const dynamic='force-dynamic';
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const month=(value:string)=>new Intl.DateTimeFormat('de-DE',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
export default async function CohortsPage({searchParams}:{searchParams:Promise<{source?:string;sub_source?:string}>}){
  if(!await currentUser())redirect('/login');
  const filters=await searchParams;
  let rows;try{rows=await getLtvCohorts({source:filters.source,subSource:filters.sub_source})}catch(error){console.error(error);return <main className="fatal"><h1>Kohorten konnten nicht geladen werden</h1><p>Migration und Supabase-Umgebungsvariablen prüfen.</p></main>}
  return <main className="dashboard"><header className="topbar"><div><div className="eyebrow">ME MEDIA · LTV</div><h1>Umsatzkohorten</h1><p>Registrierungsmonat × kumulierter Umsatz nach Lead-Alter.</p></div><div className="topActions"><InstantLink className="logout" href="/">Account Monitor</InstantLink><InstantLink className="logout active" href="/cohorts" aria-current="page">Kohorten</InstantLink><ThemeToggle/></div></header>
  <form className="cohortFilters"><label>Source<input name="source" defaultValue={filters.source||''} placeholder="alle"/></label><label>Sub-Source<input name="sub_source" defaultValue={filters.sub_source||''} placeholder="alle"/></label><button>Filtern</button><InstantLink href="/cohorts">Zurücksetzen</InstantLink></form>
  <div className="tableWrap"><table className="performanceTable cohortTable"><caption className="srOnly">LTV-Kohorten nach Registrierungsmonat, Source und Sub-Source</caption><thead><tr><th>Monat</th><th>Source / Sub-Source</th><th>Registrierungen</th><th>Umsatz 30d</th><th>60d</th><th>90d</th><th>180d</th><th>365d</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.registration_month}|${row.source_id}|${row.sub_source}`}><td data-label="Monat"><b>{month(row.registration_month)}</b></td><td data-label="Source"><b>{row.source_id||'–'}</b><small>{row.sub_source||'ohne Sub-Source'}</small></td><td data-label="Registrierungen">{row.registrations}</td><td data-label="Umsatz 30d">{euro(row.revenue_30d)}</td><td data-label="60d">{euro(row.revenue_60d)}</td><td data-label="90d">{euro(row.revenue_90d)}</td><td data-label="180d">{euro(row.revenue_180d)}</td><td data-label="365d">{euro(row.revenue_365d)}</td></tr>)}</tbody></table></div>
  {!rows.length&&<section className="smartEmpty"><h2>Noch keine Kohorten vorhanden</h2><p>Nach den ersten erfolgreichen Sync-Chunks erscheinen die Daten hier.</p></section>}</main>;
}
