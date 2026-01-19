# =====================================================
# Verificar Estado de Edge Function
# =====================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION DE EDGE FUNCTION  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Verificar que la funcion existe
Write-Host "`n[1/3] Verificando que api-search esta desplegada..." -ForegroundColor Yellow

try {
    $functions = npx supabase functions list 2>&1
    
    if ($functions -match "api-search.*ACTIVE") {
        Write-Host "[OK] api-search esta desplegada y activa" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] api-search NO esta activa" -ForegroundColor Red
        Write-Host "Ejecuta: npx supabase functions deploy api-search" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] No se pudo verificar: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Ver logs recientes
Write-Host "`n[2/3] Viendo ultimos logs (ultimos 5 minutos)..." -ForegroundColor Yellow

try {
    Write-Host "Ejecutando: npx supabase functions logs api-search --limit 20" -ForegroundColor Gray
    npx supabase functions logs api-search --limit 20
} catch {
    Write-Host "[ERROR] No se pudieron obtener los logs: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Verificar secrets
Write-Host "`n[3/3] Verificando que los secrets estan configurados..." -ForegroundColor Yellow

try {
    $secrets = npx supabase secrets list 2>&1
    
    $requiredSecrets = @(
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENAI_API_KEY"
    )
    
    foreach ($secret in $requiredSecrets) {
        if ($secrets -match $secret) {
            Write-Host "[OK] $secret esta configurado" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] $secret NO esta configurado" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[ERROR] No se pudieron verificar los secrets: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION COMPLETADA  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
















