import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getDashboard } from '@/lib/dashboard-service';
import type { Period,Slot } from '@/lib/dashboard';
export const dynamic='force-dynamic';
const euro=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const num=(n:number)=>new Intl.NumberFormat('de-DE').format(n);
const pct=(n:number)=>`${n.toFixed(2).replace('.',',')} %`;
const status=(slot:Slot)=>slot.profit>100?['Stark','strong']:slot.profit>=0?['Positiv','positive']:slot.firstSales===0?['Schwach','weak']:['Prüfen','watch'];
export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string}>}){
 const user=await currentUser();if(!user)redirect('/login');const query=await searchParams;const period:Period=query.period==='today'||query.period==='30d'?query.period:'7d';
 let data;try{data=await getDashboard(period)}catch(error){console.error(error);return <main className="fatal"><div className="eyebrow">DATENQUELLE NICHT ERREICHBAR</div><h1>Dashboard konnte nicht geladen werden</h1><p>Die Everflow-Daten sind vorübergehend nicht verfügbar.</p><Link href="/">Erneut versuchen</Link></main>}
 const totalWeight=data.slots.reduce((sum,s)=>sum+s.weight,0);
 return <main className="dashboard"><header className="topbar"><div><div className="eyebrow">ME MEDIA · PERFORMANCE MONITOR</div><h1>WLX Smartlink <span>#169</span></h1><p>Offer 57 · Singles69 · Affiliate WLX #32</p></div><div className="topActions"><div className="live"><span/>Live-Daten</div><form action="/api/auth/logout" method="post"><button className="logout">Abmelden</button></form></div></header>
 <nav className="periods" aria-label="Zeitraum">{([['today','Heute'],['7d','7 Tage'],['30d','30 Tage']] as const).map(([value,label])=><Link key={value} className={period===value?'active':''} href={`/?period=${value}`}>{label}</Link>)}<span className="range">{data.range.label} · Berlin</span></nav>
 <section className="kpis"><article className="kpi hero"><span>Profit</span><strong className={data.totals.profit>=0?'up':'down'}>{euro(data.totals.profit)}</strong><small>Profit-EPC {euro(data.totals.profitEpc)}</small></article><article className="kpi"><span>Umsatz</span><strong>{euro(data.totals.revenue)}</strong><small>{euro(data.totals.payout)} Payout</small></article><article className="kpi"><span>Traffic</span><strong>{num(data.totals.clicks)}</strong><small>Klicks</small></article><article className="kpi"><span>SOIs</span><strong>{num(data.totals.sois)}</strong><small>CVR {pct(data.totals.cvr)}</small></article><article className="kpi"><span>Monetarisierung</span><strong>{data.totals.firstSales} / {data.totals.rebills}</strong><small>First-Sales / Rebills</small></article></section>
 <section className="sectionHead"><div><span>Aktive Rotation</span><h2>Landingpages nach Profit</h2></div><div className="scope">First-Sale-Rate = First-Sales ÷ SOIs</div></section>
 <section className="slotGrid">{data.slots.map((slot,index)=>{const [label,tone]=status(slot);const share=totalWeight?Math.round(100*slot.weight/totalWeight):0;return <article className={`slot ${tone}`} key={slot.urlId}><div className="slotTop"><div><div className="rank">#{index+1} · {label}</div><h3>{slot.name.replace(/^Single69_Everflow_/,'')}</h3><p>LP #{slot.urlId} · {share}% Gewicht · {slot.status}</p></div><strong className={slot.profit>=0?'up':'down'}>{euro(slot.profit)}</strong></div><div className="metricGrid"><div><b>{num(slot.clicks)}</b><span>Klicks</span></div><div><b>{num(slot.sois)}</b><span>SOIs · {pct(slot.cvr)}</span></div><div><b>{slot.firstSales}</b><span>First-Sales · {pct(slot.firstSaleRate)}</span></div><div><b>{slot.rebills}</b><span>Rebills</span></div></div><div className="economics"><span>Umsatz <b>{euro(slot.revenue)}</b></span><span>Payout <b>{euro(slot.payout)}</b></span><span>Profit-EPC <b>{euro(slot.profitEpc)}</b></span><span>Coin Spend <b>{slot.coinSpend}</b></span></div></article>})}</section>
 <footer><div><b>Read-only Monitor</b><span>Keine Live-Änderungen durch dieses Dashboard.</span></div><div>Cache: 60 Sekunden · Aktualisiert {new Date(data.generatedAt).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div></footer>
 </main>
}
