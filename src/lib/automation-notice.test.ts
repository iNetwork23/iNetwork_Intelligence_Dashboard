import {describe,expect,it} from 'vitest';
import{readFileSync}from'node:fs';import{join}from'node:path';
import {automationCompensationLabel,automationDecisionLabel,automationDecisionSummary,automationNotice} from './automation-notice';

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
 it('summarizes a decision with the affected landingpages for push bodies',()=>{
  expect(automationDecisionSummary({type:'replace_slot',reasonCode:'mature_economic_loser',fromOfferUrlIds:[12],toOfferUrlIds:[34]})).toBe('Slot ersetzt · LP #12 → LP #34');
  expect(automationDecisionSummary({type:'rotate_round',reasonCode:'matched_round_complete',fromOfferUrlIds:[1,2],toOfferUrlIds:[3,4]})).toBe('Runde rotiert · LP #1, #2 → LP #3, #4');
  expect(automationDecisionSummary({type:'promote',reasonCode:'robust_sale_first_leader',toOfferUrlIds:[7]})).toBe('Champion gesetzt · LP #7');
  expect(automationDecisionSummary({type:'hold',reasonCode:'test_running'})).toBe('Halten (test_running)');
 });
 it.each([['not_needed','nicht nötig'],['verified','verifiziert'],['failed','fehlgeschlagen'],['uncertain','unklar'],['whatever','whatever']])('labels compensation %s as %s',(value,label)=>{expect(automationCompensationLabel(value)).toBe(label)});
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
