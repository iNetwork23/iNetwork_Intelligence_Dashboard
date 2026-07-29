import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(join(process.cwd(),'src/app',path),'utf8');

describe('affiliate partner picker UI',()=>{
 it('is integrated with all scoped partners and keeps the reporting range',()=>{
  const page=read('affiliates/page.tsx');
  expect(page).toContain('<AffiliatePartnerPicker');
  expect(page).toContain('partners={workspaces.map');
  expect(page).toContain('rangeParams={rangeParams}');
 });
 it('supports search, traffic-type filtering, persistent pins, keyboard close and accessible state',()=>{
  const picker=read('affiliates/AffiliatePartnerPicker.tsx');
  for(const marker of['wlx-affiliate-pins','aria-expanded={open}','Affiliate suchen',"event.key==='Escape'",'Angepinnt','Alle Partner','anpinnen','lösen','affiliatePickerTrafficFilter',"'Alle'","'Smartlink'","'Direct Link'",'aria-pressed={trafficFilter===option.value}'])expect(picker).toContain(marker);
  expect(picker).toContain("params.set('mode',trafficFilter==='all'?(partner.hasDirect?'direct':'smartlinks'):trafficFilter)");
  expect(picker).not.toContain('wie bei WhatsApp immer oben');
  expect(picker).toContain('M12 17v5');
  expect(picker).toContain('M5 17h14');
 });
 it('uses a bounded desktop dropdown and a viewport-safe mobile panel',()=>{
  const css=read('globals.css');
  for(const marker of['.affiliatePickerMenu','.affiliatePinButton.pinned','.affiliatePickerTrafficFilter','grid-template-columns:repeat(3,minmax(0,1fr))','min-height:44px','max-height:min(520px,65vh)','inset:66px 12px auto','max-height:calc(100vh - 198px)'])expect(css).toContain(marker);
 });
 it('neutralizes inherited smart-search button styles and keeps only the selected row accented',()=>{
  const css=read('globals.css');
  expect(css).toContain('.smartSearch .affiliatePickerSelect{');
  expect(css).toContain('.smartSearch .affiliatePinButton{');
  expect(css).toContain('width:min(760px,calc(100vw - 80px))');
  expect(css).toContain('.affiliatePickerRow.selected:before');
  expect(css).toContain('background:transparent;color:var(--text-primary)');
  expect(css).toContain('.smartSearch .affiliatePinButton{display:grid;place-items:center;align-self:center;width:34px;height:34px');
 });
});
