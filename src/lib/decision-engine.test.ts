import {describe,expect,it} from 'vitest';
import {applyLeadMaturity,assessUnit,buildVerdictGate,projectSourceAction,wilsonLower,wilsonUpper} from './decision-engine';

const m=(x:Partial<Parameters<typeof assessUnit>[0]>)=>({clicks:0,sois:0,firstSales:0,rebills:0,profit:0,...x});

describe('wilson interval',()=>{
  it('bounds a rate between 0 and 1 and brackets the point estimate',()=>{
    const lower=wilsonLower(3,20),upper=wilsonUpper(3,20);
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeLessThan(1);
    expect(lower).toBeLessThan(3/20);
    expect(upper).toBeGreaterThan(3/20);
  });
  it('returns 0 bounds for an empty sample',()=>{
    expect(wilsonLower(0,0)).toBe(0);
    expect(wilsonUpper(0,0)).toBe(0);
  });
  it('gives zero successes in fifty trials an upper bound near seven percent',()=>{
    const upper=wilsonUpper(0,50);
    expect(upper).toBeGreaterThan(0.05);
    expect(upper).toBeLessThan(0.09);
  });
});

describe('unified decision engine',()=>{
  it('kills dead traffic: a hundred clicks without a single soi',()=>{
    expect(assessUnit(m({clicks:120}))).toMatchObject({action:'AUSSCHALTEN',severity:'critical'});
  });
  it('kills fifty sois without a first sale at negative profit',()=>{
    expect(assessUnit(m({sois:55,profit:-80}))).toMatchObject({action:'AUSSCHALTEN'});
  });
  it('does not kill mature negative traffic that has first sales and no benchmark',()=>{
    expect(assessUnit(m({sois:80,firstSales:4,profit:-30}))).toMatchObject({action:'BEOBACHTEN',severity:'warning'});
  });
  it('kills underperformance only when even the optimistic rate is below half the benchmark',()=>{
    // 1/100 = 1% Punktrate, Obergrenze ~5.4% — Benchmark 8%: Halbwert 4% < 5.4% → überlebt
    expect(assessUnit(m({sois:100,firstSales:1,profit:-10}),{benchmarkRate:0.08})).toMatchObject({action:'BEOBACHTEN'});
    // 1/400: Obergrenze ~1.4% < 4% → fällt
    expect(assessUnit(m({sois:400,firstSales:1,profit:-10}),{benchmarkRate:0.08})).toMatchObject({action:'AUSSCHALTEN'});
  });
  it('scales only with three independent first sales and positive profit',()=>{
    expect(assessUnit(m({sois:25,firstSales:3,profit:40}))).toMatchObject({action:'SKALIEREN',severity:'positive'});
    expect(assessUnit(m({sois:25,firstSales:2,profit:40}))).toMatchObject({action:'WEITERLAUFEN'});
    expect(assessUnit(m({sois:25,firstSales:3,profit:-5}))).not.toMatchObject({action:'SKALIEREN'});
  });
  it('keeps young traffic in testing instead of judging it',()=>{
    expect(assessUnit(m({clicks:40,sois:5}))).toMatchObject({action:'WEITER TESTEN',severity:'neutral'});
  });
  it('watches when there is nothing to evaluate',()=>{
    expect(assessUnit(m({}))).toMatchObject({action:'BEOBACHTEN'});
  });
  it('evaluates api traffic without clicks on the soi gate',()=>{
    expect(assessUnit(m({sois:55,profit:-80}),{api:true})).toMatchObject({action:'AUSSCHALTEN'});
    expect(assessUnit(m({sois:5,profit:-3}),{api:true})).toMatchObject({action:'WEITER TESTEN'});
  });
});

describe('source projection',()=>{
  it('maps the five actions onto the three source actions consistently',()=>{
    expect(projectSourceAction('AUSSCHALTEN')).toBe('AUSSCHALTEN');
    expect(projectSourceAction('SKALIEREN')).toBe('SKALIEREN');
    for(const action of ['WEITERLAUFEN','WEITER TESTEN','BEOBACHTEN'] as const)
      expect(projectSourceAction(action)).toBe('BEOBACHTEN');
  });
});

describe('level parity',()=>{
  it('source verdicts are always the projection of the shared engine — the two levels can no longer contradict each other',async()=>{
    const {assessTraffic}=await import('./source-breakdown');
    const cases=[
      {clicks:120,sois:0,firstSales:0,rebills:0,profit:-10},
      {clicks:80,sois:20,firstSales:0,rebills:0,profit:-1},
      {clicks:200,sois:60,firstSales:0,rebills:0,profit:-90},
      {clicks:200,sois:25,firstSales:3,rebills:1,profit:40},
      {clicks:500,sois:400,firstSales:1,rebills:0,profit:-10},
      {clicks:40,sois:5,firstSales:0,rebills:0,profit:2},
    ];
    for(const c of cases)for(const benchmark of [undefined,0.08]){
      const source=assessTraffic({...c,cvr:0,firstSaleRate:0,coinSpend:0,payout:0,revenue:0,profitPerSoi:0},benchmark);
      const engine=projectSourceAction(assessUnit(c,{benchmarkRate:benchmark}).action);
      expect(source.action).toBe(engine);
    }
  });
});

describe('lead maturity gate (Etappe 3, D3)',()=>{
  const mature=(matureSois:number,totalSois=matureSois,confidence:'hoch'|'mittel'|'niedrig'|'keine Daten'='hoch',p75Hours:number|null=48)=>({matureSois,totalSois,p75Hours,confidence});
  it('fills the gate on every verdict and reports "nicht geprüft" without maturity input',()=>{
    const v=assessUnit(m({sois:55,profit:-80}));
    expect(v.action).toBe('AUSSCHALTEN');
    expect(v.gate).toMatchObject({matureSois:55,totalSois:55,requiredSois:50,maturityReached:true,p75Hours:null,latencyConfidence:'nicht geprüft',benchmarkRate:null,confidence:'belastbar'});
    expect(v.gate?.rateLow).toBe(0);expect(v.gate?.rateHigh).toBeGreaterThan(0);expect(v.gate?.rateHigh).toBeLessThan(0.1);
    for(const x of[m({clicks:120}),m({clicks:40,sois:5}),m({}),m({sois:25,firstSales:3,profit:40})])expect(assessUnit(x).gate).toMatchObject({requiredSois:50,latencyConfidence:'nicht geprüft'});
    expect(assessUnit(m({sois:10,firstSales:1,profit:1})).gate?.confidence).toBe('unsicher');
    expect(assessUnit(m({sois:20,firstSales:3,profit:1})).gate?.confidence).toBe('belastbar');
    expect(assessUnit(m({sois:400,firstSales:1,profit:-10}),{benchmarkRate:0.08}).gate?.benchmarkRate).toBe(0.08);
  });
  it('holds K1 back as WEITER TESTEN while fewer than KILL_MATURITY_SOIS sois are mature',()=>{
    const v=assessUnit(m({sois:55,profit:-80}),{leadMaturity:mature(20,55,'hoch',36.5)});
    expect(v).toMatchObject({action:'WEITER TESTEN',severity:'neutral'});
    expect(v.reason).toContain('20 von 55 SOIs reif (Wartezeit p75 ≈ 37 h)');
    expect(v.gate).toMatchObject({matureSois:20,totalSois:55,maturityReached:false,p75Hours:36.5,latencyConfidence:'hoch'});
    expect(assessUnit(m({sois:55,profit:-80}),{leadMaturity:mature(50,55)})).toMatchObject({action:'AUSSCHALTEN',gate:{maturityReached:true}});
    expect(assessUnit(m({sois:55,profit:-80}),{api:true,leadMaturity:mature(49,55)})).toMatchObject({action:'WEITER TESTEN'});
  });
  it('holds K2 back the same way and keeps the benchmark in the gate',()=>{
    const gated=assessUnit(m({sois:400,firstSales:1,profit:-10}),{benchmarkRate:0.08,leadMaturity:mature(30,400,'mittel',72)});
    expect(gated).toMatchObject({action:'WEITER TESTEN',gate:{benchmarkRate:0.08,matureSois:30,totalSois:400,p75Hours:72,latencyConfidence:'mittel'}});
    expect(gated.reason).toContain('30 von 400 SOIs reif (Wartezeit p75 ≈ 72 h)');
    expect(assessUnit(m({sois:400,firstSales:1,profit:-10}),{benchmarkRate:0.08,leadMaturity:mature(400)})).toMatchObject({action:'AUSSCHALTEN'});
  });
  it('fails closed: without conversion data a would-be kill becomes BEOBACHTEN "Reife nicht prüfbar"',()=>{
    const none=mature(0,0,'keine Daten',72);
    const v=assessUnit(m({sois:55,profit:-80}),{leadMaturity:none});
    expect(v).toMatchObject({action:'BEOBACHTEN',severity:'warning',gate:{latencyConfidence:'keine Daten',maturityReached:false}});
    expect(v.reason).toContain('Reife nicht prüfbar – keine Conversion-Daten');
    expect(assessUnit(m({sois:400,firstSales:1,profit:-10}),{benchmarkRate:0.08,leadMaturity:none})).toMatchObject({action:'BEOBACHTEN'});
    // Einheiten, die ohnehin nicht AUSSCHALTEN wären, bleiben unverändert.
    expect(assessUnit(m({clicks:40,sois:5}),{leadMaturity:none})).toMatchObject({action:'WEITER TESTEN',reason:'Testquote noch nicht reif; vor einer Abschaltung mehr Evidenz sammeln.'});
    expect(assessUnit(m({sois:25,firstSales:3,profit:40}),{leadMaturity:none})).toMatchObject({action:'SKALIEREN'});
  });
  it('leaves K3 (dead traffic) uncoupled from maturity',()=>{
    expect(assessUnit(m({clicks:120}),{leadMaturity:mature(0,0,'keine Daten')})).toMatchObject({action:'AUSSCHALTEN',severity:'critical'});
    expect(assessUnit(m({clicks:120}),{leadMaturity:mature(0,0,'hoch')})).toMatchObject({action:'AUSSCHALTEN'});
  });
  it('applyLeadMaturity gates an externally produced verdict exactly like assessUnit',()=>{
    const metrics=m({sois:55,profit:-80}),context={leadMaturity:mature(10,55)};
    expect(applyLeadMaturity(assessUnit(metrics),metrics,context)).toEqual(assessUnit(metrics,context));
    expect(buildVerdictGate(metrics,context)).toEqual(assessUnit(metrics,context).gate);
    expect(applyLeadMaturity({action:'WEITERLAUFEN',severity:'positive',reason:'r',evidence:[]},m({sois:5,firstSales:1,profit:1}),context)).toMatchObject({action:'WEITERLAUFEN',reason:'r',gate:{matureSois:10}});
  });
  it('shows a sub-ten-hour p75 with one decimal and an unknown p75 as text',()=>{
    expect(assessUnit(m({sois:55,profit:-80}),{leadMaturity:mature(1,55,'niedrig',6.25)}).reason).toContain('(Wartezeit p75 ≈ 6,3 h)');
    expect(assessUnit(m({sois:55,profit:-80}),{leadMaturity:mature(1,55,'niedrig',null)}).reason).toContain('(Wartezeit p75 unbekannt)');
  });
});
