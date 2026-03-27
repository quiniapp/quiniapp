/**
 * Hash a password using bcrypt
 * @param password - Plain text password to hash
 * @returns Bcrypt hash of the password
 */
export declare const hashPassword: (password: string) => Promise<string>;
/**
 * Compare a plain text password with a hash
 * @param password - Plain text password to compare
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches hash, false otherwise
 */
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
/**
 * Generate a random password (for password resets)
 * @param length - Length of password to generate (default: 12)
 * @returns Random password string
 */
export declare const generateRandomPassword: (length?: number) => string;
/**
 * Validate password strength (basic validation)
 * @param password - Password to validate
 * @returns Object with validation result and error messages
 */
export declare const validatePasswordStrength: (password: string) => {
  valid: boolean;
  errors: string[];
};
