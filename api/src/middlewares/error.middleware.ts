import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@helper/errors';
import { APIResponse } from '@helper/response/api_response.response';
import { logger } from '../utils/logger';
import { IS_PRODUCTION } from '../../envs';

/**
 * Centralized error handling middleware
 * DEBE registrarse DESPUÉS de todas las rutas
 */
export const errorHandler = (err: Error, req: Request, res: Response): void => {
  // Log completo del error para debugging
  logger.error('Error caught by middleware:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Manejar errores de validación Zod
  if (err instanceof ZodError) {
    const response: APIResponse<null> = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación en los datos enviados',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Manejar errores operacionales (AppError)
  if (err instanceof AppError) {
    const errorResponse: any = {
      code: err.errorCode,
      message: err.message,
    };
    if (err.details !== undefined) {
      errorResponse.details = err.details;
    }
    const response: APIResponse<null> = { error: errorResponse };
    res.status(err.statusCode).json(response);
    return;
  }

  // Manejar errores de Supabase/PostgreSQL
  if (err.name === 'PostgrestError' || (err as any).code?.startsWith('PGRST')) {
    logger.error('Database error:', err);
    const errorResponse: any = {
      code: 'DATABASE_ERROR',
      message: IS_PRODUCTION ? 'Error en la base de datos' : err.message,
    };
    if (!IS_PRODUCTION) {
      errorResponse.details = err;
    }
    const response: APIResponse<null> = { error: errorResponse };
    res.status(500).json(response);
    return;
  }

  // Error inesperado (programming error)
  logger.error('Unexpected error:', err);
  const errorResponse: any = {
    code: 'INTERNAL_SERVER_ERROR',
    message: IS_PRODUCTION ? 'Ocurrió un error inesperado' : err.message,
  };
  if (!IS_PRODUCTION) {
    errorResponse.details = { stack: err.stack };
  }
  const response: APIResponse<null> = { error: errorResponse };
  res.status(500).json(response);
};

/**
 * Async error wrapper - elimina necesidad de try/catch
 * Uso: private handler = asyncHandler(async (req, res) => { ... })
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
