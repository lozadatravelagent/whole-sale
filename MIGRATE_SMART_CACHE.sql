-- ============================================================================
-- MIGRACIÓN: Agregar soft/hard expiration para caché inteligente
-- ============================================================================
-- Agrega campos necesarios para el sistema de caché con background refresh
-- ============================================================================

-- Paso 1: Agregar nuevas columnas
ALTER TABLE search_cache
ADD COLUMN IF NOT EXISTS soft_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS hard_expires_at timestamp with time zone;

-- Paso 2: Migrar datos existentes (usar expires_at como hard_expires_at)
UPDATE search_cache
SET
  hard_expires_at = expires_at,
  soft_expires_at = created_at + interval '5 minutes'  -- 5 minutos por defecto
WHERE hard_expires_at IS NULL;

-- Paso 3: Hacer NOT NULL los nuevos campos
ALTER TABLE search_cache
ALTER COLUMN soft_expires_at SET NOT NULL,
ALTER COLUMN hard_expires_at SET NOT NULL;

-- Paso 4: Actualizar índices
DROP INDEX IF EXISTS idx_search_cache_key;
DROP INDEX IF EXISTS idx_search_cache_stale;

-- Índice simple sin WHERE clause (más eficiente para queries con filtros dinámicos)
CREATE INDEX idx_search_cache_key_new ON search_cache(cache_key, hard_expires_at);

-- Índice compuesto para búsquedas por tipo y expiración
CREATE INDEX idx_search_cache_type_expires ON search_cache(search_type, soft_expires_at, hard_expires_at);

-- Índice para cleanup de expirados
CREATE INDEX idx_search_cache_hard_expires_new ON search_cache(hard_expires_at);

-- Paso 5: Actualizar función de limpieza
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  -- Solo eliminar cache hard expired
  DELETE FROM search_cache WHERE hard_expires_at < now();

  RAISE NOTICE 'Cleaned expired cache entries';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 6: Verificar migración
SELECT
  'search_cache' as table_name,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE hard_expires_at > now()) as active_entries,
  COUNT(*) FILTER (WHERE soft_expires_at < now() AND hard_expires_at > now()) as stale_entries,
  COUNT(*) FILTER (WHERE soft_expires_at > now()) as fresh_entries
FROM search_cache;

-- Paso 7: Ver estructura actualizada
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'search_cache'
  AND column_name IN ('soft_expires_at', 'hard_expires_at', 'expires_at', 'created_at')
ORDER BY ordinal_position;

-- ============================================================================
-- RESULTADO ESPERADO:
-- - soft_expires_at: timestamp NOT NULL
-- - hard_expires_at: timestamp NOT NULL
-- - expires_at: timestamp (puede deprecarse en el futuro)
-- ============================================================================

SELECT '✅ Smart cache migration completed!' as status;
