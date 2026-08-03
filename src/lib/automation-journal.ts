// Das Automationsjournal ist ein generierter Schnappschuss (scripts/sync-automation-journal.mjs),
// keine Live-Abfrage. Ohne eine Frischeprüfung meldet die Ansicht auch dann Normalbetrieb,
// wenn die Automation längst steht. Die Bewertung erfolgt serverseitig zur Anfragezeit.

export type JournalCampaign={
  readonly campaignId:number;readonly name:string;readonly enabled:boolean;readonly mode:string;
  readonly lastRunAt?:string|null;readonly nextRunAt?:string|null;
};
export type JournalShape={readonly generatedAt:string;readonly campaigns:readonly JournalCampaign[]};
export type OverdueCampaign={campaignId:number;name:string;overdueMinutes:number};
export type JournalFreshness={generatedAt:string;ageMinutes:number|null;stale:boolean;overdue:OverdueCampaign[]};

const MINUTE=60_000;
// Auch bei sehr kurzen Intervallen bleibt ein Mindestpuffer, damit normale Laufzeitschwankungen
// keinen Fehlalarm auslösen.
const MIN_GRACE_MINUTES=15;
// Lässt sich aus den Daten kein Intervall ableiten — etwa weil nextRunAt fehlt —, greift dieser
// Rückfallwert. Ohne ihn würde sich die Alterungsprüfung genau dann abschalten, wenn das Journal
// unvollständig ist, also im ungünstigsten Fall.
const FALLBACK_CYCLE_MINUTES=180;

const minutesBetween=(from:number,to:number)=>Math.round((to-from)/MINUTE);
const parse=(value:unknown)=>{const time=Date.parse(String(value));return Number.isFinite(time)?time:null};

// Der Puffer leitet sich aus dem tatsächlichen Prüfintervall der Campaign ab (nextRunAt - lastRunAt)
// statt aus dem frei formulierten schedule-Text, der nicht verlässlich parsebar ist.
export function graceMinutes(intervalMinutes:number|null){
  if(intervalMinutes===null||intervalMinutes<=0)return MIN_GRACE_MINUTES;
  return Math.max(MIN_GRACE_MINUTES,Math.round(intervalMinutes/4));
}

export function assessJournalFreshness(journal:JournalShape,now=new Date()):JournalFreshness{
  const nowMs=now.getTime(),generated=parse(journal.generatedAt),overdue:OverdueCampaign[]=[];
  let longestCycle=0;
  for(const campaign of journal.campaigns||[]){
    if(!campaign.enabled||campaign.mode!=='live')continue;
    const last=parse(campaign.lastRunAt),next=parse(campaign.nextRunAt);
    const interval=last!==null&&next!==null&&next>last?minutesBetween(last,next):null,grace=graceMinutes(interval);
    if(interval!==null)longestCycle=Math.max(longestCycle,interval+grace);
    if(next===null)continue;
    const late=minutesBetween(next,nowMs);
    if(late>grace)overdue.push({campaignId:campaign.campaignId,name:campaign.name,overdueMinutes:late});
  }
  const ageMinutes=generated===null?null:minutesBetween(generated,nowMs),cycle=longestCycle>0?longestCycle:FALLBACK_CYCLE_MINUTES;
  // Ein unlesbarer Zeitstempel gilt als veraltet: die Frische lässt sich dann nicht belegen.
  const stale=ageMinutes===null||overdue.length>0||ageMinutes>cycle;
  return{generatedAt:journal.generatedAt,ageMinutes,stale,overdue:overdue.sort((a,b)=>b.overdueMinutes-a.overdueMinutes)};
}
