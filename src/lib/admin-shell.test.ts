import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(join(process.cwd(),'src/app',path),'utf8');

describe('responsive admin shell',()=>{
 it('mounts one global authenticated sidebar around dashboard content',()=>{
  const layout=read('layout.tsx');
  expect(layout).toContain('DashboardShell');
  expect(layout).toContain('<DashboardShell>{children}</DashboardShell>');
  const shell=read('components/DashboardShell.tsx');
  const frame=read('components/DashboardShellFrame.tsx');
  expect(frame).toContain('className="adminShell"');
  expect(shell).toContain('<AdminSidebar');
 });

 it('removes the authenticated shell when client navigation reaches the login page',()=>{
  const shell=read('components/DashboardShell.tsx');
  const frame=read('components/DashboardShellFrame.tsx');
  expect(shell).toContain('<DashboardShellFrame');
  expect(frame).toContain('usePathname');
  expect(frame).toContain('pathname==="/login"');
  expect(frame).toContain('return children');
 });

 it('provides permission-aware navigation, account controls and persistent collapse',()=>{
  const sidebar=read('components/AdminSidebar.tsx'),logout=read('components/OneSignalLogoutForm.tsx'),shell=read('components/DashboardShell.tsx'),navigation=`${sidebar}\n${logout}\n${shell}`;
  for(const marker of['Account Monitor','LTV-Kohorten','Affiliate Optimizer','Auto-Rotation','Benutzer & Rechte','Sicherheit','Abmelden','Nur Lesen'])expect(navigation).toContain(marker);
  expect(sidebar).not.toContain('Read only');
  expect(sidebar).toContain('{props.capabilityLabel}');
  expect(sidebar).toContain('className={props.writeAccess?"write":"read"}');
  expect(sidebar).not.toContain('label:"Smartlink Intelligence"');
  expect(sidebar).not.toContain('Sicherheit & MFA');
  expect(sidebar).toContain('aria-expanded={!collapsed}');
  expect(sidebar).toContain('wlx-sidebar-collapsed');
  expect(sidebar).toContain('data-sidebar-collapsed');
  expect(sidebar).toContain('aria-label="Navigation öffnen"');
  expect(sidebar).toContain('aria-label="Navigation schließen"');
 });

 it('groups language, appearance and logout as one legible sidebar action panel',()=>{
  const sidebar=read('components/AdminSidebar.tsx'),theme=read('components/ThemeToggle.tsx'),css=read('globals.css');
  for(const marker of['sidebarPreferences','sidebarPreference','Sprache','Darstellung','<LanguageToggle compact/>','<ThemeToggle showLabel/>'])expect(sidebar).toContain(marker);
  expect(theme).toContain('showLabel=false');
  expect(theme).toContain('themeToggleLabel');
  for(const marker of['.sidebarPreferences{display:grid;grid-template-columns:1fr 1fr','.sidebarPreference>span','.sidebarActions>form','.sidebarLogout{display:flex'])expect(css).toContain(marker);
  expect(css).toContain('min-height:44px');
 });

 it('defines desktop collapse and mobile drawer behavior without horizontal page overflow',()=>{
  const css=read('globals.css');
  for(const marker of['.adminShell','.adminSidebar','.adminContent','.sidebarBackdrop','--sidebar-width','@media(max-width:760px)'])expect(css).toContain(marker);
  expect(css).toContain('overflow-x:hidden');
  expect(css).toContain('transform:translateX(-100%)');
  expect(css).toContain('width:76px');
 });

 it('derives the sidebar capability label from real permissions instead of a static read-only badge',()=>{
  const shell=read('components/DashboardShell.tsx'),css=read('globals.css');
  for(const marker of['capabilityLabel={capabilityLabel}','writeAccess={','Nur Lesen',"'landingpages.manage')&&can(user.access,'api.manage')&&'Sperren'","'campaigns.edit')&&can(user.access,'api.manage')&&'Campaigns'","'automations.live')&&'Live-Freigabe'","'exports.download')&&'Export'"])expect(shell).toContain(marker);
  for(const marker of['.sidebarStatus i.read{','.sidebarStatus i.write{'])expect(css).toContain(marker);
 });

 it('gates the LTV cohort entry like the cohorts page on statistics and finance',()=>{
  const shell=read('components/DashboardShell.tsx'),cohorts=read('cohorts/page.tsx');
  expect(cohorts).toContain("can(user.access,'statistics.view')");
  expect(cohorts).toContain("can(user.access,'finance.view')");
  expect(shell).toContain("const mayStatistics=can(user.access,'statistics.view')&&can(user.access,'finance.view')");
  expect(shell).toContain('mayStatistics={mayStatistics}');
 });

 it('lets each account persist and edit the visible primary navigation order',()=>{
  const sidebar=read('components/AdminSidebar.tsx'),css=read('globals.css');
  for(const marker of['wlx-sidebar-order:','Bearbeiten','Fertig','draggable','onDragStart','onDrop','nach oben','nach unten','aria-live="polite"'])expect(sidebar).toContain(marker);
  for(const marker of['.sidebarNavHeader','.sidebarOrderItem','.sidebarDragHandle','.sidebarOrderControls','.sidebarOrderAnnouncement'])expect(css).toContain(marker);
  expect(css).toContain('.sidebarOrderControls button{width:28px;height:28px');
  expect(css).toContain('.sidebarOrderControls button{width:44px;height:44px');
 });
});
