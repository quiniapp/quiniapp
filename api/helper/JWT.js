import { JWT_SECRET_ACCESS, JWT_SECRET_REFRESH } from 'api/envs';
import jwt from 'jsonwebtoken';
import { SESSION_CONFIG } from 'api/src/config/session.config';
/**
 * Sign a new access token (15 minutes expiration)
 */
export const signAccessToken = (userId, username, userType, sessionId, organizationId) => {
    const payload = {
        user_id: userId,
        username,
        user_type: userType,
        session_id: sessionId,
        organization_id: organizationId,
        type: 'access',
    };
    return jwt.sign(payload, String(JWT_SECRET_ACCESS), {
        expiresIn: String(SESSION_CONFIG.JWT_ACCESS_EXPIRATION),
    });
};
/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, String(JWT_SECRET_ACCESS));
        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }
        return decoded;
    }
    catch {
        throw new Error('Invalid access token');
    }
};
/**
 * Sign a new refresh token (30 days expiration)
 */
export const signRefreshToken = (userId, sessionId, tokenVersion) => {
    const payload = {
        user_id: userId,
        session_id: sessionId,
        token_version: tokenVersion,
        type: 'refresh',
    };
    return jwt.sign(payload, String(JWT_SECRET_REFRESH), {
        expiresIn: String(SESSION_CONFIG.JWT_REFRESH_EXPIRATION),
    });
};
/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, String(JWT_SECRET_REFRESH));
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        return decoded;
    }
    catch {
        throw new Error('Invalid refresh token');
    }
};
// Legacy functions removed in Phase 5
// Migration to custom JWT session system completed
