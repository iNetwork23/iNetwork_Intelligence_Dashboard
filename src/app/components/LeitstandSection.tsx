import InstantLink from '../affiliates/InstantLink';
import {can,type AccessMetadata} from '@/lib/rbac';
import {describeRollup,formatBlockSince,leitstandAmount,loadLeitstand,mayBlockSources,rollupStaleWarning,LEITSTAND_ROLLUP_PENDING,type LeitstandCounters,type LeitstandRow,type LeitstandView} from '@/lib/leitstand';
import {NOT_BLOCKABLE_HINT} from '@/lib/source-candidate-link';
import {signTone} from '@/lib/verdict-vocabulary';
const toneClass=(tone:ReturnType<typeof signTone>)=>tone==='positive'?'up':tone==='negative'?'down':undefined;

/** Leitstand-Sektion der Startseite (Server-Komponente, kein Client-State): Top-3 Verluste mit Sperrstatus, laufende Eingriffe, Top-3 Skalierung. Die Sperre selbst passiert auf /sources. */
const SOURCES_HREF='/sources?range=30d',BLOCKS_HREF='/source-blocks';
function BlockStatus({row,mayBlock,unknown}:{row:LeitstandRow;mayBlock:boolean;unknown:boolean}){
 if(unknown)return <span className="leitstandPending">Sperrstatus unbekannt</span>;
 if(row.block.state==='active')return <span className="leitstandBlocked">{formatBlockSince(row.block.since!)}</span>;
 if(row.block.state==='pending')return mayBlock?<InstantLink href={BLOCKS_HREF} className="leitstandPending">Verifizierung läuft</InstantLink>:<span className="leitstandPending">Verifizierung läuft</span>;
 if(row.block.state==='error')return mayBlock?<InstantLink href={BLOCKS_HREF} className="leitstandIncident">Zustand unklar</InstantLink>:<span className="leitstandIncident">Zustand unklar</span>;
 if(!row.blockable)return <span className="leitstandOpen">{NOT_BLOCKABLE_HINT}</span>;
 return mayBlock?<InstantLink href={row.href} className="leitstandAction">Vergütung sperren</InstantLink>:<span className="leitstandOpen">Nicht gesperrt</span>;
}
function Row({row,finance,mayBlock,withBlock,unknown=false}:{row:LeitstandRow;finance:boolean;mayBlock:boolean;withBlock:boolean;unknown?:boolean}){
 return <li className={`leitstandRow ${row.severity}`}>
  <div className="leitstandRowMain"><InstantLink href={row.href} className="leitstandRowTitle"><b>{row.title}</b><small>Quelle {row.source}</small></InstantLink><strong className={finance?toneClass(signTone(row.profit,{clicks:row.clicks,sois:row.sois})):undefined}>{leitstandAmount(row,finance)}</strong></div>
  <div className="leitstandRowMeta"><span>{row.leadStatus??'Lead-Status unbekannt'}</span><span className="leitstandReason">{row.reason}</span>{withBlock&&<BlockStatus row={row} mayBlock={mayBlock} unknown={unknown}/>}</div>
 </li>;
}
function Counter({count,label,href,warn}:{count:number|null;label:string;href:string|null;warn?:boolean}){
 const body=<><b>{count===null?'–':count}</b><span>{count===null?`${label} · nicht lesbar`:label}</span></>,className=warn&&count!==null&&count>0?'warn':undefined;
 return <li>{href?<InstantLink href={href} className={className}>{body}</InstantLink>:<div className={className}>{body}</div>}</li>;
}
function Counters({counters,mayBlock,unknown}:{counters:LeitstandCounters;mayBlock:boolean;unknown:boolean}){
 return <article className="leitstandPanel leitstandCounters" aria-label="Laufende Eingriffe"><h3>Laufende Eingriffe</h3><ul>
  <Counter count={unknown?null:counters.activeBlocks} label="aktive Sperren" href={mayBlock?BLOCKS_HREF:null}/>
  <Counter count={unknown?null:counters.incidents} label="Sperr-Incidents" href={mayBlock?BLOCKS_HREF:null} warn/>
  <Counter count={unknown?null:counters.openKill} label="offene Ausschalt-Kandidaten" href={SOURCES_HREF}/>
 </ul></article>;
}
/** `view` kann von der Seite vorab gestartet werden (parallel zu getDashboard); ohne Prop lädt die Sektion selbst. */
export default async function LeitstandSection({access,view:pending}:{access:AccessMetadata;view?:Promise<LeitstandView>}){
 const finance=can(access,'finance.view'),view=await(pending??loadLeitstand(access)),model=view.model,mayBlock=mayBlockSources(access)&&!view.blockIndexUnavailable,unknown=view.blockIndexUnavailable;
 const head=(source:string|null)=><header className="leitstandHead"><div><span>Leitstand</span><h2 id="leitstand-title">Leitstand · letzte 30 Tage</h2></div>{source&&<small className="leitstandSource">{source}</small>}</header>;
 if(!model)return <section className="leitstand" aria-labelledby="leitstand-title">{head(null)}<p className="leitstandHint" role="status">{view.failed?'Quellen-Rollup derzeit nicht lesbar – bitte später erneut laden.':LEITSTAND_ROLLUP_PENDING}</p></section>;
 const rollup=describeRollup(model),stale=rollupStaleWarning(model.generatedAt);
 return <section className="leitstand" aria-labelledby="leitstand-title">
  {head(rollup.source)}
  {rollup.warning&&<p className="leitstandWarning" role="status">{rollup.warning}</p>}
  {stale&&<p className="leitstandWarning" role="status">{stale}</p>}
  {view.blockIndexUnavailable&&<p className="leitstandWarning" role="status">Sperrstatus derzeit nicht lesbar – Sperren auf /sources prüfen.</p>}
  <div className="leitstandGrid">
   <article className="leitstandPanel losses" aria-label="Top-3 Verlustquellen"><h3>Top-3 Verlustquellen</h3>{model.losses.length?<ol>{model.losses.map(row=><Row key={row.key} row={row} finance={finance} mayBlock={mayBlock} withBlock unknown={unknown}/>)}</ol>:<p className="leitstandEmpty">Keine Ausschalt-Kandidaten im Rollup.</p>}</article>
   <Counters counters={model.counters} mayBlock={mayBlockSources(access)} unknown={unknown}/>
   <article className="leitstandPanel winners" aria-label="Top-3 Skalierungskandidaten"><h3>Top-3 Skalierungskandidaten</h3>{model.winners.length?<ol>{model.winners.map(row=><Row key={row.key} row={row} finance={finance} mayBlock={false} withBlock={false}/>)}</ol>:<p className="leitstandEmpty">Keine Skalierungskandidaten im Rollup.</p>}</article>
  </div>
 </section>;
}
