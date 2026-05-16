import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return next();
  }

  res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'CSRF validation failed',
    },
  });
};
