import {expect,it} from 'vitest';
import {translateText} from './i18n';
it.each([
 ['3 direkte Landingpages','3 direct landing pages'],
 ['Letzter Lead 10.09.','Last lead 10/09'],
 ['Mehr anzeigen · 162 weitere','Show more · 162 more'],
 ['BEOBACHTEN / WEITER TESTEN','WATCH / KEEP TESTING'],
 ['Veränderung','Change'],
])('translates the observed affiliate list text in both languages', (de,en)=>{
 expect(translateText(de,'en')).toBe(en);expect(translateText(en,'de')).toBe(de);
});
