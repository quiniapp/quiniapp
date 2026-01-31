import jwt from 'jsonwebtoken';

/**
 * Genera un token JWT para tests
 */
export function generateTestToken(userId: string, userType: string): string {
  const payload = {
    user_id: userId,
    user_type: userType,
  };

  return jwt.sign(payload, process.env.JWT_SECRET_ACCESS || 'test_access_secret_256_bit', {
    expiresIn: '1h',
  });
}

/**
 * Genera headers de autenticación para requests
 */
export function getAuthHeaders(userId: string, userType: string) {
  const token = generateTestToken(userId, userType);
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `access_token=${token}`,
  };
}
