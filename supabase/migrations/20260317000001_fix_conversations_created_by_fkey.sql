-- Fix: FK constraints without ON DELETE behavior (defaults to RESTRICT),
-- which prevents deleting users that have related records.
-- Change to ON DELETE SET NULL to preserve history when a user is deleted.

-- conversations.created_by: allow NULL so SET NULL can work
ALTER TABLE public.conversations
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT conversations_created_by_fkey;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- api_keys.created_by
ALTER TABLE public.api_keys
  DROP CONSTRAINT api_keys_created_by_fkey;

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
