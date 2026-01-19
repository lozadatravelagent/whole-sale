# =====================================================
# Deploy sin verificacion JWT
# =====================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY SIN JWT VERIFICATION  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[INFO] Vamos a desplegar con verify_jwt: false" -ForegroundColor Yellow
Write-Host "Esto permite que la funcion maneje su propia autenticacion" -ForegroundColor Gray
Write-Host ""

cd ..

Write-Host "Desplegando..." -ForegroundColor Yellow
try {
    npx supabase functions deploy api-search --no-verify-jwt
    
    Write-Host ""
    Write-Host "[OK] Funcion desplegada exitosamente" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Fallo el deploy: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Intentando sin el flag --no-verify-jwt..." -ForegroundColor Yellow
    
    try {
        npx supabase functions deploy api-search
        Write-Host ""
        Write-Host "[OK] Desplegado (sin flag)" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Tambien fallo: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Esperando 5 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Test
Write-Host ""
Write-Host "Probando la API..." -ForegroundColor Yellow

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

$body = @{
    request_id = "req_no_jwt_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

try {
    # Intentar SOLO con X-API-Key (sin Authorization)
    Write-Host "Probando SIN Authorization header..." -ForegroundColor Gray
    
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 60

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  EXITO! FUNCIONA SIN JWT!  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
    Write-Host "Request ID: $($response.request_id)" -ForegroundColor Cyan
    Write-Host ""
    $response | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host ""
    Write-Host "[INFO] Sin Authorization aun falla (esperado si verify_jwt esta activo)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ahora ejecuta este script para obtener la ANON KEY correcta:" -ForegroundColor Cyan
    Write-Host ".\scripts\12-get-anon-key.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
















