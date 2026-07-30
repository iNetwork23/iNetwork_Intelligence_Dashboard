import {describe,expect,it} from 'vitest';
import {MemorySecurityStore} from './security';
import {commitAutomationTarget,createAutomationConfiguration,getAutomationConfiguration,listAutomationConfigurations,recordAutomationRun,transitionAutomation,updateAutomationConfiguration,updateAutomationConfigurationAuthorized} from './automation-store';
import {normalizeAutomationDraft} from './automation-config';

const draft=()=>normalizeAutomationDraft({name:'Test',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',objective:'sale_first',offers:[{offerId:57,offerName:'Singles69',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:1,offerUrlName:'A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:2,offerUrlName:'B',status:'active'}]}],schedule:{intervalMinutes:120},thresholds:{targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:336,minIndependentFirstSales:3,minIndependentPayers:3},weights:{mode:'equal'}},new Date('2026-07-30T12:00:00Z'));

describe('automation store',()=>{
 it('persists versioned configurations and rejects stale updates',async()=>{
  const store=new MemorySecurityStore(),created=await createAutomationConfiguration(store,draft(),'actor-1');
  expect((await getAutomationConfiguration(store,created.id))?.version).toBe(1);
  const updated=await updateAutomationConfiguration(store,{...created,name:'Neu'},1,'actor-2');
  expect(updated.version).toBe(2);expect(updated.updatedBy).toBe('actor-2');
  await expect(updateAutomationConfiguration(store,{...updated,name:'Stale'},1,'actor-3')).rejects.toThrow('zwischenzeitlich geändert');
  expect((await listAutomationConfigurations(store)).map(x=>x.name)).toEqual(['Neu']);
 });

 it('authorizes the exact normalized update after reloading current state inside the automation lease',async()=>{
  const store=new MemorySecurityStore(),created=await createAutomationConfiguration(store,draft(),'actor'),requested={...created,name:'Fresh exact',affiliateId:999};
  await expect(updateAutomationConfigurationAuthorized(store,requested,created.version,'actor',async(candidate,current)=>{expect(candidate.name).toBe('Fresh exact');expect(current.version).toBe(created.version);throw new Error('scope narrowed')})).rejects.toThrow('scope narrowed');
  expect((await getAutomationConfiguration(store,created.id))?.affiliateId).toBe(436);
 });

 it('requires a completed dry run before a draft can request live approval',async()=>{
  const store=new MemorySecurityStore(),created=await createAutomationConfiguration(store,draft(),'actor');
  await expect(transitionAutomation(store,created.id,created.version,'request_live','actor')).rejects.toThrow(/dry/i);
  expect((await getAutomationConfiguration(store,created.id))?.status).toBe('draft');
 });

 it('never enables writes without an explicit verified live preflight',async()=>{
  const store=new MemorySecurityStore(),created=await createAutomationConfiguration(store,draft(),'actor');
  const dry=await transitionAutomation(store,created.id,1,'dry_run','actor',{preflightVerified:false});
  expect(dry.status).toBe('dry_run');expect(dry.writeEnabled).toBe(false);
  const awaiting=await transitionAutomation(store,created.id,2,'request_live','actor',{preflightVerified:false});
  expect(awaiting.status).toBe('awaiting_live');expect(awaiting.writeEnabled).toBe(false);
  await expect(transitionAutomation(store,created.id,3,'activate_live','actor',{preflightVerified:false})).rejects.toThrow('Preflight');
  const active=await transitionAutomation(store,created.id,3,'activate_live','actor',{preflightVerified:true,baselineFingerprint:'sha256:abc'});
  expect(active.status).toBe('active');expect(active.writeEnabled).toBe(true);expect(active.acceptedBaselineFingerprint).toBe('sha256:abc');
  const paused=await transitionAutomation(store,created.id,4,'pause','actor');expect(paused.status).toBe('paused');expect(paused.writeEnabled).toBe(false);
 });

 it('commits only verified routing targets and permanently removes outgoing LPs from the candidate queue',async()=>{
  const store=new MemorySecurityStore(),base=draft();base.offers[0].landingpages.push({familyKey:'c',familyName:'C',offerUrlId:3,offerUrlName:'C',status:'active',selection:'candidate'});
  const created=await createAutomationConfiguration(store,base,'actor');
  const dry=await transitionAutomation(store,created.id,1,'dry_run','actor');
  const awaiting=await transitionAutomation(store,created.id,dry.version,'request_live','actor');
  const active=await transitionAutomation(store,created.id,awaiting.version,'activate_live','actor',{preflightVerified:true,baselineFingerprint:'sha256:before'});
  const target=[{...active.slots[0],offerUrlId:3,familyKey:'c',familyName:'C',offerUrlName:'C'},{...active.slots[1]}];
  const committed=await commitAutomationTarget(store,active.id,active.version,target,'sha256:after','scheduler');
  expect(committed.slots.map(x=>x.offerUrlId)).toEqual([3,2]);
  expect(committed.offers[0].landingpages.find(x=>x.offerUrlId===1)?.selection).toBe('excluded');
  expect(committed.offers[0].landingpages.find(x=>x.offerUrlId===3)?.selection).toBe('active');
  expect(committed.acceptedBaselineFingerprint).toBe('sha256:after');
 });

 it('stores append-only run evidence without overwriting prior runs',async()=>{
  const store=new MemorySecurityStore(),created=await createAutomationConfiguration(store,draft(),'actor');
  await recordAutomationRun(store,created.id,{runId:'r1',startedAt:'2026-07-30T12:00:00Z',completedAt:'2026-07-30T12:01:00Z',mode:'dry_run',decision:'hold',writesPerformed:0,verified:true,summary:'Noch nicht reif'});
  await recordAutomationRun(store,created.id,{runId:'r2',startedAt:'2026-07-30T14:00:00Z',completedAt:'2026-07-30T14:01:00Z',mode:'dry_run',decision:'rotate',writesPerformed:0,verified:true,summary:'Rotation simuliert'});
  const current=await getAutomationConfiguration(store,created.id);
  expect(current?.runs.map(x=>x.runId)).toEqual(['r2','r1']);
 });
});
