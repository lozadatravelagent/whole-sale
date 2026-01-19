# =====================================================
# TEST DE API KEY DE PRODUCCIÓN
# =====================================================
#
# Este script prueba la API key generada contra:
# 1. Supabase Edge Function directo
# 2. Cloudflare proxy (api.vibook.ai)
# =====================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔬 TESTING API KEY DE PRODUCCIÓN" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Request de prueba
$requestBody = @{
    request_id = "test_prod_$(Get-Date -Format 'yyyyMMddHHmmss')"
    prompt = "vuelo a madrid del 10 al 20 de enero, 2 adultos"
} | ConvertTo-Json

Write-Host "📋 Request Body:" -ForegroundColor Yellow
Write-Host $requestBody
Write-Host ""

# =====================================================
# TEST 1: Supabase Edge Function Directo
# =====================================================
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "TEST 1: Supabase Edge Function Directo" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

$supabaseUrl = "https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search"

Write-Host "📤 Endpoint: $supabaseUrl" -ForegroundColor Gray
Write-Host "🔑 API Key: $($ApiKey.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri $supabaseUrl `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "X-API-Key" = $ApiKey
        } `
        -Body $requestBody `
        -TimeoutSec 30

    Write-Host "✅ Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    Write-Host ""
    Write-Host "📥 Response:" -ForegroundColor Yellow
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
} catch {
    Write-Host "❌ ERROR en Supabase directo" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Yellow
    }

    Write-Host ""
}

# =====================================================
# TEST 2: Cloudflare Proxy (api.vibook.ai)
# =====================================================
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "TEST 2: Cloudflare Proxy (api.vibook.ai)" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

$cloudflareUrl = "https://api.vibook.ai/search"

Write-Host "📤 Endpoint: $cloudflareUrl" -ForegroundColor Gray
Write-Host "🔑 API Key: $($ApiKey.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri $cloudflareUrl `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "X-API-Key" = $ApiKey
            "Origin" = "https://www.maxevagestion.com"
        } `
        -Body $requestBody `
        -TimeoutSec 30

    Write-Host "✅ Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    Write-Host ""
    Write-Host "📥 Response:" -ForegroundColor Yellow
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
} catch {
    Write-Host "❌ ERROR en Cloudflare proxy" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Yellow
    }

    Write-Host ""
}

# =====================================================
# RESUMEN
# =====================================================
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ TESTS COMPLETADOS" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si ambos tests pasaron (status 200 o 422):" -ForegroundColor Yellow
Write-Host "  ✅ La API key está correctamente configurada" -ForegroundColor Green
Write-Host "  ✅ Podés usarla en producción" -ForegroundColor Green
Write-Host ""
Write-Host "Si algún test falló con 403:" -ForegroundColor Yellow
Write-Host "  1. Verificá que la API key sea de producción (wsk_prod_*)" -ForegroundColor Yellow
Write-Host "  2. Verificá los allowed_origins en metadata" -ForegroundColor Yellow
Write-Host "  3. Verificá la configuración de Cloudflare WAF" -ForegroundColor Yellow
Write-Host ""
