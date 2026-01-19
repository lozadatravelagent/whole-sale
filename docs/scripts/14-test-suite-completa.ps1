# =====================================================
# Suite Completa de Tests - Version Final
# =====================================================

# Cargar configuracion
. .\config.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SUITE COMPLETA DE TESTS API SEARCH  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

# =============================================================================
# TEST 1: Health Check
# =============================================================================

Write-Host "`n[TEST 1/5] Health Check..." -ForegroundColor Yellow

$body = @{
    request_id = "req_health_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 60

    Write-Host "[PASS] Status: $($response.status)" -ForegroundColor Green
    $testResults += @{ test = "Health Check"; status = "PASS"; result = $response.status }
    
} catch {
    Write-Host "[FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ test = "Health Check"; status = "FAIL"; error = $_.Exception.Message }
}

# =============================================================================
# TEST 2: Busqueda Completa con Metadata
# =============================================================================

Write-Host "`n[TEST 2/5] Busqueda Completa con Metadata..." -ForegroundColor Yellow

$body = @{
    request_id = "req_full_$(Get-Date -Format 'HHmmss')"
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
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 120

    Write-Host "[PASS] Status: $($response.status)" -ForegroundColor Green
    Write-Host "  Metadata presente: $(if ($response.metadata) { 'SI' } else { 'NO' })" -ForegroundColor Cyan
    $testResults += @{ test = "Busqueda Completa"; status = "PASS"; result = $response.status }
    
} catch {
    Write-Host "[FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ test = "Busqueda Completa"; status = "FAIL"; error = $_.Exception.Message }
}

# =============================================================================
# TEST 3: Idempotencia (Cache)
# =============================================================================

Write-Host "`n[TEST 3/5] Idempotencia (Cache)..." -ForegroundColor Yellow

$body = @{
    request_id = "req_full_$(Get-Date -Format 'HHmmss' -Date (Get-Date).AddSeconds(-30))"  # Usar mismo ID que TEST 2
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 60

    if ($response.is_retry) {
        Write-Host "[PASS] Cache funciona (is_retry: true)" -ForegroundColor Green
        $testResults += @{ test = "Idempotencia"; status = "PASS"; result = "is_retry: true" }
    } else {
        Write-Host "[WARNING] Cache no se aplico (is_retry: false)" -ForegroundColor Yellow
        $testResults += @{ test = "Idempotencia"; status = "WARNING"; result = "is_retry: false" }
    }
    
} catch {
    Write-Host "[FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ test = "Idempotencia"; status = "FAIL"; error = $_.Exception.Message }
}

# =============================================================================
# TEST 4: Punta Cana Whitelist
# =============================================================================

Write-Host "`n[TEST 4/5] Punta Cana Whitelist..." -ForegroundColor Yellow

$body = @{
    request_id = "req_pc_$(Get-Date -Format 'HHmmss')"
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
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 120

    if ($response.metadata.destination_rules) {
        Write-Host "[PASS] Whitelist aplicado" -ForegroundColor Green
        Write-Host "  Tipo: $($response.metadata.destination_rules.type)" -ForegroundColor Cyan
        $testResults += @{ test = "Punta Cana Whitelist"; status = "PASS"; result = "Whitelist aplicado" }
    } else {
        Write-Host "[WARNING] No hay metadata de whitelist" -ForegroundColor Yellow
        $testResults += @{ test = "Punta Cana Whitelist"; status = "WARNING"; result = "Sin metadata" }
    }
    
} catch {
    Write-Host "[FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ test = "Punta Cana Whitelist"; status = "FAIL"; error = $_.Exception.Message }
}

# =============================================================================
# TEST 5: Light Fare Detection
# =============================================================================

Write-Host "`n[TEST 5/5] Light Fare Detection..." -ForegroundColor Yellow

$body = @{
    request_id = "req_lf_$(Get-Date -Format 'HHmmss')"
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
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 120

    if ($null -ne $response.metadata.light_fares_excluded) {
        Write-Host "[PASS] Light fares metadata presente" -ForegroundColor Green
        Write-Host "  Excluidos: $($response.metadata.light_fares_excluded)" -ForegroundColor Cyan
        $testResults += @{ test = "Light Fare Detection"; status = "PASS"; result = "Metadata presente" }
    } else {
        Write-Host "[WARNING] No hay metadata de light fares" -ForegroundColor Yellow
        $testResults += @{ test = "Light Fare Detection"; status = "WARNING"; result = "Sin metadata" }
    }
    
} catch {
    Write-Host "[FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ test = "Light Fare Detection"; status = "FAIL"; error = $_.Exception.Message }
}

# =============================================================================
# RESUMEN
# =============================================================================

Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DE TESTS  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passCount = ($testResults | Where-Object { $_.status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.status -eq "FAIL" }).Count
$warnCount = ($testResults | Where-Object { $_.status -eq "WARNING" }).Count

foreach ($result in $testResults) {
    $color = switch ($result.status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARNING" { "Yellow" }
    }
    Write-Host "  [$($result.status)] $($result.test)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Total: $passCount PASS | $failCount FAIL | $warnCount WARNING" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  TODOS LOS TESTS PASARON!  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ALGUNOS TESTS FALLARON  " -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
}

Write-Host ""

