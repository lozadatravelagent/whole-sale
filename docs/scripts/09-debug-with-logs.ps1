# =====================================================
# Debug con Logs en Tiempo Real
# =====================================================

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEBUG CON LOGS  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Primero verificar que la funcion este desplegada
Write-Host "[VERIFICACION] Chequeando version desplegada..." -ForegroundColor Yellow
cd ..
$functions = npx supabase functions list 2>&1 | Out-String
if ($functions -match "api-search\s+\|\s+\w+\s+\|\s+(\d+)") {
    Write-Host "[OK] api-search version: $($Matches[1])" -ForegroundColor Green
} else {
    Write-Host "[ERROR] No se pudo detectar la version" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AHORA VAS A VER LOS LOGS EN TIEMPO REAL" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instrucciones:" -ForegroundColor White
Write-Host "1. Se van a mostrar los logs continuamente" -ForegroundColor Gray
Write-Host "2. En OTRA terminal, ejecuta:" -ForegroundColor Gray
Write-Host "   cd C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\scripts" -ForegroundColor Cyan
Write-Host "   .\10-simple-test.ps1" -ForegroundColor Cyan
Write-Host "3. Vuelve a esta terminal y mira los logs" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona Ctrl+C para salir cuando termines" -ForegroundColor Yellow
Write-Host ""
Write-Host "Iniciando logs en 3 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Ver logs en tiempo real
npx supabase functions logs api-search --follow
















