import { UnauthorizedError } from '@helper/errors';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { verifyAccessToken } from 'api/helper/JWT';
import { SessionRepository } from 'api/src/session/repository/session.repository';
import { AuthRepository } from 'api/src/auth/repository/auth.repository';
import { parseUser } from 'api/src/user/helper/parseUser';
import { SESSION_CONFIG } from 'api/src/config/session.config';
const sessionRepository = new SessionRepository();
const authRepository = new AuthRepository();
/**
 * Session-based authentication middleware
 * Validates JWT access token and session in database with sliding window
 *
 * Features:
 * - Validates access token JWT
 * - Checks session in database (is_active, expires_at)
 * - Updates last_activity_at (sliding window: 4 hours)
 * - Gets fresh user data from database
 * - Attaches user and organization_id to request
 */
export const isAuthenticated = asyncHandler(async (req, res, next) => {
    const accessToken = req.cookies[SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME];
    if (!accessToken) {
        throw new UnauthorizedError('No autenticado - token no encontrado');
    }
    // 1. Verify access token JWT
    let decoded;
    try {
        decoded = verifyAccessToken(accessToken);
    }
    catch {
        throw new UnauthorizedError('Token de acceso inválido');
    }
    // 2. Verify session in database
    const session = await sessionRepository.getById(decoded.session_id);
    if (!session || !session.is_active) {
        throw new UnauthorizedError('Sesión inválida o expirada');
    }
    // 3. Check if session expired
    if (new Date() > session.expires_at) {
        await sessionRepository.revoke(session.session_id, 'expired');
        throw new UnauthorizedError('Sesión expirada');
    }
    // 4. Update session activity (sliding window)
    // This extends the session expiration by INACTIVITY_TIMEOUT (4 hours)
    // respecting the ABSOLUTE_TIMEOUT (30 days) limit
    await sessionRepository.updateActivity(session.session_id);
    // 5. Get fresh user data from database
    const userData = await authRepository.getUserById(decoded.user_id);
    // 6. Attach user to request
    req.user = {
        user: parseUser(userData),
        session_id: session.session_id,
        organization_id: session.organization_id,
    };
    req.organization_id = session.organization_id;
    next();
});
/**
 * Helper function to get session info from request
 * Useful for controllers that need session details
 */
export const getSessionInfo = (req) => {
    if (!req.user) {
        throw new UnauthorizedError('No active session');
    }
    return {
        user_id: req.user.user.user_id,
        session_id: req.user.session_id,
        organization_id: req.user.organization_id,
        user_type: req.user.user.user_type,
    };
};
