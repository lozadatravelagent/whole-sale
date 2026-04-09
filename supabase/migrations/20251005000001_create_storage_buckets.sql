-- Create storage bucket for agency logos
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('agency-logos', 'agency-logos', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_column THEN
  INSERT INTO storage.buckets (id, name)
  VALUES ('agency-logos', 'agency-logos')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage policies — wrapped in exception handler because storage.objects
-- ownership varies across Supabase versions (local vs hosted)
DO $$ BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can view agency logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agency-logos');

  CREATE POLICY "Users can upload agency logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agency-logos'
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role IN ('OWNER', 'SUPERADMIN', 'ADMIN')
      )
    )
  );

  CREATE POLICY "Users can update agency logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agency-logos'
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role IN ('OWNER', 'SUPERADMIN', 'ADMIN')
      )
    )
  )
  WITH CHECK (
    bucket_id = 'agency-logos'
  );

  CREATE POLICY "Users can delete agency logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agency-logos'
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role IN ('OWNER', 'SUPERADMIN', 'ADMIN')
      )
    )
  );

  COMMENT ON POLICY "Users can upload agency logos" ON storage.objects IS
  'OWNER, SUPERADMIN, and ADMIN can upload logos for agencies';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping storage policies — insufficient privileges (expected on Supabase local)';
END $$;
