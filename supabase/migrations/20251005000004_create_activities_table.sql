-- Create activities table for tracking lead and system activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN ('lead_created', 'lead_won', 'lead_lost', 'quote_sent', 'message_sent', 'status_changed', 'note_added')),
  description TEXT NOT NULL,

  -- Related entities
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Metadata (JSON for flexible data storage)
  metadata JSONB DEFAULT '{}',

  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_agency_id ON activities(agency_id);
CREATE INDEX idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX idx_activities_lead_id ON activities(lead_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_user_id ON activities(user_id);

-- Composite index for common queries
CREATE INDEX idx_activities_agency_created ON activities(agency_id, created_at DESC) WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- OWNER: See all activities
CREATE POLICY "OWNER can view all activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'OWNER'
    )
  );

-- SUPERADMIN: See activities in their tenant
CREATE POLICY "SUPERADMIN can view tenant activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPERADMIN'
      AND users.tenant_id = activities.tenant_id
    )
  );

-- ADMIN: See activities in their agency
CREATE POLICY "ADMIN can view agency activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
      AND users.agency_id = activities.agency_id
    )
  );

-- SELLER: See activities for their assigned leads
CREATE POLICY "SELLER can view own lead activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = activities.lead_id
      AND leads.assigned_user_id = auth.uid()
    )
  );

-- INSERT policies: Users can create activities for their scope
CREATE POLICY "Users can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        -- OWNER can create any activity
        users.role = 'OWNER'
        OR
        -- SUPERADMIN can create activities in their tenant
        (users.role = 'SUPERADMIN' AND users.tenant_id = activities.tenant_id)
        OR
        -- ADMIN can create activities in their agency
        (users.role = 'ADMIN' AND users.agency_id = activities.agency_id)
        OR
        -- SELLER can create activities for their leads
        (users.role = 'SELLER' AND EXISTS (
          SELECT 1 FROM leads
          WHERE leads.id = activities.lead_id
          AND leads.assigned_user_id = auth.uid()
        ))
      )
    )
  );

-- Function to auto-create activity when lead status changes
CREATE OR REPLACE FUNCTION create_activity_on_lead_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create activity if status changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO activities (
      activity_type,
      description,
      lead_id,
      user_id,
      agency_id,
      tenant_id,
      metadata
    ) VALUES (
      CASE
        WHEN NEW.status = 'won' THEN 'lead_won'
        WHEN NEW.status = 'lost' THEN 'lead_lost'
        ELSE 'status_changed'
      END,
      CASE
        WHEN NEW.status = 'won' THEN 'Lead ganado: ' || NEW.contact->>'name'
        WHEN NEW.status = 'lost' THEN 'Lead perdido: ' || NEW.contact->>'name'
        ELSE 'Estado cambiado a ' || NEW.status || ': ' || NEW.contact->>'name'
      END,
      NEW.id,
      NEW.assigned_user_id,
      NEW.agency_id,
      NEW.tenant_id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'budget', NEW.budget,
        'destination', NEW.trip->>'city'
      )
    );
  END IF;

  -- Create activity when new lead is created
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO activities (
      activity_type,
      description,
      lead_id,
      user_id,
      agency_id,
      tenant_id,
      metadata
    ) VALUES (
      'lead_created',
      'Nuevo lead: ' || NEW.contact->>'name',
      NEW.id,
      NEW.assigned_user_id,
      NEW.agency_id,
      NEW.tenant_id,
      jsonb_build_object(
        'destination', NEW.trip->>'city',
        'budget', NEW.budget
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_activity_on_lead_change ON leads;
CREATE TRIGGER trigger_create_activity_on_lead_change
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_on_lead_change();

-- Add comment
COMMENT ON TABLE activities IS 'Activity log for tracking lead and system events';
