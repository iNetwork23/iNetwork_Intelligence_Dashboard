import{readFileSync}from'node:fs';import{join}from'node:path';import{describe,expect,it}from'vitest';
const source=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
describe('automation config card',()=>{
 it('anchors every config card for push deep links and scrolls to the hash after loading',()=>{
  const ui=source('src/app/automation/AutomationDashboard.tsx'),css=source('src/app/globals.css');
  expect(ui).toContain('id={`config-${config.id}`}');
  expect(css).toContain('.automationConfig{scroll-margin-top:');
  expect(ui).toContain('window.location.hash');
  expect(ui).toContain('scrollIntoView');
 });
 it('shows slot progress from the last evaluation in client state without persisting it',()=>{
  const ui=source('src/app/automation/AutomationDashboard.tsx'),store=source('src/lib/automation-store.ts');
  expect(ui).toContain('setEvaluations');
  for(const field of ['clicks','sois','firstSales','profit','ageHours','remainingSois','remainingClicks','gateReached','economicallyRobust'])expect(ui,field).toContain(`progress.${field}`);
  expect(ui).toContain('Fortschritt aus Evaluation vom');
  expect(ui).toContain('Fortschritt erst nach Dry Run oder Prüfen sichtbar');
  expect(store).not.toContain('evaluation');
 });
 it('surfaces the last incident on held configurations',()=>{
  const ui=source('src/app/automation/AutomationDashboard.tsx');
  expect(ui).toContain("config.status==='hold'&&config.lastIncident");
  expect(ui).toContain('config.lastIncident.message');
  expect(ui).toContain('config.lastIncident.providerMutated');
  expect(ui).toContain('automationCompensationLabel(config.lastIncident.compensation)');
 });
});
