import{readFileSync,readdirSync}from'node:fs';import{join}from'node:path';import{describe,expect,it}from'vitest';
describe('README operations contract',()=>{const root=process.cwd(),read=(path:string)=>readFileSync(join(root,path),'utf8');it('matches the configured hourly sync minute',()=>{const docs=read('README.md'),vercel=JSON.parse(read('vercel.json'));expect(vercel.crons).toContainEqual({path:'/api/sync',schedule:'17 * * * *'});expect(docs).toContain('stündlich um Minute 17');expect(docs).not.toContain('stündlich zur vollen Stunde')});it('directs operators through the complete ordered migration workflow',()=>{const docs=read('README.md'),migrations=readdirSync(join(root,'supabase/migrations')).filter(name=>name.endsWith('.sql'));expect(migrations).toHaveLength(21);expect(docs).toContain('lexikografischer Reihenfolge');expect(docs).toContain('FRAUD-CONTROL-MIGRATION-RUNBOOK.md');expect(docs).toContain('CREATE INDEX CONCURRENTLY');expect(docs).toContain('20260906215000_index_affiliate_conversion_reads.sql');expect(docs).toContain('WLX-DATABASE-READBACK-2026-09-06.md');expect(docs).toContain('20260907095257_repair_ltv_cron_statement_budget.sql');expect(docs).toContain('rollback-ltv-cron-statement-budget.sql');expect(docs).toContain('20260908090600_bound_conversion_replacement_timeout.sql');expect(docs).toContain('WLX-IMPORT-READBACK-2026-09-08.md');expect(docs).toContain('03-restore-conversion-timeout.sql');expect(docs).toContain('20260909104000_add_approved_conversion_read_view.sql');expect(docs).toContain('WLX-APPROVED-CONVERSION-VIEW-2026-09-09.md');expect(docs).toContain('rollback-approved-conversion-read-view.sql')});it('documents removed full_matrix drafts as rejected with an operator recovery path',()=>{const docs=read('README.md');expect(docs).not.toContain('alte Multi-Offer-Drafts werden sicher zu `matched_rounds` normalisiert');expect(docs).toContain('explizit abgelehnt');expect(docs).toContain('neu anlegen')})});

describe('current operations inventory',()=>{
 it('documents every configured cron route and schedule',()=>{
  const docs=readFileSync(join(process.cwd(),'README.md'),'utf8');
  const config=JSON.parse(readFileSync(join(process.cwd(),'vercel.json'),'utf8'));
  for(const cron of config.crons){expect(docs).toContain(`| \`${cron.path}\` | \`${cron.schedule}\` |`)}
 });
 it('documents Sources, Deals and the difference between health and sync',()=>{
  const docs=readFileSync(join(process.cwd(),'README.md'),'utf8');
  for(const route of ['/sources','/settings/deals','/api/deals','/api/health'])expect(docs).toContain(route);
  expect(docs).toContain('GET /api/sync ist kein lesender Statuscheck');
 });
});
