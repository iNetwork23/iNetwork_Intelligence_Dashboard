import{readFileSync}from'node:fs';
import{join}from'node:path';
import{beforeEach,describe,expect,it,vi}from'vitest';
import{parseAccessMetadata}from'./rbac';
import{sourceCandidateBlockKey,sourceCandidateHref}from'./source-candidate-link';
import type{SourceCandidate,SourceCandidatesSnapshot}from'./source-candidates';
import type{SourceBlockRecord}from'./source-blocks';

vi.mock('server-only',()=>({}));
const cacheSpy=vi.fn();
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown,keys:string[],options:unknown)=>{cacheSpy(keys,options);return load}}));
const loadSourceCandidates=vi.fn(),loadBlockIndex=vi.fn();
vi.mock('./source-candidates',()=>({loadSourceCandidates:(...a:unknown[])=>loadSourceCandidates(...a)}));
vi.mock('./block-effects',()=>({loadBlockIndex:(...a:unknown[])=>loadBlockIndex(...a)}));

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const access=(role:'admin'|'partner'|'employee'|'read_only',extra:{grants?:string[];denials?:string[]}={})=>parseAccessMetadata({role,status:'active',grants:extra.grants??[],denials:extra.denials??[],version:1,scopes:{}});
const candidate=(x:Partial<SourceCandidate>&{mainValue:string|null}):SourceCandidate=>({affiliateId:'376',affiliate:'Partner 376',offerId:'8',offer:'Flirt DE',offerUrlId:'2766',offerUrl:'LP 2766',trafficMode:'tracked',level:'main_source',subValue:null,action:'AUSSCHALTEN',severity:'critical',reason:'0 SOIs bei 150 Klicks',clicks:150,sois:0,firstSales:0,rebills:0,revenue:0,payout:0,profit:0,lastLeadDate:null,leadStatus:'Kein Lead gefunden',...x});
const record=(row:SourceCandidate,status:SourceBlockRecord['status'],effectiveAt='2026-09-01T10:15:00Z'):SourceBlockRecord=>({id:`blk-${row.mainValue}-${status}`,affiliateId:Number(row.affiliateId),affiliateName:row.affiliate,offerId:Number(row.offerId),offerName:row.offer,originCampaignId:null,trafficMode:row.trafficMode,level:row.level,mainField:row.trafficMode==='api'?'adv1':'source_id',mainValue:row.mainValue,subField:row.trafficMode==='api'?'adv2':'sub1',subValue:row.subValue,variables:[],reason:'',status,effectiveAt,createdAt:effectiveAt,createdBy:'admin',updatedAt:effectiveAt,updatedBy:'admin',everflowSettingId:status==='active'?700:null,lastVerifiedAt:null,error:status==='error'?'Everflow-Antwort nicht bestätigt':null});
const index=(entries:Array<[SourceCandidate,SourceBlockRecord['status']]>)=>new Map(entries.map(([row,status])=>[sourceCandidateBlockKey(row),record(row,status)]));
const rows={
 worst:candidate({mainValue:'worst',profit:-120.5,sois:4,clicks:900,leadStatus:'Vermutlich inaktiv'}),
 bad:candidate({mainValue:'bad',profit:-60,sois:1,clicks:400}),
 mild:candidate({mainValue:'mild',profit:-12.25,sois:0,clicks:150}),
 tiny:candidate({mainValue:'tiny',profit:-1,sois:0,clicks:120}),
 watch:candidate({mainValue:'watch',action:'BEOBACHTEN',severity:'warning',profit:-300,sois:3,clicks:50}),
 star:candidate({mainValue:'star',action:'SKALIEREN',severity:'positive',profit:250,sois:40,clicks:1000,leadStatus:'Heute aktiv'}),
 good:candidate({mainValue:'good',action:'SKALIEREN',severity:'positive',profit:90,sois:20,clicks:500}),
 ok:candidate({mainValue:'ok',action:'SKALIEREN',severity:'positive',profit:30,sois:9,clicks:200}),
 small:candidate({mainValue:'small',action:'SKALIEREN',severity:'positive',profit:5,sois:3,clicks:80}),
 sub:candidate({mainValue:'net',subValue:'pl-7',level:'sub_source',trafficMode:'api',profit:-40,sois:2,clicks:300}),
};
const snapshot=(overrides:Partial<SourceCandidatesSnapshot>={}):SourceCandidatesSnapshot=>({version:1,range:{from:'2026-08-06',to:'2026-09-04'},generatedAt:'2026-09-04T10:47:12.000Z',affiliates:12,affiliatesProcessed:12,coverageComplete:true,rows:Object.values(rows),...overrides});

beforeEach(()=>{vi.clearAllMocks()});

describe('Leitstand ranking',()=>{
 it('ranks the three biggest loss sources by ascending profit among AUSSCHALTEN candidates only',async()=>{
  const{rankLosses}=await import('./leitstand');
  expect(rankLosses(Object.values(rows)).map(row=>row.mainValue)).toEqual(['worst','bad','net']);
  expect(rankLosses(Object.values(rows),10).map(row=>row.mainValue)).toEqual(['worst','bad','net','mild','tiny']);
 });
 it('ranks the three best scaling candidates by descending profit',async()=>{
  const{rankWinners}=await import('./leitstand');
  expect(rankWinners(Object.values(rows)).map(row=>row.mainValue)).toEqual(['star','good','ok']);
 });
 it('breaks profit ties deterministically by SOIs, then identity',async()=>{
  const{rankLosses}=await import('./leitstand');
  const a=candidate({mainValue:'a',profit:-10,sois:3}),b=candidate({mainValue:'b',profit:-10,sois:9});
  expect(rankLosses([a,b]).map(row=>row.mainValue)).toEqual(['b','a']);
  expect(rankLosses([b,a]).map(row=>row.mainValue)).toEqual(['b','a']);
 });
});

describe('Leitstand block status via block index',()=>{
 it('marks an active record as blocked since its effective date and links unblocked rows to their /sources row',async()=>{
  const{leitstandRow,formatBlockSince}=await import('./leitstand');
  const blocked=leitstandRow(rows.worst,index([[rows.worst,'active']])),open=leitstandRow(rows.bad,index([[rows.worst,'active']]));
  expect(blocked.block).toEqual({state:'active',since:'2026-09-01T10:15:00Z',id:'blk-worst-active'});
  expect(formatBlockSince(blocked.block.since!)).toBe('Gesperrt seit 01.09.2026');
  expect(open.block).toEqual({state:'none',since:null,id:null});
  expect(open.href).toBe(sourceCandidateHref(rows.bad,'30d'));
  expect(open.href).toMatch(/^\/sources\?range=30d&open=/);
  expect(blocked.title).toBe('Partner 376 · Flirt DE');
  expect(blocked.source).toBe('worst');
 });
 it('treats pending and error records as running interventions, inactive records as open',async()=>{
  const{leitstandRow}=await import('./leitstand');
  const map=index([[rows.bad,'pending'],[rows.mild,'error'],[rows.tiny,'inactive']]);
  expect(leitstandRow(rows.bad,map).block.state).toBe('pending');
  expect(leitstandRow(rows.mild,map).block.state).toBe('error');
  expect(leitstandRow(rows.tiny,map).block.state).toBe('inactive');
 });
 it('lets an active main-source block cover its sub-source candidates and keeps the rest leaf non-blockable',async()=>{
  const{leitstandRow,countLeitstand}=await import('./leitstand');
  const main=candidate({mainValue:'net',trafficMode:'api'}),sub=candidate({mainValue:'net',subValue:'pl-9',level:'sub_source',trafficMode:'api',profit:-40}),rest=candidate({mainValue:'net',subValue:null,level:'sub_source',trafficMode:'api',profit:-5});
  const covered=leitstandRow(sub,index([[main,'active']]));
  expect(covered.block).toEqual({state:'active',since:'2026-09-01T10:15:00Z',id:'blk-net-active'});
  expect(covered.blockable).toBe(true);
  expect(leitstandRow(sub,index([[main,'inactive']])).block.state).toBe('inactive');
  expect(leitstandRow(sub,index([[sub,'inactive'],[main,'active']])).block.state).toBe('active');
  const restRow=leitstandRow(rest,new Map());
  expect(restRow.blockable).toBe(false);expect(restRow.block.state).toBe('none');
  expect(countLeitstand([sub,rest],index([[main,'active']]))).toEqual({openKill:0,activeBlocks:1,incidents:0});
  expect(countLeitstand([sub,rest],new Map())).toEqual({openKill:1,activeBlocks:0,incidents:0});
 });
 it('maps API sub-sources onto adv1/adv2 identities like the block index does',async()=>{
  const{leitstandRow}=await import('./leitstand');
  const row=leitstandRow(rows.sub,index([[rows.sub,'active']]));
  expect(row.block.state).toBe('active');
  expect(row.source).toBe('net → pl-7');
 });
});

describe('Rollup staleness',()=>{
 it('warns when the rollup is older than two hours and stays quiet otherwise',async()=>{
  const{rollupStaleWarning,ROLLUP_STALE_AFTER_MS}=await import('./leitstand');
  const now=new Date('2026-09-04T15:00:00Z');
  expect(rollupStaleWarning('2026-09-04T13:47:00Z',now)).toBeNull();
  expect(rollupStaleWarning('2026-09-04T10:47:00Z',now)).toBe('Rollup ist 4 Stunden alt – der Rollups-Cron (stündlich um :47) hat seitdem nicht geschrieben.');
  expect(rollupStaleWarning('kaputt',now)).toBeNull();
  expect(ROLLUP_STALE_AFTER_MS).toBe(7_200_000);
 });
});

describe('Leitstand counters',()=>{
 it('counts open AUSSCHALTEN candidates without active or running blocks, active blocks and incidents',async()=>{
  const{countLeitstand}=await import('./leitstand');
  const map=index([[rows.worst,'active'],[rows.bad,'pending'],[rows.mild,'error'],[rows.tiny,'inactive'],[rows.star,'active']]);
  expect(countLeitstand(Object.values(rows),map)).toEqual({openKill:2,activeBlocks:2,incidents:2});
 });
 it('counts every AUSSCHALTEN candidate as open when nothing is blocked',async()=>{
  const{countLeitstand}=await import('./leitstand');
  expect(countLeitstand(Object.values(rows),new Map())).toEqual({openKill:5,activeBlocks:0,incidents:0});
 });
});

describe('Leitstand model',()=>{
 it('returns null for a missing snapshot and a neutral hint naming the hourly :47 rollup',async()=>{
  const{buildLeitstand,LEITSTAND_ROLLUP_PENDING}=await import('./leitstand');
  expect(buildLeitstand(null,new Map())).toBeNull();
  expect(LEITSTAND_ROLLUP_PENDING).toBe('Quellen-Rollup steht noch aus (läuft stündlich um :47)');
 });
 it('describes the rollup provenance and warns when coverage is incomplete',async()=>{
  const{buildLeitstand,describeRollup}=await import('./leitstand');
  const complete=buildLeitstand(snapshot(),new Map())!;
  expect(complete.losses.map(row=>row.source)).toEqual(['worst','bad','net → pl-7']);
  expect(complete.winners.map(row=>row.source)).toEqual(['star','good','ok']);
  expect(complete.counters).toEqual({openKill:5,activeBlocks:0,incidents:0});
  expect(describeRollup(complete)).toEqual({source:'Rollup vom 04.09.2026, 12:47 · 12 von 12 Partnern',warning:null});
  const partial=buildLeitstand(snapshot({affiliatesProcessed:7,coverageComplete:false}),new Map())!;
  expect(describeRollup(partial).warning).toBe('Rollup unvollständig: 7 von 12 Partnern ausgewertet – Zeitbudget erreicht oder Partner übersprungen.');
 });
 it('formats amounts with finance.view and falls back to volume without it',async()=>{
  const{leitstandRow,leitstandAmount}=await import('./leitstand');
  const row=leitstandRow(rows.worst,new Map());
  expect(leitstandAmount(row,true).replace(/\u00a0/g,' ')).toBe('-120,50 €');
  expect(leitstandAmount(row,false)).toBe('4 SOIs · 900 Klicks');
  expect(leitstandAmount(row,false)).not.toContain('€');
 });
});

describe('Leitstand access',()=>{
 it('is hidden for partners and shown for internal roles with dashboard.view',async()=>{
  const{mayViewLeitstand,mayBlockSources}=await import('./leitstand');
  expect(mayViewLeitstand(access('partner'))).toBe(false);
  expect(mayViewLeitstand(access('admin'))).toBe(true);
  expect(mayViewLeitstand(access('read_only'))).toBe(true);
  expect(mayViewLeitstand(access('admin',{denials:['dashboard.view']}))).toBe(false);
  expect(mayBlockSources(access('partner'))).toBe(false);
  expect(mayBlockSources(access('admin'))).toBe(true);
  expect(mayBlockSources(access('read_only'))).toBe(false);
 });
 it('never renders the section or shell counters for partners in the page and shell sources',()=>{
  const page=read('src/app/page.tsx'),shell=read('src/app/components/DashboardShell.tsx'),section=read('src/app/components/LeitstandSection.tsx');
  expect(page).toContain('<LeitstandSection');
  expect(page).toContain("user.access.role!=='partner'&&<LeitstandSection");
  expect(page.indexOf('<DataStatusBar')).toBeLessThan(page.indexOf('<LeitstandSection'));
  expect(page.indexOf('<LeitstandSection')).toBeLessThan(page.indexOf('<section className="kpis">'));
  expect(shell).toContain("user.access.role!=='partner'&&can(user.access,'dashboard.view')");
  expect(shell).toContain('loadLeitstandCounters');
  expect(section).not.toContain("'use client'");
  expect(section).not.toContain('useState');
  for(const marker of['Leitstand · letzte 30 Tage','Vergütung sperren','formatBlockSince(','LEITSTAND_ROLLUP_PENDING','Laufende Eingriffe','/source-blocks','/sources?range=30d','mayBlockSources'])expect(section).toContain(marker);
  expect(read('src/lib/leitstand.ts')).toContain('`Gesperrt seit ${');
  expect(section).not.toContain('SourceBlockButton');
 });
});

describe('Leitstand loaders',()=>{
 it('loads snapshot and block index for the 30-day reporting range and never throws',async()=>{
  const{loadLeitstand}=await import('./leitstand');
  loadSourceCandidates.mockResolvedValue(snapshot());loadBlockIndex.mockResolvedValue(index([[rows.worst,'active']]));
  const view=await loadLeitstand(access('admin'),new Date('2026-09-04T12:00:00Z'));
  expect(loadSourceCandidates).toHaveBeenCalledWith({from:'2026-08-06',to:'2026-09-04'},expect.objectContaining({role:'admin'}));
  expect(view.model?.losses[0].block.state).toBe('active');
  expect(view.failed).toBe(false);expect(view.blockIndexUnavailable).toBe(false);
 });
 it('falls back to the pending hint when the snapshot loader fails and keeps rows when only the block index fails',async()=>{
  const{loadLeitstand}=await import('./leitstand');
  loadSourceCandidates.mockRejectedValueOnce(new Error('supabase down'));loadBlockIndex.mockResolvedValue(new Map());
  const failed=await loadLeitstand(access('admin'));
  expect(failed).toEqual({model:null,failed:true,blockIndexUnavailable:false});
  loadSourceCandidates.mockResolvedValueOnce(snapshot());loadBlockIndex.mockRejectedValueOnce(new Error('store down'));
  const degraded=await loadLeitstand(access('admin'));
  expect(degraded.model?.losses).toHaveLength(3);expect(degraded.blockIndexUnavailable).toBe(true);expect(degraded.failed).toBe(false);
 });
 it('bundles the shell counters in one cache entry tagged for candidates and blocks',async()=>{
  const{loadLeitstandCounters}=await import('./leitstand');
  loadSourceCandidates.mockResolvedValue(snapshot());loadBlockIndex.mockResolvedValue(index([[rows.worst,'active'],[rows.bad,'error']]));
  const counters=await loadLeitstandCounters(new Date('2026-09-04T12:00:00Z'));
  expect(counters).toEqual({openKill:3,activeBlocks:1,incidents:1});
  expect(cacheSpy).toHaveBeenCalledTimes(1);
  expect(cacheSpy.mock.calls[0][0]).toEqual(['leitstand-counters-v1','2026-08-06','2026-09-04']);
  const options=cacheSpy.mock.calls[0][1] as{revalidate:number;tags:string[]};
  expect(options.revalidate).toBeGreaterThanOrEqual(60);expect(options.revalidate).toBeLessThanOrEqual(120);
  expect(options.tags.sort()).toEqual(['source-blocks','source-candidates']);
  expect(loadSourceCandidates).toHaveBeenCalledWith({from:'2026-08-06',to:'2026-09-04'},expect.objectContaining({role:'admin'}));
 });
 it('yields empty counters while the rollup is pending',async()=>{
  const{loadLeitstandCounters}=await import('./leitstand');
  loadSourceCandidates.mockResolvedValue(null);loadBlockIndex.mockResolvedValue(index([[rows.worst,'active']]));
  expect(await loadLeitstandCounters()).toEqual({openKill:0,activeBlocks:1,incidents:0});
 });
});

describe('Leitstand navigation markers',()=>{
 it('adds the Quellen entry directly under Home for internal roles and renders counters as prop-driven badges',()=>{
  const sidebar=read('src/app/components/AdminSidebar.tsx'),shell=read('src/app/components/DashboardShell.tsx');
  expect(sidebar).toContain('const PRIMARY_ROUTES=["/","/sources"');
  expect(sidebar).toContain('{href:"/sources",label:"Quellen"');
  expect(sidebar).toContain('show:props.maySources');
  expect(sidebar).toContain('sidebarBadge');
  expect(sidebar).toContain('badge:props.sourcesBadge');
  expect(sidebar).toContain('badge:props.sourceBlocksBadge');
  expect(sidebar).not.toMatch(/fetch\(/);
  expect(shell).toContain('maySources={mayLeitstand}');
  expect(shell).toContain('sourcesBadge={counters?.openKill??null}');
  expect(shell).toContain('sourceBlocksBadge={counters?.activeBlocks??null}');
  expect(shell).toMatch(/try\{counters=await loadLeitstandCounters\(\)\}catch/);
 });
 it('keeps the mobile control view single-column and compact',()=>{
  const css=read('src/app/globals.css');
  for(const marker of['.leitstand{','.leitstandGrid{','.leitstandRow{','.leitstandCounters{','.sidebarBadge{'])expect(css).toContain(marker);
  expect(css).toMatch(/@media\(max-width:760px\)\{[^@]*\.leitstandGrid\{[^}]*grid-template-columns:1fr/);
 });
});
