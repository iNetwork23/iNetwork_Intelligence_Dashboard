import{KILL_MATURITY_SOIS,SCALE_MIN_FIRST_SALES,SCALE_MIN_SOIS,wilsonLower,wilsonUpper,type UnitAction,type UnitSeverity}from'./decision-engine';
/**
 * Ein Vokabular in drei Klassen (Entscheidung D13) und die Reife-Gates für Farben (D15) und Konfidenztexte (D19).
 * Urteil = was die Engine sagt · Aktion = was ein Mensch auslöst · Zustand = was gerade gilt.
 * UI-Code bezieht Wörter, Vorzeichenfarben und Konfidenztexte ausschließlich von hier. Client-sicher (keine Server-Importe).
 */
export type VerdictWord=UnitAction;
export const VERDICT_WORDS:readonly VerdictWord[]=['AUSSCHALTEN','SKALIEREN','WEITERLAUFEN','WEITER TESTEN','BEOBACHTEN'];
export const VERDICT_SEVERITY:Record<VerdictWord,UnitSeverity>={AUSSCHALTEN:'critical',SKALIEREN:'positive',WEITERLAUFEN:'positive','WEITER TESTEN':'neutral',BEOBACHTEN:'warning'};
export const isVerdictWord=(value:unknown):value is VerdictWord=>typeof value==='string'&&(VERDICT_WORDS as readonly string[]).includes(value);
/** Klasse 2 · Aktionen (Schaltflächen, Menüs). */
export const ACTION_WORDS={block:'Vergütung sperren',blockAcrossOffers:'Produktweit sperren',blockSelected:'Ausgewählte sperren',unblock:'Sperre aufheben',verifyThenUnblock:'Nach Everflow-Prüfung deaktivieren',blockAcrossOffersScoped:(scope:string)=>`${scope} überall sperren`,blockAcrossOffersConfirm:(scope:string)=>`${scope} in allen gefundenen Produkten sperren`,pause:'Pausieren',resume:'Fortsetzen'} as const;
/** Klasse 3 · Zustände (Marker, Badges). */
export const STATE_WORDS={blockedSince:(date:string)=>`Gesperrt seit ${date}`,notBlocked:'Nicht gesperrt',unclear:'Zustand unklar',verifying:'Verifizierung läuft',blockedAcrossOffers:'Produktweit gesperrt',frozen:'eingefroren',partialDay:'Teiltag'} as const;
/** Vier Severities → CSS-Token (bestehende Variablen aus globals.css). */
export const SEVERITY_TOKEN:Record<UnitSeverity,string>={positive:'var(--positive)',neutral:'var(--text-muted)',warning:'var(--warning)',critical:'var(--negative)'};
/** Reife-Gate D15: erst ab dieser Evidenz bekommen Vorzeichen eine Farbe. */
export const TREND_MATURITY={clicks:100,sois:20} as const;
/** CVR-Ampel erst ab so vielen Klicks (D15). */
export const CVR_GATE_CLICKS=100;
export type Volume={clicks:number;sois:number};
export const isTrendMature=(m:Volume)=>m.clicks>=TREND_MATURITY.clicks||m.sois>=TREND_MATURITY.sois;
export const maturityGateText=`unter Reifeschwelle (≥ ${TREND_MATURITY.clicks} Klicks oder ≥ ${TREND_MATURITY.sois} SOIs)`;
export type SignTone='positive'|'negative'|'neutral';
/** Vorzeichenfarbe nur bei reifer Evidenz; 0 bleibt neutral. */
export const signTone=(value:number,m:Volume):SignTone=>!isTrendMature(m)||!Number.isFinite(value)||value===0?'neutral':value>0?'positive':'negative';
/** CVR-Ampel: neutral unter dem Klick-Gate oder ohne Vergleichswert; negativ erst unter dem halben Vergleichswert. */
export const cvrTone=(clicks:number,rate:number,benchmark?:number|null):SignTone=>clicks<CVR_GATE_CLICKS||benchmark===undefined||benchmark===null||!(benchmark>0)?'neutral':rate>=benchmark?'positive':rate<benchmark*0.5?'negative':'neutral';
export type ConfidenceBand={label:'belastbar'|'unsicher';low:number;high:number;text:string};
const pct=(value:number)=>`${(value*100).toFixed(1).replace('.',',')} %`;
/** D19: Klartext plus Wilson-Band der First-Sale-Rate. Belastbar ab Abschaltreife oder Skalierreife. */
export function confidenceBand(successes:number,trials:number):ConfidenceBand{const low=wilsonLower(successes,trials),high=wilsonUpper(successes,trials),label=trials>=KILL_MATURITY_SOIS||(trials>=SCALE_MIN_SOIS&&successes>=SCALE_MIN_FIRST_SALES)?'belastbar':'unsicher';return{label,low,high,text:trials>0?`${label} · ${pct(low)}–${pct(high)}`:'unsicher · keine SOIs'}}
export type Delta={direction:'up'|'down'|'flat'|'none';absolute:number|null;relative:number|null;text:string;reason:string|null};
/** Vorperiode mit Richtung: '–' nur mit Grund (keine Vorperiode / unter Reifeschwelle). */
export function formatDelta(current:number,previous:number|null|undefined,options:{maturity?:Volume;unit?:string;digits?:number}={}):Delta{const{maturity,unit='',digits=0}=options;if(previous===null||previous===undefined)return{direction:'none',absolute:null,relative:null,text:'–',reason:'keine Vorperiode'};if(maturity&&!isTrendMature(maturity))return{direction:'none',absolute:null,relative:null,text:'–',reason:maturityGateText};const absolute=current-previous,relative=previous!==0?absolute/Math.abs(previous):null,direction=absolute>0?'up':absolute<0?'down':'flat',sign=absolute>0?'+':'',fixed=digits===0&&Math.abs(absolute)<1&&absolute!==0?absolute.toFixed(2):absolute.toFixed(digits),text=`${sign}${fixed.replace('.',',')}${unit}${relative!==null?` (${relative>0?'+':''}${(relative*100).toFixed(0)} %)`:''}`;return{direction,absolute,relative,text,reason:null}}
