import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import OptimizationFlow from '@/app/components/OptimizationFlow';

const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

describe('gemeinsame Optimierungsoberfläche',()=>{
  it('erklärt die drei aufeinander aufbauenden Ebenen und markiert die aktive',()=>{
    const html=renderToStaticMarkup(<OptimizationFlow active="smartlink"/>);
    expect(html).toContain('Wo handeln?');
    expect(html).toContain('Warum und wie?');
    expect(html).toContain('Was wurde ausgeführt?');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Campaign-Tiefenanalyse');
  });

  it('wird von Affiliate Optimizer, Smartlink Intelligence und Auto-Rotation gemeinsam verwendet',()=>{
    for(const path of ['../app/affiliates/page.tsx','../app/smartlinks/page.tsx','../app/automation/page.tsx']){
      expect(source(path)).toContain("components/OptimizationFlow");
      expect(source(path)).toContain('<OptimizationFlow');
    }
  });

  it('verwendet in Affiliate- und Campaign-Ansicht dieselbe Priorisierungsfunktion',()=>{
    expect(source('../app/affiliates/AffiliateSmartlinks.tsx')).toContain('primarySmartlinkRecommendation');
    expect(source('../app/smartlinks/page.tsx')).toContain('primarySmartlinkRecommendation');
  });

  it('bewahrt den Affiliate-Rücksprung beim Campaign-Wechsel und Refresh',()=>{
    const picker=source('../app/smartlinks/CampaignPicker.tsx'),page=source('../app/smartlinks/page.tsx');
    expect(picker).toContain('smartlinkDeepDiveHref');
    expect(picker).toContain('returnTo');
    expect(page).toContain('smartlinkRefreshHref');
    expect(page).toContain('returnTo={');
    expect(page).toContain('affiliateContextReturnHref');
    expect(page).toContain('{affiliateBackHref&&');
    expect(page).not.toContain('affiliateReturnHref(query.returnTo');
  });

  it('verwendet ausschließlich die vorhandenen Dashboard-Farbrollen',()=>{
    for(const path of ['../app/components/OptimizationFlow.module.css','../app/affiliates/AffiliateSmartlinkOverview.module.css']){
      const css=source(path);
      expect(css).not.toMatch(/var\(--(?:surface|danger|success|accent-text)\)/);
      expect(css).toMatch(/var\(--surface-1\)/);
    }
  });
});
