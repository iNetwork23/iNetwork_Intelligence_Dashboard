# ADR 0001: Kein verpflichtender MFA/TOTP-Zwang im aktuellen WLX-Dashboard

- **Status:** angenommen
- **Datum:** 2026-08-02
- **Gültig ab Releasebasis:** `84594ae314401b721a3bc8ba86f53adc89ad8058`
- **Entscheider:** Produktbetrieb ME Media

## Kontext

Das Dashboard verwendet individuelle beziehungsweise kontrollierte Benutzeridentitäten, Passwortprüfung, opaque serverseitige Sessions, Accountstatus, Rechteversionen, Sessionwiderruf, RBAC, Scope-before-aggregation und Audit-Ereignisse. Eine vollständige TOTP-Lifecycle-Implementierung mit Enrollment, Recovery Codes, Lost-Device-Prozess und privilegiertem Setup-Gating existiert nicht.

Eine frühere Oberfläche konnte MFA-Begriffe suggerieren, obwohl kein Authenticator-Zwang bestand. Dieser Copy-Drift wurde im finalen Release behoben. Ein bloßer Challenge-Schalter ohne sicheren Enrollment-/Recovery-Vertrag wäre riskanter als eine wahrheitsgemäße password-only-Policy.

## Entscheidung

Im aktuellen WLX-Dashboard wird **kein verpflichtender MFA/TOTP-Zwang** eingeführt.

Der Loginvertrag bleibt:

1. E-Mail oder unterstützter Legacy-Benutzername plus Passwort;
2. serverseitige Authentifizierung;
3. opaque Sitzung mit Status-, Rechteversions- und Scopeprüfung;
4. Sessionwiderruf bei sicherheitsrelevanten Änderungen;
5. kein behaupteter oder versteckter Authenticator-Code.

Der deaktivierte MFA-POST-Endpunkt bleibt fail-closed und antwortet mit HTTP 410. UI und Dokumentation dürfen keine aktivierbare MFA behaupten.

## Begründung

- Verhindert Benutzer-Lockouts durch einen halbfertigen Faktor-Lifecycle.
- Hält UI, API und tatsächlich implementierten Sicherheitsstand konsistent.
- Bewahrt existierende, produktiv geprüfte Loginidentitäten.
- Ermöglicht eine spätere vollständige MFA-Einführung als eigenständiges Security-Release statt als Copy-/Config-Änderung.

## Konsequenzen

- Password-only ist eine bewusste Policy, kein Bypass.
- Privilegierte Rollen benötigen weiterhin starke Passwörter, sichere Sessionverwaltung, Status-/Rechteprüfungen und Audit.
- Security-Copy-Vertragstests müssen MFA-/Authenticator-Behauptungen verhindern.
- Dieser ADR schließt nur die Produktentscheidung; er behauptet nicht, MFA sei implementiert.

## Bedingungen für eine spätere Neubewertung

MFA wird als separates Projekt neu bewertet, wenn mindestens eine Bedingung eintritt:

- regulatorische oder vertragliche Pflicht;
- erhöhte externe Angriffsfläche oder neue privilegierte Nutzergruppen;
- belastbarer Identity-Provider mit vollständigem MFA-/Recovery-Lifecycle;
- dokumentierter Sicherheitsvorfall, der Step-up-Authentifizierung erfordert.

Eine spätere Umsetzung muss mindestens enthalten:

1. verschlüsselte TOTP-Secrets;
2. Bestätigung vor Aktivierung und Replay-Schutz;
3. Recovery Codes und Lost-Device-Prozess;
4. Admin-Recovery mit Hierarchieprüfung und Audit;
5. Sessionwiderruf nach Faktoränderung;
6. privilegierte Setup-Sessions, die bis Enrollment alle gewöhnlichen Rechte verweigern;
7. Desktop-/Mobil-E2E und unabhängigen Security-Review.

## Nicht entschieden

Dieser ADR entscheidet nicht über Passkeys/WebAuthn oder externe SSO-Anbieter. Diese benötigen eigene Threat Models und Produktentscheidungen.
