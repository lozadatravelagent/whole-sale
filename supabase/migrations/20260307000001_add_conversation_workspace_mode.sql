do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'conversation_workspace_mode'
  ) then
    create type public.conversation_workspace_mode as enum ('standard', 'planner');
  end if;
end $$;

alter table public.conversations
add column if not exists workspace_mode public.conversation_workspace_mode not null default 'standard';

update public.conversations as c
set workspace_mode = 'planner'
where c.workspace_mode = 'standard'
  and (
    c.external_key = 'Planificador de Viajes'
    or exists (
      select 1
      from public.messages as m
      where m.conversation_id = c.id
        and (
          coalesce(m.meta, '{}'::jsonb) ? 'plannerData'
          or coalesce(m.meta ->> 'messageType', '') in (
            'trip_planner',
            'trip_planner_state',
            'planner_date_selection'
          )
          or coalesce(m.meta ->> 'plannerPromptAction', '') = 'open_date_selector'
          or coalesce(m.meta -> 'plannerDateSelector' ->> 'enabled', 'false') = 'true'
          or (
            coalesce(m.meta ->> 'messageType', '') = 'missing_info_request'
            and (
              coalesce(m.meta ->> 'plannerPromptAction', '') = 'open_date_selector'
              or coalesce(m.meta -> 'missingFields', '[]'::jsonb) @> '["exact_dates"]'::jsonb
            )
          )
          or (
            coalesce(m.meta ->> 'messageType', '') = 'contextual_memory'
            and coalesce(
              m.meta -> 'parsedRequest' ->> 'requestType',
              m.meta -> 'originalRequest' ->> 'requestType',
              ''
            ) = 'itinerary'
          )
          or coalesce(
            m.meta -> 'parsedRequest' ->> 'requestType',
            m.meta -> 'originalRequest' ->> 'requestType',
            ''
          ) = 'itinerary'
        )
    )
  );

drop function if exists public.get_conversations_with_agency();

create function public.get_conversations_with_agency()
returns table (
  agency_id uuid,
  agency_name text,
  channel public.conversation_channel,
  created_at timestamptz,
  created_by uuid,
  creator_email text,
  creator_role public.user_role,
  external_key text,
  id uuid,
  last_message_at timestamptz,
  phone_number_id text,
  state public.conversation_state,
  tenant_id uuid,
  tenant_name text,
  workspace_mode public.conversation_workspace_mode
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select u.id, u.role, u.tenant_id, u.agency_id
    from public.users as u
    where u.id = auth.uid()
  )
  select
    c.agency_id,
    a.name as agency_name,
    c.channel,
    c.created_at,
    c.created_by,
    creator.email as creator_email,
    creator.role as creator_role,
    c.external_key,
    c.id,
    c.last_message_at,
    c.phone_number_id,
    c.state,
    c.tenant_id,
    t.name as tenant_name,
    c.workspace_mode
  from public.conversations as c
  left join public.agencies as a on a.id = c.agency_id
  left join public.tenants as t on t.id = c.tenant_id
  left join public.users as creator on creator.id = c.created_by
  join viewer on true
  where
    viewer.role = 'OWNER'
    or (viewer.role = 'SUPERADMIN' and c.tenant_id = viewer.tenant_id)
    or (viewer.role = 'ADMIN' and c.agency_id = viewer.agency_id)
    or (viewer.role = 'SELLER' and c.created_by = viewer.id)
  order by c.last_message_at desc;
$$;

grant execute on function public.get_conversations_with_agency() to authenticated;
