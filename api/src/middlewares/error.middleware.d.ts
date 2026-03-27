import { Request, Response, NextFunction } from 'express';
/**
 * Centralized error handling middleware
 * DEBE registrarse DESPUÉS de todas las rutas
 * IMPORTANTE: Necesita 4 parámetros (err, req, res, next) para que Express lo reconozca como error handler
 */
export declare const errorHandler: (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => void;
/**
 * Async error wrapper - elimina necesidad de try/catch
 * Uso: private handler = asyncHandler(async (req, res) => { ... })
 */
export declare const asyncHandler: (
  fn: Function
) => (req: Request, res: Response, next: NextFunction) => void;
