-- Enable pg_trgm for fast ILIKE searches
create extension if not exists pg_trgm;

-- GIN trigram index on message text content
-- Converts ILIKE '%query%' from sequential scan to index scan (~ms)
create index if not exists idx_messages_content_text_trgm
  on public.messages
  using gin ((content ->> 'text') gin_trgm_ops);

-- RPC: search conversations by message content
create or replace function public.search_conversations_by_content(p_query text)
returns table (conversation_id uuid, snippet text, matched_at timestamptz)
language sql stable security definer set search_path = public
as $$
  with viewer as (
    select u.id, u.role, u.tenant_id, u.agency_id
    from public.users u where u.id = auth.uid()
  )
  select distinct on (m.conversation_id)
    m.conversation_id,
    left(m.content ->> 'text', 80) as snippet,
    m.created_at as matched_at
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join viewer v on true
  where
    m.content ->> 'text' ilike '%' || p_query || '%'
    and m.role in ('user', 'assistant')
    and (
      v.role = 'OWNER'
      or (v.role = 'SUPERADMIN' and c.tenant_id = v.tenant_id)
      or (v.role = 'ADMIN' and c.agency_id = v.agency_id)
      or (v.role = 'SELLER' and c.created_by = v.id)
    )
  order by m.conversation_id, m.created_at desc
  limit 50;
$$;

grant execute on function public.search_conversations_by_content(text) to authenticated;
