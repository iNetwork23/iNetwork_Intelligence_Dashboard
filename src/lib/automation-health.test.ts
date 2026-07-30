import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {automationCampaignLabel,isAutomationCampaignHealthy} from './automation-health';

const now=Date.parse('2026-07-30T06:00:00Z'),campaign={enabled:true,mode:'live',lastStatus:'ok',lastRunAt:'2026-07-30T05:00:00Z',nextRunAt:'2026-07-30T07:00:00Z',latest:{verified:true,action:'none',summary:'ok'}};
describe('automation campaign health',()=>{
 it('requires the newest run to be verified and successful',()=>{
  expect(isAutomationCampaignHealthy(campaign,'2026-07-30T05:55:00Z',now)).toBe(true);
  expect(isAutomationCampaignHealthy({...campaign,latest:{...campaign.latest,verified:false}},'2026-07-30T05:55:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy({...campaign,lastStatus:'error'},'2026-07-30T05:55:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy({...campaign,latest:{...campaign.latest,action:'aborted',summary:'everflow_api_key_missing'}},'2026-07-30T05:55:00Z',now)).toBe(false);
  expect(automationCampaignLabel(campaign,'2026-07-30T05:55:00Z',now)).toBe('LIVE');
  expect(automationCampaignLabel({...campaign,latest:{...campaign.latest,verified:false}},'2026-07-30T05:55:00Z',now)).toBe('FEHLER');
  expect(automationCampaignLabel({...campaign,enabled:false},'2026-07-30T05:55:00Z',now)).toBe('PAUSIERT');
  expect(isAutomationCampaignHealthy({...campaign,lastRunAt:'2026-07-30T02:00:00Z'},'2026-07-30T05:55:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy({...campaign,nextRunAt:'2026-07-30T05:00:00Z'},'2026-07-30T05:55:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy(campaign,'2026-07-30T02:00:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy(campaign,undefined,now)).toBe(false);
  expect(isAutomationCampaignHealthy(campaign,'2026-07-30T06:10:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy({...campaign,lastRunAt:'2099-01-01T00:00:00Z'},'2026-07-30T06:00:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy({...campaign,nextRunAt:'2099-01-01T00:00:00Z'},'2026-07-30T06:00:00Z',now)).toBe(false);
  expect(isAutomationCampaignHealthy({...campaign,lastRunAt:'2026-07-30T06:00:00Z',nextRunAt:'2026-07-30T05:56:00Z'},'2026-07-30T06:00:00Z',now)).toBe(false);
  const dashboard=readFileSync(new URL('../app/automation/AutomationDashboard.tsx',import.meta.url),'utf8');
  expect(dashboard).not.toContain('<b>Automatische Rotation ist live</b>');
 });
});