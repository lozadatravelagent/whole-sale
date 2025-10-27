-- Migration: Create storage bucket for PDF background images
-- Date: 2025-10-06

-- Create storage bucket for PDF backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-backgrounds', 'pdf-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload backgrounds
CREATE POLICY "Authenticated users can upload PDF backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdf-backgrounds');

-- Allow authenticated users to update their backgrounds
CREATE POLICY "Authenticated users can update PDF backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pdf-backgrounds');

-- Allow public read access to backgrounds (needed for PDFMonkey)
CREATE POLICY "Public read access for PDF backgrounds"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-backgrounds');

-- Allow authenticated users to delete backgrounds
CREATE POLICY "Authenticated users can delete PDF backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdf-backgrounds');
