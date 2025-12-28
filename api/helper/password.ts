import bcrypt from 'bcrypt';
import { SESSION_CONFIG } from 'api/src/config/session.config';

/**
 * Hash a password using bcrypt
 * @param password - Plain text password to hash
 * @returns Bcrypt hash of the password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SESSION_CONFIG.BCRYPT_ROUNDS);
};

/**
 * Compare a plain text password with a hash
 * @param password - Plain text password to compare
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches hash, false otherwise
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate a random password (for password resets)
 * @param length - Length of password to generate (default: 12)
 * @returns Random password string
 */
export const generateRandomPassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Validate password strength (basic validation)
 * @param password - Password to validate
 * @returns Object with validation result and error messages
 */
export const validatePasswordStrength = (
  password: string
): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
