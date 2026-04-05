/**
 * Script de verificación del entorno de testing
 *
 * Ejecutar con: npx tsx scripts/verify-test-env.ts
 *
 * Verifica:
 * - Conexión a Supabase
 * - Tablas necesarias existen
 * - Variables de entorno configuradas
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Cargar variables de entorno
dotenv.config();

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET_ACCESS',
  'JWT_SECRET_REFRESH',
];

const REQUIRED_TABLES = [
  'organizations',
  'users',
  'schedules',
  'lotteries',
  'schedule_lotteries',
  'tickets',
  'bets',
  'results',
  'current_accounts',
];

async function main() {
  console.log('🔍 Verificando configuración del entorno de testing...\n');

  let hasErrors = false;

  // 1. Verificar variables de entorno
  console.log('📋 Verificando variables de entorno:');
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (!value) {
      console.log(`  ❌ ${envVar}: NO CONFIGURADA`);
      hasErrors = true;
    } else {
      const masked = value.substring(0, 10) + '...';
      console.log(`  ✅ ${envVar}: ${masked}`);
    }
  }

  console.log('');

  // 2. Determinar qué credenciales usar
  const supabaseEnv = process.env.SUPABASE_ENVIROMENT || 'REMOTE';
  const supabaseUrl =
    supabaseEnv === 'LOCAL' ? process.env.SUPABASE_URL_LOCAL : process.env.SUPABASE_URL;
  const supabaseKey =
    supabaseEnv === 'LOCAL'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL
      : process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`🔗 Conectando a Supabase (${supabaseEnv}):`);
  console.log(`   URL: ${supabaseUrl}`);

  if (!supabaseUrl || !supabaseKey) {
    console.log('  ❌ Credenciales de Supabase no configuradas\n');
    process.exit(1);
  }

  // 3. Crear cliente de Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 4. Verificar conexión
  try {
    const { error } = await supabase.from('organizations').select('count').limit(1);

    if (error) {
      console.log(`  ❌ Error conectando: ${error.message}\n`);
      hasErrors = true;
    } else {
      console.log('  ✅ Conexión exitosa\n');
    }
  } catch (err: any) {
    console.log(`  ❌ Error de conexión: ${err.message}\n`);
    hasErrors = true;
  }

  // 5. Verificar tablas
  console.log('📊 Verificando tablas necesarias:');
  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);

      if (error) {
        console.log(`  ❌ ${table}: ${error.message}`);
        hasErrors = true;
      } else {
        console.log(`  ✅ ${table}`);
      }
    } catch (err: any) {
      console.log(`  ❌ ${table}: ${err.message}`);
      hasErrors = true;
    }
  }

  console.log('');

  // 6. Verificar migraciones aplicadas (contar registros en tablas críticas)
  console.log('🔄 Verificando estado de la base de datos:');

  try {
    // Intentar crear una organización de prueba temporal
    const testOrgId = randomUUID();
    const { error: insertError } = await supabase
      .from('organizations')
      .insert({ organization_id: testOrgId, name: `__TEST_VERIFY_${Date.now()}` });

    if (insertError) {
      console.log(`  ⚠️  No se puede insertar: ${insertError.message}`);
      console.log('     Esto podría indicar permisos insuficientes o migraciones pendientes');
    } else {
      console.log('  ✅ Permisos de escritura: OK');

      // Limpiar
      await supabase.from('organizations').delete().eq('organization_id', testOrgId);
    }
  } catch (err: any) {
    console.log(`  ❌ Error verificando permisos: ${err.message}`);
    hasErrors = true;
  }

  console.log('');

  // 7. Resumen final
  if (hasErrors) {
    console.log('❌ Se encontraron errores en la configuración.');
    console.log('\n📖 Consulta el archivo TESTING-SETUP.md para instrucciones de configuración.\n');
    process.exit(1);
  } else {
    console.log('✅ ¡Entorno de testing configurado correctamente!');
    console.log('\n▶️  Puedes ejecutar los tests con: npm test\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
