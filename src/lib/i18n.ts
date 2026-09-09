import {translations} from './i18n-translations';

export type DashboardLocale='de'|'en';
export {translations};
export const LOCALE_STORAGE_KEY='wlx-locale';
export const LOCALE_COOKIE='wlx-locale';

const reverseTranslations=new Map<string,string>(Object.entries(translations).map(([de,en])=>[en,de]));

// Only complete, known UI messages match. Source IDs and business names are
// never translated by replacing individual words inside arbitrary strings.
const statusTemplates:readonly [RegExp,string,RegExp,string][]=[
 [/^Dry Run: Entscheidung Halten \(([a-z_]+)\) · (\d+) Writes$/,'Dry run: Decision hold ($1) · $2 writes',/^Dry run: Decision hold \(([a-z_]+)\) · (\d+) writes$/,'Dry Run: Entscheidung Halten ($1) · $2 Writes'],
 [/^Halten \(([a-z_]+)\)$/,'Hold ($1)',/^Hold \(([a-z_]+)\)$/,'Halten ($1)'],
 [/^(\d+(?:[.,]\d+)?) Tage$/,'$1 days',/^(\d+(?:[.,]\d+)?) days$/,'$1 Tage'],
 [/^(\d+) aktiv$/,'$1 active',/^(\d+) active$/,'$1 aktiv'],
 [/^(\d+) Min\.$/,'$1 min',/^(\d+) min$/,'$1 Min.'],
 [/^Rollup vom ([\d.,/: ]+) · Zugewiesener Bereich$/,'Rollup from $1 · Assigned scope',/^Rollup from ([\d.,/: ]+) · Assigned scope$/,'Rollup vom $1 · Zugewiesener Bereich'],
 [/^Rollup vom ([\d.,/: ]+) · (\d+) von (\d+) Partnern$/,'Rollup from $1 · $2 of $3 partners',/^Rollup from ([\d.,/: ]+) · (\d+) of (\d+) partners$/,'Rollup vom $1 · $2 von $3 Partnern'],
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
