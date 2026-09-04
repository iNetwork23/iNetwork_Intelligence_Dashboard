import {describe,expect,it} from 'vitest';
import{readFileSync}from'node:fs';import{join}from'node:path';
import {automationDecisionLabel,automationNotice} from './automation-notice';

describe('automationNotice',()=>{
 it('describes a run by its decision and write count instead of claiming a verified write',()=>{
  expect(automationNotice('dry_run',{ok:true,evaluation:{action:{type:'hold',reasonCode:'insufficient_evidence'}},writesPerformed:0})).toBe('Dry Run: Entscheidung Halten (insufficient_evidence) · 0 Writes');
  expect(automationNotice('live_run',{ok:true,evaluation:{action:{type:'replace_slot',reasonCode:'test_quota_reached'}},writesPerformed:1})).toBe('Live-Lauf: Entscheidung Slot ersetzt · 1 Writes');
 });
 it('translates every decision type into readable German',()=>{
  expect(automationDecisionLabel({type:'hold'})).toBe('Halten');
  expect(automationDecisionLabel({type:'rotate_round',reasonCode:'round_complete'})).toBe('Runde rotiert');
  expect(automationDecisionLabel({type:'promote',reasonCode:'champion'})).toBe('Champion gesetzt');
  expect(automationDecisionLabel(undefined)).toBe('unbekannt');
 });
 it.each([['create','Entwurf gespeichert'],['update','Konfiguration aktualisiert'],['request_live','Live angefordert'],['activate_live','Live aktiviert'],['pause','Pausiert'],['resume','Fortgesetzt'],['complete','Beendet'],['import_legacy','Als Entwurf importiert']])('labels %s as %s',(action,label)=>{expect(automationNotice(action,{ok:true})).toBe(label)});
 it('falls back to a neutral label for unknown actions and missing run data',()=>{
  expect(automationNotice('whatever',{ok:true})).toBe('Aktion ausgeführt');
  expect(automationNotice('dry_run',null)).toBe('Dry Run: Entscheidung unbekannt · 0 Writes');
 });
 it('is wired into the dashboard with distinct success and error styling',()=>{
  const ui=readFileSync(join(process.cwd(),'src/app/automation/AutomationDashboard.tsx'),'utf8'),css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');
  expect(ui).not.toContain('Aktion erfolgreich und serverseitig verifiziert');
  expect(ui).toContain("from'@/lib/automation-notice'");
  expect(ui).toContain('automationNotice(body.action,payload)');
  expect(ui).toContain('automationNotice ${notice.tone}');
  expect(css).toContain('.automationNotice.ok');
  expect(css).toContain('.automationNotice.error');
 });
});
