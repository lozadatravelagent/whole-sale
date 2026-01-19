# =====================================================
# Deploy y Test Final
# =====================================================

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY Y TEST FINAL  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# PASO 1: Deploy
Write-Host "`n[1/2] Desplegando api-search con cambios..." -ForegroundColor Yellow

try {
    cd ..
    npx supabase functions deploy api-search
    
    Write-Host "`n[OK] Funcion desplegada exitosamente" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Fallo el deploy: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nEsperando 5 segundos para que se active..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# PASO 2: Test
Write-Host "`n[2/2] Probando la API con X-API-Key header..." -ForegroundColor Yellow

$body = @{
    request_id = "req_final_test_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    Write-Host "`nEnviando request..." -ForegroundColor Gray
    Write-Host "Header: X-API-Key: $($API_KEY.Substring(0,15))..." -ForegroundColor Gray
    Write-Host ""
    
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 60

    Write-Host "[SUCCESS] La API funciona correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
    Write-Host "Request ID: $($response.request_id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Response completa:" -ForegroundColor Magenta
    $response | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host "[ERROR] La API sigue fallando" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor White
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETADO  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
















