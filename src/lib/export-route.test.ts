import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
/** Export-Vertrag Etappe 4: Kappungshinweis, X-Export-Truncated, granularity=month – bei unveränderten Rechte-/Scope-/Finanz-Markern (access-boundaries.test.ts). */
describe('export route contract (Etappe 4)',()=>{
 const route=()=>read('src/app/api/exports/route.ts');
 it('keeps the scoped, finance-safe, audited markers',()=>{const source=route();expect(source).toContain("requirePermission('exports.download')");expect(source).toContain('filterPartnerRows(data,auth.user.access)');expect(source).toContain("stripFinance(scoped,can(auth.user.access,'finance.view'))");expect(source).toContain("action:'export.download'");expect(source).toContain('foreignScopeRequested(auth.user.access,requested)');expect(source).toContain("assertScopesSupported(auth.user.access,['affiliate','offer','campaign','source','sub_source'])")});
 it('detects the cap via exportTruncated, writes the notice as the first CSV line and sets X-Export-Truncated only then',()=>{
  const source=route();
  expect(source).toContain('truncated=exportTruncated(result)');
  expect(source).toContain("const csv=[...(truncated?[exportTruncationNotice(cappedAt,granularity)]:[])");
  expect(source).toContain("...(truncated?{'X-Export-Truncated':'1'}:{})");
  expect(read('src/lib/export-query.ts')).toContain('`# gekappt bei ${rows} Zeilen – Zeitraum verkleinern oder granularity=month nutzen`');
 });
 it('serves granularity=month through the paged monthly loader with the same filters and partner scopes, rejects other values',()=>{
  const source=route();
  expect(source).toContain("granularity=parseExportGranularity(params.get('granularity'))");
  expect(source).toContain("if(granularity===null)return NextResponse.json({error:'granularity ist ungültig (day oder month)'},{status:400");
  expect(source).toContain("if(granularity==='month'){const monthly=await loadMonthlyExportRows(getSupabaseAdmin() as never,filters,partnerScopes)");
  expect(source).toContain('data=monthly.rows;truncated=monthly.truncated;cappedAt=monthly.dailyRows');
  expect(read('src/lib/export-query.ts')).toContain('metric_month');
 });
 it('extends the audit entry additively with granularity and truncated',()=>{const source=route();expect(source).toContain("after:{rows:rows.length,from,to,finance:can(auth.user.access,'finance.view'),granularity,truncated}");expect(source).toContain("targetId:`${granularity==='month'?'daily_metrics_month':'daily_metrics'}:${rows.length}`")});
 it('does not touch the sync or data paths and keeps reads on daily_metrics only',()=>{const query=read('src/lib/export-query.ts');expect(query.split("from('daily_metrics')")).toHaveLength(2);expect(query).not.toContain('sync_state');expect(query).not.toContain('rpc(')});
});
