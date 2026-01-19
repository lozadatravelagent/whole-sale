# =====================================================
# Script Interactivo para Generar API Key
# =====================================================
# 
# Este script te guía paso a paso para generar una API key
# de producción para un tercero.
#
# Requisitos:
# - PowerShell 7+
# - Acceso a Supabase Dashboard (para obtener la URL y Service Role Key)
# =====================================================

param(
    [string]$SupabaseUrl = "",
    [string]$ServiceRoleKey = "",
    [string]$Name = "API Key para Tercero - Producción",
    [int]$RateLimitPerMinute = 500,
    [int]$RateLimitPerHour = 10000,
    [int]$RateLimitPerDay = 100000,
    [string]$ExpiresAt = ""  # Formato: "2025-12-31" o vacío para sin expiración
)

# Colores para output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }

Write-Info "=========================================="
Write-Info "🔑 Generador de API Key para Tercero"
Write-Info "=========================================="
Write-Host ""

# Solicitar datos si no se proporcionaron
if ([string]::IsNullOrEmpty($SupabaseUrl)) {
    $SupabaseUrl = Read-Host "Ingresá la URL de tu proyecto Supabase (ej: https://xxxxx.supabase.co)"
}

if ([string]::IsNullOrEmpty($ServiceRoleKey)) {
    Write-Warning "⚠️  Necesitás la SERVICE ROLE KEY (no la ANON KEY)"
    Write-Info "   Podés encontrarla en: Supabase Dashboard → Settings → API"
    $ServiceRoleKey = Read-Host "Ingresá la Service Role Key"
}

# Validar URL
if (-not $SupabaseUrl.StartsWith("https://")) {
    Write-Error "❌ La URL debe comenzar con https://"
    exit 1
}

# Generar API key aleatoria
Write-Info "Generando API key segura..."
$randomChars = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$apiKeyFull = "wsk_prod_$randomChars"
$keyPrefix = "wsk_prod_"

# Calcular hash SHA-256
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($apiKeyFull))
$keyHash = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()

Write-Success "✅ API key generada: $apiKeyFull"
Write-Host ""

# Preparar expiración
$expiresAtSql = "NULL"
if (-not [string]::IsNullOrEmpty($ExpiresAt)) {
    $expiresAtSql = "'$ExpiresAt'::timestamptz"
}

# Construir SQL
$sql = @"
INSERT INTO api_keys (
  id,
  key_prefix,
  key_hash,
  tenant_id,
  agency_id,
  created_by,
  scopes,
  rate_limit_per_minute,
  rate_limit_per_hour,
  rate_limit_per_day,
  name,
  environment,
  is_active,
  expires_at,
  created_at,
  usage_count,
  metadata
) VALUES (
  gen_random_uuid(),
  '$keyPrefix',
  '$keyHash',
  NULL,
  NULL,
  NULL,
  ARRAY['search:*'],
  $RateLimitPerMinute,
  $RateLimitPerHour,
  $RateLimitPerDay,
  '$Name',
  'production',
  true,
  $expiresAtSql,
  NOW(),
  0,
  jsonb_build_object(
    'description', 'API key de producción para integración con tercero',
    'created_at', NOW(),
    'created_by_script', true
  )
)
RETURNING id, key_prefix, name, environment, created_at;
"@

Write-Info "=========================================="
Write-Success "🔑 API KEY GENERADA"
Write-Info "=========================================="
Write-Host ""
Write-Host "API KEY COMPLETA: " -NoNewline
Write-Success $apiKeyFull
Write-Host ""
Write-Warning "⚠️  GUARDÁ ESTA KEY AHORA - NO SE VOLVERÁ A MOSTRAR"
Write-Host ""
Write-Info "=========================================="
Write-Host ""
Write-Info "Configuración:"
Write-Host "  - Nombre: $Name"
Write-Host "  - Rate Limits: $RateLimitPerMinute/min, $RateLimitPerHour/hora, $RateLimitPerDay/día"
Write-Host "  - Scopes: search:*"
Write-Host "  - Environment: production"
if (-not [string]::IsNullOrEmpty($ExpiresAt)) {
    Write-Host "  - Expira: $ExpiresAt"
} else {
    Write-Host "  - Expiración: Sin expiración"
}
Write-Host ""

# Mostrar SQL para ejecutar
Write-Info "=========================================="
Write-Info "📝 SQL para ejecutar en Supabase Dashboard"
Write-Info "=========================================="
Write-Host ""
Write-Host "Copiá y ejecutá este SQL en Supabase Dashboard → SQL Editor:"
Write-Host ""
Write-Host $sql
Write-Host ""
Write-Warning "⚠️  IMPORTANTE: Ejecutá el SQL ANTES de cerrar esta ventana para guardar la key"
Write-Host ""

# Mostrar instrucciones de uso
Write-Info "=========================================="
Write-Info "📤 Cómo usar esta API key"
Write-Info "=========================================="
Write-Host ""
Write-Host "Endpoint: $SupabaseUrl/functions/v1/api-search"
Write-Host ""
Write-Host "Headers requeridos:"
Write-Host "  Authorization: Bearer <ANON_KEY>"
Write-Host "  X-API-Key: $apiKeyFull"
Write-Host "  Content-Type: application/json"
Write-Host ""
Write-Host "Ejemplo cURL:"
Write-Host @"
curl -X POST `"$SupabaseUrl/functions/v1/api-search`" \
  -H `"Authorization: Bearer <ANON_KEY>`" \
  -H `"X-API-Key: $apiKeyFull`" \
  -H `"Content-Type: application/json`" \
  -d '{
    `"request_id`": `"req_001`",
    `"prompt`": `"vuelo a Miami para 2 personas`"
  }'
"@
Write-Host ""

