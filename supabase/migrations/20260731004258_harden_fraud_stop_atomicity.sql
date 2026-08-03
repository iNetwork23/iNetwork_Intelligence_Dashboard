begin;

create unique index if not exists fraud_stop_requests_active_identity_uidx
  on public.fraud_stop_requests (
    affiliate_id,
    coalesce(source, ''),
    coalesce(source_dimension, ''),
    coalesce(sub_source, ''),
    coalesce(sub_source_dimension, ''),
    scope,
    coalesce(offer_id, '')
  )
  where deactivated_at is null;

create or replace function public.manage_fraud_stop(
  p_action text,
  p_stop jsonb,
  p_audit jsonb
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_deactivated_at timestamptz;
  v_at timestamptz := clock_timestamp();
  v_audit_id uuid := gen_random_uuid();
begin
  if p_action = 'create' then
    begin
      insert into public.fraud_stop_requests (
        affiliate_id, source, sub_source, source_dimension, sub_source_dimension,
        offer_id, scope, requested_at, grace_hours, channel, reference, note, created_by
      ) values (
        p_stop->>'affiliate_id', nullif(p_stop->>'source',''), nullif(p_stop->>'sub_source',''),
        nullif(p_stop->>'source_dimension',''), nullif(p_stop->>'sub_source_dimension',''),
        nullif(p_stop->>'offer_id',''), p_stop->>'scope', (p_stop->>'requested_at')::timestamptz,
        (p_stop->>'grace_hours')::integer, p_stop->>'channel', nullif(p_stop->>'reference',''),
        nullif(p_stop->>'note',''), p_stop->>'created_by'
      ) returning id into v_id;
    exception when unique_violation then
      select row.id into v_id
      from public.fraud_stop_requests row
      where row.deactivated_at is null
        and row.affiliate_id = p_stop->>'affiliate_id'
        and row.source is not distinct from nullif(p_stop->>'source','')
        and row.source_dimension is not distinct from nullif(p_stop->>'source_dimension','')
        and row.sub_source is not distinct from nullif(p_stop->>'sub_source','')
        and row.sub_source_dimension is not distinct from nullif(p_stop->>'sub_source_dimension','')
        and row.scope = p_stop->>'scope'
        and row.offer_id is not distinct from nullif(p_stop->>'offer_id','');
      if v_id is null then raise; end if;
      return v_id;
    end;
    select to_jsonb(row) into v_after from public.fraud_stop_requests row where row.id = v_id;
    v_before := null;
  elsif p_action = 'deactivate' then
    v_id := (p_stop->>'id')::uuid;
    select row.deactivated_at, to_jsonb(row) into v_deactivated_at, v_before
      from public.fraud_stop_requests row where row.id = v_id for update;
    if v_before is null then raise exception using errcode='P0002', message='stop not found'; end if;
    if v_deactivated_at is not null then return v_id; end if;
    update public.fraud_stop_requests set deactivated_at = v_at where id = v_id;
    select to_jsonb(row) into v_after from public.fraud_stop_requests row where row.id = v_id;
  else
    raise exception using errcode='22023', message='invalid fraud stop action';
  end if;

  insert into public.sync_state (key, value)
  values (
    'rbac:audit:' || to_char(v_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || ':' || v_audit_id::text,
    p_audit || jsonb_build_object(
      'id', v_audit_id::text,
      'at', v_at,
      'action', case when p_action='create' then 'fraud_stop.create' else 'fraud_stop.deactivate' end,
      'targetId', v_id::text,
      'before', v_before,
      'after', v_after
    )
  );
  return v_id;
end;
$$;

revoke all on function public.manage_fraud_stop(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.manage_fraud_stop(text,jsonb,jsonb) to service_role;

commit;
