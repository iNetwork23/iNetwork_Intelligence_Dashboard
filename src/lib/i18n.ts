import {translations} from './i18n-translations';

export type DashboardLocale='de'|'en';
export {translations};
export const LOCALE_STORAGE_KEY='wlx-locale';
export const LOCALE_COOKIE='wlx-locale';

const reverseTranslations=new Map<string,string>(Object.entries(translations).map(([de,en])=>[en,de]));

// Only complete, known UI messages match. Source IDs and business names are
// never translated by replacing individual words inside arbitrary strings.
const statusTemplates:readonly [RegExp,string,RegExp,string][]=[
 [/^Gespeichert · 1 Regel aktiv\.$/,'Saved · 1 rule active.',/^Saved · 1 rule active\.$/,'Gespeichert · 1 Regel aktiv.'],
 [/^Gespeichert · (\d+) Regeln aktiv\.$/,'Saved · $1 rules active.',/^Saved · (\d+) rules active\.$/,'Gespeichert · $1 Regeln aktiv.'],
 [/^(\d+) von (\d+) SOIs reif \(Schwelle (\d+)\)$/,'$1 of $2 SOIs mature (threshold $3)',/^(\d+) of (\d+) SOIs mature \(threshold (\d+)\)$/,'$1 von $2 SOIs reif (Schwelle $3)'],
 [/^([\d.,]+) % der Sale-Ereignisse$/,'$1 % of sale events',/^([\d.,]+)\s*% of sale events$/,'$1 % der Sale-Ereignisse'],
 [/^(-?[\d.,]+\s*€) Umsatz je SOI$/,'$1 revenue per SOI',/^(-?€[\d.,]+) revenue per SOI$/,'$1 Umsatz je SOI'],
 [/^([\d.,]+ %) CVR · ([\d.,]+) SOIs aus ([\d.,]+) Klicks · ([\d.,]+) First-Sales$/,'$1 CVR · $2 SOIs from $3 clicks · $4 First-Sales',/^([\d.,]+\s*%) CVR · ([\d.,]+) SOIs from ([\d.,]+) clicks · ([\d.,]+) First-Sales$/,'$1 CVR · $2 SOIs aus $3 Klicks · $4 First-Sales'],
 [/^([\d.,]+) SOIs · keine Klicks · ([\d.,]+) First-Sales$/,'$1 SOIs · no clicks · $2 First-Sales',/^([\d.,]+) SOIs · no clicks · ([\d.,]+) First-Sales$/,'$1 SOIs · keine Klicks · $2 First-Sales'],
 [/^First-Sale-Rate auch optimistisch unter ([\d.,]+ %) \(halber Vergleichswert\) bei negativem Profit\.$/,'First-sale rate is below $1 (half the benchmark) even optimistically, with negative profit.',/^First-sale rate is below ([\d.,]+\s*%) \(half the benchmark\) even optimistically, with negative profit\.$/,'First-Sale-Rate auch optimistisch unter $1 (halber Vergleichswert) bei negativem Profit.'],
 [/^(\d+) direkte Landingpages$/,'$1 direct landing pages',/^(\d+) direct landing pages$/,'$1 direkte Landingpages'],
 [/^Letzter Lead (\d{2})\.(\d{2})\.$/,'Last lead $1/$2',/^Last lead (\d{2})\/(\d{2})$/,'Letzter Lead $1.$2.'],
 [/^Mehr anzeigen · (\d+) weitere$/,'Show more · $1 more',/^Show more · (\d+) more$/,'Mehr anzeigen · $1 weitere'],
 [/^Notiz ist zu lang \(max\. (\d+) Zeichen\)\.$/,'Note is too long (max. $1 characters).',/^Note is too long \(max\. (\d+) characters\)\.$/,'Notiz ist zu lang (max. $1 Zeichen).'],
 [/^Höchstens (\d+) Regeln\.$/,'At most $1 rules.',/^At most (\d+) rules\.$/,'Höchstens $1 Regeln.'],
 [/^Für Partner (\d+)( \/ Campaign \d+)? gibt es bereits eine Regel\.$/,'A rule already exists for partner $1$2.',/^A rule already exists for partner (\d+)( \/ Campaign \d+)?\.$/,'Für Partner $1$2 gibt es bereits eine Regel.'],
 [/^Partner (\d+)( \/ Campaign \d+)? ist doppelt\.$/,'Partner $1$2 is duplicated.',/^Partner (\d+)( \/ Campaign \d+)? is duplicated\.$/,'Partner $1$2 ist doppelt.'],
 [/^([\d.,]+) % First-Sales je SOI$/,'$1 % first sales per SOI',/^([\d.,]+)% first sales per SOI$/,'$1 % First-Sales je SOI'],
 [/^(-?[\d.,]+\s*€) bei ([\d.,]+) SOIs(\.?)$/,'$1 from $2 SOIs$3',/^(-?€[\d.,]+) from ([\d.,]+) SOIs(\.?)$/,'$1 bei $2 SOIs$3'],
 [/^([\d.,]+) SOIs · noch keine belastbare Mindestmenge\.$/,'$1 SOIs · minimum sample size not yet reached.',/^([\d.,]+) SOIs · minimum sample size not yet reached\.$/,'$1 SOIs · noch keine belastbare Mindestmenge.'],
 [/^Stand (\d{2}:\d{2})$/,'Updated $1',/^Updated (\d{2}:\d{2})$/,'Stand $1'],
 [/^(\d+) Partner verfügbar$/,'$1 partners available',/^(\d+) partners available$/,'$1 Partner verfügbar'],
 [/^(\d+) gespeicherte Smartlinks$/,'$1 saved smartlinks',/^(\d+) saved smartlinks$/,'$1 gespeicherte Smartlinks'],
 [/^(\d+) Campaign(s?) mit Prüfhinweis$/,'$1 campaign$2 to review',/^(\d+) campaign(s?) to review$/,'$1 Campaign$2 mit Prüfhinweis'],
 [/^(\d+) dringend prüfen$/,'$1 urgent reviews',/^(\d+) urgent reviews$/,'$1 dringend prüfen'],
 [/^\((\d+) ausgeblendet\)$/,'($1 hidden)',/^\((\d+) hidden\)$/,'($1 ausgeblendet)'],
 [/^· (\d+) Pfade$/,'· $1 paths',/^· (\d+) paths$/,'· $1 Pfade'],
 [/^Top 3: ([\d.,]+) % der SOIs · (\d+) Partner mit SOIs$/,'Top 3: $1 % of SOIs · $2 partners with SOIs',/^Top 3: ([\d.,]+) % of SOIs · (\d+) partners with SOIs$/,'Top 3: $1 % der SOIs · $2 Partner mit SOIs'],
 [/^Dry Run: Entscheidung Halten \(([a-z_]+)\) · (\d+) Writes$/,'Dry run: Decision hold ($1) · $2 writes',/^Dry run: Decision hold \(([a-z_]+)\) · (\d+) writes$/,'Dry Run: Entscheidung Halten ($1) · $2 Writes'],
 [/^Halten \(([a-z_]+)\)$/,'Hold ($1)',/^Hold \(([a-z_]+)\)$/,'Halten ($1)'],
 [/^(\d+(?:[.,]\d+)?) Tage$/,'$1 days',/^(\d+(?:[.,]\d+)?) days$/,'$1 Tage'],
 [/^(\d+) aktiv$/,'$1 active',/^(\d+) active$/,'$1 aktiv'],
 [/^(\d+) Min\.$/,'$1 min',/^(\d+) min$/,'$1 Min.'],
 [/^Rollup vom ([\d.,/: ]+) · Zugewiesener Bereich$/,'Rollup from $1 · Assigned scope',/^Rollup from ([\d.,/: ]+) · Assigned scope$/,'Rollup vom $1 · Zugewiesener Bereich'],
 [/^Rollup vom ([\d.,/: ]+) · (\d+) von (\d+) Partnern$/,'Rollup from $1 · $2 of $3 partners',/^Rollup from ([\d.,/: ]+) · (\d+) of (\d+) partners$/,'Rollup vom $1 · $2 von $3 Partnern'],
 [/^(\d+) von (\d+) Partnern$/,'$1 of $2 partners',/^(\d+) of (\d+) partners$/,'$1 von $2 Partnern'],
 [/^(\d+) von (\d+) Partnern wurden innerhalb des Zeitbudgets ausgewertet\. Quellen fehlender Partner sind nicht bewertet und fehlen in dieser Liste\.$/,'$1 of $2 partners were evaluated within the time budget. Sources from missing partners have not been evaluated and are absent from this list.',/^(\d+) of (\d+) partners were evaluated within the time budget\. Sources from missing partners have not been evaluated and are absent from this list\.$/,'$1 von $2 Partnern wurden innerhalb des Zeitbudgets ausgewertet. Quellen fehlender Partner sind nicht bewertet und fehlen in dieser Liste.'],
 [/^Auswahl für LP #(\d+)$/,'Selection for LP #$1',/^Selection for LP #(\d+)$/,'Auswahl für LP #$1'],
 [/^Familien-ID für LP #(\d+)$/,'Family ID for LP #$1',/^Family ID for LP #(\d+)$/,'Familien-ID für LP #$1'],
 [/^Familienname für LP #(\d+)$/,'Family name for LP #$1',/^Family name for LP #(\d+)$/,'Familienname für LP #$1'],
 [/^Journal-Stand vor (\d+) (h|min)$/,'Journal updated $1 $2 ago',/^Journal updated (\d+) (h|min) ago$/,'Journal-Stand vor $1 $2'],
 [/^Berlin-Tagesdaten müssen neu synchronisiert werden \((\d+)\/(\d+) Tage bestätigt\)$/,'Berlin daily data must be refreshed ($1/$2 days confirmed)',/^Berlin daily data must be refreshed \((\d+)\/(\d+) days confirmed\)$/,'Berlin-Tagesdaten müssen neu synchronisiert werden ($1/$2 Tage bestätigt)'],
 [/^Mindestens (\d+) Klicks berücksichtigen die Rule of Three bei null Conversions\.$/,'At least $1 clicks account for the rule of three with zero conversions.',/^At least (\d+) clicks account for the rule of three with zero conversions\.$/,'Mindestens $1 Klicks berücksichtigen die Rule of Three bei null Conversions.'],
 [/^Traffic wird auf (\d+) Varianten verteilt\.$/,'Traffic is split across $1 variants.',/^Traffic is split across (\d+) variants\.$/,'Traffic wird auf $1 Varianten verteilt.'],
 [/^· noch (\d+)$/,'· $1 remaining',/^· (\d+) remaining$/,'· noch $1'],
 [/^(\d+) Klicks ohne einen einzigen SOI\.$/,'$1 clicks without a single SOI.',/^(\d+) clicks without a single SOI\.$/,'$1 Klicks ohne einen einzigen SOI.'],
 [/^(\d+) Quelle sperren$/,'Block $1 source',/^Block (\d+) source$/,'$1 Quelle sperren'],
 [/^(\d+) Quellen sperren$/,'Block $1 sources',/^Block (\d+) sources$/,'$1 Quellen sperren'],
 [/^(\d+) Quelle jetzt sperren$/,'Block $1 source now',/^Block (\d+) source now$/,'$1 Quelle jetzt sperren'],
 [/^(\d+) Quellen jetzt sperren$/,'Block $1 sources now',/^Block (\d+) sources now$/,'$1 Quellen jetzt sperren'],
 [/^(\d+) aktiv$/,'$1 active',/^(\d+) active$/,'$1 aktiv'],
 [/^Setting #(\d+) · Payout 0 · Postback aus$/,'Setting #$1 · Payout 0 · Postback off',/^Setting #(\d+) · Payout 0 · Postback off$/,'Setting #$1 · Payout 0 · Postback aus'],
 [/^Gesperrt seit (\d{2}\.\d{2}\.\d{4})$/,'Blocked since $1',/^Blocked since (\d{2}[./]\d{2}[./]\d{4})$/,'Gesperrt seit $1'],
 [/^· (\d+) ohne Bilanz \(vor Etappe 4 gesperrt\)$/,'· $1 without a balance (blocked before balances were recorded)',/^· (\d+) without a balance \(blocked before balances were recorded\)$/,'· $1 ohne Bilanz (vor Etappe 4 gesperrt)'],
 [/^vermieden (.+?) · entgangen (.+?) · (\d+) Sperren$/,'avoided $1 · forgone $2 · $3 blocks',/^avoided (.+?) · forgone (.+?) · (\d+) blocks$/,'vermieden $1 · entgangen $2 · $3 Sperren'],
 [/^Dieses Gerät ist registriert \((\d+) insgesamt\)\.$/,'This device is registered ($1 total).',/^This device is registered \((\d+) total\)\.$/,'Dieses Gerät ist registriert ($1 insgesamt).'],
 [/^Dieses Gerät ist nicht registriert \((\d+) insgesamt\)\.$/,'This device is not registered ($1 total).',/^This device is not registered \((\d+) total\)\.$/,'Dieses Gerät ist nicht registriert ($1 insgesamt).'],
 [/^(\d+) aktive Sperren$/,'$1 active blocks',/^(\d+) active blocks$/,'$1 aktive Sperren'],
 [/^(\d+) offene Ausschalt-Kandidaten$/,'$1 open switch-off candidates',/^(\d+) open switch-off candidates$/,'$1 offene Ausschalt-Kandidaten'],
 [/^(\d+(?:,\d+)?) % der tracked SOIs in höchstens 15 Sekunden$/,'$1 % of tracked SOIs within 15 seconds',/^(\d+(?:,\d+)?) % of tracked SOIs within 15 seconds$/,'$1 % der tracked SOIs in höchstens 15 Sekunden'],
 [/^(\d+(?:,\d+)?) % sehr schnelle tracked SOIs$/,'$1 % very fast tracked SOIs',/^(\d+(?:,\d+)?) % very fast tracked SOIs$/,'$1 % sehr schnelle tracked SOIs'],
 [/^(\d+) unabhängige Coin-Nutzer ohne Zahler · Null-Sale-Wahrscheinlichkeit (\d+(?:,\d+)?) %$/,'$1 independent coin users without payers · Zero-sale probability $2 %',/^(\d+) independent coin users without payers · Zero-sale probability (\d+(?:,\d+)?) %$/,'$1 unabhängige Coin-Nutzer ohne Zahler · Null-Sale-Wahrscheinlichkeit $2 %'],
 [/^(\d+) Kandidaten$/,'$1 candidates',/^(\d+) candidates$/,'$1 Kandidaten'],
 [/^(\d+) von (\d+) Kandidaten$/,'$1 of $2 candidates',/^(\d+) of (\d+) candidates$/,'$1 von $2 Kandidaten'],
 [/^· (\d+) sichtbar$/,'· $1 visible',/^· (\d+) visible$/,'· $1 sichtbar'],
 [/^(\d+) von (\d+) SOIs reif$/,'$1 of $2 SOIs mature',/^(\d+) of (\d+) SOIs mature$/,'$1 von $2 SOIs reif'],
 [/^(\d+) von (\d+) SOIs reif · Schwelle (\d+)$/,'$1 of $2 SOIs mature · threshold $3',/^(\d+) of (\d+) SOIs mature · threshold (\d+)$/,'$1 von $2 SOIs reif · Schwelle $3'],
 [/^unreif · (\d+) von (\d+) SOIs$/,'immature · $1 of $2 SOIs',/^immature · (\d+) of (\d+) SOIs$/,'unreif · $1 von $2 SOIs'],
 [/^reif · (\d+) SOIs$/,'mature · $1 SOIs',/^mature · (\d+) SOIs$/,'reif · $1 SOIs'],
 [/^Backfill (\d+)\/(\d+) Tage · heute alle 6 h$/,'Backfill $1/$2 days · today every 6 h',/^Backfill (\d+)\/(\d+) days · today every 6 h$/,'Backfill $1/$2 Tage · heute alle 6 h'],
 [/^Sync vor (\d+) (h|min)$/,'Sync $1 $2 ago',/^Sync (\d+) (h|min) ago$/,'Sync vor $1 $2'],
 [/^Letzter erfolgreicher Sync vor (\d+) (h|min) – Zahlen können veraltet sein$/,'Last successful sync $1 $2 ago – figures may be outdated',/^Last successful sync (\d+) (h|min) ago – figures may be outdated$/,'Letzter erfolgreicher Sync vor $1 $2 – Zahlen können veraltet sein'],
 [/^LTV-Kohorten (\d{2}:\d{2})$/,'LTV cohorts $1',/^LTV cohorts (\d{2}:\d{2})$/,'LTV-Kohorten $1'],
];
function translateStatus(text:string,locale:DashboardLocale):string|undefined{
 // Split only recognized evidence sentences, never arbitrary business labels.
 const evidence=locale==='en'
  ?/^(?:(?:\d+ von \d+ SOIs reif(?: \(Schwelle \d+\))?|Konfidenz: nicht berechnet) · Rate |\d+ Rebills · |Latenz (?:hoch|mittel|niedrig|keine Daten) · p75 )/
  :/^(?:(?:\d+ of \d+ SOIs mature(?: \(threshold \d+\))?|Confidence: not computed) · Rate |\d+ Rebills · |Latency (?:high|medium|low|no data) · p75 )/;
 if(evidence.test(text))return text.split(' · ').map(part=>translateText(part,locale)).join(' · ');
 const latency=locale==='en'?text.match(/^(Latenz p75|p75) (–|\d+(?:,\d+)? h|\d+(?:,\d+)? Tage)$/):text.match(/^(Latency p75|p75) (–|\d+(?:\.\d+)? h|\d+(?:\.\d+)? days)$/);
 if(latency)return `${latency[1]==='p75'?'p75':locale==='en'?'Latency p75':'Latenz p75'} ${locale==='en'?latency[2].replace(',','.').replace('Tage','days'):latency[2].replace('.',',').replace('days','Tage')}`;
 const rule=locale==='en'?text.match(/^Regel (\d+): (.+)$/):text.match(/^Rule (\d+): (.+)$/);
 if(rule){const translated=translateText(rule[2],locale);if(translated!==rule[2])return `${locale==='en'?'Rule':'Regel'} ${rule[1]}: ${translated}`}
 const dealField=locale==='en'
  ?text.match(/^(Testquote \(SOIs\)|Reife \(Stunden\)|CVR-Untergrenze \(%\)) (ist keine Zahl\.|muss eine ganze Zahl sein\.|muss zwischen ([\d.]+) und ([\d.]+) liegen\.)$/)
  :text.match(/^(Test quota \(SOIs\)|Maturity \(hours\)|CVR floor \(%\)) (is not a number\.|must be an integer\.|must be between ([\d.]+) and ([\d.]+)\.)$/);
 if(dealField){const[,label,message,min,max]=dealField;const translated=locale==='en'
  ?min!==undefined?`must be between ${min} and ${max}.`:message==='ist keine Zahl.'?'is not a number.':'must be an integer.'
  :min!==undefined?`muss zwischen ${min} und ${max} liegen.`:message==='is not a number.'?'ist keine Zahl.':'muss eine ganze Zahl sein.';
  return `${translateText(label,locale)} ${translated}`}
 const action=locale==='en'
  ?text.match(/^(Source|Sub1|ADV1|ADV2)( [\s\S]+)?: (Vergütung sperren|Sperre aufheben|Nach Everflow-Prüfung deaktivieren)$/)
  :text.match(/^(Source|Sub1|ADV1|ADV2)( [\s\S]+)?: (Block payout|Unblock|Deactivate after checking Everflow)$/);
 if(action){const[,scope,identity='',label]=action;return `${scope}${identity}: ${translateText(label,locale)}`}
 const scoped=locale==='en'
  ?text.match(/^(Source|Sub1|ADV1|ADV2) (überall sperren|in allen gefundenen Produkten sperren)$/)
  :text.match(/^(Source|Sub1|ADV1|ADV2) (block across offers|block in all matching offers)$/);
 if(scoped){const[,scope,label]=scoped;return `${scope} ${locale==='en'?(label==='überall sperren'?'block across offers':'block in all matching offers'):(label==='block across offers'?'überall sperren':'in allen gefundenen Produkten sperren')}`}
 const confirm=locale==='en'?text.match(/^(Vergütung sperren|Sperre aufheben) · (Source|Sub1|ADV1|ADV2)$/):text.match(/^(Block payout|Unblock) · (Source|Sub1|ADV1|ADV2)$/);
 if(confirm)return `${translateText(confirm[1],locale)} · ${confirm[2]}`;
 const maturity=locale==='en'
  ?text.match(/^(\d+) von (\d+) SOIs reif \(Wartezeit p75 ≈ (\d+(?:,\d+)?) h\); Ausschalten erst ab (\d+) reifen SOIs\.$/)
  :text.match(/^(\d+) of (\d+) SOIs mature \(p75 waiting time ≈ (\d+(?:\.\d+)?) h\); switch off only after (\d+) mature SOIs\.$/);
 if(maturity){const[,mature,total,hours,required]=maturity;return locale==='en'
  ?`${mature} of ${total} SOIs mature (p75 waiting time ≈ ${hours.replace(',','.')} h); switch off only after ${required} mature SOIs.`
  :`${mature} von ${total} SOIs reif (Wartezeit p75 ≈ ${hours.replace('.',',')} h); Ausschalten erst ab ${required} reifen SOIs.`}
 for(const[de,enText,en,deText]of statusTemplates){const pattern=locale==='en'?de:en;if(pattern.test(text))return text.replace(pattern,locale==='en'?enText:deText)}
 return undefined;
}

export function normalizeLocale(value:string|null|undefined):DashboardLocale{return value==='en'?'en':'de'}
export function localeTag(locale:DashboardLocale){return locale==='en'?'en-GB':'de-DE'}

export function translateText(value:string,locale:DashboardLocale):string{
 const match=value.match(/^(\s*)([\s\S]*?)(\s*)$/);if(!match)return value;
 const [,before,text,after]=match;if(!text)return value;
 const translated=(locale==='en'?(translations as Record<string,string>)[text]:reverseTranslations.get(text))??translateStatus(text,locale);
 return translated===undefined?value:`${before}${translated}${after}`;
}

function germanNumberToEnglish(value:string){const [whole,fraction]=value.split(',');return`${whole.replaceAll('.',',')}${fraction===undefined?'':`.${fraction}`}`}
function englishNumberToGerman(value:string){const [whole,fraction]=value.split('.');return`${whole.replaceAll(',','.')}${fraction===undefined?'':`,${fraction}`}`}
export function localizeDisplayText(value:string,locale:DashboardLocale){
 // Translate complete tokens once: a converted €3.000 must not then be
 // mistaken for a German thousands group and changed into €3,000.
 const tokens=/(?<![\d.,])(\d+(?:\.\d{3})*(?:,\d+)?)\s*€|€(\d+(?:,\d{3})*(?:\.\d+)?)|\b(\d{2}\.\d{2}\.\d{4})\b|\b(\d{2}\/\d{2}\/\d{4})\b|(?<![\d.,])(\d+(?:\.\d{3})*(?:,\d+)?)\s+%|(?<![\d.,])(\d+(?:,\d{3})*(?:\.\d+)?)%|\b(?:\d{1,3}(?:[.,]\d{3})+)\b/g;
 return value.replace(tokens,(token,deMoney:string|undefined,enMoney:string|undefined,deDate:string|undefined,enDate:string|undefined,dePercent:string|undefined,enPercent:string|undefined)=>{
  if(deMoney!==undefined)return locale==='en'?`€${germanNumberToEnglish(deMoney)}`:token;
  if(enMoney!==undefined)return locale==='de'?`${englishNumberToGerman(enMoney)} €`:token;
  if(deDate!==undefined)return locale==='en'?token.replaceAll('.','/'):token;
  if(enDate!==undefined)return locale==='de'?token.replaceAll('/','.'):token;
  if(dePercent!==undefined)return locale==='en'?`${germanNumberToEnglish(dePercent)}%`:token;
  if(enPercent!==undefined)return locale==='de'?`${englishNumberToGerman(enPercent)} %`:token;
  return locale==='en'?token.replaceAll('.',','):token.replaceAll(',','.');
 });
}

export function persistLocale(locale:DashboardLocale,root:{lang:string;dataset:DOMStringMap},storage:{setItem:(key:string,value:string)=>unknown}){
 root.lang=locale;root.dataset.locale=locale;storage.setItem(LOCALE_STORAGE_KEY,locale);
 if(typeof document!=='undefined')document.cookie=`${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function localeBootScript(){
 return `(function(){var l='de';try{var s=localStorage.getItem('${LOCALE_STORAGE_KEY}');if(s==='en'||s==='de')l=s;else{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=(de|en)/);if(m)l=m[1]}}catch(e){}document.documentElement.lang=l;document.documentElement.dataset.locale=l})()`;
}
