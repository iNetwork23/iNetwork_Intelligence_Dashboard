import{describe,expect,it}from'vitest';
import{ACTION_WORDS,CVR_GATE_CLICKS,STATE_WORDS,TREND_MATURITY,VERDICT_SEVERITY,VERDICT_WORDS,confidenceBand,cvrTone,formatDelta,isTrendMature,isVerdictWord,maturityGateText,signTone}from'./verdict-vocabulary';
import{KILL_MATURITY_SOIS,SCALE_MIN_FIRST_SALES,SCALE_MIN_SOIS,wilsonLower,wilsonUpper}from'./decision-engine';
describe('verdict vocabulary (D13)',()=>{
 it('knows exactly five verdict words, each with a severity, and no legacy ABSCHALTEN',()=>{expect(VERDICT_WORDS).toEqual(['AUSSCHALTEN','SKALIEREN','WEITERLAUFEN','WEITER TESTEN','BEOBACHTEN']);for(const word of VERDICT_WORDS)expect(['positive','neutral','warning','critical']).toContain(VERDICT_SEVERITY[word]);expect(isVerdictWord('ABSCHALTEN')).toBe(false);expect(isVerdictWord('AUSSCHALTEN')).toBe(true)});
 it('keeps action and state words in their own classes',()=>{expect(ACTION_WORDS.block).toBe('Vergütung sperren');expect(STATE_WORDS.blockedSince('04.09.2026')).toBe('Gesperrt seit 04.09.2026');expect(Object.values(ACTION_WORDS).some(word=>VERDICT_WORDS.includes(word as never))).toBe(false)});
});
describe('maturity gates (D15)',()=>{
 it('colours signs only above the trend maturity',()=>{expect(TREND_MATURITY).toEqual({clicks:100,sois:20});expect(isTrendMature({clicks:99,sois:19})).toBe(false);expect(isTrendMature({clicks:100,sois:0})).toBe(true);expect(isTrendMature({clicks:0,sois:20})).toBe(true);expect(signTone(-12.5,{clicks:40,sois:5})).toBe('neutral');expect(signTone(-12.5,{clicks:400,sois:5})).toBe('negative');expect(signTone(3,{clicks:0,sois:25})).toBe('positive');expect(signTone(0,{clicks:500,sois:50})).toBe('neutral');expect(signTone(Number.NaN,{clicks:500,sois:50})).toBe('neutral')});
 it('rates CVR only from the click gate and against a benchmark',()=>{expect(CVR_GATE_CLICKS).toBe(100);expect(cvrTone(99,0.5,0.1)).toBe('neutral');expect(cvrTone(100,0.5,0.1)).toBe('positive');expect(cvrTone(100,0.04,0.1)).toBe('negative');expect(cvrTone(100,0.07,0.1)).toBe('neutral');expect(cvrTone(1000,0.5)).toBe('neutral');expect(cvrTone(1000,0.5,0)).toBe('neutral')});
});
describe('confidence band (D19)',()=>{
 it('is belastbar from kill maturity or scale maturity and carries the Wilson band',()=>{const band=confidenceBand(3,KILL_MATURITY_SOIS);expect(band.label).toBe('belastbar');expect(band.low).toBeCloseTo(wilsonLower(3,KILL_MATURITY_SOIS),10);expect(band.high).toBeCloseTo(wilsonUpper(3,KILL_MATURITY_SOIS),10);expect(band.text).toMatch(/^belastbar · \d+,\d %–\d+,\d %$/);expect(confidenceBand(SCALE_MIN_FIRST_SALES,SCALE_MIN_SOIS).label).toBe('belastbar');expect(confidenceBand(1,SCALE_MIN_SOIS).label).toBe('unsicher');expect(confidenceBand(0,0).text).toBe('unsicher · keine SOIs')});
});
describe('formatDelta',()=>{
 it('shows a dash only with a reason',()=>{expect(formatDelta(5,null)).toMatchObject({direction:'none',text:'–',reason:'keine Vorperiode'});expect(formatDelta(5,3,{maturity:{clicks:10,sois:1}})).toMatchObject({direction:'none',text:'–',reason:maturityGateText})});
 it('formats direction, absolute and relative change',()=>{expect(formatDelta(120,100,{maturity:{clicks:500,sois:30}})).toMatchObject({direction:'up',absolute:20,relative:0.2,text:'+20 (+20 %)',reason:null});expect(formatDelta(80,100)).toMatchObject({direction:'down',text:'-20 (-20 %)'});expect(formatDelta(100,100)).toMatchObject({direction:'flat',text:'0 (0 %)'});expect(formatDelta(1.5,1,{unit:' %',digits:1}).text).toBe('+0,5 % (+50 %)');expect(formatDelta(3,0).relative).toBeNull()});
});
