# =====================================================
# Script: Test API Search - Suite Completa
# Description: Tests exhaustivos del endpoint api-search
# =====================================================

# Configuración
$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTING API SEARCH - SUITE COMPLETA  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoint: $SUPABASE_URL/functions/v1/api-search" -ForegroundColor Gray
Write-Host "API Key: $($API_KEY.Substring(0,15))..." -ForegroundColor Gray
Write-Host ""

# =============================================================================
# TEST 1: Health Check ✅
# =============================================================================

Write-Host "`n=== TEST 1: Health Check ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_healthcheck_001"
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
    Write-Host "Request ID: $($response.request_id)" -ForegroundColor Gray
    Write-Host "`nResponse completa:" -ForegroundColor Magenta
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# =============================================================================
# TEST 2: Búsqueda Completa de Vuelos ✈️
# =============================================================================

Write-Host "`n`n=== TEST 2: Búsqueda Completa de Vuelos ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_test_full_001"
    prompt = "vuelo de buenos aires a miami 15 de marzo por 10 dias para 2 personas"
    options = @{
        include_metadata = $true
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
    
    if ($response.results.flights) {
        Write-Host "Vuelos encontrados: $($response.results.flights.count)" -ForegroundColor Cyan
    }
    
    if ($response.metadata) {
        Write-Host "`nMetadata:" -ForegroundColor Magenta
        $response.metadata | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# =============================================================================
# TEST 3: Idempotencia 🔄
# =============================================================================

Write-Host "`n`n=== TEST 3: Idempotencia (Cache) ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_test_full_001"  # MISMO ID que TEST 2
    prompt = "vuelo de buenos aires a miami"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    if ($response.is_retry) {
        Write-Host "✅ IDEMPOTENCIA FUNCIONA" -ForegroundColor Green
        Write-Host "is_retry: $($response.is_retry)" -ForegroundColor Yellow
        Write-Host "cached_at: $($response.cached_at)" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️ NO vino del cache (is_retry: false)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# =============================================================================
# TEST 4: Punta Cana Whitelist 🌴
# =============================================================================

Write-Host "`n`n=== TEST 4: Punta Cana Whitelist ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_puntacana_001"
    prompt = "hotel todo incluido doble en punta cana 15 de marzo por 5 noches"
    options = @{
        include_metadata = $true
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCESS" -ForegroundColor Green
    
    if ($response.metadata.destination_rules) {
        Write-Host "`n--- METADATA DE WHITELIST ---" -ForegroundColor Magenta
        Write-Host "Tipo: $($response.metadata.destination_rules.type)" -ForegroundColor Yellow
        Write-Host "Hoteles desde provider: $($response.metadata.destination_rules.total_available_from_provider)" -ForegroundColor Cyan
        Write-Host "Hoteles en whitelist: $($response.metadata.destination_rules.whitelist_matches)" -ForegroundColor Green
        Write-Host "Después de filtros: $($response.metadata.destination_rules.after_all_filters)" -ForegroundColor Green
        
        Write-Host "`nMetadata completa:" -ForegroundColor Gray
        $response.metadata | ConvertTo-Json -Depth 5
    } else {
        Write-Host "⚠️ NO hay metadata de whitelist" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# =============================================================================
# TEST 5: Light Fare Detection 🧳
# =============================================================================

Write-Host "`n`n=== TEST 5: Light Fare Detection ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_lightfare_001"
    prompt = "vuelo con equipaje de mano de buenos aires a miami 15 de marzo"
    options = @{
        include_metadata = $true
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCESS" -ForegroundColor Green
    
    if ($null -ne $response.metadata.light_fares_excluded) {
        Write-Host "`n--- LIGHT FARE METADATA ---" -ForegroundColor Magenta
        Write-Host "Light fares excluidos: $($response.metadata.light_fares_excluded)" -ForegroundColor Yellow
        
        if ($response.metadata.light_fare_airlines) {
            Write-Host "Aerolíneas light: $($response.metadata.light_fare_airlines -join ', ')" -ForegroundColor Cyan
        }
    } else {
        Write-Host "⚠️ NO hay metadata de light fares" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# =============================================================================
# TEST 6: Error Handling - Invalid API Key
# =============================================================================

Write-Host "`n`n=== TEST 6: Error Handling - Invalid API Key ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_invalid_key_001"
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer wsk_invalid_key_123"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "⚠️ Debería haber fallado pero respondió OK" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Correctamente rechazó API key inválida (401)" -ForegroundColor Green
    } else {
        Write-Host "❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# =============================================================================
# TEST 7: Error Handling - Missing request_id
# =============================================================================

Write-Host "`n`n=== TEST 7: Error Handling - Missing request_id ===" -ForegroundColor Cyan

$body = @{
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "⚠️ Debería haber fallado pero respondió OK" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Correctamente rechazó request sin request_id (400)" -ForegroundColor Green
    } else {
        Write-Host "❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# =============================================================================
# RESUMEN FINAL
# =============================================================================

Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "  TESTS COMPLETADOS  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Tests exitosos: Verificá los resultados arriba" -ForegroundColor Green
Write-Host "❌ Tests fallidos: Verificá los errores en rojo" -ForegroundColor Yellow
Write-Host ""
Write-Host "Siguiente paso: Revisá los logs en Supabase Dashboard" -ForegroundColor Gray
Write-Host "https://supabase.com/dashboard/project/ujigyazketblwlzcomve/logs/edge-functions" -ForegroundColor Blue
















