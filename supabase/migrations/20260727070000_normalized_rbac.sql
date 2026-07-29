begin;

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null check (char_length(name) between 1 and 80),
  base_role text not null check (base_role in ('super_admin','admin','employee','partner','read_only')),
  is_standard boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.app_role_permissions (
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission text not null,
  effect text not null check (effect in ('grant','deny')),
  primary key (role_id, permission)
);
create table if not exists public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','blocked','deactivated')),
  metadata_version bigint not null default 1 check (metadata_version > 0),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.app_user_scopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('affiliate','offer','campaign','account','source','sub_source')),
  scope_value text not null check (char_length(scope_value) between 1 and 200),
  primary key (user_id, scope_type, scope_value)
);
create table if not exists public.app_sessions (
  token_hash char(64) primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  metadata_version bigint not null,
  created_at timestamptz not null,
  last_seen_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id) where revoked_at is null;
create table if not exists public.app_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  ip inet,
  user_agent text
);
create index if not exists app_audit_events_occurred_at_idx on public.app_audit_events(occurred_at desc);
create table if not exists public.app_mfa_factors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null check (state in ('pending','enabled')),
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  last_totp_counter bigint not null default -1,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

insert into public.app_roles(slug,name,base_role,is_standard)
values ('super_admin','Super Admin','super_admin',true),('admin','Admin','admin',true),('employee','Employee','employee',true),('partner','Partner','partner',true),('read_only','Read only','read_only',true)
on conflict (slug) do nothing;

alter table public.app_roles enable row level security;
alter table public.app_role_permissions enable row level security;
alter table public.app_user_roles enable row level security;
alter table public.app_user_scopes enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_audit_events enable row level security;
alter table public.app_mfa_factors enable row level security;

revoke all on public.app_roles, public.app_role_permissions, public.app_user_roles, public.app_user_scopes, public.app_sessions, public.app_audit_events, public.app_mfa_factors from anon, authenticated;
grant all on public.app_roles, public.app_role_permissions, public.app_user_roles, public.app_user_scopes, public.app_sessions, public.app_audit_events, public.app_mfa_factors to service_role;

commit;
