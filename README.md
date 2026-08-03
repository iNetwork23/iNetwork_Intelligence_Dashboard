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
- geschützter Dashboard-Zugang mit Brute-Force-Bremse am Login

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
2. Die Dateien in `supabase/migrations/` in Dateinamensreihenfolge vollständig im Supabase SQL-Editor ausführen.
3. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` und `EVERFLOW_API_KEY` im Hosting setzen.
4. `CRON_SECRET` setzen. Vercel sendet den Wert beim Cron-Aufruf als `Authorization: Bearer <CRON_SECRET>`; ohne den Wert bleibt `/api/sync` nur mit angemeldeter Session erreichbar.
5. Neu deployen. `vercel.json` startet `/api/sync` über den Cron-Ausdruck `0 * * * *` stündlich (Vercel Pro).

Ohne einen laufenden Cron wird der Historiencache nicht mehr befüllt und sämtliche Auswertungen frieren auf dem Stand des letzten Syncs ein. Bei Betrieb auf Railway muss der Aufruf von `/api/sync` extern eingeplant werden, da `railway.json` nur den Healthcheck definiert.

Der Sync verarbeitet den 365-Tage-Backfill in höchstens sieben Tagen pro Lauf. Nach Abschluss wird das rollierende 30-Tage-Fenster höchstens stündlich aktualisiert.

Die Stundenmetriken laufen unabhängig davon: Sie decken bei jedem Lauf die letzten 14 Tage vollständig ab, damit die Smartlink-Ansichten auch während eines laufenden Backfills echte Stundenauflösung haben und nachträgliche Everflow-Korrekturen einfließen. Schlägt allein der Stundenreport fehl, läuft der übrige Sync weiter und die Antwort von `/api/sync` weist den Fehler unter `hourlyError` aus.

### Tabellen und Views

- `conversions`: deduplizierte SOIs, First-Sales und Rebills; `lead_id` entspricht der Everflow-`transaction_id`
- `daily_metrics`: Tagesaggregate einschließlich aller Klicks; Grundlage für Portfolio-, Affiliate- und Source-Auswertungen
- `smartlink_hourly_metrics`: Stundenaggregate je Campaign und Landingpage für die Smartlink-Ansichten; bewusst ohne `source_id`/`sub_source` und nach 21 Tagen automatisch bereinigt
- `sync_state`: wiederaufnehmbarer Fortschritt
- `ltv_cohorts`: Registrierungsmonat × kumulierter Umsatz nach 30/60/90/180/365 Tagen

In derselben Datenbank liegt eine projektfremde Tabelle `hourly_metrics` mit der Zeitspalte `hour_start`, die von einem anderen System geschrieben wird. Sie gehört nicht zu diesem Repository. Alle hier angelegten Objekte tragen deshalb das Präfix `smartlink_`; Migrationen dieses Projekts dürfen `hourly_metrics` weder lesen noch verändern.

## Automationsjournal

`/automation` liest **keinen Live-Zustand**, sondern `src/data/automation-journal.ts` — eine von `scripts/sync-automation-journal.mjs` erzeugte und eingecheckte Datei. Das Skript liest Zustandsdateien des Automations-Hosts aus fest verdrahteten Pfaden unterhalb von `/home/hermes` und läuft daher nur dort. Aktuell wird die Ansicht also erst durch Skriptlauf, Commit und Deployment aktualisiert.

Damit ein stehengebliebener Schnappschuss nicht als Normalbetrieb erscheint, bewertet `/api/automation` die Frische zur Anfragezeit. Eine Campaign gilt als überfällig, wenn `nextRunAt` länger als ein Viertel ihres beobachteten Prüfintervalls zurückliegt, mindestens jedoch 15 Minuten. Trifft das zu oder ist das Journal älter als ein voller Prüfzyklus, zeigt die Ansicht einen Warnhinweis statt der `LIVE`-Kennzeichnung.

### Sync prüfen

Angemeldet im Dashboard öffnen:

```text
https://<dashboard-domain>/api/sync
```

Alternativ authentifiziert der Vercel-Cron über `Authorization: Bearer <CRON_SECRET>`.

## Login-Schutz

Fehlgeschlagene Anmeldungen werden pro Client-IP in einem 15-Minuten-Fenster gezählt. Ab fünf Fehlversuchen sperrt der Login mit wachsender Wartezeit von 60 Sekunden bis maximal einer Stunde; eine erfolgreiche Anmeldung setzt den Zähler zurück. Der Zustand liegt im Prozessspeicher, sodass jede Serverinstanz eigenständig bremst. Das erschwert automatisiertes Durchprobieren, ersetzt aber kein starkes `DASHBOARD_PASSWORD`.

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
