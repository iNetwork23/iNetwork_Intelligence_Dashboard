# AGENTS.md

## Auftrag

Dieses Repository enthält das private iNetwork Intelligence Dashboard. Änderungen müssen Profit-, Datenqualitäts- und Sicherheitsanforderungen vor visueller Bequemlichkeit priorisieren.

## Einstieg

1. `README.md` lesen.
2. `package.json` und betroffene Tests prüfen.
3. Vor Änderungen den aktuellen Git-Status ansehen und fremde Änderungen nicht überschreiben.
4. Abhängigkeiten reproduzierbar mit `npm ci` installieren.

## Befehle

```bash
npm run dev      # lokale Entwicklung
npm test         # Vitest-Testlauf
npm run lint     # ESLint
npm run build    # produktiver Next.js-Build
```

Vor Abschluss einer Änderung müssen Tests, Lint und Build erfolgreich sein. Behaupte keinen Erfolg ohne reale Befehlsausgabe.

## Architektur

- `src/app/`: Next.js App Router, Seiten und API-Routen
- `src/lib/`: Domänenlogik, Everflow-/Supabase-Zugriff und Tests
- `src/data/`: Automationsjournal und statische Entscheidungsdaten
- `supabase/migrations/`: ausführbare Datenbankmigrationen
- `scripts/`: operative Hilfsskripte
- `vercel.json` / `railway.json`: Deployment-Konfiguration

## Fachliche Leitplanken

- Smartlink- und Direkttraffic getrennt auswerten.
- Clickless API-Traffic hat keine belastbare Klick-CVR oder Profit-EPC; dort SOIs, First-Sales/SOI, Rebills, Umsatz, tatsächlichen Payout, Profit und Profit/SOI priorisieren.
- Traffic-Nachhaltigkeit auf tiefster Source-/ADV2-Ebene über Rebills pro Kunde sowie Top-1-/Top-2-Konzentration bewerten.
- Hohe Lead-CVR oder ein einzelner Sale sind kein ausreichender Qualitätsnachweis.
- Auffälligkeiten sachlich beschreiben; keine unbelegten Fraud-Vorwürfe.
- Historische und aktuelle Werte nicht vermischen. Zeitzonen und Zeitfenster explizit behandeln.

## Sicherheit

- Niemals `.env`, `.env.local`, API-Schlüssel, Passwörter, Session-Secrets, Service-Role-Keys oder Produktionsdaten committen.
- `SUPABASE_SERVICE_ROLE_KEY` bleibt ausschließlich serverseitig und darf nie `NEXT_PUBLIC_` verwenden.
- Neue API-Routen benötigen Authentifizierung und sichere Fehlerausgaben.
- Logs dürfen keine Secrets oder vollständigen sensitiven Rohdatensätze enthalten.
- Für neue Variablen nur leere Platzhalter in `.env.example` ergänzen.

## Arbeitsweise

- Kleine, nachvollziehbare Änderungen bevorzugen.
- Fachlogik mit Vitest abdecken; Regressionstests zuerst ergänzen.
- Bestehende uncommittete Änderungen anderer Bearbeiter nicht zurücksetzen.
- Keine Datenbankmigration automatisch gegen Produktion ausführen. Migrationen als SQL-Datei liefern und im Supabase SQL-Editor schrittweise ausführen lassen.
- Keine erfundenen Messwerte, API-Antworten oder Verifikationsergebnisse verwenden.

## Definition of Done

- Anforderungen vollständig umgesetzt
- relevante Tests ergänzt oder angepasst
- `npm test`, `npm run lint` und `npm run build` erfolgreich
- keine Secrets oder unnötigen Artefakte im Git-Diff
- Dokumentation und `.env.example` bei Konfigurationsänderungen aktualisiert
