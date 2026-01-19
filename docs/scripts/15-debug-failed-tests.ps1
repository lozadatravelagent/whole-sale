# =====================================================
# Debug Tests que Fallaron
# =====================================================

. .\config.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEBUG - TESTS FALLIDOS  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# =============================================================================
# TEST 4: Punta Cana (con detalles completos)
# =============================================================================

Write-Host "`n[DEBUG TEST 4] Punta Cana Whitelist..." -ForegroundColor Yellow

$body = @{
    request_id = "req_pc_debug_$(Get-Date -Format 'HHmmss')"
    prompt = "hotel todo incluido doble en punta cana 15 de marzo por 5 noches"
    options = @{
        include_metadata = $true
    }
} | ConvertTo-Json

Write-Host "`nBody enviado:" -ForegroundColor Gray
Write-Host $body -ForegroundColor DarkGray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 120

    Write-Host "[SUCCESS] Status: $($response.StatusCode)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "[ERROR] Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Message:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details:" -ForegroundColor Yellow
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorJson | ConvertTo-Json -Depth 10
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor White
        }
    }
    
    # Intentar leer el response body
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor White
    } catch {
        # No hay response body
    }
}

# =============================================================================
# TEST 5: Light Fare (con detalles completos)
# =============================================================================

Write-Host "`n`n[DEBUG TEST 5] Light Fare Detection..." -ForegroundColor Yellow

$body = @{
    request_id = "req_lf_debug_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo con equipaje de mano de buenos aires a miami 15 de marzo"
    options = @{
        include_metadata = $true
    }
} | ConvertTo-Json

Write-Host "`nBody enviado:" -ForegroundColor Gray
Write-Host $body -ForegroundColor DarkGray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 120

    Write-Host "[SUCCESS] Status: $($response.StatusCode)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "[ERROR] Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Message:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details:" -ForegroundColor Yellow
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorJson | ConvertTo-Json -Depth 10
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor White
        }
    }
    
    # Intentar leer el response body
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor White
    } catch {
        # No hay response body
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
















