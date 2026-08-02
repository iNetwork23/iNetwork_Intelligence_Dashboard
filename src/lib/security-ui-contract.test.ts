import{readFileSync}from'node:fs';import{join}from'node:path';import{describe,expect,it}from'vitest';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('security-facing UI copy and assets',()=>{
 it('does not request a remote font stylesheet that production CSP blocks',()=>{const css=read('src/app/globals.css');expect(css).not.toContain('fonts.googleapis.com');expect(css).not.toMatch(/^@import\s+url\(['"]https?:\/\//m)});
 it('truthfully states that authenticator MFA is not enabled',()=>{const settings=read('src/app/settings/security/SecuritySettings.tsx'),page=read('src/app/settings/security/page.tsx');expect(settings).toContain('kein Authenticator-Code vorgesehen');expect(settings).not.toContain('Multi-Faktor-Authentifizierung');expect(page).toContain('title="Anmeldesicherheit"');expect(page).toContain('Passwortbasierte Anmeldung und serverseitig geprüfte Sitzungen.');expect(page).not.toContain('Multi-Faktor-Authentifizierung');expect(page).not.toContain('Authenticator-App verbinden');expect(page).not.toContain('TOTP bestätigen')});
});
