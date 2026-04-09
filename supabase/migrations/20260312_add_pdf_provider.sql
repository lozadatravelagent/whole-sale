-- 1. Add pdf_provider column to agencies
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS pdf_provider text NOT NULL DEFAULT 'custom'
CHECK (pdf_provider IN ('pdfmonkey', 'custom'));

UPDATE agencies SET pdf_provider = 'pdfmonkey'
WHERE name IN ('Agency Team', 'Agency Team 2', 'Lozada Agency');

-- 2. Create storage buckets (idempotent)
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('agency-logos', 'agency-logos', true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('pdf-backgrounds', 'pdf-backgrounds', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_column THEN
  INSERT INTO storage.buckets (id, name)
  VALUES ('documents', 'documents')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name)
  VALUES ('agency-logos', 'agency-logos')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name)
  VALUES ('pdf-backgrounds', 'pdf-backgrounds')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 3. Storage RLS policies
DO $$ BEGIN
  -- documents bucket
  CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

  CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

  CREATE POLICY "Public can read documents"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'documents');

  -- agency-logos bucket
  CREATE POLICY "Authenticated users can upload agency logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agency-logos');

  CREATE POLICY "Authenticated users can update agency logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agency-logos');

  CREATE POLICY "Public can read agency logos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'agency-logos');

  CREATE POLICY "Authenticated users can read agency logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agency-logos');

  -- pdf-backgrounds bucket
  CREATE POLICY "Authenticated users can upload pdf backgrounds"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pdf-backgrounds');

  CREATE POLICY "Authenticated users can update pdf backgrounds"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pdf-backgrounds');

  CREATE POLICY "Public can read pdf backgrounds"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'pdf-backgrounds');

  CREATE POLICY "Authenticated users can read pdf backgrounds"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pdf-backgrounds');
EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN
  RAISE NOTICE 'Skipping storage policies — insufficient privileges or already exist';
END $$;
