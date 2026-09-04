import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it,vi}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/fraud',useSearchParams:()=>new URLSearchParams('period=30d'),useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import FraudBlockCell from'@/app/fraud/FraudBlockCell';
import{canAccessFraud,FRAUD_ACCESS_HINT}from'./fraud-access';
import{FRAUD_NOT_BLOCKABLE_HINT,fraudRowBlockIdentity,fraudRowBlockState,fraudRowRangeParams,isFraudRowOpen,type FraudBlockRow}from'./fraud-block-row';
import{sourceBlockMarkerIndex}from'./source-block-markers';
import{sourceBlockIdentityKey,type SourceBlockRecord}from'./source-blocks';
import{STANDARD_ROLES,type AccessMetadata,type StandardRole}from'./rbac';
import{ACTION_WORDS,STATE_WORDS}from'./verdict-vocabulary';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const scopes=()=>({affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]});
const access=(patch:Partial<AccessMetadata>={}):AccessMetadata=>({role:'super_admin',status:'active',grants:[],denials:[],scopes:scopes(),version:1,...patch});
/** Fraud-Zeile mit vollständiger Quellen-Identität (Smartlink, source_id/sub1). */
const row=(over:Partial<FraudBlockRow>={}):FraudBlockRow=>({affiliateId:'436',affiliateName:'Partner Alpha',offerId:'12',offerName:'Offer Zwölf',offerUrlId:'7',trafficMode:'tracked_smartlink',source:'fb-camp',subSource:'creative-17',sourceDimension:'source_id',subSourceDimension:'sub1',metrics:{clicks:900,sois:60,firstSales:0,rebills:0,coinEvents:0,payout:120,revenue:10,profit:-110},...over});
const record=(over:Partial<SourceBlockRecord>={}):SourceBlockRecord=>({id:'blk-1',status:'active',affiliateId:436,affiliateName:'Partner Alpha',offerId:12,offerName:'Offer Zwölf',originCampaignId:null,trafficMode:'tracked',level:'sub_source',mainField:'source_id',mainValue:'fb-camp',subField:'sub1',subValue:'creative-17',variables:[],reason:'',effectiveAt:'2026-09-01T10:00:00.000Z',createdAt:'2026-09-01T10:00:00.000Z',createdBy:'u1',updatedAt:'2026-09-01T10:00:00.000Z',updatedBy:'u1',everflowSettingId:1,lastVerifiedAt:null,error:null,...over});
const indexOf=(...records:SourceBlockRecord[])=>sourceBlockMarkerIndex(new Map(records.map(item=>[sourceBlockIdentityKey(item),item])));
const render=(item:FraudBlockRow,index:ReturnType<typeof indexOf>|undefined,options:{mayBlock?:boolean;finance?:boolean;statusUnknown?:boolean}={})=>renderToStaticMarkup(<FraudBlockCell row={item} state={fraudRowBlockState(item,index)} mayBlock={options.mayBlock??true} finance={options.finance??true} rangeParams="period=30d" statusUnknown={options.statusUnknown??false}/>);

describe('Fraud-Gate (D2): interne, ungescopte Rolle mit landingpages.manage, api.manage und statistics.view',()=>{
 it('lässt super_admin und admin ohne Scopes zu, employee nur mit beiden Sperr-Rechten, partner und read_only nie',()=>{
  expect(canAccessFraud(access())).toBe(true);
  expect(canAccessFraud(access({role:'admin'}))).toBe(true);
  expect(canAccessFraud(access({role:'employee'}))).toBe(false);
  expect(canAccessFraud(access({role:'employee',grants:['landingpages.manage','api.manage']}))).toBe(true);
  expect(canAccessFraud(access({role:'employee',grants:['landingpages.manage']}))).toBe(false);
  expect(canAccessFraud(access({role:'partner',grants:['landingpages.manage','api.manage']}))).toBe(false);
  expect(canAccessFraud(access({role:'read_only'}))).toBe(false);
  expect(canAccessFraud(access({role:'read_only',grants:['landingpages.manage','api.manage']}))).toBe(true);
 });
 it('verlangt keine finance.view fürs Gate, aber Ungescoptheit und statistics.view',()=>{
  expect(canAccessFraud(access({denials:['finance.view']}))).toBe(true);
  expect(canAccessFraud(access({denials:['statistics.view']}))).toBe(false);
  expect(canAccessFraud(access({status:'blocked'}))).toBe(false);
  for(const key of Object.keys(scopes())as Array<keyof AccessMetadata['scopes']>)expect(canAccessFraud(access({scopes:{...scopes(),[key]:['restricted']}}))).toBe(false);
  expect(FRAUD_ACCESS_HINT).toContain('landingpages.manage');expect(FRAUD_ACCESS_HINT).toContain('api.manage');expect(FRAUD_ACCESS_HINT).toContain('statistics.view');
 });
 it('Sidebar und Seite nutzen dieselbe Regel – kein Sidebar-Eintrag endet für eine Standardrolle in 403 (Abnahme G)',()=>{
  const shell=read('src/app/components/DashboardShell.tsx'),page=read('src/app/fraud/page.tsx'),service=read('src/lib/fraud-service.ts');
  expect(shell).toContain('const mayFraud=canAccessFraud(user.access)');
  expect(page).toContain('if(!canAccessFraud(user.access))');
  expect(service).toContain('if(!canAccessFraud(access))');
  expect(page).toContain('permission={FRAUD_ACCESS_HINT}');
  for(const role of Object.keys(STANDARD_ROLES)as StandardRole[]){const meta=access({role});expect(canAccessFraud(meta)).toBe(role==='super_admin'||role==='admin')}
 });
});

describe('Quellen-Identität der Fraud-Zeile → Sperr-Identität des SourceBlockButton',()=>{
 it('bildet Smartlink/Direct auf tracked (source_id/sub1) und Clickless API auf api (adv1/adv2) ab',()=>{
  expect(fraudRowBlockIdentity(row())).toEqual({affiliateId:'436',offerId:'12',trafficMode:'tracked',level:'sub_source',mainValue:'fb-camp',subValue:'creative-17'});
  expect(fraudRowBlockIdentity(row({trafficMode:'tracked_direct'}))?.trafficMode).toBe('tracked');
  // Klick-ID-artige Unterquellen kollabiert der Affiliate-Bereich (canonicalTrackedSub) – hier nicht sperrbar, sonst entstünde eine wirkungslose Einzel-ID-Sperre.
  expect(fraudRowBlockIdentity(row({subSource:'9f8e7d6c5b4a39281706f5e4d3c2b1a0'}))).toBeNull();
  expect(fraudRowBlockState(row({subSource:'9f8e7d6c5b4a39281706f5e4d3c2b1a0'}),undefined).kind).toBe('external');
  expect(fraudRowBlockIdentity(row({trafficMode:'clickless_api',sourceDimension:'adv1',subSourceDimension:'adv2'}))).toEqual({affiliateId:'436',offerId:'12',trafficMode:'api',level:'sub_source',mainValue:'fb-camp',subValue:'creative-17'});
 });
 it('liefert null ohne vollständige Identität: unbekannter Pfad, sub2–sub5, Platzhalter-Unterquelle, ungültige IDs, Dimension passt nicht zum Modus',()=>{
  expect(fraudRowBlockIdentity(row({trafficMode:'unknown',sourceDimension:'unknown',subSourceDimension:'unknown'}))).toBeNull();
  expect(fraudRowBlockIdentity(row({subSourceDimension:'sub2'}))).toBeNull();
  expect(fraudRowBlockIdentity(row({subSourceDimension:'unknown'}))).toBeNull();
  expect(fraudRowBlockIdentity(row({subSource:'Nicht übermittelt'}))).toBeNull();
  expect(fraudRowBlockIdentity(row({subSource:'  '}))).toBeNull();
  expect(fraudRowBlockIdentity(row({affiliateId:'0'}))).toBeNull();
  expect(fraudRowBlockIdentity(row({offerId:'abc'}))).toBeNull();
  expect(fraudRowBlockIdentity(row({trafficMode:'clickless_api'}))).toBeNull();
 });
 it('eine fehlende Hauptquelle bleibt sperrbar (Variable „nicht vorhanden“ wie im Affiliate-Bereich)',()=>{
  expect(fraudRowBlockIdentity(row({source:'Nicht übermittelt'}))).toEqual(expect.objectContaining({mainValue:null,subValue:'creative-17',level:'sub_source'}));
 });
});

describe('Sperrstatus je Fraud-Zeile aus dem Sperr-Index',()=>{
 it('ist offen ohne Marker, gesperrt mit aktivem Record, in Verifizierung bei pending und unklar bei error',()=>{
  expect(fraudRowBlockState(row(),indexOf()).kind).toBe('open');
  expect(fraudRowBlockState(row(),undefined).kind).toBe('open');
  const blocked=fraudRowBlockState(row(),indexOf(record()));
  expect(blocked.kind).toBe('blocked');if(blocked.kind==='blocked'){expect(blocked.text).toBe(STATE_WORDS.blockedSince('01.09.2026'));expect(blocked.marker.status).toBe('active')}
  const pending=fraudRowBlockState(row(),indexOf(record({status:'pending'})));expect(pending.kind).toBe('blocked');if(pending.kind==='blocked')expect(pending.text).toBe(STATE_WORDS.verifying);
  const unclear=fraudRowBlockState(row(),indexOf(record({status:'error'})));expect(unclear.kind).toBe('unclear');if(unclear.kind==='unclear')expect(unclear.text).toBe(STATE_WORDS.unclear);
  expect(fraudRowBlockState(row(),indexOf(record({status:'inactive'}))).kind).toBe('open');
 });
 it('eine aktive Hauptquellen-Sperre deckt die Unterquellen-Zeile ab; Zeilen ohne Identität sind extern',()=>{
  const main=record({id:'blk-main',level:'main_source',subValue:null});
  expect(fraudRowBlockState(row(),indexOf(main)).kind).toBe('blocked');
  expect(fraudRowBlockState(row({trafficMode:'unknown',sourceDimension:'unknown',subSourceDimension:'unknown'}),indexOf(main)).kind).toBe('external');
 });
 it('„nur ungesperrte“ blendet aktive und pending Sperren aus, unklare und offene bleiben',()=>{
  expect(isFraudRowOpen(fraudRowBlockState(row(),indexOf(record())))).toBe(false);
  expect(isFraudRowOpen(fraudRowBlockState(row(),indexOf(record({status:'pending'}))))).toBe(false);
  expect(isFraudRowOpen(fraudRowBlockState(row(),indexOf(record({status:'error'}))))).toBe(true);
  expect(isFraudRowOpen(fraudRowBlockState(row(),indexOf()))).toBe(true);
  expect(isFraudRowOpen(fraudRowBlockState(row({trafficMode:'unknown'}),indexOf()))).toBe(true);
 });
 it('trägt den globalen Zeitraum in den Deep-Link (D5)',()=>{
  expect(fraudRowRangeParams('30d',{from:'2026-08-01',to:'2026-08-31'})).toBe('period=30d');
  expect(fraudRowRangeParams('custom',{from:'2026-08-01',to:'2026-08-31'})).toBe('period=custom&from=2026-08-01&to=2026-08-31');
 });
});

describe('FraudBlockCell: Hohes Risiko → Sperre in höchstens zwei Klicks (Abnahme G)',()=>{
 it('rendert für eine offene Zeile mit Sperr-Recht den SourceBlockButton mit Kennzahlen (Klick 1 öffnet den Dialog, Klick 2 bestätigt)',()=>{
  const html=render(row(),indexOf());
  expect(html).toContain(ACTION_WORDS.block);
  expect(html).toContain(`Sub1 creative-17: ${ACTION_WORDS.block}`);
  expect(html).toContain('sourceBlockIconButton');
  expect(html).not.toContain(FRAUD_NOT_BLOCKABLE_HINT);
 });
 it('zeigt gesperrte Zeilen als Marker mit Link zur Sperrliste und ohne Button',()=>{
  const html=render(row(),indexOf(record()));
  expect(html).toContain('Gesperrt seit 01.09.2026');expect(html).toContain('href="/source-blocks"');
  expect(html).not.toContain('sourceBlockIconButton');expect(html).not.toContain(ACTION_WORDS.block);
  const pending=render(row(),indexOf(record({status:'pending'})));expect(pending).toContain(STATE_WORDS.verifying);expect(pending).not.toContain('sourceBlockIconButton');
 });
 it('zeigt unklare Sperren als Marker und behält den Button (Zweitversuch, Abnahme C)',()=>{
  const html=render(row(),indexOf(record({status:'error'})));
  expect(html).toContain(STATE_WORDS.unclear);expect(html).toContain('sourceBlockIconButton');
 });
 it('verlinkt Zeilen ohne vollständige Identität in den Affiliate-Bereich (sourceOpen + Anker) statt eines Buttons',()=>{
  const html=render(row({trafficMode:'unknown',sourceDimension:'unknown',subSourceDimension:'unknown'}),indexOf());
  expect(html).toContain(FRAUD_NOT_BLOCKABLE_HINT);
  expect(html).toContain('href="/affiliates?affiliate=436&amp;offer=12&amp;period=30d&amp;sourceOpen=url-7#url-7"');
  expect(html).not.toContain('sourceBlockIconButton');
  const rest=render(row({subSource:'Nicht übermittelt'}),indexOf());expect(rest).toContain(FRAUD_NOT_BLOCKABLE_HINT);expect(rest).not.toContain('sourceBlockIconButton');
 });
 it('ohne Sperr-Recht oder bei unbekanntem Sperrstatus gibt es keinen Button (fail-closed gegen Doppel-Sperren)',()=>{
  expect(render(row(),indexOf(),{mayBlock:false})).toContain(STATE_WORDS.notBlocked);
  expect(render(row(),indexOf(),{mayBlock:false})).not.toContain('sourceBlockIconButton');
  const unknown=render(row(),undefined,{statusUnknown:true});expect(unknown).toContain('Sperrstatus unbekannt');expect(unknown).not.toContain('sourceBlockIconButton');
 });
 it('gibt Geldwerte nur mit finance.view an den Dialog weiter',()=>{
  const money=renderToStaticMarkup(<FraudBlockCell row={row()} state={fraudRowBlockState(row(),indexOf())} mayBlock finance={false} rangeParams="" statusUnknown={false}/>);
  expect(money).toContain('sourceBlockIconButton');
  const cell=read('src/app/fraud/FraudBlockCell.tsx');
  expect(cell).toContain('showMoney={finance}');expect(cell).toContain('payout:finance?');expect(cell).toContain('profit:finance?');
 });
});

describe('Fraud-Seite: Sperrspalte, Filter und Farben aus dem Vokabular',()=>{
 it('lädt den Sperr-Index fail-closed, rendert die Sperrspalte je Zeile und bietet den Filter „nur ungesperrte“',()=>{
  const page=read('src/app/fraud/page.tsx');
  for(const marker of['loadBlockIndex()','sourceBlockMarkerIndex(','<FraudBlockCell','name="blocked"','value="open"','isFraudRowOpen(','fraudRowBlockState(','blockIndexError'])expect(page).toContain(marker);
  expect(page).toContain('<th>Sperre</th>');
  expect(page).not.toContain('everflow-source-blocks');
 });
 it('zeigt Geldspalten nur mit finance.view und färbt Vorzeichen nur über signTone',()=>{
  const page=read('src/app/fraud/page.tsx');
  expect(page).toContain("finance=can(user.access,'finance.view')");
  expect(page).toContain('finance&&<th>Profit</th>');
  expect(page).toContain('toneClass(signTone(row.metrics.profit');
  expect(page).not.toMatch(/profit\s*<\s*0\s*\?\s*['"]negative['"]/);
  expect(page).not.toContain('Abschalt');
 });
 it('Sperr-Aktionen nur mit landingpages.manage und api.manage; Shadow-Mode bleibt (keine Auto-Sperren)',()=>{
  const page=read('src/app/fraud/page.tsx'),control=read('src/lib/fraud-control.ts');
  expect(page).toContain("mayBlock=can(user.access,'landingpages.manage')&&can(user.access,'api.manage')");
  expect(page).toContain('mayBlock={mayBlock');
  expect(page).toContain('status="Shadow Mode"');
  for(const marker of['everflow-source-blocks','activateEverflowSourceBlock','activateSourceBlock','fetch('])expect(control).not.toContain(marker);
 });
});
