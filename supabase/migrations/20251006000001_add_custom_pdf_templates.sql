-- Migration: Add custom PDF template support for agencies
-- Description: Allows each agency to have custom PDF templates for quotes
-- Date: 2025-10-06

-- Add custom_template_ids column to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS custom_template_ids JSONB DEFAULT '{
  "combined": null,
  "flights": null,
  "flights2": null,
  "hotels": null
}'::jsonb;

-- Add pdf_backgrounds column to store background image URLs
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS pdf_backgrounds JSONB DEFAULT '{
  "combined": null,
  "flights": null,
  "flights2": null,
  "hotels": null
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN agencies.custom_template_ids IS 'PDFMonkey template IDs for custom PDF generation. Structure: {"combined": "uuid", "flights": "uuid", "flights2": "uuid", "hotels": "uuid"}';
COMMENT ON COLUMN agencies.pdf_backgrounds IS 'Background image URLs for PDF templates. Structure: {"combined": "https://...", "flights": "https://...", "flights2": "https://...", "hotels": "https://..."}';

-- Create index for faster lookups on custom templates
CREATE INDEX IF NOT EXISTS idx_agencies_custom_templates ON agencies USING gin(custom_template_ids);

-- Add template_config to branding for advanced customization
-- This allows parametrization even when using default templates
UPDATE agencies
SET branding = jsonb_set(
  COALESCE(branding, '{}'::jsonb),
  '{template_config}',
  '{
    "layout": "modern",
    "showLogo": true,
    "logoPosition": "top-left",
    "showContactFooter": true,
    "customSections": ["flights", "hotels", "terms"]
  }'::jsonb,
  true
)
WHERE branding IS NULL OR NOT (branding ? 'template_config');
