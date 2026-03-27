import { USER_TYPE, } from '@helper/types/user.type';
export const parseUser = (user) => {
    const base = {
        user_id: user.user_id,
        number: user.number,
        name: user.name,
        last_name: user.last_name,
        address: user.address,
        phone: user.phone,
        email: user.email,
        username: user.username,
        disabled: user.disabled,
        // Phase 5 fields (safe to send to frontend)
        failed_login_attempts: user.failed_login_attempts,
        locked_until: user.locked_until,
        last_login_at: user.last_login_at,
        last_login_ip: user.last_login_ip,
        // NOTE: password_hash, password_changed_at, password_reset_required are intentionally omitted for security
    };
    // Parse last session if exists (Supabase returns array, we take the first one which is already ordered)
    const last_session = user.sessions?.[0]
        ? { last_activity_at: user.sessions[0].last_activity_at }
        : undefined;
    if (user.user_type === USER_TYPE.CASHIER) {
        const cashierUser = {
            ...base,
            user_type: USER_TYPE.CASHIER,
            cashier_type: user.cashier_type,
            fee: user.fee,
            fee_plus: user.fee_plus,
        };
        // Add last session if exists
        return last_session ? { ...cashierUser, last_session } : cashierUser;
    }
    // Para OWNER, CAPITALIST, SUPERADMIN o ADMIN
    const adminUser = {
        ...base,
        user_type: user.user_type,
    };
    // Add last session if exists
    return last_session ? { ...adminUser, last_session } : adminUser;
};
