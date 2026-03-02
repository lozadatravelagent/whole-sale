-- Hotelbeds Cache API table
-- Phase 5: Bulk inventory cache for fast price estimates

CREATE TABLE IF NOT EXISTS hotelbeds_cache (
  hotel_code TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  min_rate NUMERIC,
  max_rate NUMERIC,
  room_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (hotel_code, check_in, check_out, currency)
);

CREATE INDEX IF NOT EXISTS idx_hotelbeds_cache_hotel
  ON hotelbeds_cache(hotel_code);

CREATE INDEX IF NOT EXISTS idx_hotelbeds_cache_dates
  ON hotelbeds_cache(check_in, check_out);

CREATE INDEX IF NOT EXISTS idx_hotelbeds_cache_updated
  ON hotelbeds_cache(updated_at);
