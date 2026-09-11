import { describe, expect, it } from 'vitest';
import { variantIdentityLine, variantLabel } from '@/app/affiliates/affiliate-format';
import { translateText } from './i18n';

describe('direct path identity', () => {
  it('translates the complete unassigned identity and path counts without replacing business names',()=>{
    for(const [de,en] of [['Offer #9 · Ohne Landingpage-Zuordnung','Offer #9 · No landing-page assignment'],['1 Direktpfad','1 direct path'],['3 Direktpfade','3 direct paths']]){
      expect(translateText(de,'en')).toBe(en);expect(translateText(en,'de')).toBe(de);
    }
    expect(translateText('Partner 3 Direktpfade','en')).toBe('Partner 3 Direktpfade');
  });
  it.each(['N/A','Default','','API'])('does not invent a landing page or traffic mode for URL 0 (%s)', offerUrl => {
    const v={offerUrl,offerId:'9',offerUrlId:'0'};
    expect(variantLabel(v)).toBe('Ohne Landingpage-Zuordnung');
    expect(variantIdentityLine(v)).toBe('Offer #9 · Ohne Landingpage-Zuordnung');
  });
  it.each(['N/A','Default',''])('uses a real URL ID when its name is missing (%s)', offerUrl => {
    const v={offerUrl,offerId:'9',offerUrlId:'27'};
    expect(variantLabel(v)).toBe('Landingpage #27');
    expect(variantIdentityLine(v)).toBe('Offer #9 · URL #27');
  });
  it('preserves meaningful landing-page names and their stable identifiers',()=>{
    const v={offerUrl:'Default campaign – N/A test',offerId:'9',offerUrlId:'27'};
    expect(variantLabel(v)).toBe(v.offerUrl);
    expect(variantIdentityLine(v)).toBe('Default campaign – N/A test · Offer #9 · URL #27');
  });
});
