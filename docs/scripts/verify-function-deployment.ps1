# Script para verificar si el código de add-message en Supabase coincide con el local
# Uso: .\verify-function-deployment.ps1

Write-Host "📥 Descargando función add-message desde Supabase..." -ForegroundColor Cyan

# Descargar la función
$output = npx supabase functions download add-message 2>&1
Write-Host $output

# Buscar el archivo descargado
$downloadedPath = $null
$possiblePaths = @(
    "supabase/functions/add-message.downloaded/index.ts",
    "add-message/index.ts",
    "supabase/functions/add-message/downloaded/index.ts"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $downloadedPath = $path
        Write-Host "✅ Encontrado en: $path" -ForegroundColor Green
        break
    }
}

if (-not $downloadedPath) {
    Write-Host "❌ No se pudo encontrar el archivo descargado" -ForegroundColor Red
    Write-Host "Buscando en todo el directorio..." -ForegroundColor Yellow
    Get-ChildItem -Path . -Filter "index.ts" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -like "*add-message*" -and $_.FullName -notlike "*node_modules*" } |
        Select-Object FullName
    exit
}

# Comparar archivos
$localFile = "supabase/functions/add-message/index.ts"
$remoteFile = $downloadedPath

Write-Host "`n📊 Comparando archivos..." -ForegroundColor Cyan
Write-Host "Local:  $localFile" -ForegroundColor Gray
Write-Host "Remote: $remoteFile" -ForegroundColor Gray

if (Test-Path $localFile) {
    $localHash = (Get-FileHash $localFile -Algorithm SHA256).Hash
    $remoteHash = (Get-FileHash $remoteFile -Algorithm SHA256).Hash
    
    if ($localHash -eq $remoteHash) {
        Write-Host "`n✅ ¡Los archivos son IDÉNTICOS!" -ForegroundColor Green
        Write-Host "   Hash SHA256: $localHash" -ForegroundColor Gray
    } else {
        Write-Host "`n⚠️  Los archivos son DIFERENTES" -ForegroundColor Yellow
        Write-Host "   Local hash:  $localHash" -ForegroundColor Gray
        Write-Host "   Remote hash: $remoteHash" -ForegroundColor Gray
        Write-Host "`n📋 Mostrando diferencias..." -ForegroundColor Cyan
        
        # Usar git diff si está disponible, sino mostrar un resumen
        if (Get-Command git -ErrorAction SilentlyContinue) {
            git diff --no-index --color=never $localFile $remoteFile | Select-Object -First 100
        } else {
            Write-Host "   Instala git para ver diferencias detalladas, o compara manualmente los archivos" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ No se encontró el archivo local: $localFile" -ForegroundColor Red
    exit
}

# Limpiar archivo descargado
Write-Host "`n🧹 Limpiando archivo descargado..." -ForegroundColor Cyan
$downloadedDir = Split-Path $remoteFile -Parent
if ($downloadedDir -and (Test-Path $downloadedDir)) {
    Remove-Item -Path $downloadedDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Limpieza completada" -ForegroundColor Green
}

Write-Host "`n✨ Verificación completada" -ForegroundColor Green

