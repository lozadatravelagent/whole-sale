# =====================================================
# Test Simple con Timeout
# =====================================================

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsenNjb212ZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI0NzgyNTY3LCJleHAiOjIwNDAzNTg1Njd9.f1zzQw5h7mUW-iu4CsJPo4iq-Z8EKc0FqI00c2LdD9E"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST SIMPLE CON TIMEOUT  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test basico con timeout de 60 segundos
$body = @{
    request_id = "req_simple_test_001"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Write-Host "Enviando request..." -ForegroundColor Yellow
Write-Host "URL: $SUPABASE_URL/functions/v1/api-search" -ForegroundColor Gray
Write-Host "Timeout: 60 segundos" -ForegroundColor Gray
Write-Host ""

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

    Write-Host "[SUCCESS] La API respondio correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "[ERROR] La llamada a la API fallo" -ForegroundColor Red
    Write-Host ""
    
    # Determinar tipo de error
    if ($_.Exception.Message -match "401") {
        Write-Host "[ERROR 401] API Key Invalida o No Existe" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "SOLUCION:" -ForegroundColor Cyan
        Write-Host "1. Abri Supabase Dashboard" -ForegroundColor White
        Write-Host "   https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor" -ForegroundColor Blue
        Write-Host ""
        Write-Host "2. Anda a SQL Editor" -ForegroundColor White
        Write-Host ""
        Write-Host "3. Ejecuta el archivo: scripts/01-create-api-key.sql" -ForegroundColor White
        Write-Host ""
        Write-Host "4. Verifica con: scripts/02-verify-api-key.sql" -ForegroundColor White
        Write-Host ""
        
    } elseif ($_.Exception.Message -match "timeout") {
        Write-Host "[TIMEOUT] La funcion tardo mas de 60 segundos" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Esto puede ser por:" -ForegroundColor White
        Write-Host "- Cold start (primera ejecucion)" -ForegroundColor Gray
        Write-Host "- Problema de red" -ForegroundColor Gray
        Write-Host "- La funcion esta procesando" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Reintenta en 30 segundos" -ForegroundColor Cyan
        
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor White
        
        if ($_.ErrorDetails.Message) {
            Write-Host ""
            Write-Host "Detalles:" -ForegroundColor Yellow
            Write-Host $_.ErrorDetails.Message -ForegroundColor White
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

