-- Make migration idempotent and compatible with Supabase Postgres
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('SUPERADMIN', 'ADMIN');
  end if;
  if not exists (select 1 from pg_type where typname = 'integration_status') then
    create type public.integration_status as enum ('active','pending','disabled');
  end if;
  if not exists (select 1 from pg_type where typname = 'conversation_channel') then
    create type public.conversation_channel as enum ('wa','web');
  end if;
  if not exists (select 1 from pg_type where typname = 'conversation_state') then
    create type public.conversation_state as enum ('active','closed','pending');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type public.message_role as enum ('user','assistant','system');
  end if;
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type public.lead_status as enum ('new','quoted','negotiating','won','lost');
  end if;
  if not exists (select 1 from pg_type where typname = 'quality_state') then
    create type public.quality_state as enum ('GREEN','YELLOW','RED');
  end if;
  if not exists (select 1 from pg_type where typname = 'provider_code') then
    create type public.provider_code as enum ('EUROVIPS','LOZADA','DELFOS','ICARO','STARLING');
  end if;
  if not exists (select 1 from pg_type where typname = 'auth_provider') then
    create type public.auth_provider as enum ('email','google');
  end if;
end $$;

-- Timestamp trigger function
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper functions for RLS
create or replace function public.is_superadmin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'SUPERADMIN'::public.user_role
  );
$$;

create or replace function public.is_same_tenant(_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.tenant_id = _tenant_id
  );
$$;

create or replace function public.is_same_agency(_agency_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.agency_id = _agency_id
  );
$$;

-- Tables
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Triggers (drop then create for compatibility)
drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.update_updated_at_column();

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  branding jsonb not null default jsonb_build_object(),
  phones text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agencies_tenant on public.agencies(tenant_id);
drop trigger if exists trg_agencies_updated_at on public.agencies;
create trigger trg_agencies_updated_at
before update on public.agencies
for each row execute function public.update_updated_at_column();

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  email text not null,
  role public.user_role not null default 'ADMIN',
  provider public.auth_provider not null default 'email',
  created_at timestamptz not null default now()
);
create index if not exists idx_users_tenant_agency on public.users(tenant_id, agency_id);

create table if not exists public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone_number_id text not null,
  waba_id text not null,
  token_encrypted text not null,
  quality_state public.quality_state not null default 'GREEN',
  meta jsonb not null default jsonb_build_object()
);
create index if not exists idx_wa_numbers_tenant on public.whatsapp_numbers(tenant_id);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  provider_code public.provider_code not null,
  credentials_encrypted jsonb not null default jsonb_build_object(),
  status public.integration_status not null default 'pending',
  meta jsonb not null default jsonb_build_object(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_integrations_agency on public.integrations(agency_id);
drop trigger if exists trg_integrations_updated_at on public.integrations;
create trigger trg_integrations_updated_at
before update on public.integrations
for each row execute function public.update_updated_at_column();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  channel public.conversation_channel not null,
  external_key text not null,
  phone_number_id text null,
  state public.conversation_state not null default 'active',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_conversations_tenant_agency on public.conversations(tenant_id, agency_id);
create index if not exists idx_conversations_last_message on public.conversations(last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content jsonb not null default jsonb_build_object(),
  meta jsonb not null default jsonb_build_object(),
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact jsonb not null,
  trip jsonb not null,
  status public.lead_status not null default 'new',
  conversation_id uuid null references public.conversations(id) on delete set null,
  pdf_urls text[] not null default array[]::text[],
  assigned_user_id uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_tenant_agency_status on public.leads(tenant_id, agency_id, status);
drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.update_updated_at_column();

create table if not exists public.reports_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  date date not null,
  metrics jsonb not null default jsonb_build_object()
);
create unique index if not exists uq_reports_daily_tenant_agency_date on public.reports_daily(tenant_id, agency_id, date);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id uuid,
  action text not null,
  target text,
  meta jsonb not null default jsonb_build_object(),
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at);

-- Enable RLS on all tables
alter table public.tenants enable row level security;
alter table public.agencies enable row level security;
alter table public.users enable row level security;
alter table public.whatsapp_numbers enable row level security;
alter table public.integrations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;
alter table public.reports_daily enable row level security;
alter table public.audit_logs enable row level security;

-- Policies (drop then create to be idempotent)
-- tenants
drop policy if exists "superadmins can select tenants in their tenant" on public.tenants;
create policy "superadmins can select tenants in their tenant"
  on public.tenants for select to authenticated
  using (public.is_superadmin() and public.is_same_tenant(id));

drop policy if exists "superadmins can insert tenants" on public.tenants;
create policy "superadmins can insert tenants"
  on public.tenants for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists "superadmins can update tenants" on public.tenants;
create policy "superadmins can update tenants"
  on public.tenants for update to authenticated
  using (public.is_superadmin() and public.is_same_tenant(id))
  with check (public.is_superadmin() and public.is_same_tenant(id));

drop policy if exists "superadmins can delete tenants" on public.tenants;
create policy "superadmins can delete tenants"
  on public.tenants for delete to authenticated
  using (public.is_superadmin() and public.is_same_tenant(id));

-- agencies
drop policy if exists "superadmins can select agencies in tenant" on public.agencies;
create policy "superadmins can select agencies in tenant"
  on public.agencies for select to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id));

drop policy if exists "admins can select their agency" on public.agencies;
create policy "admins can select their agency"
  on public.agencies for select to authenticated
  using (public.is_same_agency(id));

drop policy if exists "superadmins can manage agencies" on public.agencies;
create policy "superadmins can manage agencies"
  on public.agencies for all to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id))
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

drop policy if exists "admins can update their agency" on public.agencies;
create policy "admins can update their agency"
  on public.agencies for update to authenticated
  using (public.is_same_agency(id))
  with check (public.is_same_agency(id));

-- users
drop policy if exists "user can select self" on public.users;
create policy "user can select self"
  on public.users for select to authenticated
  using (id = auth.uid());

drop policy if exists "superadmins can select users in tenant" on public.users;
create policy "superadmins can select users in tenant"
  on public.users for select to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id));

drop policy if exists "superadmins can insert users" on public.users;
create policy "superadmins can insert users"
  on public.users for insert to authenticated
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

drop policy if exists "user can update self" on public.users;
create policy "user can update self"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "superadmins can update users in tenant" on public.users;
create policy "superadmins can update users in tenant"
  on public.users for update to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id))
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

drop policy if exists "superadmins can delete users in tenant" on public.users;
create policy "superadmins can delete users in tenant"
  on public.users for delete to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id));

-- whatsapp_numbers
drop policy if exists "superadmins can manage whatsapp_numbers" on public.whatsapp_numbers;
create policy "superadmins can manage whatsapp_numbers"
  on public.whatsapp_numbers for all to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id))
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

-- integrations
drop policy if exists "admins can manage their integrations" on public.integrations;
create policy "admins can manage their integrations"
  on public.integrations for all to authenticated
  using (public.is_same_agency(agency_id))
  with check (public.is_same_agency(agency_id));

drop policy if exists "superadmins can manage integrations in tenant" on public.integrations;
create policy "superadmins can manage integrations in tenant"
  on public.integrations for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- conversations
drop policy if exists "admins can read conversations of their agency" on public.conversations;
create policy "admins can read conversations of their agency"
  on public.conversations for select to authenticated
  using (public.is_same_agency(agency_id));

drop policy if exists "admins can write conversations of their agency" on public.conversations;
create policy "admins can write conversations of their agency"
  on public.conversations for insert to authenticated
  with check (public.is_same_agency(agency_id));

drop policy if exists "admins can update conversations of their agency" on public.conversations;
create policy "admins can update conversations of their agency"
  on public.conversations for update to authenticated
  using (public.is_same_agency(agency_id))
  with check (public.is_same_agency(agency_id));

drop policy if exists "superadmins can manage conversations in tenant" on public.conversations;
create policy "superadmins can manage conversations in tenant"
  on public.conversations for all to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id))
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

-- messages
drop policy if exists "admins can read messages of their agency" on public.messages;
create policy "admins can read messages of their agency"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_same_agency(c.agency_id)
  ));

drop policy if exists "admins can write messages of their agency" on public.messages;
create policy "admins can write messages of their agency"
  on public.messages for insert to authenticated
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_same_agency(c.agency_id)
  ));

drop policy if exists "superadmins can manage messages in tenant" on public.messages;
create policy "superadmins can manage messages in tenant"
  on public.messages for all to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_superadmin() and public.is_same_tenant(c.tenant_id)
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_superadmin() and public.is_same_tenant(c.tenant_id)
  ));

-- leads
drop policy if exists "admins can read leads of their agency" on public.leads;
create policy "admins can read leads of their agency"
  on public.leads for select to authenticated
  using (public.is_same_agency(agency_id));

drop policy if exists "admins can write leads of their agency" on public.leads;
create policy "admins can write leads of their agency"
  on public.leads for insert to authenticated
  with check (public.is_same_agency(agency_id));

drop policy if exists "admins can update leads of their agency" on public.leads;
create policy "admins can update leads of their agency"
  on public.leads for update to authenticated
  using (public.is_same_agency(agency_id))
  with check (public.is_same_agency(agency_id));

drop policy if exists "superadmins can manage leads in tenant" on public.leads;
create policy "superadmins can manage leads in tenant"
  on public.leads for all to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id))
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

-- reports_daily
drop policy if exists "admins can read reports of their agency" on public.reports_daily;
create policy "admins can read reports of their agency"
  on public.reports_daily for select to authenticated
  using (public.is_same_agency(agency_id));

drop policy if exists "superadmins can manage reports in tenant" on public.reports_daily;
create policy "superadmins can manage reports in tenant"
  on public.reports_daily for all to authenticated
  using (public.is_superadmin() and public.is_same_tenant(tenant_id))
  with check (public.is_superadmin() and public.is_same_tenant(tenant_id));

-- audit_logs
drop policy if exists "tenant members can read audit logs" on public.audit_logs;
create policy "tenant members can read audit logs"
  on public.audit_logs for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid()));

drop policy if exists "tenant members can insert audit logs" on public.audit_logs;
create policy "tenant members can insert audit logs"
  on public.audit_logs for insert to authenticated
  with check (exists (select 1 from public.users u where u.id = auth.uid()));
