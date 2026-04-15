# Script de configuración automática del entorno de test (PowerShell)
# Ejecutar: .\scripts\setup-test-env.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Configurando entorno de test para QuiniApp..." -ForegroundColor Cyan
Write-Host ""

# Paso 1: Crear directorio supabase-test
Write-Host "📁 Paso 1: Creando directorio supabase-test..." -ForegroundColor Yellow
if (Test-Path "supabase-test") {
    Write-Host "   ⚠️  El directorio supabase-test ya existe. Saltando..." -ForegroundColor DarkYellow
} else {
    New-Item -ItemType Directory -Path "supabase-test" | Out-Null
    Write-Host "   ✅ Directorio creado" -ForegroundColor Green
}
Write-Host ""

# Paso 2: Inicializar Supabase en el directorio de test
Write-Host "🔧 Paso 2: Inicializando Supabase en supabase-test..." -ForegroundColor Yellow
Set-Location supabase-test
if (Test-Path "config.toml") {
    Write-Host "   ⚠️  config.toml ya existe. Saltando inicialización..." -ForegroundColor DarkYellow
} else {
    npx supabase init
    Write-Host "   ✅ Supabase inicializado" -ForegroundColor Green
}
Set-Location ..
Write-Host ""

# Paso 3: Configurar puertos en config.toml
Write-Host "⚙️  Paso 3: Configurando puertos en config.toml..." -ForegroundColor Yellow
$configPath = "supabase-test\config.toml"
$configContent = Get-Content $configPath -Raw

if ($configContent -match "port = 54331") {
    Write-Host "   ⚠️  Puertos ya configurados. Saltando..." -ForegroundColor DarkYellow
} else {
    # Backup del config original
    Copy-Item $configPath "$configPath.backup" -Force

    # Reemplazar puertos
    $configContent = $configContent -replace "port = 54321", "port = 54331"
    $configContent = $configContent -replace "port = 54322", "port = 54332"
    $configContent = $configContent -replace "shadow_port = 54320", "shadow_port = 54333"
    $configContent = $configContent -replace "port = 54323", "port = 54343"
    $configContent = $configContent -replace "port = 54324", "port = 54334"
    $configContent = $configContent -replace "smtp_port = 54325", "smtp_port = 54335"
    $configContent = $configContent -replace "pop3_port = 54326", "pop3_port = 54336"

    Set-Content $configPath $configContent
    Write-Host "   ✅ Puertos configurados (54331/54332)" -ForegroundColor Green
}
Write-Host ""

# Paso 4: Copiar migraciones
Write-Host "📋 Paso 4: Copiando migraciones..." -ForegroundColor Yellow
if ((Test-Path "supabase-test\migrations") -and (Get-ChildItem "supabase-test\migrations" -ErrorAction SilentlyContinue)) {
    Write-Host "   ⚠️  Migraciones ya existen. Saltando..." -ForegroundColor DarkYellow
} else {
    if (-not (Test-Path "supabase-test\migrations")) {
        New-Item -ItemType Directory -Path "supabase-test\migrations" | Out-Null
    }
    Copy-Item "supabase\migrations\*" "supabase-test\migrations\" -Recurse -Force
    Write-Host "   ✅ Migraciones copiadas" -ForegroundColor Green
}
Write-Host ""

# Paso 5: Crear .env.test desde .env.test.example
Write-Host "📝 Paso 5: Creando .env.test..." -ForegroundColor Yellow
if (Test-Path ".env.test") {
    Write-Host "   ⚠️  .env.test ya existe. Saltando..." -ForegroundColor DarkYellow
} else {
    Copy-Item ".env.test.example" ".env.test"
    Write-Host "   ✅ .env.test creado desde .env.test.example" -ForegroundColor Green
    Write-Host "   ℹ️  Revisa y ajusta los valores en .env.test si es necesario" -ForegroundColor Cyan
}
Write-Host ""

# Paso 6: Iniciar Supabase de test
Write-Host "🚀 Paso 6: Iniciando Supabase de test..." -ForegroundColor Yellow
Set-Location supabase-test
npx supabase start
Set-Location ..
Write-Host ""

# Paso 7: Verificar configuración
Write-Host "✅ Paso 7: Verificando configuración..." -ForegroundColor Yellow
npm run test:verify
Write-Host ""

# Resumen
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Configuración completada exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Resumen:"
Write-Host "   • Supabase de DESARROLLO: http://localhost:54321 (puertos 54321/54322)"
Write-Host "   • Supabase de TEST:       http://localhost:54331 (puertos 54331/54332)"
Write-Host ""
Write-Host "🎯 Próximos pasos:"
Write-Host "   • Ejecutar tests:  npm test"
Write-Host "   • Ver status:      npm run supabase:test:status"
Write-Host "   • Detener test:    npm run supabase:test:stop"
Write-Host ""
Write-Host "📖 Más información en: TESTING-LOCAL-SETUP.md"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
