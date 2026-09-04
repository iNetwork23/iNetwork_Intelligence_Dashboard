import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/session';
import {can} from '@/lib/rbac';
import {getLtvCohorts} from '@/lib/cohorts';
import {paginateLtvCohorts,revenuePerRegistration} from '@/lib/cohort-pagination';
import {getDashboard} from '@/lib/dashboard-service';
import {reportingRange} from '@/lib/supabase-reporting';
import {globalPeriodParams,resolveGlobalPeriod,todayPartialNote} from '@/lib/period-controls';
import {breakEvenSummary,buildLtvCurve,entityRates,findBreakEven,ltvSparklinePoints} from '@/lib/ltv-breakeven';
import {signTone} from '@/lib/verdict-vocabulary';
import {toneClass} from '@/lib/verdict-trust';
import type {Portfolio} from '@/lib/portfolio';
import InstantLink from '../affiliates/InstantLink';
import DashboardPageHeader from '../components/DashboardPageHeader';
import DataStatusBar from '../components/DataStatusBar';
import AccessDeniedHint from '../components/AccessDeniedHint';
import PeriodControls from '../components/PeriodControls';
import Sparkline from '../components/Sparkline';
import {getDataStatus,ltvHeaderStatus} from '@/lib/data-status';
export const dynamic='force-dynamic';
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const num=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
const id=(value:string)=>value?`#${value}`:'–';
const month=(value:string)=>new Intl.DateTimeFormat('de-DE',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
const byNumericId=(a:string,b:string)=>(Number(a)||0)-(Number(b)||0)||a.localeCompare(b);
export default async function CohortsPage({searchParams}:{searchParams:Promise<{source?:string;sub_source?:string;affiliate?:string;page?:string;period?:string;from?:string;to?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  if(!can(user.access,'statistics.view'))return <main className="fatal"><h1>403 · Keine Berechtigung</h1><AccessDeniedHint permission="statistics.view"/></main>;
  if(!can(user.access,'finance.view'))return <main className="fatal"><h1>403 · Finanzdaten nicht freigegeben</h1><AccessDeniedHint permission="finance.view"/></main>;
  const filters=await searchParams;
  let allRows;try{allRows=await getLtvCohorts({source:filters.source,subSource:filters.sub_source},user.access)}catch(error){console.error(error);if(error instanceof Error&&error.message.includes('403'))return <main className="fatal"><h1>403 · Fremder oder nicht auswertbarer Scope</h1><AccessDeniedHint/></main>;return <main className="fatal"><h1>Kohorten konnten nicht geladen werden</h1><p>Migration und Supabase-Umgebungsvariablen prüfen.</p></main>}
  // Etappe 4 (Abnahme F): globaler Zeitraum nur für die CPL der Partner-Karte; die Kohorten-Tabelle bleibt zeitraumunabhängig.
  let period=resolveGlobalPeriod(filters.period),periodError:string|null=null,resolved;try{resolved=reportingRange(period,new Date(),{from:filters.from,to:filters.to})}catch{periodError='Bitte ein gültiges Von- und Bis-Datum auswählen.';period='30d';resolved=reportingRange(period)}
  const periodQuery=periodError?{}:globalPeriodParams(new URLSearchParams(Object.entries({period:filters.period,from:filters.from,to:filters.to}).filter((entry):entry is[string,string]=>Boolean(entry[1])))),withPeriod=(params:URLSearchParams)=>{for(const[key,value]of Object.entries(periodQuery))params.set(key,value);return params};
  const result=paginateLtvCohorts(allRows,Number(filters.page||1),100,{affiliate:filters.affiliate}),rows=result.rows,pageHref=(page:number)=>{const params=new URLSearchParams();if(filters.source)params.set('source',filters.source);if(filters.sub_source)params.set('sub_source',filters.sub_source);if(filters.affiliate)params.set('affiliate',filters.affiliate);params.set('page',String(page));withPeriod(params);return`/cohorts?${params}`},resetHref=Object.keys(periodQuery).length?`/cohorts?${withPeriod(new URLSearchParams())}`:'/cohorts';
  const dataStatus=await getDataStatus(),header=ltvHeaderStatus(dataStatus);
  // D7: Partner sehen nichts Neues – Partnerwahl und LTV-Karte nur für interne Rollen (Finanzrecht ist oben bereits geprüft).
  const internal=user.access.role!=='partner',selected=(filters.affiliate||'').trim(),partnerIds=internal?[...new Set(allRows.map(row=>row.affiliate_id))].filter(Boolean).sort(byNumericId):[];
  let portfolio:Portfolio|null=null,portfolioError=false;
  if(internal&&selected){try{portfolio=await getDashboard(period,period==='custom'?{from:resolved.from!,to:resolved.to}:undefined,user.access)}catch(error){console.error('LTV-Karte: Portfolio für CPL nicht ladbar',error);portfolioError=true}}
  const partnerName=(affiliateId:string)=>portfolio?.affiliates.find(row=>row.id===affiliateId)?.name;
  const card=(()=>{
    if(!internal||!selected)return null;
    const curve=buildLtvCurve(allRows,selected),entity=portfolio?.affiliates.find(row=>row.id===selected)??null,rates=entityRates(entity),breakEven=findBreakEven(curve,rates.cpl),points=ltvSparklinePoints(curve),volume={clicks:0,sois:curve.registrations},tone=rates.cpl!==null&&breakEven.ltv!==null?signTone(breakEven.ltv-rates.cpl,volume):'neutral',matureWindows=curve.points.filter(point=>point.mature).map(point=>`${point.window} Tage`),immature=curve.immatureMonths365,scopeNote=[filters.source?`Source ${filters.source}`:null,filters.sub_source?`Sub-Source ${filters.sub_source}`:null].filter(Boolean).join(' · ');
    return <section className="ltvPartnerCard" aria-labelledby="ltvPartnerTitle">
      <header className="ltvPartnerHead"><div><span>LTV je Partner</span><h2 id="ltvPartnerTitle">{partnerName(selected)||`Partner ${id(selected)}`}{partnerName(selected)?<small> {id(selected)}</small>:null}</h2></div><PeriodControls dimension="global" period={period} from={period==='custom'?resolved.from!:undefined} to={period==='custom'?resolved.to:undefined} rangeLabel={resolved.label} maxDate={reportingRange('today').to} error={periodError} todayNote={todayPartialNote(dataStatus)} compact/></header>
      <div className="ltvPartnerCurve"><Sparkline points={points} label={`LTV je Registrierung über ${matureWindows.length?matureWindows.join(', '):'noch kein reifes Fenster'}`} width={200} height={44} tone={tone}/><ol className="ltvWindows">{curve.points.map(point=><li key={point.window}><span>{point.window} Tage</span><b className={point.mature?'':'ltvImmature'}>{point.perRegistration===null?'noch nicht reif':euro(point.perRegistration)}</b><small>{point.matureMonths} von {point.totalMonths} Monaten reif</small></li>)}</ol></div>
      <p className={`ltvBreakEven ${toneClass(tone)}`.trim()}><b>{breakEvenSummary(breakEven,euro)}</b></p>
      <dl className="ltvPartnerRates">
        <div><dt>Payout je SOI</dt><dd>{rates.cpl===null?'–':euro(rates.cpl)}</dd><small>{entity&&entity.sois>0?`${euro(entity.payout)} Payout ÷ ${num(entity.sois)} SOIs · ${resolved.label}`:portfolioError?'Portfolio für den Zeitraum nicht ladbar':`keine SOIs in ${resolved.label}`}</small></div>
        <div><dt>Umsatz je SOI</dt><dd>{rates.revenuePerSoi===null?'–':euro(rates.revenuePerSoi)}</dd><small>{entity&&entity.sois>0?`${euro(entity.revenue)} Umsatz ÷ ${num(entity.sois)} SOIs · ${resolved.label}`:'ohne SOIs nicht berechenbar'}</small></div>
        <div><dt>Kohorten</dt><dd>{curve.months.length} {curve.months.length===1?'Monat':'Monate'} · {num(curve.registrations)} Registrierungen</dd><small>{curve.months.length?`${month(curve.months[0])} bis ${month(curve.months[curve.months.length-1])}${scopeNote?` · ${scopeNote}`:''}`:'keine Kohorten für diesen Partner'}</small></div>
      </dl>
      {immature.length>0&&<p className="ltvMaturityNote" role="note">{immature.length===curve.months.length?'Keine Kohorte ist für 365 Tage reif':`${immature.length} von ${curve.months.length} Kohorten-Monaten für 365 Tage noch nicht reif`} ({immature.slice(0,6).map(month).join(', ')}{immature.length>6?', …':''}). Unreife Monate bleiben je Fenster außen vor; die Kurve wächst mit jedem reifen Monat nach.</p>}
      <small className="ltvPartnerFoot">CPL = gebuchter Payout ÷ SOIs im gewählten Zeitraum · LTV-Kurve = kumulierter Umsatz ÷ Registrierungen je Fenster, gewichtet über alle reifen Kohorten-Monate des Partners.</small>
    </section>;
  })();
  return <main className="dashboard"><DashboardPageHeader kicker="ME Media · LTV-Analyse" title="Umsatzkohorten" status={header.label} tone={header.tone} icon="cohorts" description="Registrierungsmonat und kumulierter Umsatz nach Lead-Alter vergleichen."/>
  <DataStatusBar status={dataStatus}/>
  <form className="cohortFilters"><label>Source<input name="source" defaultValue={filters.source||''} placeholder="alle"/></label><label>Sub-Source<input name="sub_source" defaultValue={filters.sub_source||''} placeholder="alle"/></label>{internal?<label>Partner<select name="affiliate" defaultValue={selected}><option value="">alle</option>{selected&&!partnerIds.includes(selected)?<option value={selected}>{id(selected)} · ohne Kohorten</option>:null}{partnerIds.map(affiliateId=><option key={affiliateId} value={affiliateId}>{id(affiliateId)}{partnerName(affiliateId)?` · ${partnerName(affiliateId)}`:''}</option>)}</select></label>:<label>Affiliate-ID<input name="affiliate" defaultValue={filters.affiliate||''} placeholder="alle"/></label>}{Object.entries(periodQuery).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}<button>Filtern</button><InstantLink href={resetHref}>Zurücksetzen</InstantLink></form>
  {card}
  {internal&&!selected&&partnerIds.length>0&&<p className="ltvPartnerHint">Partner wählen, um LTV-Kurve, Payout je SOI und Break-even zu sehen.</p>}
  <div className="tableWrap"><table className="performanceTable cohortTable"><caption className="srOnly">LTV-Kohorten nach Registrierungsmonat, Affiliate, Offer, Campaign, Source und Sub-Source</caption><thead><tr><th>Monat</th><th>Affiliate</th><th>Offer</th><th>Campaign</th><th>Source / Sub-Source</th><th>Registrierungen</th><th>Umsatz je Registrierung (90 Tage)</th><th>Umsatz 30d</th><th>60d</th><th>90d</th><th>180d</th><th>365d</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.registration_month}|${row.affiliate_id}|${row.offer_id}|${row.campaign_id}|${row.source_id}|${row.sub_source}`}><td data-label="Monat"><b>{month(row.registration_month)}</b></td><td data-label="Affiliate">{id(row.affiliate_id)}</td><td data-label="Offer">{id(row.offer_id)}</td><td data-label="Campaign">{row.campaign_id==='0'?'Direkt':id(row.campaign_id)}</td><td data-label="Source"><b>{row.source_id||'–'}</b><small>{row.sub_source||'ohne Sub-Source'}</small></td><td data-label="Registrierungen">{row.registrations}</td><td data-label="Umsatz je Registrierung (90 Tage)">{(value=>value===null?'–':euro(value))(revenuePerRegistration(row))}</td><td data-label="Umsatz 30d">{euro(row.revenue_30d)}</td><td data-label="60d">{euro(row.revenue_60d)}</td><td data-label="90d">{euro(row.revenue_90d)}</td><td data-label="180d">{euro(row.revenue_180d)}</td><td data-label="365d">{euro(row.revenue_365d)}</td></tr>)}</tbody></table></div>
  {result.total>0&&<nav className="cohortPager" aria-label="Kohortenseiten"><span>{result.total.toLocaleString('de-DE')} Gruppen · Seite {result.page} von {result.pages}</span><div>{result.page>1?<InstantLink href={pageHref(result.page-1)}>← Zurück</InstantLink>:<span/>}{result.page<result.pages?<InstantLink href={pageHref(result.page+1)}>Weiter →</InstantLink>:<span/>}</div></nav>}
  {!result.total&&<section className="smartEmpty"><h2>Noch keine Kohorten vorhanden</h2><p>Nach den ersten erfolgreichen Sync-Chunks erscheinen die Daten hier.</p></section>}</main>;
}
