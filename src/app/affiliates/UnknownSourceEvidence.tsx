'use client';
import type {SourceBreakdownRow} from '../../lib/source-breakdown';
import {useHydratedLocale} from '../components/LanguageProvider';
import {localizeClientRoot} from '../components/LocalizedLinkContent';
import styles from './UnknownSourceEvidence.module.css';

/** Preserve stored events whose traffic mode cannot be safely assigned to a source control. */
export default function UnknownSourceEvidence({rows,rangeLabel,finance}:{rows:SourceBreakdownRow[];rangeLabel:string;finance:boolean}){
 const locale=useHydratedLocale(),totals={sois:0,firstSales:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0};
 for(const row of rows)if(row.trafficMode==='unknown')for(const key of Object.keys(totals) as (keyof typeof totals)[])totals[key]+=row.days30[key];
 if(!Object.values(totals).some(value=>value!==0))return null;
 const n=(value:number)=>new Intl.NumberFormat(locale==='en'?'en-GB':'de-DE').format(value),money=(value:number)=>new Intl.NumberFormat(locale==='en'?'en-IE':'de-DE',{style:'currency',currency:'EUR'}).format(value);
 return localizeClientRoot(<section className={styles.notice} aria-label="Quellendaten ohne bestätigten Trafficmodus">
  <h3>Quellendaten ohne bestätigten Trafficmodus</h3>
  <p>Diese gespeicherten Werte sind in der Offer-Auswertung enthalten. Eine Zuordnung zu Source/Sub1 oder ADV1/ADV2 ist nicht bestätigt; daraus werden keine Quellenaktionen abgeleitet.</p>
  <p>{rangeLabel}</p>
  <dl>{([['SOIs',n(totals.sois)],['First-Sales',n(totals.firstSales)],['Rebills',n(totals.rebills)],['Coin-Spend',n(totals.coinSpend)],...(finance?[['Umsatz',money(totals.revenue)],['Payout',money(totals.payout)],['Profit',money(totals.profit)]]:[]) ]).map(([label,value])=><div key={label}><dt>{label}</dt><dd data-no-translate>{value}</dd></div>)}</dl>
 </section>,locale);
}
