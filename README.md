# iNetwork Intelligence Dashboard

Internes Performance- und Intelligence-Dashboard für Everflow-Traffic, Smartlinks, Affiliates, Automationsentscheidungen und langfristige LTV-/Kohortenanalysen.

> **Öffentliches Repository:** Zugangsdaten, API-Schlüssel, interne Produktionsdaten und personenbezogene Daten dürfen niemals committed werden.

## Funktionsumfang

- Account- und Portfolio-Monitoring über mehrere Zeiträume
- Smartlink- und Affiliate-Auswertungen
- Automationsjournal und Entscheidungsunterstützung
- dauerhafter Everflow-Historiencache in Supabase
- wiederaufnehmbarer 365-Tage-Backfill und rollierende Aktualisierung
- LTV-Kohorten nach Quelle und Sub-Source
- geschützter Dashboard-Zugang

## Technischer Stack

- Node.js 22+
- Next.js 16 / React 19 / TypeScript
- Vitest
- Supabase/Postgres
- Vercel Cron und alternativ Railway

## Lokaler Start

```bash
npm ci
cp .env.example .env.local
# Werte in .env.local ergänzen
npm run dev
```

Standardmäßig läuft die Anwendung unter `http://localhost:3000`.

## Konfiguration

| Variable | Erforderlich | Zweck |
|---|---:|---|
| `EVERFLOW_API_KEY` | Ja | Serverseitiger Zugriff auf Everflow |
| `DASHBOARD_USERNAME` | Ja | Benutzername für den Dashboard-Login |
| `DASHBOARD_PASSWORD` | Ja | Passwort für den Dashboard-Login |
| `SESSION_SECRET` | Ja | Signiert Sessions; mindestens 32 zufällige Zeichen |
| `SUPABASE_URL` | Für Historie | URL des Supabase-Projekts |
| `SUPABASE_SERVICE_ROLE_KEY` | Für Historie | Nur serverseitig verwendeter Service-Role-Key |
| `CRON_SECRET` | Empfohlen | Schützt `/api/sync` bei Cron-Aufrufen |

Echte Werte gehören ausschließlich in `.env.local` oder in die Secret-Verwaltung des Hosting-Anbieters. `.env.example` enthält nur leere Platzhalter.

## Supabase-Historiencache

1. Ein Supabase-Projekt anlegen.
2. Den vollständigen Inhalt von `supabase/migrations/20260722191500_everflow_history_cache.sql` im Supabase SQL-Editor ausführen.
3. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` und `EVERFLOW_API_KEY` im Hosting setzen.
4. Optional `CRON_SECRET` setzen.
5. Neu deployen. `vercel.json` startet `/api/sync` auf Vercel Pro stündlich.

Der Sync verarbeitet den 365-Tage-Backfill in höchstens sieben Tagen pro Lauf. Nach Abschluss wird das rollierende 30-Tage-Fenster höchstens stündlich aktualisiert.

### Tabellen und Views

- `conversions`: deduplizierte SOIs, First-Sales und Rebills; `lead_id` entspricht der Everflow-`transaction_id`
- `daily_metrics`: Tagesaggregate einschließlich aller Klicks
- `sync_state`: wiederaufnehmbarer Fortschritt
- `ltv_cohorts`: Registrierungsmonat × kumulierter Umsatz nach 30/60/90/180/365 Tagen

### Sync prüfen

Angemeldet im Dashboard öffnen:

```text
https://<dashboard-domain>/api/sync
```

Alternativ authentifiziert der Vercel-Cron über `Authorization: Bearer <CRON_SECRET>`.

## Qualitätsprüfung

Vor jedem Push ausführen:

```bash
npm test
npm run lint
npm run build
```

GitHub Actions führt dieselben Prüfungen automatisch aus.

## Nutzung mit KI-Entwicklungswerkzeugen

Das Repository kann lokal mit Claude Code, Codex, Cursor, OpenCode oder vergleichbaren Werkzeugen geöffnet werden. Verbindliche Projektregeln und Einstiegspunkte stehen in [`AGENTS.md`](AGENTS.md). Eine KI darf niemals echte Secrets in Dateien, Logs, Commits oder Chat-Ausgaben übernehmen.

Empfohlener Ablauf:

```bash
git clone https://github.com/iNetwork23/iNetwork_Intelligence_Dashboard.git
cd iNetwork_Intelligence_Dashboard
npm ci
cp .env.example .env.local
```

Danach das Verzeichnis im gewünschten KI-Werkzeug öffnen und zuerst `README.md` sowie `AGENTS.md` lesen lassen.
