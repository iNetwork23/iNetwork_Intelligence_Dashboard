import Link from 'next/link';
import styles from './OptimizationFlow.module.css';

type Stage='affiliate'|'smartlink'|'automation';
const stages:[Stage,string,string,string][]=[
  ['affiliate','1','Wo handeln?','Affiliate Optimizer'],
  ['smartlink','2','Warum und wie?','Campaign-Tiefenanalyse'],
  ['automation','3','Was wurde ausgeführt?','Auto-Rotation & Nachweis'],
];
const hrefs:Record<Stage,string>={affiliate:'/affiliates',smartlink:'/affiliates?mode=smartlinks',automation:'/automation'};

export default function OptimizationFlow({active}:{active:Stage}){
  return <nav className={styles.flow} aria-label="Gemeinsamer Optimierungsprozess">
    <div className={styles.intro}>
      <span>GEMEINSAMER OPTIMIERUNGSPROZESS</span>
      <b>Erkennen → analysieren → sicher ausführen</b>
    </div>
    <ol>
      {stages.map(([id,index,question,label])=><li key={id} className={id===active?styles.active:''}>
        <Link href={hrefs[id]} prefetch={false} aria-current={id===active?'step':undefined}>
          <i>{index}</i><span><small>{question}</small><b>{label}</b></span>
        </Link>
      </li>)}
    </ol>
  </nav>;
}
