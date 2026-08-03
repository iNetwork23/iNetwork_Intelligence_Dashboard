# Spezifikation: KI-/Telegram-Partnernachrichten-Assistent

**Status:** freigegebene Produktspezifikation, noch keine Versandimplementierung
**Releasebezug:** Nacharbeit zum WLX-Release `84594ae314401b721a3bc8ba86f53adc89ad8058`

## 1. Ziel

Das Dashboard darf aus einer exakt ausgewählten, serverseitig erneut geladenen Traffic-Zeile einen sachlichen Partnernachrichten-Entwurf erzeugen. Es darf niemals eigenständig Nachrichten versenden oder externe Aktionen auslösen. Der Mensch sieht Empfänger, Datengrundlage und finalen Text und gibt jeden Versand ausdrücklich frei.

Unterstützte Absichten:

- Rückfrage zur Trafficqualität;
- Stoppen beziehungsweise Payout-0 ankündigen;
- Skalierung anfragen;
- Wiederaufnahme abstimmen;
- Statusupdate senden.

## 2. Verbindliche Sicherheitsgrenzen

1. Browserwerte und Labels sind nur Auswahlhinweise, nie Autorität.
2. Der Server lädt unmittelbar vor Analyse und Versand den kanonischen Scope erneut.
3. Affiliate, Offer, Campaign, Landingpage, Trafficmodus, Main Source und Subsource bleiben als unteilbare Tuple erhalten.
4. Für clickless/API-Traffic werden `adv1`/`adv2` verwendet; Klick-CVR und Profit-EPC werden dort nicht behauptet.
5. Partnerrollen dürfen keine fremden Partner adressieren.
6. Analyse erfordert Leserechte; externer Versand erhält eine separate Permission `partner_messages.send`.
7. Chat-ID, Topic-ID, Bot-Token, Providerorigin und Credentials kommen ausschließlich aus serverseitiger Konfiguration.
8. KI-Ausgabe kann weder Empfänger noch Berechtigung noch Versandstatus bestimmen.
9. Kein automatischer Retry nach Timeout oder Verbindungsabbruch, weil die Zustellung unklar sein kann.
10. Ein Erfolg wird nur mit realer Provider-Message-ID gespeichert.

## 3. Kanonischer Kontext

```ts
type PartnerMessageContext = {
  affiliateId: string;
  affiliateName: string;
  trafficMode: 'tracked' | 'api';
  offerId: string;
  offerName: string;
  campaignId: string | null;
  campaignName: string | null;
  offerUrlId: string | null;
  offerUrlName: string | null;
  mainValue: string;
  subValue: string | null;
  period: { from: string; to: string; timezone: 'Europe/Berlin' };
};
```

Die Destination wird serverseitig ausschließlich aus `affiliateId` aufgelöst. Technische Main-/Subsource-Werte dürfen nicht durch Anzeigenamen ersetzt werden.

## 4. Analysevertrag

Der Server aggregiert zuerst und berechnet Quoten danach. Die Antwort trennt:

- belegte Fakten;
- Hypothesen;
- Business-Auswirkung;
- Confidence;
- Warnungen;
- empfohlene Handlung;
- editierbaren Nachrichtenentwurf.

Mindestens sichtbar:

- SOIs, First-Sales, Rebills und gewonnene Kunden;
- First-Sales/SOI und Rebills/Kunde;
- Top-1-/Top-2-Kundenanteile;
- Umsatz, tatsächlicher Payout, Profit und Profit/SOI bei Finance-Recht;
- bei tracked Traffic zusätzlich Klicks und CVR;
- bei API-Traffic ausdrücklich `Klick-CVR: n/a`;
- Datenzeitraum und Frische-/Coverage-Status.

Unvollständige, stale oder technisch fehlgeschlagene Daten werden fail-closed angezeigt und dürfen keinen sendbaren Entwurf erzeugen.

## 5. Textregeln

Partnertexte müssen:

- Firma/Partner und Zeitraum nennen;
- absolute Zahlen vor Quoten nennen;
- Main Source und vorhandene Subsource exakt enthalten;
- Beobachtung, mögliche Erklärung und Klärungsfrage trennen;
- keine unbelegten Betrugs- oder Manipulationsvorwürfe enthalten;
- keine internen Credentials, Roh-IDs des Providers oder personenbezogenen Kundendaten enthalten;
- bei kleiner Stichprobe und Kundenkonzentration ausdrücklich Unsicherheit nennen.

Deterministischer Fallback bei fehlender/ungültiger KI:

> Hallo {Partner}, wir prüfen aktuell den Traffic für Source {Main} / Subsource {Sub} im Zeitraum {Von} bis {Bis}. Erfasst wurden {SOIs} SOIs, {FirstSales} First-Sales und {Rebills} Rebills. {Konzentrationshinweis} Bitte klärt mit uns, welche Platzierungen und Targetings dahinterliegen und ob es im Zeitraum Änderungen gab. Bis zur Klärung wurde noch keine zusätzliche Maßnahme ausgelöst.

Die UI kennzeichnet sichtbar, ob der Entwurf deterministisch oder KI-unterstützt erstellt wurde.

## 6. Zustandsmodell

```text
draft -> approved -> sending -> sent
                         |-> failed_confirmed
                         |-> delivery_uncertain
```

Ein Draft ist:

- an Actor und exakte Tuple gebunden;
- zeitlich begrenzt;
- nach Claim einmalig;
- nach Änderung des Textes erneut bestätigungspflichtig.

`delivery_uncertain` darf nicht automatisch wiederholt werden. Ein neuer Versuch braucht Providerprüfung und einen neu freigegebenen Draft.

## 7. Server- und API-Schnittstellen

Vorgesehene Endpunkte:

- `POST /api/partner-messages/preview`
  - Auth, CSRF, Body-Limit, Rate-Limit;
  - exakte Tuple serverseitig neu laden;
  - Fakten und Entwurf erzeugen;
  - Destination nur als sichere Bezeichnung plus `configured` zurückgeben.
- `POST /api/partner-messages/send`
  - Actor, Draft, Ablaufzeit und Textversion prüfen;
  - aktuelle Rechte und Scope uncached neu laden;
  - atomaren One-time Claim durchführen;
  - feste Telegram-Provider-URL mit Timeout aufrufen;
  - nur bestätigten Providerstatus speichern.

Antworten sind `private, no-store`. Browserkörper dürfen keine Chat-/Topic-ID oder Credentials enthalten.

## 8. Telegram-Konfiguration

Serverseitig erforderlich:

- Bot-Token;
- validierte Partner→Chat/Topic-Zuordnung;
- optionale, nicht sensitive Destination-Bezeichnung;
- feste Provider-URL;
- Timeout und maximal zulässige Nachrichtenlänge.

Platzhalter gelten als nicht konfiguriert. Bei fehlender Destination bleibt Kopieren möglich, Senden ist deaktiviert.

## 9. UX Desktop und Mobil

1. Nutzer wählt eine konkrete Source-Zeile und klickt `Partner informieren`.
2. Dialog zeigt Tuple, Zeitraum, Fakten, Warnungen und Destination.
3. Nutzer wählt Absicht und kann Text bearbeiten.
4. Vor Versand erscheint eine zweite Zusammenfassung mit Empfänger und finalem Text.
5. `Jetzt senden` ist erst danach aktiv.
6. Erfolg zeigt reale Message-ID; definitive Ablehnung und unklare Zustellung sind getrennte Zustände.

Touch-Ziele mindestens 44 px, Keyboardfokus sichtbar, Dialog vollständig beschriftet.

## 10. Audit

Geschützt zu speichern:

- realer Actor und effektiver Nutzer;
- kanonische Tuple und Zeitraum;
- Absicht, freigegebener Text und Textversion;
- sichere Destinationreferenz;
- Draft-/Claim-ID;
- Provider-Message-ID bei Erfolg;
- definitive Ablehnung oder `delivery_uncertain`;
- Zeitstempel.

Breit zugängliche Logs enthalten keinen vollständigen Nachrichtentext und keine Destination-/Credentialwerte.

## 11. TDD- und Releasegates

1. Tuple-Auswahl und Scope-Aggregation.
2. Deterministischer Template-Fallback.
3. strikte KI-JSON-Validierung.
4. Destination-/Platzhaltervalidierung.
5. Provider-Erfolg, Ablehnung und Timeout.
6. Draft-Ownership, Ablaufzeit und atomarer Claim.
7. Auth, CSRF, Body-Limit, Rate-Limit und Scope-Reload.
8. UI-Preview, Bearbeitung, Bestätigung und Statuszustände.
9. Desktop und 390×844 Mobil.
10. vollständige Tests, Lint, TypeScript, Audit und Build.
11. unabhängiger Security-/Release-Review.

## 12. Nicht-Ziele dieser Spezifikation

- kein autonomer Versand;
- keine automatische Source-Sperre;
- keine freie KI-Auswahl des Empfängers;
- keine Nachrichten auf Basis reiner Browserdaten;
- keine Behauptung, dass Telegram bereits konfiguriert oder der Assistent implementiert sei.
