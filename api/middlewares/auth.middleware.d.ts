import { Request, Response, NextFunction } from 'express';
import { IUserEntityFront } from '@helper/types/user.type';
declare module 'express' {
  interface Request {
    user?: {
      user: IUserEntityFront;
      session_id: string;
      organization_id: string;
    };
    organization_id?: string;
  }
}
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
export declare const isAuthenticated: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Helper function to get session info from request
 * Useful for controllers that need session details
 */
export declare const getSessionInfo: (req: Request) => {
  user_id: string;
  session_id: string;
  organization_id: string;
  user_type: import('@helper/types/user.type').USER_TYPE;
};
