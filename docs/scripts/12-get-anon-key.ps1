# =====================================================
# Obtener ANON KEY correcta del proyecto
# =====================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  OBTENER ANON KEY CORRECTA  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[INSTRUCCIONES]" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Abri esta URL en tu navegador:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/ujigyazketblwlzcomve/settings/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Busca la seccion 'Project API keys'" -ForegroundColor White
Write-Host ""
Write-Host "3. Copia la key que dice 'anon' 'public'" -ForegroundColor White
Write-Host "   (Es una cadena larga que empieza con 'eyJ...')" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Pega la key aqui y presiona Enter:" -ForegroundColor White
Write-Host ""

$ANON_KEY = Read-Host "ANON KEY"

if ([string]::IsNullOrWhiteSpace($ANON_KEY)) {
    Write-Host ""
    Write-Host "[ERROR] No ingresaste ninguna key" -ForegroundColor Red
    exit 1
}

if (-not $ANON_KEY.StartsWith("eyJ")) {
    Write-Host ""
    Write-Host "[WARNING] La key no empieza con 'eyJ', puede estar incorrecta" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[OK] Key recibida: $($ANON_KEY.Substring(0,50))..." -ForegroundColor Green
Write-Host ""

# Ahora probar con esta key
$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

$body = @{
    request_id = "req_correct_anon_$(Get-Date -Format 'HHmmss')"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Write-Host "Probando con la nueva ANON KEY..." -ForegroundColor Yellow
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

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  EXITO! LA API FUNCIONA!  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($response.status)" -ForegroundColor Yellow
    Write-Host "Request ID: $($response.request_id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Magenta
    $response | ConvertTo-Json -Depth 5
    Write-Host ""
    Write-Host "[IMPORTANTE] Guarda esta ANON KEY para futuros tests:" -ForegroundColor Yellow
    Write-Host $ANON_KEY -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Aun falla con esta ANON KEY" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor White
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        try {
            $_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
    
    Write-Host ""
    Write-Host "[DIAGNOSTICO] Posibles problemas:" -ForegroundColor Yellow
    Write-Host "1. La ANON KEY esta expirada o incorrecta" -ForegroundColor Gray
    Write-Host "2. La funcion tiene verificacion JWT habilitada" -ForegroundColor Gray
    Write-Host "3. Hay un problema con la configuracion del proyecto" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Siguiente paso: Ver logs de Supabase" -ForegroundColor Cyan
    Write-Host "https://supabase.com/dashboard/project/ujigyazketblwlzcomve/logs/edge-functions" -ForegroundColor Blue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
















