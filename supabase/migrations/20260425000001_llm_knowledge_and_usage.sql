-- LLM knowledge and usage persistence
-- Date: 2026-04-25

create table if not exists public.lead_ai_profiles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  source_conversation_id uuid null references public.conversations(id) on delete set null,
  profile_json jsonb not null default '{}'::jsonb,
  summary_text text null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_ai_profiles_lead_id on public.lead_ai_profiles(lead_id);
create index if not exists idx_lead_ai_profiles_tenant_agency on public.lead_ai_profiles(tenant_id, agency_id);

drop trigger if exists trg_lead_ai_profiles_updated_at on public.lead_ai_profiles;
create trigger trg_lead_ai_profiles_updated_at
before update on public.lead_ai_profiles
for each row execute function public.update_updated_at_column();

create table if not exists public.llm_request_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete set null,
  agency_id uuid null references public.agencies(id) on delete set null,
  conversation_id uuid null references public.conversations(id) on delete set null,
  lead_id uuid null references public.leads(id) on delete set null,
  provider text not null,
  model text not null,
  feature text not null,
  operation text not null,
  request_id text null,
  prompt_tokens integer null,
  completion_tokens integer null,
  cached_tokens integer null,
  total_tokens integer null,
  estimated_cost_usd numeric(12, 6) not null default 0,
  latency_ms integer null,
  finish_reason text null,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_llm_request_logs_created_at on public.llm_request_logs(created_at desc);
create index if not exists idx_llm_request_logs_tenant_agency_feature on public.llm_request_logs(tenant_id, agency_id, feature, created_at desc);
create index if not exists idx_llm_request_logs_conversation on public.llm_request_logs(conversation_id, created_at desc);
create index if not exists idx_llm_request_logs_lead on public.llm_request_logs(lead_id, created_at desc);

alter table public.lead_ai_profiles enable row level security;
alter table public.llm_request_logs enable row level security;

drop policy if exists "lead_ai_profiles_select_policy" on public.lead_ai_profiles;
drop policy if exists "lead_ai_profiles_insert_policy" on public.lead_ai_profiles;
drop policy if exists "lead_ai_profiles_update_policy" on public.lead_ai_profiles;
drop policy if exists "llm_request_logs_select_policy" on public.llm_request_logs;

create policy "lead_ai_profiles_select_policy"
  on public.lead_ai_profiles for select to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and (
          public.is_owner()
          or (public.get_user_role() = 'SUPERADMIN' and l.tenant_id = public.get_user_tenant_id())
          or (public.get_user_role() = 'ADMIN' and l.agency_id = public.get_user_agency_id())
          or (public.get_user_role() = 'SELLER' and l.assigned_user_id = auth.uid())
        )
    )
  );

create policy "lead_ai_profiles_insert_policy"
  on public.lead_ai_profiles for insert to authenticated
  with check (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and l.tenant_id = lead_ai_profiles.tenant_id
        and l.agency_id = lead_ai_profiles.agency_id
        and (
          public.is_owner()
          or (public.get_user_role() = 'SUPERADMIN' and l.tenant_id = public.get_user_tenant_id())
          or (public.get_user_role() = 'ADMIN' and l.agency_id = public.get_user_agency_id())
          or (public.get_user_role() = 'SELLER' and l.assigned_user_id = auth.uid())
        )
    )
  );

create policy "lead_ai_profiles_update_policy"
  on public.lead_ai_profiles for update to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and (
          public.is_owner()
          or (public.get_user_role() = 'SUPERADMIN' and l.tenant_id = public.get_user_tenant_id())
          or (public.get_user_role() = 'ADMIN' and l.agency_id = public.get_user_agency_id())
          or (public.get_user_role() = 'SELLER' and l.assigned_user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and l.tenant_id = lead_ai_profiles.tenant_id
        and l.agency_id = lead_ai_profiles.agency_id
        and (
          public.is_owner()
          or (public.get_user_role() = 'SUPERADMIN' and l.tenant_id = public.get_user_tenant_id())
          or (public.get_user_role() = 'ADMIN' and l.agency_id = public.get_user_agency_id())
          or (public.get_user_role() = 'SELLER' and l.assigned_user_id = auth.uid())
        )
    )
  );

create policy "llm_request_logs_select_policy"
  on public.llm_request_logs for select to authenticated
  using (
    public.is_owner()
    or (public.get_user_role() = 'SUPERADMIN' and tenant_id = public.get_user_tenant_id())
    or (public.get_user_role() = 'ADMIN' and agency_id = public.get_user_agency_id())
  );
