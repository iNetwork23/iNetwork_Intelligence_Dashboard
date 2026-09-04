import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {ACTION_WORDS,STATE_WORDS,VERDICT_WORDS} from './verdict-vocabulary';

/**
 * Quelltext-Vertrag für Abnahme E „Wortfamilien: 3 Klassen“ (D13) und „Vorzeichenfarbe unter der Reifeschwelle: 0 Fälle“ (D15).
 * Urteil = VERDICT_WORDS, Aktion = ACTION_WORDS, Zustand = STATE_WORDS – UI-Dateien führen keine eigenen Wörter und keine eigenen Ampeln.
 */
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
/** Dateien der Partnerseite und Verdikt-Anzeige (Agent P) – dort gelten alle Regeln. */
const OWN_FILES=['src/app/components/LeitstandSection.tsx','src/app/affiliates/AffiliateCockpit.tsx','src/app/affiliates/TrendList.tsx','src/app/affiliates/TrafficActionLists.tsx','src/app/affiliates/CandidateTopN.tsx','src/app/affiliates/AffiliatePanels.tsx','src/app/affiliates/SourceBreakdown.tsx','src/app/affiliates/SourceTable.tsx','src/app/components/SmartlinkPresentation.tsx','src/app/affiliates/SourceBlockButton.tsx','src/lib/affiliate-trend.ts','src/lib/affiliate-priority.ts','src/lib/verdict-trust.ts','src/lib/source-block-markers.ts'];
/** Leitstand und Quellenliste (nur lesen): Wortregeln gelten dort ebenso. */
const SHARED_FILES=['src/app/components/LeitstandSection.tsx','src/app/sources/SourceCandidateList.tsx'];
const ALL=[...OWN_FILES,...SHARED_FILES];
/** „ausschalten“/„ausgeschaltet“ als Beschriftung: das Wort schließt ein String-Literal ab (Schaltfläche, Label, Titel). Erklärtexte („Ausschalten sperrt …“) sind Wirkungs-Copy und bleiben. */
const ACTION_LITERAL=/(ausschalten|ausgeschaltet)\s*[`'"]/;
const OWN_TRAFFIC_LIGHT=/>=\s*0\s*\?\s*['"](up|positive)['"]/;

describe('Wortfamilien: drei Klassen, je eine Liste',()=>{
  it('the vocabulary itself is the single source: one verdict word for stopping, one action word, one state family',()=>{
    expect(VERDICT_WORDS).toContain('AUSSCHALTEN');
    expect(VERDICT_WORDS).not.toContain('ABSCHALTEN');
    expect(ACTION_WORDS.block).toBe('Vergütung sperren');
    expect(STATE_WORDS.unclear).toBe('Zustand unklar');
    expect(STATE_WORDS.blockedSince('04.09.2026')).toBe('Gesperrt seit 04.09.2026');
  });
  it.each(ALL)('%s uses no „ausschalten“ as an action label',(file)=>{
    expect(read(file)).not.toMatch(ACTION_LITERAL);
  });
  it.each(ALL)('%s contains no „Abschalt“ literal (the verdict word is AUSSCHALTEN)',(file)=>{
    expect(read(file)).not.toContain('Abschalt');
    expect(read(file)).not.toContain('ABSCHALT');
  });
  it.each(ALL)('%s knows no „Sperre unklar“ outside STATE_WORDS',(file)=>{
    expect(read(file)).not.toContain('Sperre unklar');
  });
  it('the block control and the block markers take their words from ACTION_WORDS/STATE_WORDS',()=>{
    expect(read('src/app/affiliates/SourceBlockButton.tsx')).toContain('ACTION_WORDS.block');
    expect(read('src/app/affiliates/SourceBlockButton.tsx')).toContain('STATE_WORDS.blockedSince');
    expect(read('src/lib/source-block-markers.ts')).toContain('STATE_WORDS.unclear');
  });
});

describe('Vorzeichenfarbe nur über signTone/cvrTone (D15)',()=>{
  it.each(OWN_FILES)('%s defines no own traffic light on the sign',(file)=>{
    expect(read(file)).not.toMatch(OWN_TRAFFIC_LIGHT);
    expect(read(file)).not.toMatch(/cvr\s*>=\s*1\s*\?/);
  });
  it('every UI file that colours a sign imports the shared helpers',()=>{
    for(const file of ['src/app/affiliates/TrendList.tsx','src/app/affiliates/AffiliatePanels.tsx','src/app/affiliates/SourceBreakdown.tsx','src/app/components/SmartlinkPresentation.tsx'])
      expect(read(file)).toMatch(/from\s*["'](\.\.\/\.\.\/lib|@\/lib)\/verdict-vocabulary["']/);
  });
});
