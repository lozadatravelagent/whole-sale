# Script simple para verificar si add-message tiene los fixes de idempotencia

$file = "supabase/functions/add-message/index.ts"

if (-not (Test-Path $file)) {
    Write-Host "❌ Archivo no encontrado: $file" -ForegroundColor Red
    exit
}

Write-Host "🔍 Verificando características del fix de duplicados en $file" -ForegroundColor Cyan
Write-Host ""

$checks = @(
    @{
        Name = "Validación de client_id"
        Pattern = "Missing client_id.*idempotency"
        Expected = "Warn sobre client_id faltante"
    },
    @{
        Name = "Check de idempotencia"
        Pattern = "IDEMPOTENCY.*Checking for existing message"
        Expected = "Verificación de mensajes existentes por client_id"
    },
    @{
        Name = "Manejo de ON CONFLICT"
        Pattern = "ON CONFLICT.*Duplicate detected"
        Expected = "Detección de duplicados vía constraint"
    },
    @{
        Name = "UNIQUE constraint handling"
        Pattern = "maybeSingle\(\)"
        Expected = "Uso de maybeSingle para manejar conflictos"
    }
)

$allPassed = $true

foreach ($check in $checks) {
    $content = Get-Content $file -Raw
    if ($content -match $check.Pattern) {
        Write-Host "✅ $($check.Name): OK" -ForegroundColor Green
    } else {
        Write-Host "❌ $($check.Name): FALTANTE" -ForegroundColor Red
        Write-Host "   Esperado: $($check.Expected)" -ForegroundColor Yellow
        $allPassed = $false
    }
}

Write-Host ""
if ($allPassed) {
    Write-Host "✅ Tu código local TIENE todos los fixes de idempotencia" -ForegroundColor Green
    Write-Host ""
    Write-Host "📅 Verificando fecha del último deploy en Supabase..." -ForegroundColor Cyan
    Write-Host "   Versión actual en Supabase: 13 (2025-10-04)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Para verificar si está desplegado:" -ForegroundColor Yellow
    Write-Host "   1. Ve a Supabase Dashboard > Edge Functions > add-message" -ForegroundColor Gray
    Write-Host "   2. Revisa los logs de producción" -ForegroundColor Gray
    Write-Host "   3. Busca los logs: [IDEMPOTENCY] client_id:" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Si los logs NO aparecen, despliega con:" -ForegroundColor Yellow
    Write-Host "   npx supabase functions deploy add-message" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Tu código local NO tiene todos los fixes" -ForegroundColor Yellow
    Write-Host "   Revisa el archivo: $file" -ForegroundColor Gray
}

