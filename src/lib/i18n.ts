import {translations} from './i18n-translations';

export type DashboardLocale='de'|'en';
export {translations};
export const LOCALE_STORAGE_KEY='wlx-locale';
export const LOCALE_COOKIE='wlx-locale';

const reverseTranslations=new Map<string,string>(Object.entries(translations).map(([de,en])=>[en,de]));

// Only complete, known UI messages match. Source IDs and business names are
// never translated by replacing individual words inside arbitrary strings.
const statusTemplates:readonly [RegExp,string,RegExp,string][]=[
 [/^Tagesverlauf Offer #(\d+) · Ohne Landingpage-Zuordnung$/,'Daily trend Offer #$1 · No landing-page assignment',/^Daily trend Offer #(\d+) · No landing-page assignment$/,'Tagesverlauf Offer #$1 · Ohne Landingpage-Zuordnung'],
 [/^Tagesverlauf (.+)$/,'Daily trend $1',/^Daily trend (.+)$/,'Tagesverlauf $1'],
 [/^1 Direktpfad$/,'1 direct path',/^1 direct path$/,'1 Direktpfad'],
 [/^(\d+) Direktpfade$/,'$1 direct paths',/^(\d+) direct paths$/,'$1 Direktpfade'],
 [/^Offer #(\d+) · Ohne Landingpage-Zuordnung$/,'Offer #$1 · No landing-page assignment',/^Offer #(\d+) · No landing-page assignment$/,'Offer #$1 · Ohne Landingpage-Zuordnung'],
 [/^Campaign-Empfehlung · ([\d./–]+)$/,'Campaign recommendation · $1',/^Campaign recommendation · ([\d./–]+)$/,'Campaign-Empfehlung · $1'],
 [/^Lead-Herkunft für LP #(\d+)$/,'Lead origin for LP #$1',/^Lead origin for LP #(\d+)$/,'Lead-Herkunft für LP #$1'],
 [/^(Source|Sub1|ADV1|ADV2) ([\s\S]+) kopieren$/,'Copy $1 $2',/^Copy (Source|Sub1|ADV1|ADV2) ([\s\S]+)$/,'$1 $2 kopieren'],
 [/^(-?[\d.,]+\s*€) Umsatz · (-?[\d.,]+\s*€) Payout · (-?[\d.,]+\s*€) Profit\.$/,'$1 revenue · $2 payout · $3 profit.',/^(-?€[\d.,]+) revenue · (-?€[\d.,]+) payout · (-?€[\d.,]+) profit\.$/,'$1 Umsatz · $2 Payout · $3 Profit.'],
 [/^Keine Quelle passt zu „([\s\S]+)“\.$/,'No source matches “$1”.',/^No source matches “([\s\S]+)”\.$/,'Keine Quelle passt zu „$1“.'],
 [/^Sales und Nachzahlungen für LP #(\d+)$/,'Sales and additional payments for LP #$1',/^Sales and additional payments for LP #(\d+)$/,'Sales und Nachzahlungen für LP #$1'],
 [/^1 Quellenkombination$/,'1 source combination',/^1 source combination$/,'1 Quellenkombination'],
 [/^(\d+) Quellenkombinationen$/,'$1 source combinations',/^(\d+) source combinations$/,'$1 Quellenkombinationen'],
 [/^als belastbare Source-Snapshots verfügbar · angefordert: ([\d./–]+)\.$/,'available as verified source snapshots · requested: $1.',/^available as verified source snapshots · requested: ([\d./–]+)\.$/,'als belastbare Source-Snapshots verfügbar · angefordert: $1.'],
 [/^Auswertung für LP #(\d+)$/,'Analysis for LP #$1',/^Analysis for LP #(\d+)$/,'Auswertung für LP #$1'],
 [/^Campaign #(\d+) verdient (-?[\d.,]+\s*€)$/,'Campaign #$1 earns $2',/^Campaign #(\d+) earns (-?€[\d.,]+)$/,'Campaign #$1 verdient $2'],
 [/^Campaign #(\d+) verliert (-?[\d.,]+\s*€)$/,'Campaign #$1 loses $2',/^Campaign #(\d+) loses (-?€[\d.,]+)$/,'Campaign #$1 verliert $2'],
 [/^Die aktuellen Landingpages liegen bei (-?[\d.,]+\s*€)\.$/,'The current landing pages have a balance of $1.',/^The current landing pages have a balance of (-?€[\d.,]+)\.$/,'Die aktuellen Landingpages liegen bei $1.'],
 [/^([\d.,]+) SOIs aus ([\d.,]+) Klicks$/,'$1 SOIs from $2 clicks',/^([\d.,]+) SOIs from ([\d.,]+) clicks$/,'$1 SOIs aus $2 Klicks'],
 [/^([\d.,]+) First-Sales aus ([\d.,]+) SOIs$/,'$1 first sales from $2 SOIs',/^([\d.,]+) first sales from ([\d.,]+) SOIs$/,'$1 First-Sales aus $2 SOIs'],
 [/^([\d.,]+) vergütete SOIs$/,'$1 paid SOIs',/^([\d.,]+) paid SOIs$/,'$1 vergütete SOIs'],
 [/^(-?[\d.,]+\s*€) Umsatz – (-?[\d.,]+\s*€) Payout$/,'$1 revenue – $2 payout',/^(-?€[\d.,]+) revenue – (-?€[\d.,]+) payout$/,'$1 Umsatz – $2 Payout'],
 [/^(-?[\d.,]+\s*€) Profit bei ([\d.,]+) SOIs · keine belastbare Stop-Empfehlung\.$/,'$1 profit from $2 SOIs · insufficient evidence to recommend stopping.',/^(-?€[\d.,]+) profit from ([\d.,]+) SOIs · insufficient evidence to recommend stopping\.$/,'$1 Profit bei $2 SOIs · keine belastbare Stop-Empfehlung.'],
 [/^(\d+) von (\d+) Tagen$/,'$1 of $2 days',/^(\d+) of (\d+) days$/,'$1 von $2 Tagen'],
 [/^Kein Lead in (\d+) Tagen$/,'No lead in $1 days',/^No lead in (\d+) days$/,'Kein Lead in $1 Tagen'],
 [/^Seit (\d+) Tagen keine neuen Leads$/,'No new leads for $1 days',/^No new leads for (\d+) days$/,'Seit $1 Tagen keine neuen Leads'],
 [/^Frühere (\d+) LPs$/,'Previous $1 LPs',/^Previous (\d+) LPs$/,'Frühere $1 LPs'],
 [/^Aktuelle (\d+) LPs$/,'Current $1 LPs',/^Current (\d+) LPs$/,'Aktuelle $1 LPs'],
 [/^([\d./–]+) · vollständige Kontrollrechnung$/,'$1 · complete reconciliation',/^([\d./–]+) · complete reconciliation$/,'$1 · vollständige Kontrollrechnung'],
 [/^(\d{4}-\d{2}-\d{2}) · tägliche Daten nicht minutengenau teilbar$/,'$1 · daily data cannot be split by minute',/^(\d{4}-\d{2}-\d{2}) · daily data cannot be split by minute$/,'$1 · tägliche Daten nicht minutengenau teilbar'],
 [/^(Campaign #\d+ · )?Campaign zuletzt gespeichert am ([\d.,/: ]+) · als Rotationsreferenz verwendet$/,'$1Campaign last saved at $2 · used as the rotation reference',/^(Campaign #\d+ · )?Campaign last saved at ([\d.,/: ]+) · used as the rotation reference$/,'$1Campaign zuletzt gespeichert am $2 · als Rotationsreferenz verwendet'],
 [/^(\d+) von (\d+) aktive Zeilen ·$/,'$1 of $2 active lines ·',/^(\d+) of (\d+) active lines ·$/,'$1 von $2 aktive Zeilen ·'],
 [/^(\d+) aktive Zeilen ·$/,'$1 active lines ·',/^(\d+) active lines ·$/,'$1 aktive Zeilen ·'],
 [/^(\d{2}[./]\d{2}[./]\d{4}–\d{2}[./]\d{2}[./]\d{4}) \(365 Tage\)$/,'$1 (365 days)',/^(\d{2}[./]\d{2}[./]\d{4}–\d{2}[./]\d{2}[./]\d{4}) \(365 days\)$/,'$1 (365 Tage)'],
 [/^Rollup ist (\d+) Stunden alt – der Rollups-Cron \(stündlich um :47\) hat seitdem nicht geschrieben\.$/,'The rollup is $1 hours old – the hourly rollup job at :47 has not updated it since.',/^The rollup is (\d+) hours old – the hourly rollup job at :47 has not updated it since\.$/,'Rollup ist $1 Stunden alt – der Rollups-Cron (stündlich um :47) hat seitdem nicht geschrieben.'],
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
 [/^(\d+) von (\d+) Kohorten-Monaten für 365 Tage noch nicht reif$/,'$1 of $2 cohort months have not matured for 365 days',/^(\d+) of (\d+) cohort months have not matured for 365 days$/,'$1 von $2 Kohorten-Monaten für 365 Tage noch nicht reif'],
 [/^keine SOIs in ([\d./– -]+)$/,'no SOIs in $1',/^no SOIs in ([\d./– -]+)$/,'keine SOIs in $1'],
 [/^(-?[\d.,]+\s*€) Umsatz ÷ ([\d.,]+) SOIs · ([\d./– -]+)$/,'$1 revenue ÷ $2 SOIs · $3',/^(-?€[\d.,]+) revenue ÷ ([\d.,]+) SOIs · ([\d./– -]+)$/,'$1 Umsatz ÷ $2 SOIs · $3'],
 [/^Break-even nach (\d+) Tagen · CPL (-?[\d.,]+\s*€) · LTV (\d+) Tage (-?[\d.,]+\s*€)$/,'Break-even after $1 days · CPL $2 · LTV $3 days $4',/^Break-even after (\d+) days · CPL (-?€[\d.,]+) · LTV (\d+) days (-?€[\d.,]+)$/,'Break-even nach $1 Tagen · CPL $2 · LTV $3 Tage $4'],
 [/^Break-even nicht erreicht · CPL (-?[\d.,]+\s*€) · LTV (\d+) Tage (-?[\d.,]+\s*€)$/,'Break-even not reached · CPL $1 · LTV $2 days $3',/^Break-even not reached · CPL (-?€[\d.,]+) · LTV (\d+) days (-?€[\d.,]+)$/,'Break-even nicht erreicht · CPL $1 · LTV $2 Tage $3'],
 [/^Break-even noch offen · CPL (-?[\d.,]+\s*€) · LTV (\d+) Tage (-?[\d.,]+\s*€) · Fenster ab (\d+) Tagen noch nicht reif$/,'Break-even pending · CPL $1 · LTV $2 days $3 · windows from $4 days are not mature yet',/^Break-even pending · CPL (-?€[\d.,]+) · LTV (\d+) days (-?€[\d.,]+) · windows from (\d+) days are not mature yet$/,'Break-even noch offen · CPL $1 · LTV $2 Tage $3 · Fenster ab $4 Tagen noch nicht reif'],
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
const cohortMonthNames={de:['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec']} as const;
function translateCohortMonths(text:string,locale:DashboardLocale):string|undefined{
 const from=cohortMonthNames[locale==='en'?'de':'en'],to=cohortMonthNames[locale];
 const token=`(?:${from.map(name=>name.replaceAll('.','\\.')).join('|')}) \\d{4}`;
 const convert=(value:string)=>{const split=value.lastIndexOf(' ');return`${to[from.findIndex(name=>name===value.slice(0,split))]}${value.slice(split)}`};
 const range=text.match(new RegExp(`^(${token}) ${locale==='en'?'bis':'to'} (${token})((?: · (?:Source|Sub-Source) [\\s\\S]+)?)$`));
 if(range)return`${convert(range[1])} ${locale==='en'?'to':'bis'} ${convert(range[2])}${range[3]}`;
 if(new RegExp(`^${token}(?:, ${token})*$`).test(text))return text.split(', ').map(convert).join(', ');
 return undefined;
}
function translateStatus(text:string,locale:DashboardLocale):string|undefined{
 const sourceSort=locale==='en'
  ?text.match(/^Nach (Klicks|SOIs|CVR|First-Sales|Rebills|Coin-Spend|Umsatz|Payout|Profit) sortieren: (höchste zuerst|derzeit (niedrigste zuerst|höchste zuerst); klicken für (niedrigste zuerst|höchste zuerst))$/)
  :text.match(/^Sort by (Clicks|SOIs|CVR|First sales|Rebills|Coin spend|Revenue|Payout|Profit): (highest first|currently (lowest first|highest first); click for (lowest first|highest first))$/);
 if(sourceSort){const metric=translateText(sourceSort[1],locale),direction=(value:string)=>locale==='en'?(value==='niedrigste zuerst'?'lowest first':'highest first'):(value==='lowest first'?'niedrigste zuerst':'höchste zuerst');return locale==='en'?`Sort by ${metric}: ${sourceSort[3]?`currently ${direction(sourceSort[3])}; click for ${direction(sourceSort[4])}`:'highest first'}`:`Nach ${metric} sortieren: ${sourceSort[3]?`derzeit ${direction(sourceSort[3])}; klicken für ${direction(sourceSort[4])}`:'höchste zuerst'}`}
 const window=locale==='en'
  ?text.match(/^(?:(CVR|Umsatz|Payout|Profit|SOI-Vergütung) · )?(Heute · [\d./]+ · bis Datenstand|Kurztrend · [\d./–]+ · Teilmenge des Kampagnenzeitraums · heute bis Datenstand|Reifefenster · [\d./–]+ · (?:vollständige Kalendertage nach Campaign-Speichertag|letzte 14 Kalendertage)|Letzte 14 Kalendertage · [\d./–-]+(?: · heute bis Datenstand)?)( · nicht zum Campaign-Profit addieren)?$/)
  :text.match(/^(?:(CVR|Revenue|Payout|Profit|SOI payout) · )?(Today · [\d./]+ · through the latest data|Short-term trend · [\d./–]+ · subset of the campaign period · today through the latest data|Maturity window · [\d./–]+ · (?:full calendar days after the campaign save date|last 14 calendar days)|Last 14 calendar days · [\d./–-]+(?: · today through the latest data)?)( · do not add to campaign profit)?$/);
 if(window){let value=locale==='en'?window[2].replace(/(\d{2})\.(\d{2})\.(?=–)/g,'$1/$2'):window[2].replace(/(\d{2})\/(\d{2})(?=–)/g,'$1.$2.');const pairs=[['Heute','Today'],['bis Datenstand','through the latest data'],['Kurztrend','Short-term trend'],['Teilmenge des Kampagnenzeitraums','subset of the campaign period'],['heute','today'],['Reifefenster','Maturity window'],['vollständige Kalendertage nach Campaign-Speichertag','full calendar days after the campaign save date'],['letzte 14 Kalendertage','last 14 calendar days'],['Letzte 14 Kalendertage','Last 14 calendar days']];for(const[de,en]of pairs)value=value.replace(locale==='en'?de:en,locale==='en'?en:de);return`${window[1]?`${translateText(window[1],locale)} · `:''}${value}${window[3]?(locale==='en'?' · do not add to campaign profit':' · nicht zum Campaign-Profit addieren'):''}`}
 const datedLabel=locale==='en'?text.match(/^(Umsatz|SOI-Vergütung) · ([\d./–]+)$/):text.match(/^(Revenue|SOI payout) · ([\d./–]+)$/);
 if(datedLabel)return`${translateText(datedLabel[1],locale)} · ${datedLabel[2]}`;
 const months=translateCohortMonths(text,locale);if(months!==undefined)return months;
 const ltvLabel=locale==='en'?text.match(/^LTV je Registrierung über (noch kein reifes Fenster|(?:30|60|90|180|365) Tage(?:, (?:30|60|90|180|365) Tage)*)$/):text.match(/^LTV per registration over (no mature window yet|(?:30|60|90|180|365) days(?:, (?:30|60|90|180|365) days)*)$/);
 if(ltvLabel)return locale==='en'?`LTV per registration over ${ltvLabel[1]==='noch kein reifes Fenster'?'no mature window yet':ltvLabel[1].replaceAll('Tage','days')}`:`LTV je Registrierung über ${ltvLabel[1]==='no mature window yet'?'noch kein reifes Fenster':ltvLabel[1].replaceAll('days','Tage')}`;
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
