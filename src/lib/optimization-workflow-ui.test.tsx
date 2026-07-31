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

  it('wird vom zentralen Affiliate Optimizer und der getrennten Ausführung gemeinsam verwendet',()=>{
    for(const path of ['../app/affiliates/page.tsx','../app/automation/page.tsx']){
      expect(source(path)).toContain("components/OptimizationFlow");
      expect(source(path)).toContain('<OptimizationFlow');
    }
    expect(source('../app/smartlinks/page.tsx')).toContain('legacySmartlinkRedirectHref');
  });

  it('verwendet in Affiliate- und Campaign-Ansicht dieselbe Priorisierungsfunktion',()=>{
    expect(source('../app/affiliates/AffiliateSmartlinks.tsx')).toContain('primarySmartlinkRecommendation');
    expect(source('../app/affiliates/AffiliateSmartlinkOverview.tsx')).toContain('primarySmartlinkRecommendation');
  });

  it('bewahrt den Affiliate- und Zeitraumkontext beim Campaign-Wechsel',()=>{
    const picker=source('../app/smartlinks/CampaignPicker.tsx'),page=source('../app/affiliates/page.tsx');
    expect(picker).toContain('affiliateCampaignStateHref');
    expect(picker).toContain('returnTo');
    expect(page).toContain('<CampaignPicker');
    expect(page).toContain('returnTo={');
    expect(page).toContain('rangeParams');
  });

  it('verwendet ausschließlich die vorhandenen Dashboard-Farbrollen',()=>{
    for(const path of ['../app/components/OptimizationFlow.module.css','../app/affiliates/AffiliateSmartlinkOverview.module.css']){
      const css=source(path);
      expect(css).not.toMatch(/var\(--(?:surface|danger|success|accent-text)\)/);
      expect(css).toMatch(/var\(--surface-1\)/);
    }
  });
});
