import{FRAUD_NOT_BLOCKABLE_HINT,type FraudBlockRow,type FraudBlockState}from'@/lib/fraud-block-row';
import{openSourceRowHref}from'@/lib/open-source-row-link';
import{SOURCE_BLOCKS_HREF}from'@/lib/source-block-markers';
import{STATE_WORDS}from'@/lib/verdict-vocabulary';
import SourceBlockButton from'../affiliates/SourceBlockButton';
import InstantLink from'../affiliates/InstantLink';
type Props={row:FraudBlockRow;state:FraudBlockState;mayBlock:boolean;finance:boolean;rangeParams:string;statusUnknown:boolean};
/**
 * Sperrspalte der Fraud-Zeile (D2, Abnahme G „Hohes Risiko → Sperre ≤ 2 Klicks“): offene Zeile → SourceBlockButton (Klick 1 Dialog, Klick 2 bestätigen),
 * gesperrt → Marker ohne Button, unklar → Marker plus Button (Zweitversuch), ohne vollständige Identität → Hinweis mit Deep-Link (sourceOpen) in den Affiliate-Bereich.
 * Shadow-Mode bleibt: hier wird nichts automatisch gesperrt, jede Sperre bestätigt der Nutzer im Dialog.
 */
export default function FraudBlockCell({row,state,mayBlock,finance,rangeParams,statusUnknown}:Props){
 if(state.kind==='external')return <div className="fraudBlockCell"><span className="fraudNotBlockable">{FRAUD_NOT_BLOCKABLE_HINT}</span><InstantLink className="fraudBlockLink" href={openSourceRowHref(row.affiliateId,row.offerId,row.offerUrlId,rangeParams)}>Im Affiliate-Bereich öffnen</InstantLink></div>;
 if(statusUnknown)return <div className="fraudBlockCell"><span className="fraudNotBlockable">Sperrstatus unbekannt</span><InstantLink className="fraudBlockLink" href={SOURCE_BLOCKS_HREF}>Sperrliste öffnen</InstantLink></div>;
 const {identity}=state,metrics={payout:finance?row.metrics.payout:null,sois:row.metrics.sois,profit:finance?row.metrics.profit:null,clicks:row.metrics.clicks,firstSales:row.metrics.firstSales};
 const button=mayBlock?<SourceBlockButton affiliateId={identity.affiliateId} affiliateName={row.affiliateName} offerId={identity.offerId} offerName={row.offerName} trafficMode={identity.trafficMode} level={identity.level} mainValue={identity.mainValue} subValue={identity.subValue} metrics={metrics} showMoney={finance}/>:null;
 if(state.kind==='blocked')return <div className="fraudBlockCell"><b className={`fraudBlocked ${state.marker.status}`}>{state.text}</b><InstantLink className="fraudBlockLink" href={SOURCE_BLOCKS_HREF}>Sperre ansehen</InstantLink></div>;
 if(state.kind==='unclear')return <div className="fraudBlockCell"><b className={`fraudBlocked ${state.marker.status}`}>{state.text}</b>{button??<InstantLink className="fraudBlockLink" href={SOURCE_BLOCKS_HREF}>Sperre ansehen</InstantLink>}</div>;
 return <div className="fraudBlockCell">{button??<span className="fraudNotBlockable">{STATE_WORDS.notBlocked}</span>}</div>;
}
