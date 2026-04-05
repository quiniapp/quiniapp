import { beforeAll, afterAll } from '@jest/globals';
import { supabase } from '../database/db.connection.js';

// Setup global antes de todos los tests
beforeAll(async () => {
  console.log('🚀 Iniciando suite de tests...');

  // SEGURIDAD: Verificar que estamos en modo TEST y LOCAL
  const nodeEnv = process.env.NODE_ENV;
  const supabaseEnv = process.env.SUPABASE_ENVIROMENT;

  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   SUPABASE_ENVIROMENT: ${supabaseEnv}`);

  if (nodeEnv !== 'test') {
    throw new Error(
      '❌ SEGURIDAD: NODE_ENV debe ser "test". ' +
        'Los tests solo deben ejecutarse en entorno de test. ' +
        'Usa: npm test (que configura NODE_ENV=test automáticamente)'
    );
  }

  if (supabaseEnv !== 'LOCAL') {
    throw new Error(
      '❌ SEGURIDAD: SUPABASE_ENVIROMENT debe ser "LOCAL". ' +
        'Los tests solo deben ejecutarse contra Supabase local. ' +
        'Configura SUPABASE_ENVIROMENT=LOCAL en .env.test'
    );
  }

  // Verificar que estamos usando el puerto correcto (54331 = test, NO 54321 = desarrollo)
  const supabaseUrl = process.env.SUPABASE_URL_LOCAL;
  if (!supabaseUrl?.includes('54331')) {
    console.warn(
      '⚠️  ADVERTENCIA: SUPABASE_URL_LOCAL no usa puerto 54331 (puerto de test). ' +
        `URL actual: ${supabaseUrl}. ` +
        'Verifica que estés usando el Supabase de test y no el de desarrollo.'
    );
  }

  console.log(`   Supabase URL: ${supabaseUrl}`);

  // Verificar conexión a Supabase
  const { error } = await supabase.from('organizations').select('count').limit(1);
  if (error) {
    throw new Error(`Error conectando a Supabase: ${error.message}`);
  }

  console.log('✓ Conexión a Supabase establecida');
  console.log('✓ Validaciones de seguridad pasadas');
});

// Cleanup después de todos los tests
afterAll(async () => {
  console.log('🧹 Limpiando recursos...');
  // Cerrar conexiones si es necesario
});
