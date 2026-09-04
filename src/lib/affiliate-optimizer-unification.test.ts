import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const app=(path:string)=>readFileSync(join(process.cwd(),'src/app',path),'utf8');

describe('zentraler Affiliate Optimizer',()=>{
  it('bindet vollständige Smartlink-Suche und ausgewählte Campaign in dieselbe Oberfläche ein',()=>{
    const page=app('affiliates/page.tsx');
    const overview=app('affiliates/AffiliateSmartlinkOverview.tsx');
    const liveLink=app('affiliates/LiveCampaignDeepDiveLink.tsx');
    const picker=app('smartlinks/CampaignPicker.tsx');
    const details=app('affiliates/AffiliateSmartlinks.tsx');
    expect(page).toContain('getCampaignDirectory');
    expect(page).toContain('<CampaignPicker');
    expect(page).toContain('selectedCampaignId=');
    expect(page).toContain('affiliateOptimizerCurrentHref');
    expect(page.match(/returnTo=\{smartlinkCurrentHref\}/g)).toHaveLength(2);
    expect(overview).toContain('<LiveCampaignDeepDiveLink');
    expect(picker).toContain("window.dispatchEvent(new Event('affiliate-url-statechange'))");
    expect(liveLink).toContain("window.addEventListener('affiliate-url-statechange'");
    expect(liveLink).toContain('window.location.href');
    expect(details).toContain('visibleMappings');
    expect(details).toContain('defaultOpen={selectedCampaignId===mapping.campaignId}');
  });

  it('lädt beim Affiliate-Wechsel nur kompakte Campaign-Daten und die volle Tiefe erst für die ausgewählte Campaign',()=>{
    const page=app('affiliates/page.tsx');
    expect(page).toContain('compactSmartlinkInsights');
    expect(page).toContain('selectedSmartlinkDetails');
    expect(page).toContain('getAffiliateSmartlinks(\n        selectedWorkspace.affiliateId,\n        selectedWorkspace.campaigns.map');
    expect(page).toContain('false,\n        false,');
    expect(page).toContain('detailedCampaignId ? getAffiliateSmartlinks');
    expect(page).toContain('selectedRebillDetails');
    expect(page).toContain('detailedCampaignId ? getAffiliateRebillEvents');
    expect(page).toContain('smartlinkDetailsError');
    expect(page).toContain('Campaign-Tiefendaten konnten nicht geladen werden');
    expect(page).toContain('Detailansicht wird nicht mit unvollständigen Daten dargestellt');
    expect(page).toContain('{selectedCampaignId && (\n            smartlinkDetailsError ?');
    expect(page).toContain(': (\n              <>\n                <section className="sectionHead">');
  });

  it('führt Rotationskandidaten in die getrennte sichere Ausführung und füllt den Scope vor',()=>{
    const details=app('affiliates/AffiliateSmartlinks.tsx');
    const automation=app('automation/AutomationDashboard.tsx');
    expect(details).toContain('Austausch sicher vorbereiten');
    expect(details).toContain('automationCampaignHref');
    expect(automation).toContain('useSearchParams');
    expect(automation).toContain("searchParams.get('affiliate')");
    expect(automation).toContain("searchParams.get('campaign')");
    expect(automation).toContain("searchParams.get('intent')==='replace'");
  });

  it('hält die Datumssteuerung für Direktlinks und Smartlinks gemeinsam sichtbar',()=>{
    const page=app('affiliates/page.tsx');
    const period=app('components/PeriodControls.tsx');
    expect(page.lastIndexOf('<PeriodControls dimension="global" period={period.period} from=')).toBeLessThan(page.lastIndexOf('selectedWorkspace && mode === "smartlinks"'));
    expect(period).toContain('Jahr / Monat');
    expect(period).toContain('Individuell');
    expect(period.match(/<form/g)).toHaveLength(1);
  });

  it('bewahrt Favoriten, Kurzfenster, Tagesverlauf und echten Cache-Refresh zentral',()=>{
    const page=app('affiliates/page.tsx');
    const details=app('affiliates/AffiliateSmartlinks.tsx');
    const watchlist=app('smartlinks/SmartlinkWatchlist.tsx');
    expect(page).toContain('<SmartlinkWatchlist');
    expect(page).toContain('query.refresh === "1"');
    expect(details).toContain('title={data.windows.traffic}');
    expect(details).toContain('title={data.windows.economics}');
    expect(details).toContain('title={data.windows.maturity}');
    expect(details).toContain('TAGESBASIS · LETZTE 14 KALENDERTAGE');
    expect(details).toContain('Datenstand');
    expect(watchlist).toContain('baseHref');
    expect(watchlist).toContain('affiliateId?:string');
    expect(watchlist).toContain('href(x.id,x.affiliateId)');
    expect(watchlist).not.toContain('href={`/smartlinks?campaign=');
  });

  it('erhält die bisherigen Smartlink-Rechte ohne zusätzliche Partner-Berechtigung',()=>{
    const page=app('affiliates/page.tsx');
    const sidebar=app('components/AdminSidebar.tsx');
    expect(page).toContain('const mayPartners = can(user.access, "partners.view")');
    expect(page).toContain('const maySmartlinks = can(user.access, "smartlinks.view") && can(user.access, "finance.view")');
    expect(page).toContain('if (!mayPartners && !(query.mode === "smartlinks" && maySmartlinks))');
    expect(sidebar).toContain('show:props.mayPartners||props.maySmartlinks');
  });

  it('zeigt die globale Campaign-Suche vor der Affiliate-Auswahl und hält Ambiguität kompatibel',()=>{
    const page=app('affiliates/page.tsx');
    const legacy=app('smartlinks/page.tsx');
    expect(page.indexOf('{mode === "smartlinks" && (')).toBeLessThan(page.indexOf('{requestedSmartlinkMismatch ? ('));
    expect(page).toContain('initialOpen={query.open || query.campaign}');
    expect(legacy).toContain('<LegacySmartlinksPage searchParams={Promise.resolve(query)} />');
    expect(legacy).toContain('matches.length!==1');
  });

  it('nutzt feste 30-Tage-Zuordnungen und weist nicht auflösbare Deep Links vor dem Detail explizit zurück',()=>{
    const page=app('affiliates/page.tsx');
    expect(page).toContain('getCampaignAffiliateMappings(undefined, user.access)');
    expect(page).toContain('overlayPeriodFinancialMappings(periodMappings, associationMappings)');
    expect(page).toContain('HISTORISCHE ZUORDNUNGEN IM GEWÄHLTEN ZEITRAUM');
    expect(page).toContain('requestedSmartlinkMismatch');
    expect(page).toContain('ANGEFORDERTER AFFILIATE NICHT AUFLÖSBAR');
  });

  it('weist veraltete oder fremde Campaign-Affiliate-Kombinationen explizit zurück',()=>{
    const details=app('affiliates/AffiliateSmartlinks.tsx');
    expect(details).toContain('selectionMismatch');
    expect(details).toContain('CAMPAIGN PASST NICHT ZUM AFFILIATE');
    expect(details).not.toContain("selectedCampaignId&&mappings.some(mapping=>mapping.campaignId===selectedCampaignId)?mappings.filter(mapping=>mapping.campaignId===selectedCampaignId):mappings");
  });
});
