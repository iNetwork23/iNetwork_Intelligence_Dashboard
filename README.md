# WLX / ME Media Performance Intelligence

Authentifiziertes Everflow-, Smartlink- und Operations-Dashboard mit Supabase-Historie, Affiliate Optimizer, Campaign-/Landingpage-/Source-Tiefenanalyse, RBAC, PWA/Web Push und kontrollierter Source-Sperren-Preview.

## Verifizierter Produktionsstand

- freigegebener Produktcommit: `84594ae314401b721a3bc8ba86f53adc89ad8058`;
- der aktuelle kanonische Branch darf zusätzlich reine `src/data/automation-journal.ts`-Nachfolger enthalten;
- Produktionsalias: `https://wlx-railway-dashboard.vercel.app`;
- operator-lokaler Prüfbericht (nicht Teil dieses Repositories): `/home/hermes/release-artifacts/full-project-check-2026-08-02/WLX-VOLLSTAENDIGER-PROJEKTCHECK-2026-08-02.md`;
- operator-lokales Manifest (nicht Teil dieses Repositories): `/home/hermes/release-artifacts/WLX-ABNAHME-CHECKLIST-2026-08-02.json`.

Der historische Campaign-#23-CTA-, Picker-, Source-Preview-Statement-Timeout- und Rohhistorien-Cachefehler ist im lokalen Kandidaten behoben. Campaign-Umsatz wird nur nach reconcilierten Buckets erklärt; Eventanzahlen werden nicht als kausale Umsatzzuordnung ausgegeben. Neue Releases benötigen trotzdem erneut Tests, immutable Review, Deploymentfingerprint und echte Desktop-/Mobil-Browserklicks.

## Everflow-Historiencache mit Supabase

Das Dashboard speichert Everflow-Conversions und tägliche Reporting-Fakten dauerhaft in Supabase. Jeder Lauf arbeitet den 365-Tage-Backfill in höchstens sieben Tagen rückwärts ab. Auf Vercel Pro läuft `/api/sync` stündlich um Minute 17. Nach Abschluss des Backfills aktualisiert derselbe Cron das rollierende 30-Tage-Fenster höchstens stündlich.

## Einmalige Einrichtung

1. Ein Supabase-Projekt anlegen.
2. Die Migrationen bis einschließlich `20260729003000_rebill_concentration_index.sql` einzeln in lexikografischer Reihenfolge aus `supabase/migrations/` ausführen und jeden Schritt per Objekt-Read-back bestätigen. Für die nachfolgenden Fraud-, Identity-, Replacement- und LTV-Schritte ausschließlich `docs/FRAUD-CONTROL-MIGRATION-RUNBOOK.md` verwenden; dessen getrennte `CREATE INDEX CONCURRENTLY`-Dateien dürfen nicht in einen gemeinsamen SQL-Editor-Block aufgenommen werden.
3. In Vercel unter **Project → Settings → Environment Variables** setzen:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
EVERFLOW_API_KEY=<everflow-api-key>
```

Der Service-Role-Key darf niemals mit `NEXT_PUBLIC_` beginnen oder im Browser-Code verwendet werden. Die Tabellen haben RLS ohne Client-Policies; Zugriffe erfolgen ausschließlich serverseitig. Optional kann `CRON_SECRET` gesetzt werden. Vercel sendet diesen Wert dann automatisch als Bearer-Token an Cron-Routen.

### Push-Provider getrennt betreiben

Der interne Web-Push-Pfad verwendet die geschützten VAPID-Variablen. Die PWA ist bewusst online-first; der Service Worker darf keine authentifizierten Seiten, API-Antworten oder Finanz-/Operationsdaten offline cachen.

Der optionale serverseitige OneSignal-Adapter ist davon getrennt. In der aktuellen Produktionskonfiguration fehlen die OneSignal-Variablen; OneSignal darf daher nicht als aktiv oder verbunden bezeichnet werden. Für eine spätere Aktivierung werden ausschließlich diese geschützten Variablen gesetzt:

```text
ONESIGNAL_APP_ID=<onesignal-app-id>
ONESIGNAL_REST_API_KEY=<onesignal-rest-api-key>
APP_ORIGIN=https://<dashboard-domain>
```

`ONESIGNAL_REST_API_KEY` darf niemals mit `NEXT_PUBLIC_` beginnen. OneSignal-Geräte werden mit der serverseitig authentifizierten Dashboard-User-ID als OneSignal-`external_id` verbunden; eine vom Browser gelieferte User-ID wird nicht als Autorisierung verwendet. Unter **App & Hinweise** wird nur der Konfigurationsstatus angezeigt. Credentials allein belegen keine Gerätebindung: Vor einer Freigabe müssen SDK-Aliasbindung, rate-limitierter Testversand, reale Provider-Message-ID, Desktop/Mobil und getrennte interne-Web-Push-Zustände geprüft werden. Interner Web Push und OneSignal werden nicht still gespiegelt, da sonst doppelte Zustellungen entstehen können.

4. Neu deployen. `vercel.json` startet `/api/sync` auf Vercel Pro stündlich um Minute 17.

## Tabellen

- `conversions`: deduplizierte SOIs, First-Sales und Rebills einschließlich vollständigem Everflow-Rohdatensatz; `lead_id` entspricht der Everflow-`transaction_id`.
- `daily_metrics`: Tagesaggregate einschließlich aller Klicks. Diese dritte Tabelle ist nötig, weil nicht konvertierte Klicks im Conversion-Report fehlen.
- `sync_state`: wiederaufnehmbarer Backfill-/Rolling-Fortschritt.
- `ltv_cohorts`: bestehende Live-View für Registrierungsmonat × kumulierten Umsatz nach 30/60/90/180/365 Tagen.
- `private.ltv_cohorts_materialized`: scope-sicherer Produktionscache für die Kohortenoberfläche; `pg_cron` aktualisiert ihn stündlich um Minute 25, ohne einen HTTP-Request offenzuhalten.

## Sync-Status prüfen

Angemeldet im Dashboard im Browser öffnen:

```text
https://<dashboard-domain>/api/sync
```

Beispielantwort:

```json
{
  "mode": "backfill",
  "from": "2026-07-16",
  "to": "2026-07-22",
  "upsertedConversions": 18234,
  "upsertedMetrics": 7421,
  "backfillComplete": false
}
```

Im laufenden Modus kann zusätzlich `"skipped": true` erscheinen, wenn seit dem letzten erfolgreichen 30-Tage-Abgleich noch keine Stunde vergangen ist. Derselbe Status steht in den Vercel Function Logs. Fehler aktualisieren `sync_state` nicht; der nächste Cron setzt am letzten erfolgreichen Chunk fort.

## Dashboard

Der Account Monitor liest seine Reports aus der Postgres-Funktion `portfolio_metric_rows`. Verfügbar sind Heute, 7 Tage, 30 Tage, 90 Tage, 12 Monate, **365 Tage** sowie ein freier Zeitraum. Der kompatible URL-Wert `period=all` bezeichnet ausdrücklich einen begrenzten 365-Tage-Bereich und keine Lifetime-Historie. `/cohorts` zeigt die LTV-Kohorten; `/api/cohorts?source=…&sub_source=…` liefert dieselben Daten als authentifiziertes JSON.

Im Automation Builder stehen nur tatsächlich implementierte Strategien zur Verfügung: `equal_slots`, `champion_challenger` und für Multi-Offer `matched_rounds`. Der frühere reine Enum-/UI-Wert `full_matrix` wurde entfernt; alte Multi-Offer-Drafts werden sicher zu `matched_rounds` normalisiert. Eine nicht vorhandene vollständige Offer×Landingpage-Engine wird nicht mehr behauptet.

## Source-Preview und Fraud-Abgrenzung

`GET /api/source-blocks?action=preview_across_offers` ist read-only. Die Route prüft Affiliate, Trafficmodus, Main Source, optionale Subsource, Offer und bei Einzelprüfung Campaign serverseitig anhand synchronisierter Source-Snapshots. Unvollständige Snapshot-Historie wird fail-closed abgelehnt. Der Preview-Pfad verwendet weder den vollständigen Smartlink-Tiefen-RPC noch einen Next-Funktionscache für die große Rohhistorie.

Eine Source-Sperre bedeutet in diesem Produkt Payout 0/Postback aus für den bestätigten Scope, nicht einen physischen Trafficstopp. Source-Sperren sind außerdem nicht gleichbedeutend mit vollständiger accountweiter Fraud Detection. Ein Fraud-Control-Dashboard muss Smartlink, Direct und clickless/API getrennt auswerten, Scope vor Aggregation anwenden und Kundenkonzentration einbeziehen.

Eine echte Provider-Sperre darf nur nach aktueller Preview, exakter Bestätigung, ausdrücklich freigegebenem Testscope und vorhandenem Rollback ausgeführt werden. Der finale Releaseaudit hat bewusst keinen produktiven POST ausgelöst.

## Lokale Prüfung

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
npx tsc --noEmit
git diff --check
```

## RBAC, MFA und sichere Betriebsgrenzen

Die Anwendung erzwingt RBAC serverseitig auf Seiten, API-Routen, Exporten und Reporting-Services. Partner-Sichten werden vor Aggregation auf Affiliate-, Offer-, Campaign-, Source- und Sub-Source-Scopes eingeschränkt; ein leerer Partner-Scope liefert keine Daten. Finanzkennzahlen benötigen zusätzlich `finance.view`. Rollenänderungen, Session-Widerrufe, Impersonation und Audit-Ereignisse werden über die Access-Konsole verwaltet.

Die Produktentscheidung verlangt bewusst keinen MFA-Code beim Dashboard-Login: E-Mail/Benutzername plus Passwort erzeugen nach erfolgreicher serverseitiger Prüfung eine normale Sitzung. Das ist eine vollständige Login-Policy, kein versteckter Bypass; Login-UI, Challenge-Parsing und Session-Gating verlangen daher kein TOTP. Die MFA-Einschreibung ist in Oberfläche und API deaktiviert; der POST-Endpunkt antwortet mit HTTP 410. Die formale Entscheidung und Neubewertungskriterien stehen in `docs/decisions/0001-password-only-no-mandatory-mfa.md`. `APP_ORIGIN` muss auf den kanonischen öffentlichen Ursprung zeigen. Der authentifizierte Export liegt unter `/api/exports`; `CRON_SECRET` autorisiert ausschließlich den maschinellen stündlichen Supabase-Sync, während manuelle Sync-Aufrufe `api.manage` benötigen.

Die normalisierten RBAC-Migrationen und atomaren SQL-Primitiven sind im Repository enthalten und müssen vor einem Deployment auf der Ziel-Datenbank angewendet und technisch verifiziert werden. Die aktive Runtime verwendet zusätzlich den persistenten Security-Store mit atomarem `INSERT`/Unique-Key für Rate-Limit-Slots, Widerrufsmarkern gegen Session-Reanimation und fail-closed Owner-Locks für sicherheitskritische Mutationen. Der erste Zugang erfolgt kontrolliert über den abschaltbaren Legacy-Super-Admin; nach Einrichtung eines individuellen Super-Admin-Kontos wird `ALLOW_LEGACY_ADMIN=false` gesetzt. Eine lokale Migrationsdatei allein belegt keine produktive Anwendung.

### Incident-Recovery für die Access-Verwaltung

Admin-Mutationen verwenden bewusst einen fail-closed Lock ohne automatische Übernahme. Bleibt dieser nach einem nachgewiesenen Prozessabbruch bestehen, muss zuerst ausgeschlossen werden, dass noch eine Admin-Mutation läuft. Anschließend kann ein Operator mit produktiven Supabase-Zugangsdaten den owner-bedingten Recovery-Befehl ausführen:

```bash
CONFIRM_ADMIN_ACCESS_UNLOCK='UNLOCK admin-access-mutation' npm run admin:unlock-access
```

Der Befehl verweigert die Ausführung ohne exakte Bestätigung und löscht nur den zuvor gelesenen Owner. Ursache, Zeitpunkt und Operator sind im Incident-Protokoll zu dokumentieren.

## Automation, Release und Rollback

Der externe Hermes-Job `cd39b3e8f6d4` synchronisiert das durable Automation-Journal alle 15 Minuten aus `/home/hermes/wlx-pwa-final-release`. Dieser Journal-Sync ist vom stündlichen `/api/sync`-Datenimport zu unterscheiden.

Vor Produktänderungen:

1. Job pausieren und Release-Marker mit Basiscommit schreiben.
2. Arbeitsbranch/Worktree vom aktuellen kanonischen Commit erstellen.
3. Nachfolger seit dem letzten Produktrelease klassifizieren; nur reine `src/data/automation-journal.ts`-Nachfolger dürfen ohne neue Produktprüfung übernommen werden.
4. Produktänderungen strikt test-first durchführen.

Vor Deployment:

1. vollständige Tests, ESLint, TypeScript, `npm audit --omit=dev`, Produktionsbuild und `git diff --check`;
2. immutable Commit/Tree und unabhängiger Review mit terminalem PASS;
3. Deployment aus sauberem, mit `.vercel/project.json` verlinktem Checkout;
4. Alias, `READY`, `/api/health` und release-spezifische Funktion prüfen;
5. authentifizierte Desktop- und 390×844-Mobil-E2E mit echten sichtbaren Klicks;
6. temporäre Nutzer, Access-Keys, Credentials, Server und Worktrees entfernen;
7. kanonischen Checkout und Cron auf den freigegebenen Ancestor/Nachfolger ausrichten, dann Pause-Marker entfernen und Job reaktivieren.

Rollback bedeutet, den letzten unabhängig freigegebenen immutable Deploymentstand wieder auf den Produktionsalias zu promoten und erst danach Automation/Cron auf den korrespondierenden sauberen Checkout zurückzuführen. Ein fehlgeschlagenes Gate darf nicht als PASS dokumentiert werden.

## Partnernachrichten

Der KI-/Telegram-Partnernachrichten-Assistent ist spezifiziert, aber nicht implementiert oder als Versandprovider konfiguriert. Der verbindliche Daten-, RBAC-, Human-Approval-, Delivery- und Auditvertrag steht in `docs/PARTNER-MESSAGING-SPEC.md`. Kein autonomer Versand und keine Empfängerwahl durch Browser oder KI.
