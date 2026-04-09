-- Migration: Create storage bucket for PDF background images
-- Date: 2025-10-06

-- Create storage bucket for PDF backgrounds
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('pdf-backgrounds', 'pdf-backgrounds', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_column THEN
  INSERT INTO storage.buckets (id, name)
  VALUES ('pdf-backgrounds', 'pdf-backgrounds')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage policies — wrapped for permission compatibility across Supabase versions
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload PDF backgrounds"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pdf-backgrounds');

  CREATE POLICY "Authenticated users can update PDF backgrounds"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pdf-backgrounds');

  CREATE POLICY "Public read access for PDF backgrounds"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'pdf-backgrounds');

  CREATE POLICY "Authenticated users can delete PDF backgrounds"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pdf-backgrounds');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping PDF backgrounds storage policies — insufficient privileges (expected on Supabase local)';
END $$;
