-- Hotelbeds Content API tables
-- Phase 2: Hotel content cache + destination code mapping

-- Hotel content cache (from Content API)
CREATE TABLE IF NOT EXISTS hotelbeds_hotels (
  code TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  category_code TEXT,
  destination_code TEXT,
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  images JSONB DEFAULT '[]',
  facilities JSONB DEFAULT '[]',
  address TEXT,
  web TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Destination code mapping (from Content API)
CREATE TABLE IF NOT EXISTS hotelbeds_destinations (
  code TEXT PRIMARY KEY,
  name TEXT,
  country_code TEXT
);

-- Index for destination lookups
CREATE INDEX IF NOT EXISTS idx_hotelbeds_hotels_destination
  ON hotelbeds_hotels(destination_code);

CREATE INDEX IF NOT EXISTS idx_hotelbeds_hotels_updated
  ON hotelbeds_hotels(updated_at);

CREATE INDEX IF NOT EXISTS idx_hotelbeds_destinations_country
  ON hotelbeds_destinations(country_code);
