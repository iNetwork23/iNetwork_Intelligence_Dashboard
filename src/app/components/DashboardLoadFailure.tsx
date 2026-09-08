import {reportingRange,type ReportingPeriod} from '@/lib/supabase-reporting';
import DashboardPageHeader from './DashboardPageHeader';
import LocalizedMain from './LocalizedMain';
import PeriodControls from './PeriodControls';

export type DashboardRecoveryQuery={period?:string;from?:string;to?:string;view?:string;company?:string};

/** The selected range remains editable even when its facts cannot be published. */
export default function DashboardLoadFailure({period,query,incomplete}:{period:ReportingPeriod;query:DashboardRecoveryQuery;incomplete:boolean}){
 const maxDate=reportingRange('today').to;
 let rangeLabel='Ausgewählter Zeitraum';
 try{rangeLabel=reportingRange(period,new Date(),{from:query.from,to:query.to}).label}catch{/* Invalid custom input must still offer a way out. */}
 const retryQuery=new URLSearchParams();
 for(const key of ['period','from','to','view','company'] as const)if(typeof query[key]==='string')retryQuery.set(key,query[key]!);
 const retryHref=retryQuery.size?'/?'+retryQuery:'/';
 return <LocalizedMain className="dashboard">
  <div role="alert">
   <DashboardPageHeader kicker="Account Monitor" icon="monitor" tone="warning"
    title={incomplete?'Zeitraum noch nicht vollständig verfügbar':'Dashboard konnte nicht geladen werden'}
    status={incomplete?'Unvollständige Daten':'Nicht verfügbar'}
    description={incomplete?'Für diesen Zeitraum sind noch nicht alle Tagesdaten bestätigt. Wählen Sie einen anderen Zeitraum oder versuchen Sie es später erneut.':'Die Datenquelle ist vorübergehend nicht verfügbar. Sie können den Zeitraum ändern oder die Auswahl erneut laden.'}/>
  </div>
  <PeriodControls dimension="global" period={period} rangeLabel={rangeLabel} maxDate={maxDate}
   from={period==='custom'?query.from:undefined} to={period==='custom'?query.to:undefined}/>
  <a className="dashboardRetry" data-dashboard-retry href={retryHref}>Ausgewählten Zeitraum erneut laden</a>
 </LocalizedMain>;
}
