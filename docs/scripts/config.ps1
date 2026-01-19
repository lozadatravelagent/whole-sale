# =====================================================
# Configuracion de Environment Variables
# =====================================================
# 
# Usa este archivo en todos los scripts de test
# 

$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"

# ANON KEY (publica - segura para compartir)
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA"

# API KEY (privada - NO compartir en frontend)
$API_KEY = "wsk_dev_test123456789012345678901234"

Write-Host "[CONFIG] Variables cargadas:" -ForegroundColor Green
Write-Host "  SUPABASE_URL: $SUPABASE_URL" -ForegroundColor Gray
Write-Host "  ANON_KEY: $($ANON_KEY.Substring(0,30))..." -ForegroundColor Gray
Write-Host "  API_KEY: $($API_KEY.Substring(0,15))..." -ForegroundColor Gray
















