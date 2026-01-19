# =====================================================
# Test Simple (ejecutar en otra terminal)
# =====================================================

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

Write-Host "`n=== ENVIANDO REQUEST ===" -ForegroundColor Cyan

$body = @{
    request_id = "req_test_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Write-Host "URL: $SUPABASE_URL/functions/v1/api-search" -ForegroundColor Gray
Write-Host "Headers:" -ForegroundColor Gray
Write-Host "  X-API-Key: $($API_KEY.Substring(0,20))..." -ForegroundColor Gray
Write-Host "  Content-Type: application/json" -ForegroundColor Gray
Write-Host ""
Write-Host "Body:" -ForegroundColor Gray
Write-Host $body -ForegroundColor DarkGray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri "$SUPABASE_URL/functions/v1/api-search" `
        -Method POST `
        -Headers @{
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        } `
        -Body $body `
        -TimeoutSec 60

    Write-Host "[SUCCESS] Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response.Content
    
} catch {
    Write-Host "[ERROR] Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor White
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host ""
Write-Host "Mira la otra terminal para ver los logs" -ForegroundColor Yellow
















