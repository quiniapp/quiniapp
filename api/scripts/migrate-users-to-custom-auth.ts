import { supabase } from '../database/db.connection';

/**
 * Migration script to set password_reset_required for all existing users
 * Run this ONCE after deploying the new schema
 *
 * This script marks all users without a password_hash as requiring a password reset.
 * Admins (OWNER, SUPERADMIN, ADMIN) will then need to reset passwords for these users.
 *
 * Usage:
 *   cd api
 *   npx tsx scripts/migrate-users-to-custom-auth.ts
 */
async function migrateUsers() {
  console.log('[MIGRATION] Starting user migration to custom auth...\n');

  try {
    // 1. Get all active users without password_hash
    console.log('[MIGRATION] Fetching users without password_hash...');
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('user_id, username, email, user_type')
      .is('deleted_at', null)
      .eq('disabled', false)
      .is('password_hash', null);

    if (fetchError) {
      console.error('[MIGRATION] ❌ Error fetching users:', fetchError);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('[MIGRATION] ✅ No users found without password_hash. Migration not needed.');
      process.exit(0);
    }

    console.log(`[MIGRATION] Found ${users.length} users to migrate\n`);

    // Display users that will be migrated
    console.log('[MIGRATION] Users to be marked for password reset:');
    users.forEach((user, index) => {
      console.log(
        `  ${index + 1}. ${user.username || user.email} (${user.user_type}) - ID: ${user.user_id}`
      );
    });
    console.log('');

    // 2. Set password_reset_required = true for all users without password_hash
    console.log('[MIGRATION] Setting password_reset_required = true...');
    const { error: updateError, count } = await supabase
      .from('users')
      .update({
        password_reset_required: true,
      })
      .is('deleted_at', null)
      .eq('disabled', false)
      .is('password_hash', null);

    if (updateError) {
      console.error('[MIGRATION] ❌ Error updating users:', updateError);
      process.exit(1);
    }

    console.log(`[MIGRATION] ✅ Successfully updated ${count || users.length} users\n`);

    // 3. Create audit log entry
    console.log('[MIGRATION] Creating audit log entry...');
    const { error: auditError } = await supabase.from('auth_audit_log').insert({
      event_type: 'system_migration',
      success: true,
      username: 'system',
      metadata: {
        migration: 'supabase_to_custom_auth',
        timestamp: new Date().toISOString(),
        users_affected: users.length,
        description: 'Migrated to custom JWT authentication system',
      },
    });

    if (auditError) {
      console.warn('[MIGRATION] ⚠️  Warning: Failed to create audit log:', auditError);
      console.warn('[MIGRATION] Migration successful but audit log failed. Continuing...\n');
    } else {
      console.log('[MIGRATION] ✅ Audit log entry created\n');
    }

    // 4. Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('                  MIGRATION COMPLETE                   ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ ${users.length} users marked for password reset`);
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Admins (OWNER/SUPERADMIN/ADMIN) must reset passwords for all users');
    console.log('2. Use the endpoint: POST /api/private/user/reset-password/:id');
    console.log('3. Users will be required to change their password on first login');
    console.log('');
    console.log('Example API call to reset password:');
    console.log('  POST /api/private/user/reset-password/:userId');
    console.log('  Body: { "newPassword": "optional" } (if not provided, generates random)');
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] ❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run migration
migrateUsers();
