# =====================================================
# Test con ANON KEY + API KEY
# =====================================================

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

# ANON KEY de Supabase (necesaria para pasar el gateway)
# Esta es la anon key publica de tu proyecto
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsenNjb212ZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI0NzgyNTY3LCJleHAiOjIwNDAzNTg1Njd9.f1zzQw5h7mUW-iu4CsJPo4iq-Z8EKc0FqI00c2LdD9E"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST CON ANON KEY + API KEY  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$body = @{
    request_id = "req_anon_test_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Write-Host "Headers que vamos a enviar:" -ForegroundColor Yellow
Write-Host "  Authorization: Bearer [ANON_KEY] (para Supabase Gateway)" -ForegroundColor Gray
Write-Host "  X-API-Key: $($API_KEY.Substring(0,20))... (nuestra autenticacion)" -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "Enviando request..." -ForegroundColor Yellow
    
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

    Write-Host ""
    Write-Host "[SUCCESS] LA API FUNCIONA!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
    Write-Host "Request ID: $($response.request_id)" -ForegroundColor Cyan
    Write-Host "Is Retry: $($response.is_retry)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Response completa:" -ForegroundColor Magenta
    $response | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Aun falla" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor White
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
















