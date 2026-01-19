# =====================================================
# Test API con Logs en Tiempo Real
# =====================================================

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST CON LOGS EN TIEMPO REAL  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[INSTRUCCIONES]" -ForegroundColor Yellow
Write-Host "1. Abri OTRA terminal/PowerShell" -ForegroundColor White
Write-Host "2. Ejecuta: cd C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai" -ForegroundColor White
Write-Host "3. Ejecuta: npx supabase functions logs api-search --follow" -ForegroundColor White
Write-Host "4. Deja esa terminal abierta viendo los logs" -ForegroundColor White
Write-Host ""
Write-Host "Presiona cualquier tecla cuando estes listo..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`nEnviando request a la API..." -ForegroundColor Yellow
Write-Host ""

$body = @{
    request_id = "req_debug_test_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Write-Host "Body del request:" -ForegroundColor Gray
Write-Host $body -ForegroundColor DarkGray
Write-Host ""

try {
    Write-Host "Llamando a la API..." -ForegroundColor Yellow
    
    $response = Invoke-WebRequest `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 60

    Write-Host ""
    Write-Host "[SUCCESS] Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response Body:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] La API respondio con error" -ForegroundColor Red
    Write-Host ""
    
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Error Message:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details:" -ForegroundColor Red
        try {
            $_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor White
        }
    }
    
    Write-Host ""
    Write-Host "[ACCION] Mira los logs en la otra terminal para ver que paso internamente" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

