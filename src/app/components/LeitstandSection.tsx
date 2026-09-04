import InstantLink from '../affiliates/InstantLink';
import {can,type AccessMetadata} from '@/lib/rbac';
import {describeRollup,formatBlockSince,leitstandAmount,loadLeitstand,mayBlockSources,LEITSTAND_ROLLUP_PENDING,type LeitstandCounters,type LeitstandRow} from '@/lib/leitstand';

/** Leitstand-Sektion der Startseite (Server-Komponente, kein Client-State): Top-3 Verluste mit Sperrstatus, laufende Eingriffe, Top-3 Skalierung. Die Sperre selbst passiert auf /sources. */
const SOURCES_HREF='/sources?range=30d',BLOCKS_HREF='/source-blocks';
function BlockStatus({row,mayBlock}:{row:LeitstandRow;mayBlock:boolean}){
 if(row.block.state==='active')return <span className="leitstandBlocked">{formatBlockSince(row.block.since!)}</span>;
 if(row.block.state==='pending')return mayBlock?<InstantLink href={BLOCKS_HREF} className="leitstandPending">Verifizierung läuft</InstantLink>:<span className="leitstandPending">Verifizierung läuft</span>;
 if(row.block.state==='error')return mayBlock?<InstantLink href={BLOCKS_HREF} className="leitstandIncident">Zustand unklar</InstantLink>:<span className="leitstandIncident">Zustand unklar</span>;
 return mayBlock?<InstantLink href={row.href} className="leitstandAction">Vergütung sperren</InstantLink>:<span className="leitstandOpen">Nicht gesperrt</span>;
}
function Row({row,finance,mayBlock,withBlock}:{row:LeitstandRow;finance:boolean;mayBlock:boolean;withBlock:boolean}){
 return <li className={`leitstandRow ${row.severity}`}>
  <div className="leitstandRowMain"><InstantLink href={row.href} className="leitstandRowTitle"><b>{row.title}</b><small>Quelle {row.source}</small></InstantLink><strong className={finance?(row.profit>=0?'up':'down'):undefined}>{leitstandAmount(row,finance)}</strong></div>
  <div className="leitstandRowMeta"><span>{row.leadStatus??'Lead-Status unbekannt'}</span><span className="leitstandReason">{row.reason}</span>{withBlock&&<BlockStatus row={row} mayBlock={mayBlock}/>}</div>
 </li>;
}
function Counter({count,label,href,warn}:{count:number;label:string;href:string|null;warn?:boolean}){
 const body=<><b>{count}</b><span>{label}</span></>;
 return <li>{href?<InstantLink href={href} className={warn&&count>0?'warn':undefined}>{body}</InstantLink>:<div className={warn&&count>0?'warn':undefined}>{body}</div>}</li>;
}
function Counters({counters,mayBlock}:{counters:LeitstandCounters;mayBlock:boolean}){
 return <article className="leitstandPanel leitstandCounters" aria-label="Laufende Eingriffe"><h3>Laufende Eingriffe</h3><ul>
  <Counter count={counters.activeBlocks} label="aktive Sperren" href={mayBlock?BLOCKS_HREF:null}/>
  <Counter count={counters.incidents} label="Sperr-Incidents" href={mayBlock?BLOCKS_HREF:null} warn/>
  <Counter count={counters.openKill} label="offene Ausschalt-Kandidaten" href={SOURCES_HREF}/>
 </ul></article>;
}
export default async function LeitstandSection({access}:{access:AccessMetadata}){
 const finance=can(access,'finance.view'),view=await loadLeitstand(access),model=view.model,mayBlock=mayBlockSources(access)&&!view.blockIndexUnavailable;
 const head=(source:string|null)=><header className="leitstandHead"><div><span>Leitstand</span><h2 id="leitstand-title">Leitstand · letzte 30 Tage</h2></div>{source&&<small className="leitstandSource">{source}</small>}</header>;
 if(!model)return <section className="leitstand" aria-labelledby="leitstand-title">{head(null)}<p className="leitstandHint" role="status">{view.failed?'Quellen-Rollup derzeit nicht lesbar – bitte später erneut laden.':LEITSTAND_ROLLUP_PENDING}</p></section>;
 const rollup=describeRollup(model);
 return <section className="leitstand" aria-labelledby="leitstand-title">
  {head(rollup.source)}
  {rollup.warning&&<p className="leitstandWarning" role="status">{rollup.warning}</p>}
  {view.blockIndexUnavailable&&<p className="leitstandWarning" role="status">Sperrstatus derzeit nicht lesbar – Sperren auf /sources prüfen.</p>}
  <div className="leitstandGrid">
   <article className="leitstandPanel losses" aria-label="Top-3 Verlustquellen"><h3>Top-3 Verlustquellen</h3>{model.losses.length?<ol>{model.losses.map(row=><Row key={row.key} row={row} finance={finance} mayBlock={mayBlock} withBlock/>)}</ol>:<p className="leitstandEmpty">Keine Ausschalt-Kandidaten im Rollup.</p>}</article>
   <Counters counters={model.counters} mayBlock={mayBlockSources(access)}/>
   <article className="leitstandPanel winners" aria-label="Top-3 Skalierungskandidaten"><h3>Top-3 Skalierungskandidaten</h3>{model.winners.length?<ol>{model.winners.map(row=><Row key={row.key} row={row} finance={finance} mayBlock={false} withBlock={false}/>)}</ol>:<p className="leitstandEmpty">Keine Skalierungskandidaten im Rollup.</p>}</article>
  </div>
 </section>;
}
