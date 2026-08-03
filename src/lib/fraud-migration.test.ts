import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const dir=join(process.cwd(),'supabase/migrations');
const migration=()=>{
  const file=readdirSync(dir).find(name=>name.endsWith('_account_wide_fraud_control.sql'));
  expect(file,'account-wide fraud migration').toBeTruthy();
  return readFileSync(join(dir,file!),'utf8');
};
const hardeningMigration=()=>{
  const file=readdirSync(dir).find(name=>name.endsWith('_harden_fraud_stop_atomicity.sql'));
  expect(file,'fraud stop hardening migration').toBeTruthy();
  return readFileSync(join(dir,file!),'utf8');
};
const identityMigration=()=>{
  const file=readdirSync(dir).find(name=>name.endsWith('_harden_conversion_customer_identity.sql'));
  expect(file,'conversion identity hardening migration').toBeTruthy();
  return readFileSync(join(dir,file!),'utf8');
};
const replacementMigration=()=>{
  const file=readdirSync(dir).find(name=>name.endsWith('_atomic_conversion_window_replacement.sql'));
  expect(file,'atomic conversion replacement migration').toBeTruthy();
  return readFileSync(join(dir,file!),'utf8');
};
const ltvIdentityMigration=()=>{
  const file=readdirSync(dir).find(name=>name.endsWith('_harden_ltv_unavailable_identities.sql'));
  expect(file,'LTV unavailable identity migration').toBeTruthy();
  return readFileSync(join(dir,file!),'utf8');
};

describe('account-wide fraud persistence migration',()=>{
  it('stores Coin Spend as a conversion and preserves normalized fraud dimensions',()=>{
    const sql=migration();
    expect(sql).toMatch(/type\s+in\s*\(\s*'soi',\s*'coin_spend',\s*'first_sale',\s*'rebill'\s*\)/i);
    for(const column of ['click_at','traffic_mode','source_dimension','sub_source_dimension','country_code','is_scrub','error_code'])expect(sql).toMatch(new RegExp(`add column if not exists ${column}\\b`,'i'));
    expect(sql).toMatch(/conversions_fraud_source_idx/i);
    expect(sql).toMatch(/conversions_fraud_cohort_idx/i);
  });

  it('builds conversion-table indexes concurrently outside the schema transaction',()=>{
    const sql=migration();
    expect(sql).toMatch(/commit;[\s\S]*drop index concurrently if exists public\.conversions_fraud_source_idx;[\s\S]*create index concurrently conversions_fraud_source_idx/i);
    expect(sql).toMatch(/drop index concurrently if exists public\.conversions_fraud_cohort_idx;[\s\S]*create index concurrently conversions_fraud_cohort_idx/i);
    expect(sql).toMatch(/drop index concurrently if exists public\.conversions_fraud_timing_idx;[\s\S]*create index concurrently conversions_fraud_timing_idx/i);
    expect(sql).not.toMatch(/create index if not exists conversions_fraud_/i);
    expect(sql).toMatch(/set local lock_timeout = '5s'/i);
  });

  it('keeps stop requests server-only with RLS and explicit service-role grants',()=>{
    const sql=migration();
    expect(sql).toMatch(/create table if not exists public\.fraud_stop_requests/i);
    expect(sql).toMatch(/scope\s+text\s+not null[\s\S]*check\s*\(scope\s+in\s*\(\s*'offer',\s*'all_offers'\s*\)\)/i);
    expect(sql).toMatch(/grace_hours\s+integer\s+not null\s+default\s+24/i);
    expect(sql).toMatch(/alter table public\.fraud_stop_requests enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.fraud_stop_requests from public, anon, authenticated/i);
    expect(sql).toMatch(/grant all on public\.fraud_stop_requests to service_role/i);
    expect(sql).not.toMatch(/create\s+policy/i);
  });

  it('creates an executable, retry-idempotent atomic stop RPC without assuming sync_state.updated_at',()=>{
    const sql=hardeningMigration();
    expect(sql).not.toMatch(/sync_state\s*\([^)]*updated_at/i);
    expect(sql).toMatch(/fraud_stop_requests_active_identity_uidx/i);
    expect(sql).toMatch(/when unique_violation/i);
    expect(sql).toMatch(/deactivated_at is not null/i);
    expect(sql).toMatch(/set search_path = pg_catalog, public, pg_temp/i);
  });

  it('enforces write-time raw-identity stripping and exposes a bounded resumable repair before constraint validation',()=>{
    const sql=identityMigration();
    expect(sql).toMatch(/create or replace function public\.strip_conversion_raw_identity/i);
    expect(sql).toMatch(/new\.raw\s*:=\s*coalesce\(new\.raw[\s\S]*-\s*'adv4'\s*-\s*'email'/i);
    expect(sql).toMatch(/create trigger conversions_strip_raw_identity/i);
    expect(sql).toMatch(/create or replace function public\.repair_conversion_identity_batch\(p_limit integer/i);
    expect(sql).toMatch(/for update skip locked/i);
    expect(sql).toMatch(/limit p_limit/i);
    expect(sql).toMatch(/raw\s*=\s*coalesce\(row\.raw[\s\S]*-\s*'adv4'\s*-\s*'email'/i);
    expect(sql).toMatch(/'unjoinable-legacy-sha256:'/i);
    expect(sql).toMatch(/check \(length\(btrim\(lead_id\)\) > 0\) not valid/i);
    expect(sql).not.toMatch(/validate constraint conversions_lead_id_nonempty_check/i);
    expect(sql).toMatch(/revoke all on function public\.repair_conversion_identity_batch\(integer\)/i);
  });

  it('replaces a bounded conversion window atomically through a server-only RPC',()=>{
    const sql=replacementMigration();
    expect(sql).toMatch(/create or replace function public\.replace_conversion_window/i);
    expect(sql).toMatch(/delete from public\.conversions[\s\S]*insert into public\.conversions/i);
    expect(sql).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/i);
    expect(sql).toMatch(/revoke all on function public\.replace_conversion_window\(date,date,jsonb\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.replace_conversion_window\(date,date,jsonb\) to service_role/i);
    expect(sql).toMatch(/p_from::timestamp\s+at time zone 'Europe\/Berlin'/i);
    expect(sql).toMatch(/\(p_to \+ 1\)::timestamp\s+at time zone 'Europe\/Berlin'/i);
  });

  it('rebuilds LTV cohorts without unavailable customer markers before the short swap',()=>{
    const sql=ltvIdentityMigration();
    expect(sql).not.toMatch(/^\d+\|/m);
    expect(sql).toMatch(/create materialized view private\.ltv_cohorts_materialized_next[\s\S]*lead_id\s*!~\s*'\^\(unjoinable-[\s\S]*api-customer-unavailable-sha256/i);
    expect(sql).toMatch(/commit;[\s\S]*drop materialized view private\.ltv_cohorts_materialized;[\s\S]*rename to ltv_cohorts_materialized/i);
    expect(sql).toMatch(/refresh materialized view concurrently private\.ltv_cohorts_materialized/i);
    expect(sql).toMatch(/set statement_timeout = '900s'/i);
    expect(sql).toMatch(/insert into public\.sync_state[\s\S]*ltv_cohorts_materialized[\s\S]*when query_canceled/i);
  });
});
