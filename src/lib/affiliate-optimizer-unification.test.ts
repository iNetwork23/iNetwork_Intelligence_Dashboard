import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const app=(path:string)=>readFileSync(join(process.cwd(),'src/app',path),'utf8');

describe('zentraler Affiliate Optimizer',()=>{
  it('bindet vollständige Smartlink-Suche und ausgewählte Campaign in dieselbe Oberfläche ein',()=>{
    const page=app('affiliates/page.tsx');
    const details=app('affiliates/AffiliateSmartlinks.tsx');
    expect(page).toContain('getCampaignDirectory');
    expect(page).toContain('<CampaignPicker');
    expect(page).toContain('selectedCampaignId=');
    expect(page).toContain('affiliateOptimizerCurrentHref');
    expect(page.match(/returnTo=\{smartlinkCurrentHref\}/g)).toHaveLength(2);
    expect(details).toContain('visibleMappings');
    expect(details).toContain('defaultOpen={selectedCampaignId===mapping.campaignId}');
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
    const period=app('affiliates/AffiliatePeriodControls.tsx');
    expect(page.lastIndexOf('<AffiliatePeriodControls period={period} />')).toBeLessThan(page.lastIndexOf('selectedWorkspace && mode === "smartlinks"'));
    expect(period).toContain('Jahr / Monat');
    expect(period).toContain('Individuell');
    expect(period.match(/<form/g)).toHaveLength(1);
  });

  it('bewahrt Favoriten, Kurzfenster, Stundenverlauf und echten Cache-Refresh zentral',()=>{
    const page=app('affiliates/page.tsx');
    const details=app('affiliates/AffiliateSmartlinks.tsx');
    const watchlist=app('smartlinks/SmartlinkWatchlist.tsx');
    expect(page).toContain('<SmartlinkWatchlist');
    expect(page).toContain('query.refresh === "1"');
    expect(details).toContain('Letzte 24 Stunden');
    expect(details).toContain('Letzte 72 Stunden');
    expect(details).toContain('Letzte 14 Tage');
    expect(details).toContain('STUNDENBASIS · LETZTE 24H');
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
