-- Create trips table for dedicated trip planner persistence
-- Replaces the messages.meta.plannerData approach with queryable, RLS-protected storage

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  conversation_id UUID UNIQUE REFERENCES conversations(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Trip metadata
  title TEXT,
  summary TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'quoted', 'confirmed', 'archived')),

  -- Travel dates
  start_date DATE,
  end_date DATE,
  total_nights INTEGER,

  -- Preferences
  budget_level TEXT CHECK (budget_level IN ('low', 'mid', 'high', 'luxury')),
  pace TEXT CHECK (pace IN ('relaxed', 'balanced', 'fast')),
  travelers JSONB DEFAULT '{"adults": 2, "children": 0, "infants": 0}',

  -- Destinations (denormalized for fast queries)
  destination_cities TEXT[] DEFAULT '{}',
  destination_countries TEXT[] DEFAULT '{}',

  -- Full planner state
  planner_state JSONB NOT NULL DEFAULT '{}',

  -- Versioning
  version INTEGER DEFAULT 1,
  last_state_hash TEXT,
  last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_edited_at TIMESTAMPTZ,

  -- CRM link (Bloque 5)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_trips_agency ON trips(agency_id);
CREATE INDEX idx_trips_tenant ON trips(tenant_id);
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trips_status ON trips(status) WHERE status != 'archived';
CREATE INDEX idx_trips_start_date ON trips(start_date);
CREATE INDEX idx_trips_conversation ON trips(conversation_id);
CREATE INDEX idx_trips_lead ON trips(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_trips_destination_cities ON trips USING GIN(destination_cities);
CREATE INDEX idx_trips_agency_updated ON trips(agency_id, updated_at DESC) WHERE status != 'archived';

-- Trip segments (denormalized for fast queries without parsing planner_state)
CREATE TABLE IF NOT EXISTS trip_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  segment_index INTEGER NOT NULL,
  city TEXT NOT NULL,
  country TEXT,

  start_date DATE,
  end_date DATE,
  nights INTEGER,

  -- Search statuses
  hotel_status TEXT DEFAULT 'idle',
  transport_in_status TEXT DEFAULT 'idle',
  transport_out_status TEXT DEFAULT 'idle',

  -- Confirmed data (for fast CRM/reporting queries)
  hotel_name TEXT,
  hotel_price_per_night NUMERIC,
  flight_price_per_person NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trip_segments_trip ON trip_segments(trip_id);

-- Updated_at trigger
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_segments ENABLE ROW LEVEL SECURITY;

-- OWNER: full access
CREATE POLICY "OWNER can view all trips"
  ON trips FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'OWNER'
    )
  );

-- SUPERADMIN: tenant-scoped
CREATE POLICY "SUPERADMIN can view tenant trips"
  ON trips FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPERADMIN'
      AND users.tenant_id = trips.tenant_id
    )
  );

-- ADMIN: agency-scoped
CREATE POLICY "ADMIN can view agency trips"
  ON trips FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
      AND users.agency_id = trips.agency_id
    )
  );

-- SELLER: only own trips
CREATE POLICY "SELLER can view own trips"
  ON trips FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- INSERT: any authenticated user in the agency
CREATE POLICY "Users can create trips in their agency"
  ON trips FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.agency_id = trips.agency_id
    )
  );

-- UPDATE: creator or admin+
CREATE POLICY "Creator or admin can update trips"
  ON trips FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OWNER', 'SUPERADMIN', 'ADMIN')
      AND users.agency_id = trips.agency_id
    )
  );

-- Trip segments inherit trip access
CREATE POLICY "Trip segments follow trip access"
  ON trip_segments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = trip_segments.trip_id
    )
  );

CREATE POLICY "Trip segments insertable by trip owner"
  ON trip_segments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = trip_segments.trip_id
    )
  );

CREATE POLICY "Trip segments deletable by trip owner"
  ON trip_segments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = trip_segments.trip_id
    )
  );

-- View for CRM: trips by lead with estimated pricing
CREATE OR REPLACE VIEW lead_trips AS
SELECT
  t.id AS trip_id,
  t.lead_id,
  t.title,
  t.status,
  t.start_date,
  t.end_date,
  t.destination_cities,
  t.budget_level,
  t.travelers,
  t.created_by,
  t.created_at,
  t.updated_at,
  COALESCE(
    (SELECT SUM(
      COALESCE(ts.hotel_price_per_night * ts.nights, 0) +
      COALESCE(ts.flight_price_per_person, 0)
    ) FROM trip_segments ts WHERE ts.trip_id = t.id),
    0
  ) AS estimated_price
FROM trips t
WHERE t.lead_id IS NOT NULL;
