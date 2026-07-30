# Everflow-Historiencache mit Supabase

Das Dashboard speichert Everflow-Conversions und tägliche Reporting-Fakten dauerhaft in Supabase. Jeder Lauf arbeitet den 365-Tage-Backfill in höchstens sieben Tagen rückwärts ab. Auf Vercel Pro läuft `/api/sync` einmal pro Stunde. Nach Abschluss des Backfills aktualisiert derselbe Cron das rollierende 30-Tage-Fenster höchstens stündlich.

## Einmalige Einrichtung

1. Ein Supabase-Projekt anlegen.
2. Den vollständigen Inhalt von `supabase/migrations/20260722191500_everflow_history_cache.sql` im Supabase SQL-Editor ausführen.
3. In Vercel unter **Project → Settings → Environment Variables** setzen:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
EVERFLOW_API_KEY=<everflow-api-key>
```

Der Service-Role-Key darf niemals mit `NEXT_PUBLIC_` beginnen oder im Browser-Code verwendet werden. Die Tabellen haben RLS ohne Client-Policies; Zugriffe erfolgen ausschließlich serverseitig. Optional kann `CRON_SECRET` gesetzt werden. Vercel sendet diesen Wert dann automatisch als Bearer-Token an Cron-Routen.

4. Neu deployen. `vercel.json` startet `/api/sync` auf Vercel Pro stündlich zur vollen Stunde.

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

Der Account Monitor liest seine Reports aus der Postgres-Funktion `portfolio_metric_rows`. Verfügbar sind Heute, 7 Tage, 30 Tage, 90 Tage, 12 Monate, Gesamt sowie ein freier Zeitraum. `/cohorts` zeigt die LTV-Kohorten; `/api/cohorts?source=…&sub_source=…` liefert dieselben Daten als authentifiziertes JSON.

## Lokale Prüfung

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
npx tsc --noEmit
```

## RBAC, MFA und sichere Betriebsgrenzen

Die Anwendung erzwingt RBAC serverseitig auf Seiten, API-Routen, Exporten und Reporting-Services. Partner-Sichten werden vor Aggregation auf Affiliate-, Offer-, Campaign-, Source- und Sub-Source-Scopes eingeschränkt; ein leerer Partner-Scope liefert keine Daten. Finanzkennzahlen benötigen zusätzlich `finance.view`. Rollenänderungen, Session-Widerrufe, Impersonation und Audit-Ereignisse werden über die Access-Konsole verwaltet.

Die Produktentscheidung vom 29.07.2026 verlangt bewusst keinen MFA-Code beim Dashboard-Login: E-Mail/Benutzername plus Passwort erzeugen nach erfolgreicher serverseitiger Prüfung eine normale Sitzung. Das ist eine vollständige Login-Policy, kein versteckter Bypass; Login-UI, Challenge-Parsing und Session-Gating verlangen daher kein TOTP. Die MFA-Einschreibung ist in Oberfläche und API deaktiviert; der POST-Endpunkt antwortet mit HTTP 410. `APP_ORIGIN` muss auf den kanonischen öffentlichen Ursprung zeigen. Der authentifizierte Export liegt unter `/api/exports`; `CRON_SECRET` autorisiert ausschließlich den maschinellen stündlichen Sync, während manuelle Sync-Aufrufe `api.manage` benötigen.

Die normalisierten RBAC-Migrationen und atomaren SQL-Primitiven sind im Repository enthalten und müssen vor einem Deployment auf der Ziel-Datenbank angewendet und technisch verifiziert werden. Die aktive Runtime verwendet zusätzlich den persistenten Security-Store mit atomarem `INSERT`/Unique-Key für Rate-Limit-Slots, Widerrufsmarkern gegen Session-Reanimation und fail-closed Owner-Locks für sicherheitskritische Mutationen. Der erste Zugang erfolgt kontrolliert über den abschaltbaren Legacy-Super-Admin; nach Einrichtung eines individuellen Super-Admin-Kontos wird `ALLOW_LEGACY_ADMIN=false` gesetzt. Eine lokale Migrationsdatei allein belegt keine produktive Anwendung.

### Incident-Recovery für die Access-Verwaltung

Admin-Mutationen verwenden bewusst einen fail-closed Lock ohne automatische Übernahme. Bleibt dieser nach einem nachgewiesenen Prozessabbruch bestehen, muss zuerst ausgeschlossen werden, dass noch eine Admin-Mutation läuft. Anschließend kann ein Operator mit produktiven Supabase-Zugangsdaten den owner-bedingten Recovery-Befehl ausführen:

```bash
CONFIRM_ADMIN_ACCESS_UNLOCK='UNLOCK admin-access-mutation' npm run admin:unlock-access
```

Der Befehl verweigert die Ausführung ohne exakte Bestätigung und löscht nur den zuvor gelesenen Owner. Ursache, Zeitpunkt und Operator sind im Incident-Protokoll zu dokumentieren.
