# Everflow-Historiencache mit Supabase

Das Dashboard speichert Everflow-Conversions und tägliche Reporting-Fakten dauerhaft in Supabase. Der Vercel-Cron arbeitet den 365-Tage-Backfill in höchstens sieben Tagen pro Lauf rückwärts ab. Danach synchronisiert dieselbe Route stündlich das rollierende 30-Tage-Fenster; die weiterhin alle zehn Minuten gestarteten Cron-Aufrufe werden bis zur nächsten vollen Stunde übersprungen.

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

4. Neu deployen. `vercel.json` startet `/api/sync` alle zehn Minuten.

## Tabellen

- `conversions`: deduplizierte SOIs, First-Sales und Rebills einschließlich vollständigem Everflow-Rohdatensatz; `lead_id` entspricht der Everflow-`transaction_id`.
- `daily_metrics`: Tagesaggregate einschließlich aller Klicks. Diese dritte Tabelle ist nötig, weil nicht konvertierte Klicks im Conversion-Report fehlen.
- `sync_state`: wiederaufnehmbarer Backfill-/Rolling-Fortschritt.
- `ltv_cohorts`: View für Registrierungsmonat × kumulierten Umsatz nach 30/60/90/180/365 Tagen.

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
```
