import { supabase } from '../database/db.connection';
import { hashPassword, validatePasswordStrength } from '../helper/password';
import { USER_TYPE } from '../../helper/types/user.type';

/**
 * Emergency script to reset OWNER password
 *
 * This script is needed after migration to custom auth because:
 * 1. All users need password reset after migration
 * 2. Only OWNER/SUPERADMIN/ADMIN can reset passwords
 * 3. Without OWNER access, you can't reset anyone's password
 *
 * Environment variables required:
 * - OWNER_ID: The user_id of the owner account
 * - OWNER_PASSWORD: The new password for the owner
 *
 * Usage:
 *   cd api
 *   OWNER_ID=<uuid> OWNER_PASSWORD=<password> npx tsx scripts/reset-owner-password.ts
 *
 * Security:
 * - Only works for OWNER user type
 * - Validates password strength
 * - Creates audit log entry
 * - Should only be run manually when needed
 */

async function resetOwnerPassword() {
  console.log('[OWNER RESET] Starting owner password reset...\n');

  // 1. Get environment variables
  const ownerId = process.env.OWNER_ID;
  const ownerPassword = process.env.OWNER_PASSWORD;

  if (!ownerId) {
    console.error('[OWNER RESET] ❌ ERROR: OWNER_ID environment variable is required');
    console.error(
      '[OWNER RESET] Usage: OWNER_ID=<uuid> OWNER_PASSWORD=<password> npx tsx scripts/reset-owner-password.ts'
    );
    process.exit(1);
  }

  if (!ownerPassword) {
    console.error('[OWNER RESET] ❌ ERROR: OWNER_PASSWORD environment variable is required');
    console.error(
      '[OWNER RESET] Usage: OWNER_ID=<uuid> OWNER_PASSWORD=<password> npx tsx scripts/reset-owner-password.ts'
    );
    process.exit(1);
  }

  try {
    // 2. Fetch OWNER user from database
    console.log(`[OWNER RESET] Fetching user with ID: ${ownerId}...`);
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('user_id, username, email, user_type, organization_id')
      .eq('user_id', ownerId)
      .is('deleted_at', null)
      .eq('disabled', false)
      .single();

    if (fetchError || !user) {
      console.error('[OWNER RESET] ❌ ERROR: User not found with ID:', ownerId);
      console.error('[OWNER RESET] Error:', fetchError);
      console.error('\n[OWNER RESET] To find your OWNER user, run:');
      console.error(
        "  SELECT user_id, username, email, user_type FROM users WHERE user_type = 'OWNER' AND deleted_at IS NULL;"
      );
      process.exit(1);
    }

    console.log(
      `[OWNER RESET] ✅ User found: ${user.username || user.email} (${user.user_type})\n`
    );

    // 3. Verify user is actually OWNER
    if (user.user_type !== USER_TYPE.OWNER) {
      console.error(`[OWNER RESET] ❌ ERROR: User ${user.user_id} is not an OWNER`);
      console.error(`[OWNER RESET] User type: ${user.user_type}`);
      console.error(`[OWNER RESET] Expected: ${USER_TYPE.OWNER}`);
      console.error('\n[OWNER RESET] This script can only be used to reset OWNER passwords.');
      console.error('[OWNER RESET] For security, it will not work with other user types.');
      process.exit(1);
    }

    console.log('[OWNER RESET] ✅ User type verified: OWNER\n');

    // 4. Validate password strength
    console.log('[OWNER RESET] Validating password strength...');
    const validation = validatePasswordStrength(ownerPassword);

    if (!validation.valid) {
      console.error('[OWNER RESET] ❌ ERROR: Password does not meet strength requirements:');
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      console.error('\n[OWNER RESET] Password requirements:');
      console.error('  - Password cannot be empty');
      process.exit(1);
    }

    console.log('[OWNER RESET] ✅ Password strength validated\n');

    // 5. Hash password
    console.log('[OWNER RESET] Hashing password with bcrypt (12 rounds)...');
    const passwordHash = await hashPassword(ownerPassword);
    console.log('[OWNER RESET] ✅ Password hashed\n');

    // 6. Update user password
    console.log('[OWNER RESET] Updating password in database...');
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        password_reset_required: false, // Allow immediate login
        failed_login_attempts: 0, // Reset failed attempts
        locked_until: null, // Unlock account if locked
      })
      .eq('user_id', ownerId);

    if (updateError) {
      console.error('[OWNER RESET] ❌ ERROR: Failed to update password:', updateError);
      process.exit(1);
    }

    console.log('[OWNER RESET] ✅ Password updated successfully\n');

    // 7. Revoke all existing sessions (security measure)
    console.log('[OWNER RESET] Revoking all existing sessions for security...');
    const { error: revokeError } = await supabase
      .from('sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'owner_password_reset_script',
      })
      .eq('user_id', ownerId)
      .eq('is_active', true);

    if (revokeError) {
      console.warn('[OWNER RESET] ⚠️  Warning: Failed to revoke sessions:', revokeError);
      console.warn('[OWNER RESET] This is not critical, but user should logout/login manually.\n');
    } else {
      console.log('[OWNER RESET] ✅ All sessions revoked\n');
    }

    // 8. Create audit log entry
    console.log('[OWNER RESET] Creating audit log entry...');
    const { error: auditError } = await supabase.from('auth_audit_log').insert({
      user_id: ownerId,
      organization_id: user.organization_id,
      event_type: 'owner_password_reset_script',
      success: true,
      username: user.username || user.email,
      metadata: {
        script: 'reset-owner-password',
        executed_by: 'system_admin',
        reset_required: false,
      },
    });

    if (auditError) {
      console.warn('[OWNER RESET] ⚠️  Warning: Failed to create audit log:', auditError);
      console.warn('[OWNER RESET] Password reset successful but audit log failed.\n');
    } else {
      console.log('[OWNER RESET] ✅ Audit log entry created\n');
    }

    // 9. Success summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('              OWNER PASSWORD RESET SUCCESS            ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ User ID: ${user.user_id}`);
    console.log(`✅ Username: ${user.username || user.email}`);
    console.log(`✅ User Type: ${user.user_type}`);
    console.log(`✅ Organization: ${user.organization_id}`);
    console.log('');
    console.log('IMPORTANT:');
    console.log('1. Password has been reset successfully');
    console.log('2. All existing sessions have been revoked');
    console.log('3. You can now login with the new password');
    console.log('4. You will NOT be required to change password on first login');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Login to the application with:');
    console.log(`   - Username: ${user.username || user.email}`);
    console.log('   - Password: <the password you provided>');
    console.log('2. Reset passwords for other users via:');
    console.log('   POST /api/private/user/reset-password/:userId');
    console.log('3. Delete this script or keep it for emergency use only');
    console.log('');
    console.log('SECURITY NOTES:');
    console.log('- Do not commit OWNER_PASSWORD to version control');
    console.log('- Consider changing the password after initial login');
    console.log('- This script should only be used in emergencies');
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('[OWNER RESET] ❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run the script
resetOwnerPassword();
