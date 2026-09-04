'use client';
import{useSearchParams}from'next/navigation';
import InstantLink from'./InstantLink';
import{globalPeriodParams}from'@/lib/period-controls';
import{ltvBreakevenHref}from'@/lib/ltv-breakeven';
/** Ein Link von der Partnerseite zur LTV-Kurve mit Break-even (Abnahme F, ≤ 2 Klicks): Partner-ID aus Prop oder URL, globaler Zeitraum wandert mit. */
export default function LtvBreakevenLink({affiliateId,className='ltvBreakevenLink'}:{affiliateId?:string;className?:string}){
 const searchParams=useSearchParams(),id=(affiliateId||searchParams.get('affiliate')||'').trim();
 if(!id)return null;
 return <InstantLink className={className} href={ltvBreakevenHref(id,globalPeriodParams(searchParams))}>LTV-Kurve und Break-even</InstantLink>;
}
