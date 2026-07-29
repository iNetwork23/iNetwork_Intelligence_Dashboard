begin;

create table if not exists public.app_rate_limits (
  identifier_hash char(64) primary key,
  failure_count integer not null default 0 check (failure_count >= 0),
  window_started_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.app_rate_limits enable row level security;
revoke all on public.app_rate_limits from anon, authenticated;
grant all on public.app_rate_limits to service_role;

create or replace function public.app_validate_session(
  p_token_hash char(64),
  p_now timestamptz default now(),
  p_idle_interval interval default interval '30 minutes'
) returns table(user_id uuid, actor_id uuid, metadata_version bigint, created_at timestamptz, last_seen_at timestamptz, expires_at timestamptz)
language sql security definer set search_path = '' as $$
  with candidate as (
    select s.token_hash,
           s.revoked_at is null and p_now <= s.expires_at and p_now - s.last_seen_at <= p_idle_interval as valid
      from public.app_sessions s
     where s.token_hash = p_token_hash
     for update
  ), updated as (
    update public.app_sessions s
       set last_seen_at = case when c.valid then p_now else s.last_seen_at end,
           revoked_at = case when c.valid then s.revoked_at else coalesce(s.revoked_at,p_now) end
      from candidate c
     where s.token_hash = c.token_hash
    returning s.user_id,s.actor_id,s.metadata_version,s.created_at,s.last_seen_at,s.expires_at,c.valid
  )
  select u.user_id,u.actor_id,u.metadata_version,u.created_at,u.last_seen_at,u.expires_at
    from updated u where u.valid;
$$;

create or replace function public.app_revoke_session(p_token_hash char(64),p_now timestamptz default now())
returns boolean language sql security definer set search_path = '' as $$
  with revoked as (
    update public.app_sessions set revoked_at=coalesce(revoked_at,p_now)
     where token_hash=p_token_hash and revoked_at is null
    returning 1
  ) select exists(select 1 from revoked);
$$;

create or replace function public.app_revoke_user_sessions(p_user_id uuid,p_now timestamptz default now())
returns bigint language sql security definer set search_path = '' as $$
  with revoked as (
    update public.app_sessions set revoked_at=coalesce(revoked_at,p_now)
     where revoked_at is null and (user_id=p_user_id or actor_id=p_user_id)
    returning 1
  ) select count(*)::bigint from revoked;
$$;

create or replace function public.app_rate_limit_preflight(
  p_identifier_hash char(64),p_now timestamptz,p_limit integer,p_window interval
) returns table(allowed boolean,retry_after_seconds integer)
language sql security definer set search_path = '' as $$
  select coalesce(r.window_started_at + p_window <= p_now or r.failure_count < p_limit,true),
         case when r.window_started_at + p_window > p_now and r.failure_count >= p_limit
              then greatest(1,ceil(extract(epoch from r.window_started_at + p_window - p_now))::integer) else 0 end
    from (select 1) seed left join public.app_rate_limits r on r.identifier_hash=p_identifier_hash;
$$;

create or replace function public.app_record_rate_limit_failure(
  p_identifier_hash char(64),p_now timestamptz,p_limit integer,p_window interval
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_limit < 1 or p_window <= interval '0 seconds' then raise exception 'invalid rate-limit policy'; end if;
  insert into public.app_rate_limits(identifier_hash,failure_count,window_started_at,updated_at)
  values(p_identifier_hash,1,p_now,p_now)
  on conflict(identifier_hash) do update
     set failure_count=case when public.app_rate_limits.window_started_at + p_window <= p_now then 1 else least(public.app_rate_limits.failure_count+1,p_limit) end,
         window_started_at=case when public.app_rate_limits.window_started_at + p_window <= p_now then p_now else public.app_rate_limits.window_started_at end,
         updated_at=p_now
  returning failure_count into v_count;
  return v_count;
end;
$$;

create or replace function public.app_reset_rate_limit(p_identifier_hash char(64))
returns void language sql security definer set search_path = '' as $$
  delete from public.app_rate_limits where identifier_hash=p_identifier_hash;
$$;

create or replace function public.app_mutate_user_role(
  p_target_user_id uuid,
  p_role_id uuid,
  p_status text,
  p_assigned_by uuid,
  p_expected_version bigint
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_current_base text;
  v_current_status text;
  v_next_base text;
  v_active_supers bigint;
  v_new_version bigint;
begin
  if p_status not in ('active','blocked','deactivated') then raise exception 'invalid account status'; end if;
  perform pg_advisory_xact_lock(hashtext('app:last-super-admin'));
  select r.base_role,u.status into v_current_base,v_current_status
    from public.app_user_roles u join public.app_roles r on r.id=u.role_id
   where u.user_id=p_target_user_id for update of u;
  if not found then raise exception 'user role assignment not found'; end if;
  select base_role into strict v_next_base from public.app_roles where id=p_role_id;
  if v_current_base='super_admin' and v_current_status='active' and not (v_next_base='super_admin' and p_status='active') then
    select count(*) into v_active_supers
      from public.app_user_roles u join public.app_roles r on r.id=u.role_id
     where r.base_role='super_admin' and u.status='active';
    if v_active_supers <= 1 then raise exception 'Der letzte aktive Super-Admin darf nicht entfernt werden.' using errcode='23514'; end if;
  end if;
  update public.app_user_roles
     set role_id=p_role_id,status=p_status,assigned_by=p_assigned_by,assigned_at=now(),updated_at=now(),metadata_version=metadata_version+1
   where user_id=p_target_user_id and metadata_version=p_expected_version
  returning metadata_version into v_new_version;
  if not found then raise exception 'stale user role version' using errcode='40001'; end if;
  update public.app_sessions set revoked_at=coalesce(revoked_at,now())
   where revoked_at is null and (user_id=p_target_user_id or actor_id=p_target_user_id);
  return v_new_version;
end;
$$;

revoke all on function public.app_validate_session(char(64),timestamptz,interval) from public,anon,authenticated;
revoke all on function public.app_revoke_session(char(64),timestamptz) from public,anon,authenticated;
revoke all on function public.app_revoke_user_sessions(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.app_rate_limit_preflight(char(64),timestamptz,integer,interval) from public,anon,authenticated;
revoke all on function public.app_record_rate_limit_failure(char(64),timestamptz,integer,interval) from public,anon,authenticated;
revoke all on function public.app_reset_rate_limit(char(64)) from public,anon,authenticated;
revoke all on function public.app_mutate_user_role(uuid,uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.app_validate_session(char(64),timestamptz,interval),public.app_revoke_session(char(64),timestamptz),public.app_revoke_user_sessions(uuid,timestamptz),public.app_rate_limit_preflight(char(64),timestamptz,integer,interval),public.app_record_rate_limit_failure(char(64),timestamptz,integer,interval),public.app_reset_rate_limit(char(64)),public.app_mutate_user_role(uuid,uuid,text,uuid,bigint) to service_role;

commit;
