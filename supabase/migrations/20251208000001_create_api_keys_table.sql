-- =====================================================
-- Migration: Create API Keys Table
-- Description: Tabla para gestionar API keys de terceros
-- Date: 2025-12-08
-- =====================================================

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Key management
  key_prefix TEXT NOT NULL,              -- Primeros 8 chars: "wsk_prod_abc123..."
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 hash del resto de la key

  -- Ownership
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),

  -- Scopes & Permissions
  scopes TEXT[] NOT NULL DEFAULT ARRAY['search:*'],

  -- Rate Limiting
  rate_limit_per_minute INTEGER DEFAULT 100,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Lifecycle
  name TEXT,                             -- Friendly name (ej: "Producción Web")
  environment TEXT DEFAULT 'production', -- 'production' | 'development' | 'staging'
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,                -- NULL = never expires

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CONSTRAINT api_keys_environment_check CHECK (environment IN ('production', 'development', 'staging'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_agency ON api_keys(agency_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE api_keys IS 'API keys para acceso de terceros al sistema de chat';
COMMENT ON COLUMN api_keys.key_prefix IS 'Primeros 8 caracteres de la API key (formato: wsk_<env>_<prefix>)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash de la API key completa';
COMMENT ON COLUMN api_keys.scopes IS 'Permisos de la key: search:flights, search:hotels, search:combined, search:*';
COMMENT ON COLUMN api_keys.rate_limit_per_minute IS 'Límite de requests por minuto (default: 100)';
COMMENT ON COLUMN api_keys.rate_limit_per_hour IS 'Límite de requests por hora (default: 1000)';
COMMENT ON COLUMN api_keys.rate_limit_per_day IS 'Límite de requests por día (default: 10000)';
COMMENT ON COLUMN api_keys.usage_count IS 'Contador total de requests realizados con esta key';

-- Enable Row Level Security (RLS)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Solo OWNER y SUPERADMIN pueden ver/gestionar API keys
CREATE POLICY "API keys visible solo para OWNER y SUPERADMIN"
  ON api_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OWNER', 'SUPERADMIN')
      AND (
        users.tenant_id = api_keys.tenant_id
        OR users.role = 'OWNER'
      )
    )
  );

-- Policy: Solo OWNER y SUPERADMIN pueden crear API keys
CREATE POLICY "API keys creables solo por OWNER y SUPERADMIN"
  ON api_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OWNER', 'SUPERADMIN')
      AND (
        users.tenant_id = api_keys.tenant_id
        OR users.role = 'OWNER'
      )
    )
  );

-- Policy: Solo OWNER y SUPERADMIN pueden actualizar API keys
CREATE POLICY "API keys actualizables solo por OWNER y SUPERADMIN"
  ON api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OWNER', 'SUPERADMIN')
      AND (
        users.tenant_id = api_keys.tenant_id
        OR users.role = 'OWNER'
      )
    )
  );

-- Policy: Solo OWNER puede eliminar API keys
CREATE POLICY "API keys eliminables solo por OWNER"
  ON api_keys
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'OWNER'
    )
  );
