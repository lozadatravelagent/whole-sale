-- Create storage bucket for agency logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-logos', 'agency-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view agency logos (public bucket)
CREATE POLICY IF NOT EXISTS "Anyone can view agency logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'agency-logos');

-- Policy: Authenticated users with proper role can upload logos
CREATE POLICY IF NOT EXISTS "Users can upload agency logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agency-logos'
  AND (
    -- Check user has permission to edit agency settings
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('OWNER', 'SUPERADMIN', 'ADMIN')
    )
  )
);

-- Policy: Users can update their agency logos
CREATE POLICY IF NOT EXISTS "Users can update agency logos"
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

-- Policy: Users can delete their agency logos
CREATE POLICY IF NOT EXISTS "Users can delete agency logos"
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

-- Add comment for documentation
COMMENT ON POLICY "Users can upload agency logos" ON storage.objects IS
'OWNER, SUPERADMIN, and ADMIN can upload logos for agencies';
