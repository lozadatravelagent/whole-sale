-- Add new fields to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Create sellers table
CREATE TABLE IF NOT EXISTS public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sellers table
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Create temporary policy for sellers (similar to leads)
CREATE POLICY "temp_dev_policy_all_sellers" 
ON public.sellers 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- Insert sample sellers
INSERT INTO public.sellers (name, email) VALUES
('Juan Pérez', 'juan.perez@example.com'),
('María García', 'maria.garcia@example.com'),
('Carlos López', 'carlos.lopez@example.com'),
('Ana Martínez', 'ana.martinez@example.com'),
('Luis Rodríguez', 'luis.rodriguez@example.com')
ON CONFLICT (email) DO NOTHING;

-- Add seller_id to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.sellers(id);

-- Create sections table for dynamic sections
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'bg-gray-100 text-gray-800 border-gray-200',
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sections table
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Create temporary policy for sections
CREATE POLICY "temp_dev_policy_all_sections" 
ON public.sections 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- Insert default sections
INSERT INTO public.sections (agency_id, name, color, position) VALUES
('00000000-0000-0000-0000-000000000002', 'Nuevos', 'bg-blue-100 text-blue-800 border-blue-200', 1),
('00000000-0000-0000-0000-000000000002', 'Cotizados', 'bg-yellow-100 text-yellow-800 border-yellow-200', 2),
('00000000-0000-0000-0000-000000000002', 'Negociando', 'bg-orange-100 text-orange-800 border-orange-200', 3),
('00000000-0000-0000-0000-000000000002', 'Ganados', 'bg-green-100 text-green-800 border-green-200', 4),
('00000000-0000-0000-0000-000000000002', 'Perdidos', 'bg-red-100 text-red-800 border-red-200', 5)
ON CONFLICT DO NOTHING;

-- Add section_id to leads table (instead of using enum status)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id);

-- Update existing leads to use the new section system
UPDATE public.leads SET section_id = (
  SELECT s.id FROM public.sections s 
  WHERE s.agency_id = '00000000-0000-0000-0000-000000000002' 
  AND s.name = 
    CASE leads.status
      WHEN 'new' THEN 'Nuevos'
      WHEN 'quoted' THEN 'Cotizados' 
      WHEN 'negotiating' THEN 'Negociando'
      WHEN 'won' THEN 'Ganados'
      WHEN 'lost' THEN 'Perdidos'
    END
  LIMIT 1
) WHERE section_id IS NULL;