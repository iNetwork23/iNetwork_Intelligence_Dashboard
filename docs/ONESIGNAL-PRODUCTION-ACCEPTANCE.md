# OneSignal – produktive Konfiguration und getrennte Push-Abnahme

## Aktueller Status

**Extern blockiert; SDK-Integration lokal vorbereitet, produktiv bewusst deaktiviert.**

Bekannt und nicht geheim sind:

- App-ID `dccad9c4-8e4c-43bf-9785-a625db3ee9da`;
- Safari Web-ID `web.onesignal.auto.253751a8-ac24-4181-97da-883dbdadac49`;
- Web SDK v16.

Ein in Slack veröffentlichter REST-Key gilt als kompromittiert und darf nicht verwendet werden. Er muss providerseitig widerrufen und durch einen neuen, ausschließlich direkt im Production Secret Store gesetzten Key ersetzt werden.

Der lokale Client nutzt einen separaten Worker unter `/onesignal/OneSignalSDKWorker.js` mit Scope `/onesignal/`, damit der bestehende interne PWA-Worker `/sw.js` nicht ersetzt wird. Die serverseitig aufgelöste interne User-ID wird nur für nicht impersonierte Sitzungen per `OneSignal.login(...)` gebunden.

Der bestehende Serveradapter bleibt trotz vorhandener Werte fail-closed, solange `ONESIGNAL_ENABLED` nicht ausdrücklich auf `true` gesetzt wurde. Ein funktionierender interner Web-Push-Test ist kein OneSignal-Nachweis.

## Drei voneinander unabhängige OneSignal-Gates

1. **Serverkonfiguration**
   - gültige OneSignal-App-ID;
   - gültiger serverseitiger REST-API-Key;
   - kanonischer HTTPS-`APP_ORIGIN`.
2. **Gerätebindung**
   - das reale OneSignal-Gerät/Abonnement ist mit exakt der serverseitig aufgelösten internen User-ID als `external_id` verbunden;
   - keine User-ID stammt aus einem Client-Request;
   - Impersonation wird nicht gebunden oder getestet.
3. **Echte Zustellung**
   - OneSignal nimmt den Auftrag an;
   - das exakt gebundene Gerät empfängt die Nachricht;
   - Klick öffnet ausschließlich `/settings/app` auf der kanonischen Produktionsorigin.

Eine Notification-ID beziehungsweise HTTP 200 des Providers beweist nur Gate 1 und die Annahme des Auftrags, nicht Gate 2 oder 3.

## Benötigte externe Werte und Entscheidungen

Der Providerverantwortliche muss bereitstellen beziehungsweise bestätigen:

- OneSignal-App-ID für die Produktions-Web-App;
- REST-API-Key derselben App;
- freigegebene Web-Origin `https://wlx-railway-dashboard.vercel.app` oder den endgültigen kanonischen Produktionshost;
- den tatsächlich verwendeten OneSignal-Web-SDK-/Gerätebindungsweg für `external_id`;
- ein reales freigegebenes Testgerät und einen Testbenutzer;
- ob bestehende OneSignal-Geräte vorhanden sind oder erst neu registriert werden müssen.

Credentialwerte dürfen nicht in Slack, Git, Asana-Beschreibungen, Screenshots oder Abnahmeprotokolle kopiert werden.

## Vercel-Konfiguration

Die Werte ausschließlich über die geschützte Production-Environment-Konfiguration setzen:

- `ONESIGNAL_APP_ID` – öffentliche App-ID derselben OneSignal-App;
- `ONESIGNAL_SAFARI_WEB_ID` – öffentliche Safari Web-ID;
- `ONESIGNAL_REST_API_KEY` – **neu rotierter** geheimer REST-Key;
- `ONESIGNAL_ENABLED=true` – erst nach bestätigter Rotation und unmittelbar zur kontrollierten Abnahme setzen.

Der veröffentlichte alte Key darf unter keinen Umständen übernommen oder getestet werden. Danach ist ein neues Produktionsdeployment erforderlich. Ein bestehendes Deployment übernimmt geänderte Variablen nicht rückwirkend.

## Abnahme A – interner Web Push

Diese Spur verwendet VAPID und `/api/push` mit den Aktionen `subscribe`, `status`, `test` und `unsubscribe`.

1. Als normaler, nicht impersonierter Testbenutzer anmelden.
2. `/settings/app` öffnen.
3. Auf Desktop oder installierter PWA Push explizit per Benutzeraktion aktivieren.
4. Exakten aktuellen Browserendpoint serverseitig als aktiv zurücklesen.
5. „Test an dieses Gerät“ anklicken.
6. Sichtbare Benachrichtigung empfangen und anklicken.
7. Ziel muss `/settings/app` derselben Origin sein.
8. Gerät abmelden und serverseitigen Read-back `enabled = false` prüfen.
9. Zweites Gerät beziehungsweise zweites Browserprofil getrennt prüfen.

Erforderlicher Nachweis: echte Browserklicks, sichtbare Notification, aktueller Endpointstatus, Gerätezahl und Cleanup. Keine vollständigen Endpointwerte protokollieren.

## Abnahme B – OneSignal

1. Serverstatus auf `/api/push` lesen: `oneSignalConfigured = true`.
2. Nachweisen, dass das reale OneSignal-Gerät als `external_id = <serverseitige interne User-ID>` gebunden ist.
3. Als derselbe normale, nicht impersonierte Benutzer `/settings/app` öffnen.
4. „OneSignal-Verbindung testen“ per echtem Klick auslösen.
5. UI darf zunächst nur melden: „Provider hat den Testauftrag angenommen.“
6. Provider-Dashboard/API read-only prüfen: Auftrag gehört zur korrekten App und zum erwarteten Alias; keine REST-Key-Werte erfassen.
7. Echte Benachrichtigung auf dem gebundenen Gerät empfangen.
8. Notification anklicken; Ziel muss exakt `/settings/app` derselben Produktionsorigin sein.
9. Negativtest mit nicht gebundenem Testbenutzer: kein falsches oder fremdes Gerät darf empfangen.
10. Impersonation-Negativtest: OneSignal-Test muss abgelehnt werden.
11. Rate-Limit und Providerfehler prüfen; interne Providerantworten und Keys dürfen nicht an den Client gelangen.

## Getrenntes Abschlussprotokoll

| Spur | Serverkonfiguration | Gerätebindung | Echte Zustellung | Klickziel | Cleanup | Ergebnis |
|---|---|---|---|---|---|---|
| Interner Web Push | VAPID | interner Endpoint-Owner | offen | offen | offen | nicht abgenommen |
| OneSignal | Variablen fehlen | nicht nachgewiesen | nicht nachgewiesen | nicht nachgewiesen | nicht anwendbar | BLOCK |

## Releaseentscheidung

OneSignal darf erst als produktiv abgeschlossen gelten, wenn alle drei OneSignal-Gates und die getrennte interne Web-Push-Spur belegt sind. Bis dahin bleibt die UI korrekt deaktiviert und das Asana-Ticket offen beziehungsweise „extern blockiert“.
