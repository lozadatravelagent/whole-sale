-- Add preferred_language column to public.users for i18n support
-- Supports: es (default), en, pt

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'es';

COMMENT ON COLUMN public.users.preferred_language IS 'User language preference: es, en, pt';

-- Note: RLS policies already allow users to read/write their own row,
-- so no new policy is needed for preferred_language.
