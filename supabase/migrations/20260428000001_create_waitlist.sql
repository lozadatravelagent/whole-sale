-- Public waitlist for early access to Emilia.
-- Anonymous users can submit their email; only platform owners can read or modify.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  language text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_unique
  ON public.waitlist (lower(email));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated users can submit their email.
CREATE POLICY "anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 5 AND 320);

-- Only owners can read the waitlist.
CREATE POLICY "owner can read waitlist"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (public.is_owner());

-- Only owners can delete waitlist entries.
CREATE POLICY "owner can delete waitlist"
  ON public.waitlist
  FOR DELETE
  TO authenticated
  USING (public.is_owner());
