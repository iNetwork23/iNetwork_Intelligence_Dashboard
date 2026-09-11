'use client';
import {useEffect, useState} from 'react';
import type {ResolvedAffiliatePeriod} from '@/lib/affiliate-period';
import DashboardPageHeader from '../components/DashboardPageHeader';
import PeriodControls from '../components/PeriodControls';
import {useHydratedLocale} from '../components/LanguageProvider';
import {localizeClientRoot} from '../components/LocalizedLinkContent';

const recoveryKeys = ['affiliate', 'offer', 'mode', 'campaign', 'partner', 'open', 'q', 'latency', 'period', 'from', 'to', 'calendarYear', 'calendarMonth', 'sourcePeriod', 'sourceFrom', 'sourceTo', 'sourceSort', 'sourceOpen'] as const;

/** Keep the requested workspace editable after a data failure; retry performs a new server load. */
export default function AffiliateLoadFailure({query, period, incomplete}: {
  query: Record<string, string | undefined>;
  period: ResolvedAffiliatePeriod;
  incomplete: boolean;
}) {
  const locale = useHydratedLocale(), [hash, setHash] = useState('');
  const params = new URLSearchParams();
  for (const key of recoveryKeys) if (typeof query[key] === 'string') params.set(key, query[key]!);
  const queryKey = params.toString();
  useEffect(() => {
    const restore = () => {if (window.location.pathname === '/affiliates') setHash(window.location.hash);};
    restore();
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {window.removeEventListener('hashchange', restore); window.removeEventListener('popstate', restore);};
  }, [queryKey]);
  const retryHref = `/affiliates${params.size ? `?${params}` : ''}${hash}`;
  return localizeClientRoot(<main className="dashboard affiliateOptimizer">
    <div role="alert">
      <DashboardPageHeader kicker="Affiliate Optimizer" icon="affiliate" tone="warning"
        title={period.error ? 'Ungültiger Zeitraum' : incomplete ? 'Zeitraum noch nicht vollständig verfügbar' : 'Affiliate Optimizer konnte nicht geladen werden'}
        status={period.error ? 'Eingabe prüfen' : incomplete ? 'Unvollständige Daten' : 'Nicht verfügbar'}
        description={period.error || (incomplete
          ? 'Für diesen Zeitraum sind noch nicht alle Tagesdaten bestätigt. Wählen Sie einen anderen Zeitraum oder versuchen Sie es später erneut.'
          : 'Die Datenquelle ist vorübergehend nicht verfügbar. Sie können den Zeitraum ändern oder die Auswahl erneut laden.')}/>
    </div>
    <PeriodControls dimension="global" period={period.error ? query.period || period.period : period.period}
      from={period.error ? query.from : period.from} to={period.error ? query.to : period.to}
      rangeLabel={period.error ? 'Ausgewählter Zeitraum' : period.label} maxDate={period.maxDate} error={period.error}/>
    {!period.error && <a className="dashboardRetry" href={retryHref}>Erneut versuchen</a>}
  </main>, locale);
}
