import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const root=process.cwd(),read=(path:string)=>readFileSync(join(root,path),'utf8');
const walk=(dir:string):string[]=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):/\.tsx?$/.test(name)&&!/\.test\.tsx?$/.test(name)?[path]:[]});
/** Abnahme F (D9): partnerspezifische Konstanten leben nur noch im Deal-Register. */
describe('deal register contract (Etappe 4, D9)',()=>{
 it('keeps every partner-specific constant out of src/lib except deal-register.ts',()=>{
  const files=walk(join(root,'src/lib')).filter(file=>!file.endsWith('/deal-register.ts'));expect(files.length).toBeGreaterThan(50);
  for(const file of files){const source=readFileSync(file,'utf8'),name=file.slice(root.length+1);
   expect(source,`${name} enthält die Partner-ID 436 als Sonderfall`).not.toMatch(/\b436\b/);
   expect(source,`${name} prüft affiliateId===6`).not.toMatch(/affiliateId\s*===\s*6\b/);
   expect(source,`${name} prüft campaignId===2`).not.toMatch(/campaignId\s*===\s*2\b/);
   expect(source,`${name} enthält die alte Reife-Sonderregel 336:168`).not.toMatch(/\?\s*336\s*:\s*168/);
  }
  expect(walk(join(root,'src/app')).map(file=>readFileSync(file,'utf8')).some(source=>/\b436\b/.test(source))).toBe(false);
 });
 it('routes the three former constant sites through resolveDealRule with the defaults as fallback',()=>{
  for(const path of['src/lib/smartlink.ts','src/lib/automation-config.ts','src/lib/automation-import.ts']){const source=read(path);expect(source,path).toContain("from'./deal-register'");expect(source,path).toContain('resolveDealRule(');expect(source,path).toContain('DEFAULT_DEAL_RULES')}
  expect(read('src/lib/smartlink.ts')).toContain('deals:readonly DealRule[]=DEFAULT_DEAL_RULES):SlotRecommendation[]');
  expect(read('src/lib/automation-config.ts')).toContain('deals:readonly DealRule[]=DEFAULT_DEAL_RULES):AutomationThresholdRecommendation');
  expect(read('src/lib/automation-import.ts')).toContain('deals?:readonly DealRule[]');
 });
 it('loads the register at every server call site and passes it down',()=>{
  const service=read('src/lib/smartlink-service.ts');expect(service).toContain("from'./deal-register-store'");expect(service.split('applyDealRules(').length).toBe(3);
  expect(read('src/app/automation/page.tsx')).toContain('<AutomationDashboard deals={deals}/>');
  expect(read('src/app/automation/AutomationDashboard.tsx')).toContain('},deals),[offers,baselineCvr,clicksPerDay,soisPerDay,affiliateId,deals]');
  expect(read('src/app/api/automation/route.ts')).toContain('deals:await loadDealRegister()');
  expect(read('src/lib/deal-register-store.ts')).toContain("DEAL_REGISTER_STORE_KEY='deal_register:v1'".replace("DEAL_REGISTER_STORE_KEY='deal_register:v1'",'DEAL_REGISTER_STORE_KEY'));
  expect(read('src/lib/deal-register.ts')).toContain("DEAL_REGISTER_STORE_KEY='deal_register:v1'");
 });
 it('keeps the register client-safe and the store server-side',()=>{
  const pure=read('src/lib/deal-register.ts');expect(pure).not.toContain('next/cache');expect(pure).not.toContain('access-store');expect(pure).not.toContain('server-only');
  const store=read('src/lib/deal-register-store.ts');expect(store).toContain("from'./access-store'");expect(store).toContain("tags:[DEAL_REGISTER_CACHE_TAG]");expect(store).toContain('revalidate:60');
 });
 it('gates the settings page and the sidebar entry on settings.manage for internal roles only (D7)',()=>{
  const page=read('src/app/settings/deals/page.tsx');expect(page).toContain("user.access.role==='partner'||!can(user.access,'settings.manage')");expect(page).toContain('<AccessDeniedHint permission="settings.manage"/>');expect(page).toContain('<DashboardPageHeader');expect(page).toContain('Ohne gespeichertes Register gelten die bisherigen Sonderdeal-Konstanten');
  const sidebar=read('src/app/components/AdminSidebar.tsx');expect(sidebar).toContain('{href:"/settings/deals",label:"Sonderdeals",icon:"layers" as const,show:props.maySettings===true}');
  const form=read('src/app/settings/deals/DealRegisterForm.tsx');expect(form).toContain("fetch('/api/deals',{method:'PUT'");for(const column of['Partner','Campaign','Testquote','Reife','CVR-Untergrenze','Notiz','Geändert von','Geändert am'])expect(form).toContain(`<th>${column}</th>`);
 });
});
