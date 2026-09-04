import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

/** Abnahme G „Scope-Vorschau in der Access-Konsole“ (Etappe 4): Route additiv, Recht wie die Benutzerverwaltung, Systemzugriff nur serverseitig, keine Geldwerte. */
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const route=()=>read('src/app/api/admin/access/route.ts'),console=()=>read('src/app/admin/access/AccessConsole.tsx');

describe('scope preview route (GET ?preview=1)',()=>{
 it('is an additive branch of the existing GET, gated by users.manage before any data is loaded',()=>{
  const s=route(),preview=s.indexOf("searchParams.get('preview')==='1'"),gate=s.indexOf("can(actor.access, 'users.manage')",preview),load=s.indexOf("getDashboard('30d')",preview);
  expect(preview).toBeGreaterThan(-1);
  expect(gate).toBeGreaterThan(preview);
  expect(load).toBeGreaterThan(gate);
  expect(s).toContain('parseScopePreviewInput(');
  expect(s).toContain('previewScopeEntities(');
  // Bestehender GET-Vertrag bleibt: Rollen-/Audit-Partitionierung unverändert.
  expect(s).toMatch(/if\s*\(mayUsers\s*\|\|\s*mayRoles\)\s*response\.standardRoles\s*=/);
 });
 it('loads the portfolio with system access on the server only – never with the actor scope or a client-supplied period',()=>{
  const s=route(),start=s.indexOf("searchParams.get('preview')==='1'"),end=s.indexOf('const mayUsers',start),section=s.slice(start,end);
  expect(section).toContain("getDashboard('30d')");
  expect(section).not.toContain('actor.access)');
  expect(section).not.toMatch(/getDashboard\([^)]*access/);
  expect(section).not.toMatch(/searchParams\.get\(['"]period['"]\)/);
 });
 it('answers with names and SOI volume only and strips finance defensively',()=>{
  const s=route(),start=s.indexOf("searchParams.get('preview')==='1'"),end=s.indexOf('const mayUsers',start),section=s.slice(start,end);
  expect(section).toContain('stripFinance(');
  for(const money of ['profit','revenue','payout'])expect(section).not.toContain(money);
  expect(section).toContain('400');
  expect(section).toContain('503');
 });
});

describe('scope preview in the access console',()=>{
 it('renders the preview under the scope inputs, debounced, with an error text and the first names',()=>{
  const s=console();
  expect(s).toContain('function ScopePreview(');
  expect(s).toContain('<ScopePreview');
  expect(s).toContain('Vorschau: Dieses Konto sieht');
  expect(s).toContain('SCOPE_PREVIEW_NAMES');
  expect(s).toContain('SCOPE_PREVIEW_DEBOUNCE_MS');
  expect(s).toContain('preview=1');
  expect(s).toContain('Vorschau nicht verfügbar');
  expect(s).toContain('AbortController');
  expect(s).toContain('Datenbasis: letzte 30 Tage');
 });
 it('keeps the scope inputs bound to the form field names the update action reads',()=>{
  const s=console();
  expect(s).toContain('name={`s:${key}`}');
  expect(s).toContain('String(fd.get(`s:${key}`) || "")');
  expect(s).toContain("name=\"role\"");
 });
 it('explains both edge cases: empty partner scope and non-restricting internal scopes',()=>{
  const s=console();
  expect(s).toContain('Leerer Partner-Scope');
  expect(s).toContain('Datenfreigaben schränken interne Rollen nicht ein');
 });
 it('styles the preview with scoped selectors appended to globals.css (no gradients, no animation)',()=>{
  const css=read('src/app/globals.css'),start=css.indexOf('.accessPage .scopePreview');
  expect(start).toBeGreaterThan(-1);
  const block=css.slice(start);
  expect(block).not.toMatch(/gradient|animation|@keyframes|box-shadow:[^;]*\d+px\s+\d+px\s+\d+px\s+\d+px\s+rgba\([^)]*,\s*0\.[5-9]/);
 });
});
