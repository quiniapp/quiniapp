#!/bin/bash

# Script de configuración automática del entorno de test
# Ejecutar: bash scripts/setup-test-env.sh

set -e

echo "🚀 Configurando entorno de test para QuiniApp..."
echo ""

# Paso 1: Crear directorio supabase-test
echo "📁 Paso 1: Creando directorio supabase-test..."
if [ -d "supabase-test" ]; then
  echo "   ⚠️  El directorio supabase-test ya existe. Saltando..."
else
  mkdir supabase-test
  echo "   ✅ Directorio creado"
fi
echo ""

# Paso 2: Inicializar Supabase en el directorio de test
echo "🔧 Paso 2: Inicializando Supabase en supabase-test..."
cd supabase-test
if [ -f "config.toml" ]; then
  echo "   ⚠️  config.toml ya existe. Saltando inicialización..."
else
  npx supabase init
  echo "   ✅ Supabase inicializado"
fi
cd ..
echo ""

# Paso 3: Configurar puertos en config.toml
echo "⚙️  Paso 3: Configurando puertos en config.toml..."
if grep -q "port = 54331" supabase-test/config.toml; then
  echo "   ⚠️  Puertos ya configurados. Saltando..."
else
  # Backup del config original
  cp supabase-test/config.toml supabase-test/config.toml.backup

  # Reemplazar puertos
  sed -i 's/port = 54321/port = 54331/' supabase-test/config.toml
  sed -i 's/port = 54322/port = 54332/' supabase-test/config.toml
  sed -i 's/shadow_port = 54320/shadow_port = 54333/' supabase-test/config.toml
  sed -i 's/port = 54323/port = 54343/' supabase-test/config.toml
  sed -i 's/port = 54324/port = 54334/' supabase-test/config.toml
  sed -i 's/smtp_port = 54325/smtp_port = 54335/' supabase-test/config.toml
  sed -i 's/pop3_port = 54326/pop3_port = 54336/' supabase-test/config.toml

  echo "   ✅ Puertos configurados (54331/54332)"
fi
echo ""

# Paso 4: Copiar migraciones
echo "📋 Paso 4: Copiando migraciones..."
if [ -d "supabase-test/migrations" ] && [ "$(ls -A supabase-test/migrations)" ]; then
  echo "   ⚠️  Migraciones ya existen. Saltando..."
else
  mkdir -p supabase-test/migrations
  cp -r supabase/migrations/* supabase-test/migrations/
  echo "   ✅ Migraciones copiadas"
fi
echo ""

# Paso 5: Crear .env.test desde .env.test.example
echo "📝 Paso 5: Creando .env.test..."
if [ -f ".env.test" ]; then
  echo "   ⚠️  .env.test ya existe. Saltando..."
else
  cp .env.test.example .env.test
  echo "   ✅ .env.test creado desde .env.test.example"
  echo "   ℹ️  Revisa y ajusta los valores en .env.test si es necesario"
fi
echo ""

# Paso 6: Iniciar Supabase de test
echo "🚀 Paso 6: Iniciando Supabase de test..."
cd supabase-test
npx supabase start
cd ..
echo ""

# Paso 7: Verificar configuración
echo "✅ Paso 7: Verificando configuración..."
npm run test:verify
echo ""

# Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuración completada exitosamente!"
echo ""
echo "📝 Resumen:"
echo "   • Supabase de DESARROLLO: http://localhost:54321 (puertos 54321/54322)"
echo "   • Supabase de TEST:       http://localhost:54331 (puertos 54331/54332)"
echo ""
echo "🎯 Próximos pasos:"
echo "   • Ejecutar tests:  npm test"
echo "   • Ver status:      npm run supabase:test:status"
echo "   • Detener test:    npm run supabase:test:stop"
echo ""
echo "📖 Más información en: TESTING-LOCAL-SETUP.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
