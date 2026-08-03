# Kontrollierte Source-Sperren-E2E-Abnahme

## Zweck

`scripts/source-block-controlled-e2e.mjs` belegt für **ein ausdrücklich freigegebenes Test-Tuple** den vollständigen Providerpfad:

1. Sperrbestand lesen;
2. read-only Preview und serverseitigen Offer-/Source-Scope prüfen;
3. genau einen Offer-Scope aktivieren;
4. aktiven Block und Everflow-Setting per Read-back belegen;
5. denselben Block sofort deaktivieren;
6. aktiven Sperrbestand mit dem Ausgangszustand vergleichen.

Der Runner ist standardmäßig read-only. Ohne alle Destruktivgates erfolgt kein POST.

## Voraussetzungen

- ausdrücklich freigegebener Test-Affiliate, Offer, Campaign und technische Source/Subsource;
- Testtraffic, bei dem eine kurzzeitige Payout-0/Postback-aus-Regel zulässig ist;
- aktueller Snapshot enthält exakt dieses Tuple;
- Admin-/Employee-Sitzung mit `landingpages.manage` und `api.manage`;
- dokumentiertes Wartungsfenster und Operator;
- Everflow-Zugriff produktiv funktionsfähig;
- Incidentbereitschaft für den Fall `state uncertain`.

Nicht verwenden für laufenden wertvollen Traffic, unbekannte Partner-Tuples, bereits aktive Sperren oder Produkt-Weit-Scope.

## Temporäre Dateien

Scope-Datei, Beispiel `/tmp/source-block-e2e-scope.json`:

```json
{
  "affiliateId": "<test-affiliate-id>",
  "affiliateName": "<test-affiliate-name>",
  "offerId": "<test-offer-id>",
  "offerName": "<test-offer-name>",
  "campaignId": "<test-campaign-id>",
  "trafficMode": "tracked",
  "level": "sub_source",
  "mainValue": "<exact-source>",
  "subValue": "<exact-sub1>",
  "expectedConfirmation": "<exact-sub1>",
  "allowDestructive": true,
  "reason": "Freigegebene kontrollierte E2E-Abnahme <change-id>"
}
```

Für API-Traffic stehen `mainValue`/`subValue` für ADV1/ADV2. Die API bestimmt die tatsächlichen Everflow-Variablennamen serverseitig; sie werden niemals aus der Scope-Datei übernommen.

Session-Cookie-Datei, Beispiel `/tmp/source-block-e2e-cookie.txt`:

```text
<vollständiger Cookie-Header einer temporären autorisierten Prüfsitzung>
```

Beide Dateien müssen `chmod 600` haben und nach der Abnahme gelöscht werden. Keine Credentialwerte in Logs, Git oder Asana speichern.

## Stufe 1: verpflichtende read-only Preview

```bash
chmod 600 /tmp/source-block-e2e-scope.json /tmp/source-block-e2e-cookie.txt
SOURCE_BLOCK_TEST_SCOPE_FILE=/tmp/source-block-e2e-scope.json \
SOURCE_BLOCK_SESSION_COOKIE_FILE=/tmp/source-block-e2e-cookie.txt \
SOURCE_BLOCK_E2E_REPORT=/tmp/source-block-e2e-preview.json \
npm run source-block:e2e
```

Erwartet:

- `mode = preview_only`;
- freigegebenes Offer in `preview.offers`;
- `requiredConfirmation` stimmt exakt;
- kein POST;
- aktiver Sperrbestand unverändert.

## Stufe 2: scopegebundene Freigabe erzeugen

Die Bestätigungsphrase wird deterministisch aus dem Tuple gebildet:

```text
ACTIVATE-AND-ROLLBACK:<affiliateId>:<offerId>:<campaignId>:<trafficMode>:<level>:<mainValue>:<subValue-oder-∅>
```

Sie ist keine generische Zustimmung und darf nur für das geprüfte Wartungsfenster verwendet werden.

## Stufe 3: Aktivierung und sofortiger Rollback

Erst nach ausdrücklicher fachlicher Freigabe des konkreten Tuples:

```bash
SOURCE_BLOCK_TEST_SCOPE_FILE=/tmp/source-block-e2e-scope.json \
SOURCE_BLOCK_SESSION_COOKIE_FILE=/tmp/source-block-e2e-cookie.txt \
SOURCE_BLOCK_EXECUTE=1 \
CONFIRM_SOURCE_BLOCK_E2E='ACTIVATE-AND-ROLLBACK:<exaktes-tuple>' \
SOURCE_BLOCK_E2E_REPORT=/tmp/source-block-e2e-result.json \
npm run source-block:e2e
```

PASS verlangt gleichzeitig:

- Preview erfolgreich;
- vorab kein aktiver identischer Block;
- Aktivierungsantwort und Read-back referenzieren dieselbe Block-ID;
- aktiver Providerzustand belegt;
- Deaktivierung liefert `inactive`;
- nachher kein exakter aktiver Block;
- Gesamtzahl aktiver Sperren nachher identisch zu vorher.

Eine inaktive Audit-/Historienzeile darf bestehen bleiben und ist beabsichtigt.

## Unklarer Zustand und Incident

Wenn Aktivierungsantwort, Read-back oder Rollback unklar sind:

1. keinen zweiten Aktivierungsversuch starten;
2. Runner-Ausgabe und geschützten Report sichern;
3. Dashboard-Blockbestand und Everflow-Setting manuell read-only abgleichen;
4. nur die eindeutig identifizierte neue Setting-ID deaktivieren;
5. Ursache, Zeitfenster, Operator und Endzustand dokumentieren;
6. erst nach unabhängig bestätigtem Ausgangszustand erneut testen.

Der Runner versucht bei verlorener Aktivierungsantwort einen eindeutig passenden neuen Block per Read-back zu finden und zurückzurollen. Bei mehreren Treffern bricht er fail-closed ab.

## Abschluss und Cleanup

- temporären Prüfnutzer und Access Keys löschen;
- Scope-, Cookie- und lokale Credentialdateien löschen;
- nicht-sensitive Ergebniszusammenfassung in `release-artifacts` übernehmen;
- Asana-Ticket erst nach realem PASS schließen;
- nie behaupten, dass eine Sperre validiert wurde, wenn nur Preview lief.
